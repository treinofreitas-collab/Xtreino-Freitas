const EVENTS = [
  ["Modo Liga", "modo-liga"],
  ["Acesso", "acesso"],
  ["Camp de Fases", "camp-fases"],
];

const DEFAULT_ORGANIZATION_LOGO_URL = "/assets/freefire-organizacao-logo.webp?v=logo-fallback-2";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const int = (value) => Number.isFinite(Number(value)) ? String(Math.trunc(Number(value))) : "—";
const call = (handlers, name, ...args) => {
  if (typeof handlers[name] === "function") handlers[name](...args);
};

const STYLES = `
.mr-view{--mr-ink:#182329;--mr-muted:#718087;--mr-line:#dce3dd;--mr-paper:#fbfcf8;--mr-orange:#f26a32;--mr-green:#087f78;--mr-teal:#00a99d;color:var(--mr-ink);font-family:'DM Sans',sans-serif;max-width:1560px;margin:0 auto 2rem}
.mr-view *{box-sizing:border-box}.mr-view button,.mr-view select,.mr-view input{font:inherit}
.mr-view .mr-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:1.4rem;padding:1.3rem 0 1.45rem;border-bottom:1px solid #d4ddd6;margin-bottom:1.2rem}
.mr-view .mr-eyebrow,.mr-view .mr-kicker{font:500 .64rem 'DM Mono',monospace;letter-spacing:.11em;text-transform:uppercase;color:#72827c}
.mr-view .mr-eyebrow{display:flex;align-items:center;gap:.55rem}.mr-view .mr-live-dot{width:7px;height:7px;background:var(--mr-teal);border-radius:50%;box-shadow:0 0 0 4px #dff3ed}
.mr-view h1{margin:.52rem 0 .25rem;font-size:clamp(1.9rem,4vw,2.8rem);line-height:1;font-weight:800;letter-spacing:-.055em;color:#182329}
.mr-view h1 em{font-style:normal;color:var(--mr-green)}.mr-view .mr-hero p{max-width:680px;margin:.55rem 0 0;color:#64736e;font-size:.86rem;line-height:1.55}
.mr-view .mr-proof{display:flex;align-items:center;gap:.65rem;max-width:260px;padding:.7rem .8rem;background:#e8f5f0;border:1px solid #cce8dc;border-radius:10px;color:#276558;font-size:.71rem;line-height:1.4}
.mr-view .mr-proof-mark{display:grid;place-items:center;flex:0 0 28px;height:28px;border-radius:8px;background:#087f78;color:white;font:700 .67rem 'DM Mono',monospace}
.mr-view .mr-layout{display:grid;grid-template-columns:minmax(0,1fr) 380px;align-items:start;gap:1rem}
.mr-view .mr-work{display:grid;gap:.9rem;min-width:0}.mr-view .mr-panel{min-width:0;padding:1.2rem;border:1px solid var(--mr-line);background:var(--mr-paper);border-radius:14px;box-shadow:0 2px 8px rgba(25,43,38,.035)}
.mr-view .mr-head{display:flex;align-items:flex-start;gap:.75rem;margin-bottom:1rem}.mr-view .mr-step{flex:0 0 2rem;height:2rem;display:grid;place-items:center;background:#f9e9df;color:#c65b30;border-radius:8px;font:500 .68rem 'DM Mono',monospace}
.mr-view .mr-head h2,.mr-view .mr-stand-head h2{margin:0;color:#1e2a2c;font-size:.98rem;font-weight:800;letter-spacing:-.02em}.mr-view .mr-head p{margin:.2rem 0 0;color:#7c8984;font-size:.73rem;line-height:1.45}
.mr-view .mr-config{display:grid;grid-template-columns:minmax(220px,1fr) minmax(190px,.7fr);gap:.8rem}
.mr-view .mr-config-mode-liga{grid-template-columns:minmax(220px,1fr) minmax(140px,.65fr) minmax(140px,.65fr)}
.mr-view .mr-field{display:flex;flex-direction:column;gap:.38rem;color:#65756e;font-size:.68rem;font-weight:700}
.mr-view .mr-roster-dropzone.ff-drop-target-active [data-roster-text]{border-color:#dc8052!important;background:#fffaf7!important;box-shadow:0 0 0 3px rgba(242,106,50,.14)!important}
.mr-view .mr-roster-controls{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-top:.65rem}
.mr-view .mr-roster-count{color:#72827a;font:500 .64rem 'DM Mono',monospace}
.mr-view .mr-purchase-logo-controls{display:flex;align-items:center;gap:.65rem;margin-top:.55rem}
.mr-view .mr-purchase-logo-controls button{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:32px;padding:.42rem .65rem;border:1px solid #c9ddd3;border-radius:7px;background:#f2faf6;color:#226b60;font-size:.66rem;font-weight:700;cursor:pointer}
.mr-view .mr-purchase-logo-controls button:hover:not(:disabled){background:#e7f5ee;border-color:#087f78}
.mr-view .mr-purchase-logo-controls button:disabled{opacity:.55;cursor:not-allowed}
.mr-view .mr-purchase-logo-status{color:#718078;font-size:.63rem;line-height:1.4}
.mr-view .mr-roster-help{margin:.55rem 0 0;color:#718078;font-size:.66rem;line-height:1.45}
.mr-view .mr-roster-error{margin:.45rem 0 0}
.mr-view .mr-roster-logo-status{margin:.55rem 0 0;color:#648075;font-size:.65rem;line-height:1.45}
.mr-view .mr-roster-grid-logos{grid-template-columns:repeat(2,minmax(0,1fr))}
.mr-view .mr-roster-row-logos{display:grid;grid-template-columns:29px 34px minmax(0,1fr) auto;align-items:center;gap:.42rem;min-width:0}
.mr-view .mr-roster-row-logos input{min-width:0;width:100%;border:1px solid #dce3dd;border-radius:8px;background:#fff;color:#253235;padding:.45rem .55rem;font-size:.72rem}
.mr-view .mr-roster-logo{display:block;width:34px;height:34px;object-fit:contain;border:1px solid #e2e9e2;border-radius:7px;background:#f7f8f5}
.mr-view .mr-logo-upload,.mr-view .mr-logo-reset{display:grid;place-items:center;width:30px;height:30px;border:1px solid #dce3dd;border-radius:7px;background:#fff;color:#087f78;cursor:pointer}
.mr-view .mr-logo-upload:hover,.mr-view .mr-logo-reset:hover{background:#edf7f2;border-color:#9dc8b5}
.mr-view .mr-logo-upload input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0)}
.mr-view .mr-logo-upload:focus-within,.mr-view .mr-logo-reset:focus-visible{outline:3px solid rgba(8,127,120,.22);outline-offset:2px}
.mr-view .mr-logo-actions{display:flex;align-items:center;gap:.25rem}
.mr-view .mr-logo-busy{color:#75847d;font-size:.58rem}
.mr-view .mr-standing-team{display:flex;align-items:center;gap:.42rem;min-width:0}
.mr-view .mr-standing-logo{width:24px;height:24px;flex:0 0 24px;object-fit:contain;border:1px solid #e2e9e2;border-radius:5px;background:#f7f8f5}
.mr-view .mr-standing-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mr-view select{min-width:0;width:100%;border:1px solid #dce3dd;border-radius:8px;background:#fff;color:#253235;padding:.62rem .7rem;font-size:.78rem}
.mr-view select:focus,.mr-view input:focus-visible,.mr-view button:focus-visible,.mr-view label.mr-upload:focus-within{outline:3px solid rgba(8,127,120,.22);outline-offset:2px;border-color:#087f78}
.mr-view .mr-drops{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
.mr-view .mr-drop{border:1px solid #dfe6df;border-radius:11px;background:#fff;overflow:hidden}
.mr-view .mr-drop-top{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.75rem .8rem;background:#f5f8f3;border-bottom:1px solid #e8ede7}
.mr-view .mr-drop-title{font-size:.79rem;font-weight:800;color:#23312f}.mr-view .mr-drop-num{font:500 .61rem 'DM Mono',monospace;letter-spacing:.08em;color:#89958d}
.mr-view .mr-drop-body{padding:.8rem}.mr-view .mr-file-row{display:flex;align-items:center;gap:.5rem;min-width:0}
.mr-view .mr-upload{display:inline-flex;align-items:center;justify-content:center;gap:.42rem;min-height:36px;padding:.5rem .7rem;border:1px dashed #8fbdb1;border-radius:8px;background:#f2faf6;color:#226b60;font-size:.7rem;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s}
.mr-view .mr-upload:hover{background:#e7f5ee;border-color:#087f78}.mr-view .mr-upload input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0)}
.mr-view .mr-clear{border:1px solid #e4c8c0;border-radius:6px;background:#fff8f5;color:#a55443;padding:.32rem .48rem;font-size:.62rem;font-weight:700;cursor:pointer}.mr-view .mr-clear:hover{background:#ffede6}
.mr-view .mr-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#697870;font-size:.68rem}
.mr-view .mr-file-empty{color:#9aa59d;font-style:italic}.mr-view .mr-drop-state{display:flex;align-items:center;gap:.4rem;margin:.72rem 0 .55rem;font-size:.66rem;font-weight:700}
.mr-view .mr-state-dot{width:7px;height:7px;border-radius:50%;background:#c2cec5}.mr-view .mr-status-ready .mr-state-dot{background:#178467}.mr-view .mr-status-warn .mr-state-dot{background:#d79825}.mr-view .mr-status-error .mr-state-dot{background:#c75449}
.mr-view .mr-status-ready{color:#22715b}.mr-view .mr-status-warn{color:#98701e}.mr-view .mr-status-error{color:#a7443d}.mr-view .mr-status-empty{color:#86938c}
.mr-view .mr-report{display:grid;gap:.35rem;margin:.45rem 0}.mr-view .mr-report-line{padding:.42rem .5rem;border-radius:7px;font-size:.66rem;line-height:1.4}
.mr-view .mr-report-error{background:#fff0ed;color:#a7443d;border:1px solid #f2d2ca}.mr-view .mr-report-warning{background:#fff8e8;color:#86651e;border:1px solid #f0e2b9}
.mr-view .mr-team-meta{color:#6e7e76;font-size:.67rem;margin:.4rem 0}.mr-view .mr-mini-table-wrap{max-height:180px;overflow:auto;border:1px solid #e7ece6;border-radius:7px}
.mr-view .mr-mini-table{width:100%;border-collapse:collapse;font-size:.65rem}.mr-view .mr-mini-table th{position:sticky;top:0;background:#f3f7f2;color:#74847b;text-align:left;font:500 .58rem 'DM Mono',monospace;letter-spacing:.06em}
.mr-view .mr-mini-table th,.mr-view .mr-mini-table td{padding:.38rem .45rem;border-bottom:1px solid #edf0eb}.mr-view .mr-mini-table td:nth-child(2){font-weight:700;color:#354540}.mr-view .mr-mini-table td:not(:nth-child(2)){font-family:'DM Mono',monospace}
.mr-view .mr-mini-table td:nth-child(2) small{display:block;margin-top:.15rem;color:#829087;font-size:.58rem;font-weight:500;line-height:1.35}
.mr-view .mr-empty-log{padding:.65rem .55rem;border:1px dashed #d8e2d9;border-radius:7px;color:#88958e;font-size:.68rem;line-height:1.45}
.mr-view .mr-review{display:flex;align-items:flex-start;gap:.5rem;margin-top:.7rem;padding:.55rem .6rem;border-radius:8px;background:#f2f6f1;color:#57685f;font-size:.67rem;line-height:1.4;cursor:pointer}
.mr-view .mr-review input{accent-color:#087f78;width:15px;height:15px;flex:0 0 auto;margin:0}
.mr-view .mr-template{display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.85rem;border:1px solid #cfe2d8;border-radius:10px;background:#eff7f1}
.mr-view .mr-template-copy{min-width:0}.mr-view .mr-template-name{display:block;margin-top:.18rem;color:#334a40;font-size:.75rem;font-weight:800;overflow-wrap:anywhere}
.mr-view .mr-template-hint{display:block;margin-top:.18rem;color:#71827a;font-size:.64rem;line-height:1.4}
.mr-view .mr-template-ready{color:#21775b}.mr-view .mr-template-missing{color:#98701e}
.mr-view .mr-standings{position:sticky;top:1rem}.mr-view .mr-stand-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.5rem;margin-bottom:.7rem}
.mr-view .mr-stand-head h2{font-size:1.08rem;margin-top:.18rem}.mr-view .mr-count{padding:.25rem .48rem;border-radius:6px;background:#e8f3ed;color:#26725f;font:500 .62rem 'DM Mono',monospace}
.mr-view .mr-score-key{display:flex;gap:.9rem;margin-bottom:.7rem;color:#75847d;font-size:.64rem}.mr-view .mr-score-key b{color:#087f78;font:700 .65rem 'DM Mono',monospace;margin-right:.18rem}
.mr-view .mr-table-scroll{max-height:590px;overflow:auto;border:1px solid #e0e7df;border-radius:9px;background:#fff}
.mr-view .mr-stand-table{width:100%;border-collapse:collapse}.mr-view .mr-stand-table th{position:sticky;top:0;z-index:1;padding:.55rem .42rem;background:#f0f5ef;color:#75847d;text-align:left;font:500 .59rem 'DM Mono',monospace;letter-spacing:.05em}
.mr-view .mr-stand-table th:first-child,.mr-view .mr-stand-table td:first-child{text-align:center;width:36px}.mr-view .mr-stand-table th:not(:nth-child(2)),.mr-view .mr-stand-table td:not(:nth-child(2)){text-align:right}
.mr-view .mr-stand-table td{padding:.48rem .42rem;border-bottom:1px solid #edf0eb;color:#43534d;font-size:.68rem}.mr-view .mr-stand-table tr:last-child td{border-bottom:0}
.mr-view .mr-stand-table td:nth-child(2){max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:#283832}
.mr-view .mr-stand-table td:first-child{font:500 .64rem 'DM Mono',monospace;color:#7d8d83}.mr-view .mr-stand-table tr:nth-child(-n+3) td:first-child{color:#087f78;font-weight:700}
.mr-view .mr-table-empty{padding:1rem .7rem!important;text-align:center!important;color:#88958e!important;font-size:.68rem!important;line-height:1.5}
.mr-view .mr-summary{margin:.7rem 0 0;padding:.7rem .75rem;border-left:3px solid #78afa0;background:#f1f7f1;color:#63756c;font-size:.68rem;line-height:1.45}
.mr-view .mr-export{width:100%;margin-top:.8rem;padding:.75rem .85rem;border:0;border-radius:9px;background:#087f78;color:#fff;font-weight:800;font-size:.77rem;cursor:pointer;transition:transform .15s,background .15s}
.mr-view .mr-export:not(:disabled):hover{background:#066a64;transform:translateY(-1px)}.mr-view .mr-export:disabled{background:#b8c7bf;color:#eef3ef;cursor:not-allowed}
.mr-view .mr-export-note{margin:.45rem 0 0;color:#85938b;font-size:.63rem;line-height:1.4}
@media(max-width:1020px){.mr-view .mr-layout{grid-template-columns:minmax(0,1fr) 330px}}
@media(max-width:780px){.mr-view .mr-hero{align-items:flex-start;flex-direction:column}.mr-view .mr-proof{max-width:none}.mr-view .mr-layout{grid-template-columns:1fr}.mr-view .mr-standings{position:static}.mr-view .mr-table-scroll{max-height:430px}.mr-view .mr-config-mode-liga{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:780px){.mr-view .mr-roster-grid-logos{grid-template-columns:1fr}}
@media(max-width:540px){.mr-view .mr-panel{padding:.9rem}.mr-view .mr-config,.mr-view .mr-drops{grid-template-columns:1fr}.mr-view .mr-template{align-items:flex-start;flex-direction:column}.mr-view .mr-file-row{align-items:flex-start;flex-direction:column}.mr-view .mr-upload{width:100%}}
`;

