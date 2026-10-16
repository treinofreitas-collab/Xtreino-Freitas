const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const reportDate = value => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date instanceof Date && Number.isFinite(date.getTime())
    ? date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Data não informada";
};

const formatKind = kind => kind === "vacancy" ? "Vaga de equipe" : "Currículo de jogador";
let servicePromise;
let activeStatus = "open";
let isLoading = false;

async function getService() {
  const user = window.firebaseAuth?.currentUser;
  if (!user || !window.firebaseDb) throw new Error("Entre no painel administrativo para consultar as denúncias.");

  servicePromise ||= import("./mercado-da-bala-data.mjs").then(module =>
    module.createMercadoDaBalaService({ auth: window.firebaseAuth, db: window.firebaseDb })
  );
  const service = await servicePromise;
  const role = String(await service.getCurrentUserRole(user.uid) || "").toLowerCase();
  if (!["admin", "ceo"].includes(role)) throw new Error("Acesso reservado a administradores do Mercado da Bala.");
  return { service, user };
}

function reportCard(report, status) {
  const kind = report.kind === "vacancy" ? "vacancy" : "profile";
  const targetId = String(report.targetId || "");
  const decisionLabel = report.decision === "removed" ? "Conteúdo suspenso" : "Denúncia analisada";
  const pendingActions = status === "open" ? `
    <div class="flex flex-wrap gap-2 mt-4">
      <button type="button" class="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100"
        data-market-report-decision="approved" data-kind="${kind}" data-target-id="${escapeHtml(targetId)}" data-testid="button-keep-market-report-${escapeHtml(targetId)}">
        Manter publicação
      </button>
      <button type="button" class="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
        data-market-report-decision="removed" data-kind="${kind}" data-target-id="${escapeHtml(targetId)}" data-testid="button-remove-market-report-${escapeHtml(targetId)}">
        Suspender conteúdo
      </button>
    </div>` : `
    <div class="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
      <strong>${decisionLabel}</strong>
      ${report.decisionReason ? `<span class="block mt-1">${escapeHtml(report.decisionReason)}</span>` : ""}
    </div>`;

  return `<article class="mb-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid="card-market-report-${escapeHtml(report.id || targetId)}">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status === "open" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700"}">${status === "open" ? "Pendente" : "Analisada"}</span>
        <h4 class="mt-2 text-sm font-bold text-gray-900">${escapeHtml(report.targetName || "Conteúdo denunciado")}</h4>
        <p class="mt-1 text-xs text-gray-500">${formatKind(kind)} · ${reportDate(status === "open" ? report.createdAt : report.reviewedAt || report.createdAt)}</p>
      </div>
      <span class="max-w-full break-all font-mono text-[10px] text-gray-400">${escapeHtml(targetId)}</span>
    </div>
    <div class="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
      <p class="text-[10px] font-bold uppercase tracking-wide text-amber-900">Motivo informado</p>
      <p class="mt-1 whitespace-pre-line text-sm leading-6 text-gray-700">${escapeHtml(report.reason || "Sem justificativa informada.")}</p>
    </div>
    ${pendingActions}
  </article>`;
}

async function loadMarketReports(status = activeStatus) {
  const root = document.getElementById("marketReportsRoot");
  if (!root || isLoading) return;
  activeStatus = ["open", "resolved"].includes(status) ? status : "open";
  isLoading = true;
  root.innerHTML = '<div class="py-8 text-center text-sm text-gray-500">Carregando denúncias…</div>';
  document.querySelectorAll("[data-market-report-status]").forEach(button => {
    const selected = button.dataset.marketReportStatus === activeStatus;
    button.className = selected
      ? "market-report-filter px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold"
      : "market-report-filter px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50";
  });

  try {
    const { service, user } = await getService();
    const reports = await service.listModerationQueue(user.uid, activeStatus);
    root.innerHTML = reports.length
      ? `<div class="mb-3 text-xs text-gray-500">${reports.length} denúncia(s) ${activeStatus === "open" ? "aguardando análise" : "analisada(s)"}</div>${reports.map(report => reportCard(report, activeStatus)).join("")}`
      : `<div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
          <div class="text-sm font-semibold text-gray-800">${activeStatus === "open" ? "Nenhuma denúncia pendente" : "Nenhuma denúncia analisada"}</div>
          <p class="mt-1 text-xs text-gray-500">${activeStatus === "open" ? "As novas denúncias aparecerão aqui para revisão." : "As decisões tomadas serão listadas aqui."}</p>
        </div>`;
  } catch (error) {
    root.innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800">${escapeHtml(error.message || "Não foi possível carregar as denúncias.")}<button type="button" class="ml-3 underline" data-market-report-refresh>Tentar novamente</button></div>`;
  } finally {
    isLoading = false;
  }
}

async function decideReport(kind, targetId, decision) {
  const { service, user } = await getService();
  let reason = "";
  if (decision === "removed") {
    if (!window.confirm("Suspender este currículo ou vaga?")) return;
    reason = window.prompt("Informe o motivo da decisão:", "")?.trim() || "";
    if (!reason) {
      window.alert("Informe um motivo para registrar a suspensão.");
      return;
    }
  } else if (!window.confirm("Manter esta publicação e encerrar as denúncias pendentes sobre ela?")) {
    return;
  }

  await service.moderateContent(user.uid, { kind, targetId, status: decision, reason });
  window.showToast?.("success", decision === "removed" ? "Conteúdo suspenso e decisão registrada." : "Denúncia encerrada; conteúdo mantido.");
  await loadMarketReports(activeStatus);
}

document.addEventListener("click", async event => {
  const filter = event.target.closest("[data-market-report-status]");
  if (filter) {
    await loadMarketReports(filter.dataset.marketReportStatus);
    return;
  }

  if (event.target.closest("[data-market-report-refresh]") || event.target.closest("#marketReportsRefresh")) {
    await loadMarketReports(activeStatus);
    return;
  }

  const decision = event.target.closest("[data-market-report-decision]");
  if (!decision) return;
  decision.disabled = true;
  try {
    await decideReport(decision.dataset.kind, decision.dataset.targetId, decision.dataset.marketReportDecision);
  } catch (error) {
    window.showToast?.("error", error.message || "Não foi possível registrar a decisão.");
  } finally {
    decision.disabled = false;
  }
});

window.loadMarketReports = loadMarketReports;