export function createMatchResultView(container, handlers = {}) {
  if (!container) throw new TypeError("container é obrigatório");

  const onChange = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.matches("[data-event]")) call(handlers, "onEventChange", target.value);
    else if (target.matches("[data-event-hour]")) call(handlers, "onEventHourChange", target.value);
    else if (target.matches("[data-drop-count]")) call(handlers, "onDropCountChange", Number(target.value));
    else if (target.matches("[data-review]")) call(handlers, "onDropReview", Number(target.dataset.review), target.checked);
    else if (target.matches("[data-roster-slot]")) {
      call(handlers, "onRosterSlotInput", Number(target.dataset.rosterSlot), target.value);
    }
    else if (target.matches("[data-roster-logo]")) {
      const file = target.files?.[0];
      if (file) call(handlers, "onRosterLogoFile", Number(target.dataset.rosterLogo), file);
      target.value = "";
    }
    else if (target.matches("[data-drop-file]")) {
      const file = target.files?.[0];
      if (file) call(handlers, "onDropFile", Number(target.dataset.dropFile), file);
      target.value = "";
    } else if (target.matches("[data-template-file]")) {
      const file = target.files?.[0];
      if (file) call(handlers, "onTemplateFile", file);
      target.value = "";
    } else if (target.matches("[data-roster-file]")) {
      const files = Array.from(target.files || []);
      if (files.length) call(handlers, "onRosterFiles", files);
      target.value = "";
    }
  };
  const onInput = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.matches("[data-roster-text]")) call(handlers, "onRosterTextInput", target.value);
  };
  const onClick = (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-clear-drop], [data-export], [data-export-top3], [data-roster-logo-reset], [data-import-purchase-logos]")
      : null;
    if (!target || !container.contains(target)) return;
    if (target.hasAttribute("data-clear-drop")) call(handlers, "onClearDrop", Number(target.dataset.clearDrop));
    else if (target.hasAttribute("data-roster-logo-reset")) {
      if (!target.disabled) call(handlers, "onRosterLogoReset", Number(target.dataset.rosterLogoReset));
    }
    else if (target.hasAttribute("data-import-purchase-logos")) {
      if (!target.disabled) call(handlers, "onImportPurchaseLogos");
    }
    else if (!target.disabled && target.hasAttribute("data-export-top3")) call(handlers, "onExportTop3");
    else if (!target.disabled && target.hasAttribute("data-export")) call(handlers, "onExport");
  };
  const onDragOver = (event) => {
    const dropzone = event.target instanceof Element ? event.target.closest("[data-roster-dropzone]") : null;
    const hasFile = Boolean(event.dataTransfer?.files?.length) ||
      Array.from(event.dataTransfer?.items || []).some(item => item.kind === "file");
    if (!dropzone || !hasFile) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    dropzone.classList.add("ff-drop-target-active");
  };
  const onDragLeave = (event) => {
    const dropzone = event.target instanceof Element ? event.target.closest("[data-roster-dropzone]") : null;
    if (dropzone && !dropzone.contains(event.relatedTarget)) dropzone.classList.remove("ff-drop-target-active");
  };
  const onDrop = (event) => {
    const dropzone = event.target instanceof Element ? event.target.closest("[data-roster-dropzone]") : null;
    if (!dropzone || !event.dataTransfer?.files?.length) return;
    event.preventDefault();
    dropzone.classList.remove("ff-drop-target-active");
    call(handlers, "onRosterFiles", Array.from(event.dataTransfer.files));
  };
  container.addEventListener("change", onChange);
  container.addEventListener("input", onInput);
  container.addEventListener("click", onClick);
  container.addEventListener("dragover", onDragOver);
  container.addEventListener("dragleave", onDragLeave);
  container.addEventListener("drop", onDrop);

  function render(state = {}) {
    const activeElement = typeof document !== "undefined" &&
      typeof container.contains === "function" &&
      container.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focusSelector = activeElement?.matches?.("[data-roster-text]")
      ? "[data-roster-text]"
      : activeElement?.matches?.("[data-roster-slot]")
        ? `[data-roster-slot="${activeElement.dataset.rosterSlot}"]`
        : "";
    const selectionStart = activeElement && "selectionStart" in activeElement ? activeElement.selectionStart : null;
    const selectionEnd = activeElement && "selectionEnd" in activeElement ? activeElement.selectionEnd : null;
    const eventType = EVENTS.some(([, key]) => key === state.eventType) ? state.eventType : "modo-liga";
    const eventHour = String(state.eventHour || "");
    const eventHours = Array.isArray(state.eventHours) ? state.eventHours : ["19", "20", "21", "22", "23", "00"];
    const dropCount = Math.max(1, Math.min(5, Math.trunc(Number(state.dropCount) || 1)));
    const drops = Array.isArray(state.drops) ? state.drops : [];
    const standings = Array.isArray(state.standings) ? state.standings : [];
    const template = state.template || {};
    const rosterText = String(state.rosterText ?? "");
    const rosterCount = Math.max(0, Math.trunc(Number(state.rosterCount) || 0));
    const rosterFileName = String(state.rosterFileName ?? "");
    const rosterDraft = Array.isArray(state.rosterDraft) ? state.rosterDraft : [];
    const rosterRows = Array.from({ length: 15 }, (_, index) => {
      const slot = index + 1;
      const team = rosterDraft.find(item => Number(item?.slot) === slot);
      if (eventType !== "modo-liga") {
        return `<label class="ff-roster-row"><span class="ff-slot">${String(slot).padStart(2, "0")}</span><input data-roster-slot="${slot}" aria-label="Equipe do slot ${slot}" value="${esc(team?.teamName || "")}" placeholder="Nome da equipe"></label>`;
      }
      const logo = team?.logoUrl || state.organizationLogoUrl || DEFAULT_ORGANIZATION_LOGO_URL;
      const logoControls = state.canManageLogos
        ? `<div class="mr-logo-actions">
            <label class="mr-logo-upload" title="Enviar logo personalizada para ${esc(team?.teamName || `o time ${slot}`)}" aria-label="Enviar logo personalizada para o slot ${slot}">
              <i class="fas ${team?.logoBusy ? "fa-spinner fa-spin" : "fa-upload"}" aria-hidden="true"></i>
              <input data-roster-logo="${slot}" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Logo do time no slot ${slot}" ${team?.logoBusy || !team?.teamName?.trim() ? "disabled" : ""}>
            </label>
            ${team?.logoSource === "custom" ? `<button class="mr-logo-reset" type="button" data-roster-logo-reset="${slot}" title="Usar logo Freitas como padrão para ${esc(team?.teamName || `o time ${slot}`)}" aria-label="Restaurar logo Freitas do slot ${slot}" ${team?.logoBusy || !team?.teamName?.trim() ? "disabled" : ""}><i class="fas fa-rotate-left" aria-hidden="true"></i></button>` : ""}
          </div>`
        : "";
      return `<div class="mr-roster-row-logos"><span class="ff-slot">${String(slot).padStart(2, "0")}</span>
        <img class="mr-roster-logo" src="${esc(logo)}" alt="${team?.logoSource === "spec" ? "Logo SPEC do slot" : team?.logoSource === "custom" ? "Logo personalizada" : team?.logoSource === "purchase" ? "Logo da compra" : "Logo padrão Freitas"}">
        <input data-roster-slot="${slot}" aria-label="Equipe do slot ${slot}" value="${esc(team?.teamName || "")}" placeholder="Nome da equipe">
        ${logoControls}</div>`;
    }).join("");
    const eventLabel = esc(state.eventLabel || EVENTS.find(([, key]) => key === eventType)?.[0] || "Evento");
    const dropCards = Array.from({ length: dropCount }, (_, index) => {
      const drop = drops.find((item) => Number(item?.index) === index) || {};
      const teams = Array.isArray(drop.teams) ? drop.teams : [];
      const errors = Array.isArray(drop.errors) ? drop.errors : [];
      const warnings = Array.isArray(drop.warnings) ? drop.warnings : [];
      const loaded = Boolean(drop.fileName);
      const status = !loaded ? "empty" : errors.length ? "error" : warnings.length ? "warn" : "ready";
      const statusText = !loaded ? "Aguardando arquivo" : errors.length ? `${errors.length} ponto${errors.length === 1 ? "" : "s"} para corrigir` : warnings.length ? `${warnings.length} aviso${warnings.length === 1 ? "" : "s"} para revisar` : "Log validado";
      const report = [
        ...errors.map((item) => `<div class="mr-report-line mr-report-error">${esc(item)}</div>`),
        ...warnings.map((item) => `<div class="mr-report-line mr-report-warning">${esc(item)}</div>`),
      ].join("");
       const teamRows = teams.map((team) => `<tr><td>${int(team.rank)}</td><td title="${esc(team.teamName)}"><strong>${esc(team.teamName || "Equipe sem nome")}</strong><small>${esc(team.slotLabel || "")} · MatchResult: ${esc(team.sourceTeamName || team.teamName || "—")}</small></td><td>${int(team.kills)}</td><td>${int(team.playerCount)}</td></tr>`).join("");
       const ignoredCount = Array.isArray(drop.ignoredTeams) ? drop.ignoredTeams.length : 0;
      return `<article class="mr-drop">
        <div class="mr-drop-top"><div><span class="mr-drop-num">LOG ${String(index + 1).padStart(2, "0")}</span><div class="mr-drop-title">Queda ${index + 1}</div></div>
          ${loaded ? `<button type="button" class="mr-clear" data-clear-drop="${index}" aria-label="Remover log da queda ${index + 1}">Remover</button>` : ""}
        </div>
        <div class="mr-drop-body">
          <div class="mr-file-row"><label class="mr-upload">Selecionar log<input data-drop-file="${index}" type="file" accept=".log,.txt,text/plain" aria-label="Selecionar log de texto da queda ${index + 1}"></label>
            <span class="mr-file-name ${loaded ? "" : "mr-file-empty"}" title="${esc(drop.fileName || "")}">${loaded ? esc(drop.fileName) : "Nenhum arquivo selecionado"}</span></div>
          <div class="mr-drop-state mr-status-${status}"><span class="mr-state-dot" aria-hidden="true"></span>${statusText}</div>
          ${loaded ? `<div class="mr-team-meta">${teams.length} de 15 equipes vinculadas${ignoredCount ? ` · ${ignoredCount} ignorada(s)` : ""}${drop.reviewed ? " · revisão confirmada" : ""}</div>${report ? `<div class="mr-report" aria-live="polite">${report}</div>` : ""}${teams.length ? `<div class="mr-mini-table-wrap"><table class="mr-mini-table"><thead><tr><th>POS.</th><th>SLOT / EQUIPE</th><th>ABATES</th><th>JOG.</th></tr></thead><tbody>${teamRows}</tbody></table></div>` : `<div class="mr-empty-log">Nenhuma equipe da lista oficial foi reconhecida neste arquivo. Confira os nomes antes de confirmar.</div>`}
            <label class="mr-review"><input type="checkbox" data-review="${index}" ${drop.reviewed ? "checked" : ""}><span>Revisei os abates e as associações aos slots oficiais.</span></label>` : `<div class="mr-empty-log">Envie o arquivo de texto MatchResult desta queda. Formatos aceitos: .log e .txt.</div>`}
        </div>
      </article>`;
    }).join("");
    const templateBlock = eventType !== "modo-liga" ? `<section class="mr-panel">
      <div class="mr-head"><div class="mr-step">04</div><div><h2>Modelo da tabela</h2><p>Envie o template em branco para compor o resultado final.</p></div></div>
      <div class="mr-template"><div class="mr-template-copy"><span class="mr-kicker">TEMPLATE · <span class="mr-template-missing">PENDENTE</span></span><span class="mr-template-name">${esc(template.name || "Modelo próprio aguardando envio")}</span><span class="mr-template-hint">A arte será configurada quando você enviar o modelo visual deste evento. A exportação fica bloqueada até essa etapa.</span></div></div>
    </section>` : "";
    const rows = standings.map((row) => {
      const teamCell = eventType === "modo-liga"
        ? `<span class="mr-standing-team"><img class="mr-standing-logo" src="${esc(row.logoUrl || state.organizationLogoUrl || "")}" alt=""><span class="mr-standing-name">${esc(row.teamName || "—")}</span></span>`
        : esc(row.teamName || "—");
      return `<tr><td>${int(row.rank)}</td><td title="${esc(row.teamName)}">${teamCell}</td><td>${int(row.wins)}</td><td>${int(row.kills)}</td><td><strong>${int(row.points)}</strong></td></tr>`;
    }).join("");

    container.innerHTML = `<style>${STYLES}</style><div class="mr-view">
      <header class="mr-hero"><div><div class="mr-eyebrow"><span class="mr-live-dot"></span>OPERAÇÕES / COMPETITIVO</div><h1>MatchResult <em>→ Placar</em></h1>
        <p>Converta os logs oficiais da partida em uma classificação verificada de 15 equipes. ${eventLabel} · confira cada queda antes de exportar.</p></div>
        <div class="mr-proof"><span class="mr-proof-mark">TXT</span><span>Use o log MatchResult em texto. Não precisa enviar fotos e nenhuma análise por IA é feita.</span></div>
      </header>
      <div class="mr-layout"><div class="mr-work">
        <section class="mr-panel"><div class="mr-head"><div class="mr-step">01</div><div><h2>Configurar apuração</h2><p>Defina o evento e quantas quedas entram no placar.</p></div></div>
          <div class="mr-config ${eventType === "modo-liga" ? "mr-config-mode-liga" : ""}"><label class="mr-field">Evento<select data-event aria-label="Evento">${EVENTS.map(([label, key]) => `<option value="${key}" ${eventType === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          ${eventType === "modo-liga" ? `<label class="mr-field">Horário do Modo Liga<select data-event-hour aria-label="Horário do Modo Liga"><option value="">Selecione o horário</option>${eventHours.map(hour => `<option value="${esc(hour)}" ${eventHour === hour ? "selected" : ""}>${esc(hour)}H</option>`).join("")}</select></label>` : ""}
          <label class="mr-field">Quantidade de quedas<select data-drop-count aria-label="Quantidade de quedas">${[1, 2, 3, 4, 5].map((count) => `<option value="${count}" ${dropCount === count ? "selected" : ""}>${count} ${count === 1 ? "queda" : "quedas"}</option>`).join("")}</select></label></div>
        </section>
        <section class="mr-panel"><div class="ff-panel-heading"><div class="ff-step">02</div><div><h2>Lista oficial de slots</h2><p>${eventType === "modo-liga" ? "Escolha o horário para buscar as logos SPEC pela letra do slot; logos por nome continuam como alternativa." : "Cole a lista com os 15 times desta apuração."}</p></div></div>
          <div class="mr-roster-dropzone" data-roster-dropzone>
            <label class="ff-field">Cole lista ou CSV <span class="ff-field-hint">Aceita também a lista decorada com letras/números estilizados</span><textarea data-roster-text rows="4" spellcheck="false" aria-label="Lista oficial com 15 equipes" placeholder="TIME A: Nome do time&#10;1, Nome do time&#10;⃟🩵 SLOT 01: Nome do time 🍀&#10;...">${esc(rosterText)}</textarea></label>
            <div class="ff-roster-actions"><label class="ff-button ff-button-light" for="mrRosterFile"><i class="fas fa-file-import" aria-hidden="true"></i> Importar ou arrastar lista</label><input id="mrRosterFile" data-roster-file type="file" accept=".csv,.txt,text/csv,text/plain" hidden><span class="ff-file-label" data-roster-file-label title="${esc(rosterFileName)}">${esc(rosterFileName || "Nenhum arquivo selecionado")}</span></div>
            <div class="mr-roster-count" data-roster-count>${rosterCount} / 15 slots preenchidos</div>
            ${eventType === "modo-liga" ? `<div class="mr-purchase-logo-controls">
              <button type="button" data-import-purchase-logos ${state.purchaseLogoBusy || !state.canImportPurchaseLogos ? "disabled" : ""} title="${state.canImportPurchaseLogos ? "Buscar logos nas inscrições pagas do Modo Liga" : "Preencha pelo menos um nome válido para habilitar a busca"}">
                <i class="fas ${state.purchaseLogoBusy ? "fa-spinner fa-spin" : "fa-store"}" aria-hidden="true"></i>
                ${state.purchaseLogoBusy ? "Buscando logos…" : state.purchaseLogoLoaded ? "Atualizar logos das compras" : "Buscar logos nas compras"}
              </button>
              <span class="mr-purchase-logo-status" role="status" aria-live="polite">${esc(state.purchaseLogoStatus || "As logos são buscadas automaticamente após inserir nomes; a associação usa os nomes dos times nas compras.")}</span>
            </div>` : ""}
            ${eventType === "modo-liga" ? `<p class="mr-roster-logo-status" role="status" aria-live="polite">${esc(state.specLogoStatus || "Selecione um horário para carregar as logos SPEC pela letra do slot.")}</p>` : ""}
            <div class="ff-roster-grid ${eventType === "modo-liga" ? "mr-roster-grid-logos" : ""}" data-roster-grid>${rosterRows}</div>
          </div>
          ${eventType === "modo-liga" ? `<p class="mr-roster-logo-status" role="status">${esc(state.logoStatus || "A logo Freitas é usada por padrão. Envie uma logo personalizada pelo ícone ao lado do time.")}</p>` : ""}
          ${state.rosterError ? `<div class="mr-report-line mr-report-error mr-roster-error" role="alert">${esc(state.rosterError)}</div>` : ""}
          <p class="ff-note mr-roster-help">Os slots aparecem automaticamente ao colar ou importar. Cortes e abreviações só são associados quando a correspondência é única; nomes ausentes ou ambíguos são sinalizados para revisão.</p>
        </section>
        <section class="mr-panel"><div class="mr-head"><div class="mr-step">03</div><div><h2>Logs por queda</h2><p>Um arquivo MatchResult em texto por queda. Revise também os nomes vinculados aos slots.</p></div></div><div class="mr-drops">${dropCards}</div></section>
        ${templateBlock}
      </div>
      <aside class="mr-panel mr-standings"><div class="mr-stand-head"><div><span class="mr-kicker">PRÉVIA · ${eventLabel}</span><h2>Classificação geral</h2></div><span class="mr-count">${standings.length} / 15 equipes</span></div>
        <div class="mr-score-key"><span><b>B!</b> Vitórias</span><span><b>A!</b> Abates</span><span><b>P!</b> Pontos</span></div>
        <p class="mr-summary">Por queda: pontos LBFF 2021 pela colocação + 1 por abate. Da 13ª à 15ª colocação, a pontuação de posição é 0.</p>
        <div class="mr-table-scroll"><table class="mr-stand-table"><thead><tr><th>#</th><th>Equipe</th><th>B!</th><th>A!</th><th>P!</th></tr></thead><tbody>${rows || `<tr><td class="mr-table-empty" colspan="5">A classificação aparecerá aqui após a leitura dos logs.</td></tr>`}</tbody></table></div>
        ${state.summary ? `<p class="mr-summary" data-summary>${esc(state.summary)}</p>` : ""}
        <button type="button" class="mr-export" data-export ${state.canExport ? "" : "disabled"}>Exportar imagem da classificação</button>
        <p class="mr-export-note" data-export-note aria-live="polite">${state.canExport ? "Apuração pronta para gerar a imagem final." : esc(state.summary || "Confirme os logs e verifique o modelo exigido para este evento antes de exportar.")}</p>
        ${eventType === "modo-liga" ? `<button type="button" class="mr-export mr-export-top3" data-export-top3 ${state.canExportTop3 ? "" : "disabled"}>Exportar banner Top 3</button>
        <p class="mr-export-note" data-export-top3-note aria-live="polite">${state.canExportTop3 ? "Mostra as logos dos três primeiros; sem logo SPEC ou personalizada, aparece o ponto de interrogação." : esc(state.summary || "Confirme os logs antes de exportar o banner Top 3.")}</p>` : ""}
      </aside></div></div>`;
    if (focusSelector) {
      const nextFocus = container.querySelector(focusSelector);
      if (nextFocus) {
        try { nextFocus.focus({ preventScroll: true }); } catch { nextFocus.focus(); }
        if (selectionStart !== null && selectionEnd !== null) {
          try { nextFocus.setSelectionRange(selectionStart, selectionEnd); } catch { /* non-text focus target */ }
        }
      }
    }
  }

  function destroy() {
    container.removeEventListener("change", onChange);
    container.removeEventListener("input", onInput);
    container.removeEventListener("click", onClick);
    container.removeEventListener("dragover", onDragOver);
    container.removeEventListener("dragleave", onDragLeave);
    container.removeEventListener("drop", onDrop);
    container.replaceChildren();
  }

  return { render, destroy };
}
