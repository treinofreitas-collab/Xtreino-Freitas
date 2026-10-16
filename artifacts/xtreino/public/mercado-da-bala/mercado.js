const PROFILE_ROLES = ["Rushador", "Suporte", "Fragger", "Capitão", "Coringa", "Reserva", "Coach", "Analista"];
const AVAILABILITY = {
  looking: "Procurando equipe", open: "Aberto a propostas", evaluating: "Em avaliação",
  unavailable: "Temporariamente indisponível", contracted: "Já contratado"
};
const APP_STATUS = {
  new: "Novo candidato", pending: "Novo candidato", reviewing: "Em análise",
  trial_scheduled: "Teste agendado", approved: "Aprovado", rejected: "Não selecionado",
  accepted: "Aprovado", not_selected: "Não selecionado", withdrawn: "Candidatura retirada"
};
const CONTACT_REQUEST_STATUS = {
  pending: "Aguardando resposta",
  accepted: "Contato compartilhado",
  declined: "Pedido recusado"
};
const appState = {
  service: null, user: null, role: "", profiles: [], vacancies: [], favorites: [],
  ownProfile: null, ownVacancies: [], applications: [], contactRequests: [], moderation: [],
  mode: "received", contactRequestMode: "received",
  loading: false, profileModalRequest: 0
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = "") => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const asText = value => Array.isArray(value) ? value.filter(Boolean).join(", ") : (value == null ? "" : String(value));
const list = value => Array.isArray(value) ? value : (value ? [value] : []);
const first = (item, keys, fallback = "") => {
  for (const key of keys) if (item?.[key] != null && item[key] !== "") return item[key];
  return fallback;
};
const recordId = item => first(item, ["uid", "id", "profileUid", "vacancyId", "targetId", "applicationId"], "");
const initials = name => (asText(name).trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("") || "MB").toUpperCase();
const safeUrl = value => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
};
const friendlyError = error => {
  const text = error?.message || String(error || "Erro inesperado");
  if (/permission|insufficient/i.test(text)) return "Sem permissão para esta ação. Confira se sua conta tem acesso e tente novamente.";
  if (/network|offline|unavailable/i.test(text)) return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  return text;
};
const publicListingError = error => /permission|insufficient/i.test(error?.message || String(error || ""))
  ? "O Firestore recusou a leitura. Confirme se as regras específicas do Mercado da Bala já foram aplicadas no Firebase."
  : friendlyError(error);

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 2800);
}

function showError(message, retry) {
  const box = $("#globalAlert");
  box.innerHTML = `<span>${esc(message)}</span>${retry ? '<button class="mb-button secondary small" type="button" data-action="retry">Tentar novamente</button>' : ""}`;
  box.classList.add("visible");
}
function clearError() { $("#globalAlert").classList.remove("visible"); }

function emptyState(title, detail, action = "") {
  return `<div class="mb-empty"><div class="mb-empty-mark">MB</div><h3>${esc(title)}</h3><p>${esc(detail)}</p>${action}</div>`;
}
function setPanel(panel) {
  $$(".mb-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === panel));
  $$(".mb-panel").forEach(section => section.classList.toggle("active", section.id === `panel-${panel}`));
  if (panel === "my-space") loadMySpace();
  if (panel === "applications") loadApplications();
  if (panel === "contact-requests") loadContactRequests();
  if (panel === "favorites") loadFavorites();
  if (panel === "moderation") loadModeration();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function signIn() {
  if (typeof window.openLoginModal === "function") {
    window.openLoginModal();
    return;
  }
  window.location.href = "../index.html?marketplaceLogin=1";
}
function requireUser() {
  if (appState.user) return true;
  toast("Entre na Plataforma Freitas para publicar ou se candidatar.");
  signIn();
  return false;
}
function normalizeResults(result, keys) {
  if (Array.isArray(result)) return result;
  for (const key of keys) if (Array.isArray(result?.[key])) return result[key];
  if (Array.isArray(result?.data)) return result.data;
  return [];
}
function profileFilters() {
  const root = $("#playerFilters");
  return Object.fromEntries(["q", "role", "state", "availability"]
    .map(key => [key, root.querySelector(`[name="${key}"]`)?.value.trim() || ""])
    .filter(([, value]) => value));
}
function vacancyFilters() {
  const root = $("#vacancyFilters");
  return Object.fromEntries(["q", "role", "level", "state"]
    .map(key => [key, root.querySelector(`[name="${key}"]`)?.value.trim() || ""])
    .filter(([, value]) => value));
}
function matchesFilters(item, filters, fields) {
  const text = Object.values(item || {}).flatMap(v => Array.isArray(v) ? v : [v]).filter(v => typeof v === "string").join(" ").toLowerCase();
  return (!filters.q || text.includes(filters.q.toLowerCase())) &&
    (!filters.role || asText(first(item, fields.role, list(first(item, fields.roles, []))[0])).toLowerCase().includes(filters.role.toLowerCase())) &&
    (!filters.state || text.includes(filters.state.toLowerCase())) &&
    (!filters.availability || [filters.availability, AVAILABILITY[filters.availability]].some(val => text.includes(String(val).toLowerCase()))) &&
    (!filters.level || text.includes(filters.level.toLowerCase()));
}
function dateLabel(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date instanceof Date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";
}
function linkList(profile) {
  const links = profile?.socialLinks ?? profile?.contactLinks ?? profile?.links ?? [];
  if (Array.isArray(links)) return links.map(entry => typeof entry === "string" ? { label: "Contato", url: entry } : entry);
  return Object.entries(links || {}).map(([label, url]) => ({ label, url }));
}
function profileName(profile) { return first(profile, ["nickname", "displayName", "name", "playerName"], "Jogador"); }
function profileRole(profile) { return first(profile, ["mainRole", "primaryRole", "role", "position"], "Função não informada"); }
function profileAvailability(profile) {
  const value = first(profile, ["availability", "statusAvailability", "recruitmentStatus"], "");
  return AVAILABILITY[value] || value || "";
}
function cardForProfile(profile, favoriteIds = []) {
  const uid = recordId(profile);
  const name = profileName(profile);
  const secondary = list(first(profile, ["secondaryRoles", "otherRoles", "roles"], []));
  const region = [first(profile, ["city", "cidade"], ""), first(profile, ["state", "uf", "region"], "")].filter(Boolean).join(", ");
  const exp = first(profile, ["experience", "competitiveExperience", "experienceYears"], "");
  const wins = list(first(profile, ["achievements", "highlights", "accomplishments"], []));
  const isFavorite = favoriteIds.includes(uid);
  return `<article class="mb-card" data-card-id="${esc(uid)}">
    <div class="mb-card-top"><div class="mb-person"><div class="mb-avatar">${esc(initials(name))}</div><div><h3>${esc(name)}</h3><p>${esc(region || "Região não informada")}</p></div></div><span class="mb-role">${esc(profileRole(profile))}</span></div>
    <div class="mb-tags">${secondary.slice(0, 3).map(role => `<span class="mb-tag">${esc(role)}</span>`).join("")}</div>
    ${exp ? `<div class="mb-meta-row"><span>Experiência: ${esc(exp)}</span></div>` : ""}
    ${profileAvailability(profile) ? `<div class="mb-meta-row" style="margin-top:8px"><span>${esc(profileAvailability(profile))}</span></div>` : ""}
    ${wins.length ? `<p class="mb-card-desc"><strong>Em destaque:</strong> ${esc(wins.slice(0, 2).map(asText).join(" · "))}</p>` : ""}
    <div class="mb-card-foot"><div class="mb-actions"><button class="mb-button small" type="button" data-action="view-profile" data-id="${esc(uid)}">Ver currículo</button><button class="mb-button secondary small" type="button" data-action="report" data-kind="profile" data-id="${esc(uid)}">Denunciar</button></div><button class="mb-icon-button ${isFavorite ? "is-favorite" : ""}" type="button" data-action="favorite" data-id="${esc(uid)}" aria-label="${isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}" title="${isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${isFavorite ? "★" : "☆"}</button></div>
  </article>`;
}
function vacancyName(vacancy) { return first(vacancy, ["teamName", "team", "organization", "name"], "Equipe"); }
function vacancyTitle(vacancy) { return first(vacancy, ["title", "roleTitle", "headline"], `Buscando ${first(vacancy, ["role", "position"], "jogador")}`); }
function cardForVacancy(vacancy) {
  const id = recordId(vacancy);
  const roles = list(first(vacancy, ["roles", "positions", "wantedRoles"], first(vacancy, ["role", "position"], "")));
  const region = [first(vacancy, ["city"], ""), first(vacancy, ["state", "uf", "region"], "")].filter(Boolean).join(", ");
  const requirements = first(vacancy, ["requirements", "description", "details"], "");
  const spots = first(vacancy, ["slots", "openings", "vacancies", "quantity"], "");
  const level = first(vacancy, ["level", "competitiveLevel"], "");
  return `<article class="mb-card mb-vacancy-card" data-card-id="${esc(id)}">
    <div class="mb-vacancy-head"><div><h3>${esc(vacancyTitle(vacancy))}</h3><p class="mb-team">${esc(vacancyName(vacancy))}${region ? ` · ${esc(region)}` : ""}</p></div><span class="mb-open-pill">Vaga aberta</span></div>
    <div class="mb-tags">${roles.slice(0, 4).map(role => `<span class="mb-tag">${esc(role)}</span>`).join("")}</div>
    <div class="mb-meta-row">${level ? `<span>${esc(level)}</span>` : ""}${spots ? `<span>${esc(spots)} vaga(s)</span>` : ""}${first(vacancy, ["schedule", "trainingSchedule"], "") ? `<span>${esc(first(vacancy, ["schedule", "trainingSchedule"], ""))}</span>` : ""}</div>
    ${requirements ? `<p class="mb-card-desc">${esc(requirements)}</p>` : ""}
    <div class="mb-card-foot"><div class="mb-actions"><button class="mb-button small" type="button" data-action="apply" data-id="${esc(id)}">Demonstrar interesse</button><button class="mb-button secondary small" type="button" data-action="report" data-kind="vacancy" data-id="${esc(id)}">Denunciar</button></div><a href="#" class="mb-link" data-action="view-vacancy" data-id="${esc(id)}">Detalhes</a></div>
  </article>`;
}
async function loadPlayers() {
  const root = $("#playersList");
  root.innerHTML = '<div class="mb-skeleton"></div><div class="mb-skeleton"></div><div class="mb-skeleton"></div>';
  $("#playerCount").textContent = "Carregando currículos…";
  try {
    const filters = profileFilters();
    const result = await appState.service.listProfiles(filters);
    appState.profiles = normalizeResults(result, ["profiles", "items", "results"]);
    const profiles = appState.profiles.filter(profile => matchesFilters(profile, filters, { role: ["mainRole", "primaryRole", "role"], roles: ["secondaryRoles"] }));
    const favorites = new Set(appState.favorites.map(item => typeof item === "string" ? item : recordId(item)));
    $("#playerCount").textContent = `${profiles.length} ${profiles.length === 1 ? "currículo publicado" : "currículos publicados"}`;
    root.innerHTML = profiles.length ? profiles.map(profile => cardForProfile(profile, [...favorites])).join("") :
      emptyState("Nenhum currículo encontrado", Object.keys(filters).length ? "Tente ajustar os filtros para encontrar outros perfis." : "Ainda não há currículos publicados. Quando houver, eles aparecerão aqui.");
  } catch (error) {
    root.innerHTML = `<div class="mb-state" style="grid-column:1/-1"><h3>Não foi possível carregar os jogadores</h3><p>${esc(publicListingError(error))}</p><button class="mb-button secondary" type="button" data-action="retry">Tentar novamente</button></div>`;
    $("#playerCount").textContent = "Falha ao carregar";
  }
}
async function loadVacancies() {
  const root = $("#vacanciesList");
  root.innerHTML = '<div class="mb-skeleton"></div><div class="mb-skeleton"></div>';
  $("#vacancyCount").textContent = "Carregando vagas…";
  try {
    const filters = vacancyFilters();
    const result = await appState.service.listVacancies(filters);
    appState.vacancies = normalizeResults(result, ["vacancies", "items", "results"]);
    const open = appState.vacancies.filter(vacancy => {
      const status = first(vacancy, ["status", "state"], "open");
      return ["open", "published", "reopened", "active"].includes(String(status).toLowerCase()) && matchesFilters(vacancy, filters, { role: ["role", "position", "title"], roles: ["roles"] });
    });
    $("#vacancyCount").textContent = `${open.length} ${open.length === 1 ? "vaga aberta" : "vagas abertas"}`;
    root.innerHTML = open.length ? open.map(cardForVacancy).join("") :
      emptyState("Nenhuma vaga aberta", Object.keys(filters).length ? "Não encontramos vagas com esses filtros. Tente ampliar a busca." : "As equipes ainda não publicaram vagas abertas. Volte em breve.");
  } catch (error) {
    root.innerHTML = `<div class="mb-state" style="grid-column:1/-1"><h3>Não foi possível carregar as vagas</h3><p>${esc(publicListingError(error))}</p><button class="mb-button secondary" type="button" data-action="retry">Tentar novamente</button></div>`;
    $("#vacancyCount").textContent = "Falha ao carregar";
  }
}

function openModal(title, subtitle, body, buttons = []) {
  appState.profileModalRequest += 1;
  $("#modalTitle").textContent = title;
  $("#modalSubtitle").textContent = subtitle || "";
  $("#modalBody").innerHTML = body;
  $("#modalFoot").innerHTML = buttons.map(button => `<button type="button" class="mb-button ${button.class || ""}" data-action="${esc(button.action)}" ${button.data || ""}>${esc(button.label)}</button>`).join("");
  $("#modal").classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("input,select,textarea", $("#modalBody"))?.focus(), 40);
}
function closeModal() {
  appState.profileModalRequest += 1;
  $("#modal").classList.remove("open");
  document.body.style.overflow = "";
}
function profileDetail(profile, { allowContactCheck = false } = {}) {
  const name = profileName(profile);
  const uid = recordId(profile);
  const place = [first(profile, ["city"], ""), first(profile, ["state", "uf", "region"], "")].filter(Boolean).join(", ");
  const group = (heading, value) => value ? `<div class="mb-detail-block"><h4>${esc(heading)}</h4><p>${esc(asText(value))}</p></div>` : "";
  const roles = list(first(profile, ["secondaryRoles", "otherRoles", "roles"], []));
  const history = first(profile, ["teamHistory", "teamsHistory", "previousTeams", "teams"], "");
  const tournaments = first(profile, ["championships", "tournaments"], "");
  const schedule = first(profile, ["availabilitySchedule", "trainingAvailability", "schedule"], "");
  const hasContact = profile.contactAvailable === true || linkList(profile).length > 0;
  const contactSection = hasContact || allowContactCheck || appState.user
    ? `<section class="mb-contact-section" aria-label="Contato do jogador">
        <h4>CONTATO</h4>
        ${hasContact && appState.user
          ? `<button class="mb-button yellow mb-contact-button" type="button" data-action="contact-profile" data-id="${esc(uid)}" data-name="${esc(name)}">CONTATO</button>
             <p class="mb-contact-help">${hasContact ? "Acesse somente os links que este jogador escolheu compartilhar." : "Clique para verificar os links de contato compartilhados pelo jogador."}</p>`
          : !hasContact && appState.user && appState.user.uid !== uid
            ? `<p class="mb-contact-help">Este jogador ainda não compartilhou um link. Envie um pedido privado; ele decide se quer compartilhar o contato.</p>
               <button class="mb-button yellow mb-contact-button" type="button" data-action="request-contact" data-id="${esc(uid)}" data-name="${esc(name)}">TENHO INTERESSE</button>`
            : !appState.user
              ? `<button class="mb-button yellow mb-contact-button" type="button" disabled aria-disabled="true">CONTATO</button>
                 <p class="mb-contact-help">${hasContact ? "Entre em uma conta cadastrada para habilitar o contato." : "Sem link compartilhado. Entre na plataforma para enviar um pedido privado."}</p>
                 <button class="mb-button secondary small" type="button" data-action="signin">Entrar na plataforma</button>`
              : `<p class="mb-contact-help">Este é o seu próprio currículo.</p>`}
      </section>`
    : `<section class="mb-contact-section" aria-label="Contato do jogador">
        <h4>CONTATO</h4>
        <p class="mb-contact-help">Este jogador ainda não compartilhou um link de contato.</p>
        <button class="mb-button yellow mb-contact-button" type="button" disabled aria-disabled="true">TENHO INTERESSE</button>
        <p class="mb-contact-help">Entre em uma conta para enviar um pedido privado.</p>
        <button class="mb-button secondary small" type="button" data-action="signin">Entrar na plataforma</button>
      </section>`;
  return `<div class="mb-person" style="margin-bottom:18px"><div class="mb-avatar" style="width:52px;height:52px;font-size:24px">${esc(initials(name))}</div><div><h3 style="margin:0;font:800 27px var(--mb-display);text-transform:uppercase">${esc(name)}</h3><p style="margin:3px 0;color:#687970;font-size:12px">${esc([profileRole(profile), place].filter(Boolean).join(" · "))}</p></div></div>
  <div class="mb-detail-grid">
    ${group("Funções secundárias", roles)}
    ${group("Experiência competitiva", first(profile, ["experience", "competitiveExperience", "experienceYears"], ""))}
    ${group("Disponibilidade", profileAvailability(profile))}
    ${group("Agenda para treinos", schedule)}
    ${group("Histórico de equipes", history)}
    ${group("Campeonatos", tournaments)}
    ${group("Conquistas", first(profile, ["achievements", "highlights", "accomplishments"], ""))}
    ${group("Sobre e objetivo", first(profile, ["bio", "description", "objectives", "about"], ""))}
  </div>
  ${contactSection}
  <p class="mb-help" style="margin-top:12px">Contato pessoal não é exibido. Os links ficam disponíveis somente para usuários conectados.</p>`;
}
async function viewProfile(id) {
  let profile = appState.profiles.find(item => recordId(item) === id) || appState.favorites.find(item => recordId(item) === id);
  if (!profile) return toast("Este currículo não está mais disponível. Atualize a lista.");
  if (appState.user && profile.contactAvailable !== true && linkList(profile).length === 0) {
    try {
      const links = await appState.service.getProfileContactLinks(appState.user.uid, id);
      profile = { ...profile, contactAvailable: links.length > 0 };
    } catch (error) {
      toast(friendlyError(error));
      return;
    }
  }
  openModal(profileName(profile), "Currículo público", profileDetail(profile), [
    { label: "Denunciar perfil", action: "report", class: "secondary", data: `data-kind="profile" data-id="${esc(id)}"` },
    { label: "Fechar", action: "close-modal", class: "secondary" }
  ]);
}
function vacancyDetail(vacancy) {
  const sections = [
    ["Funções procuradas", first(vacancy, ["roles", "positions", "wantedRoles", "role", "position"], "")],
    ["Requisitos", first(vacancy, ["requirements"], "")],
    ["Agenda de treinos", first(vacancy, ["schedule", "trainingSchedule"], "")],
    ["Campeonatos previstos", first(vacancy, ["championships", "plannedTournaments"], "")],
    ["Ajuda de custo / remuneração", first(vacancy, ["compensation", "support", "remuneration"], "")],
    ["Sobre a equipe", first(vacancy, ["description", "details", "about"], "")]
  ];
  return `<div class="mb-detail-grid">${sections.map(([title, value]) => value ? `<div class="mb-detail-block"><h4>${esc(title)}</h4><p>${esc(asText(value))}</p></div>` : "").join("")}</div>`;
}
function viewVacancy(id) {
  const vacancy = appState.vacancies.find(item => recordId(item) === id);
  if (!vacancy) return;
  openModal(vacancyTitle(vacancy), vacancyName(vacancy), vacancyDetail(vacancy), [
    { label: "Demonstrar interesse", action: "apply", data: `data-id="${esc(id)}"` },
    { label: "Fechar", action: "close-modal", class: "secondary" }
  ]);
}
function field(name, label, value = "", type = "text", opts = {}) {
  const full = opts.full ? " full" : "";
  const required = opts.required ? " required" : "";
  const maxlength = opts.maxlength || 180;
  const input = type === "textarea"
    ? `<textarea class="mb-control" name="${esc(name)}" rows="${opts.rows || 3}" maxlength="${maxlength}"${required} placeholder="${esc(opts.placeholder || "")}">${esc(value)}</textarea>`
    : type === "select"
      ? `<select class="mb-control" name="${esc(name)}"${required}>${opts.options.map(([key, text]) => `<option value="${esc(key)}" ${String(value) === String(key) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select>`
      : `<input class="mb-control" name="${esc(name)}" type="${type}" value="${esc(value)}" maxlength="${maxlength}"${required} placeholder="${esc(opts.placeholder || "")}">`;
  return `<div class="mb-field${full}"><label>${esc(label)}${opts.required ? " *" : ""}</label>${input}${opts.help ? `<span class="mb-help">${esc(opts.help)}</span>` : ""}</div>`;
}
function roleOptions(selected = []) {
  const selectedValues = new Set(list(selected));
  return `<div class="mb-checks">${PROFILE_ROLES.map(role => `<label class="mb-check"><input type="checkbox" name="secondaryRoles" value="${esc(role)}" ${selectedValues.has(role) ? "checked" : ""}><span>${esc(role)}</span></label>`).join("")}</div>`;
}
function openProfileForm(profile = appState.ownProfile) {
  if (!requireUser()) return;
  const p = profile || {};
  const avail = first(p, ["availability"], "looking");
  const links = linkList(p).map(item => typeof item === "string" ? item : first(item, ["url", "href", "link"], "")).filter(Boolean).join("\n");
  const form = `<form id="profileForm" class="mb-form">
    ${field("nickname", "Nickname / nome de exibição", profileName(p) === "Jogador" ? "" : profileName(p), "text", { required: true, maxlength: 36, placeholder: "Como a comunidade deve te chamar" })}
    ${field("mainRole", "Função principal", profileRole(p) === "Função não informada" ? "" : profileRole(p), "select", { required: true, options: [["", "Selecione uma função"], ...PROFILE_ROLES.map(role => [role, role])] })}
    <div class="mb-field full"><label>Funções secundárias</label>${roleOptions(first(p, ["secondaryRoles", "otherRoles", "roles"], []))}</div>
    ${field("city", "Cidade (opcional)", first(p, ["city"], ""), "text", { maxlength: 60 })}
    ${field("state", "Estado (opcional)", first(p, ["state", "uf"], ""), "select", { options: [["", "Selecione"], ...["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(state => [state, state])] })}
    ${field("experience", "Experiência competitiva", first(p, ["experience", "competitiveExperience"], ""), "text", { maxlength: 70, placeholder: "Ex.: 2 temporadas no competitivo" })}
    ${field("availability", "Disponibilidade", avail, "select", { required: true, options: Object.entries(AVAILABILITY) })}
    ${field("availabilitySchedule", "Disponibilidade para treinos", first(p, ["availabilitySchedule", "trainingAvailability", "schedule"], ""), "text", { maxlength: 100, placeholder: "Dias e horários" })}
    ${field("teamHistory", "Histórico de equipes", first(p, ["teamHistory", "teamsHistory", "previousTeams"], ""), "textarea", { full: true, maxlength: 500 })}
    ${field("championships", "Campeonatos disputados", first(p, ["championships", "tournaments"], ""), "textarea", { maxlength: 400 })}
    ${field("achievements", "Principais conquistas", first(p, ["achievements", "highlights", "accomplishments"], ""), "textarea", { maxlength: 400 })}
    ${field("bio", "Sobre você e objetivos competitivos", first(p, ["bio", "description", "objectives"], ""), "textarea", { full: true, maxlength: 700, help: "Não inclua telefone, e-mail ou dados privados." })}
    ${field("socialLinks", "Links sociais / contato (opcional)", links, "textarea", { full: true, maxlength: 350, help: "Um link por linha. Somente links informados aqui podem aparecer no currículo público.", placeholder: "https://..." })}
    <div class="mb-notice mb-field full">Por segurança e privacidade, este formulário não solicita idade, data de nascimento, telefone ou e-mail. Estatísticas não informadas por fontes confiáveis não serão exibidas.</div>
  </form>`;
  openModal(p && recordId(p) ? "Editar currículo" : "Meu currículo competitivo", "Crie uma apresentação clara para capitães e equipes.", form, [
    { label: "Cancelar", action: "close-modal", class: "secondary" },
    { label: p && recordId(p) ? "Salvar alterações" : "Salvar currículo", action: "save-profile" }
  ]);
}
function formValues(form, fields) {
  const data = new FormData(form);
  return Object.fromEntries(fields.map(name => [name, data.get(name)?.trim?.() || ""]));
}
async function saveProfile() {
  const form = $("#profileForm");
  if (!form.reportValidity()) return;
  const values = formValues(form, ["nickname", "mainRole", "city", "state", "experience", "availability", "availabilitySchedule", "teamHistory", "championships", "achievements", "bio"]);
  values.secondaryRoles = [...form.querySelectorAll('input[name="secondaryRoles"]:checked')].map(input => input.value);
  values.socialLinks = form.elements.socialLinks.value.split(/\n/).map(url => url.trim()).filter(url => safeUrl(url)).map(url => ({ label: "Contato", url }));
  try {
    await appState.service.saveMyProfile(appState.user.uid, values);
    appState.ownProfile = { ...appState.ownProfile, ...values, uid: appState.user.uid };
    closeModal();
    toast("Currículo salvo. Confira o status antes de publicar.");
    await loadMySpace();
    await loadPlayers();
  } catch (error) { toast(friendlyError(error)); }
}
function openVacancyForm(vacancy = null) {
  if (!requireUser()) return;
  const v = vacancy || {};
  const roles = list(first(v, ["roles", "positions", "wantedRoles"], first(v, ["role", "position"], [])));
  const form = `<form id="vacancyForm" class="mb-form">
    ${field("teamName", "Nome da equipe", first(v, ["teamName", "team", "organization", "name"], ""), "text", { required: true, maxlength: 60 })}
    ${field("title", "Título da vaga", first(v, ["title", "roleTitle", "headline"], ""), "text", { required: true, maxlength: 70, placeholder: "Ex.: Procurando suporte" })}
    <div class="mb-field full"><label>Funções procuradas</label>${roleOptions(roles)}</div>
    ${field("level", "Nível competitivo", first(v, ["level", "competitiveLevel"], ""), "select", { options: [["", "Selecione"], ["Iniciante", "Iniciante"], ["Amador", "Amador"], ["Semiprofissional", "Semiprofissional"], ["Profissional", "Profissional"]] })}
    ${field("state", "Estado / região (opcional)", first(v, ["state", "uf", "region"], ""), "text", { maxlength: 40 })}
    ${field("slots", "Quantidade de vagas", first(v, ["slots", "openings", "vacancies", "quantity"], ""), "number", { required: true, maxlength: 2 })}
    ${field("validityDays", "Prazo do anúncio", first(v, ["validityDays"], 30), "select", { required: true, options: [["14", "14 dias"], ["30", "30 dias"], ["60", "60 dias"]] })}
    ${field("schedule", "Agenda de treinos", first(v, ["schedule", "trainingSchedule"], ""), "text", { maxlength: 100 })}
    ${field("requirements", "Requisitos", first(v, ["requirements"], ""), "textarea", { full: true, maxlength: 450 })}
    ${field("championships", "Campeonatos previstos", first(v, ["championships", "plannedTournaments"], ""), "textarea", { maxlength: 300 })}
    ${field("compensation", "Ajuda de custo / remuneração (opcional)", first(v, ["compensation", "support", "remuneration"], ""), "text", { maxlength: 120 })}
    ${field("description", "Sobre a equipe", first(v, ["description", "details", "about"], ""), "textarea", { full: true, maxlength: 600 })}
    <div class="mb-notice mb-field full">Não informe contatos privados de terceiros. Vagas e currículos passam a ser públicos quando publicados.</div>
  </form>`;
  openModal(recordId(v) ? "Editar vaga" : "Publicar vaga", "Conte com clareza quem vocês procuram e como funciona a rotina.", form, [
    { label: "Cancelar", action: "close-modal", class: "secondary" },
    { label: recordId(v) ? "Salvar alterações" : "Publicar vaga", action: "save-vacancy", data: `data-id="${esc(recordId(v))}"` }
  ]);
}
async function saveVacancy(id = "") {
  const form = $("#vacancyForm");
  if (!form.reportValidity()) return;
  const values = formValues(form, ["teamName", "title", "level", "state", "schedule", "requirements", "championships", "compensation", "description"]);
  values.slots = Math.max(1, Number(form.elements.slots.value));
  values.validityDays = Number(form.elements.validityDays.value);
  values.roles = [...form.querySelectorAll('input[name="secondaryRoles"]:checked')].map(input => input.value);
  values.status = id ? (first(appState.ownVacancies.find(item => recordId(item) === id), ["status"], "open")) : "open";
  try {
    if (id) await appState.service.updateVacancy(appState.user.uid, id, values);
    else await appState.service.createVacancy(appState.user.uid, values);
    closeModal();
    toast(id ? "Vaga atualizada." : "Vaga publicada.");
    await loadMySpace();
    await loadVacancies();
  } catch (error) { toast(friendlyError(error)); }
}

function appId(application) { return first(application, ["id", "applicationId"], ""); }
function applicantName(application) {
  return first(application, ["nickname", "playerName", "profileName", "applicantName", "name"], "Candidato");
}
function renderApplication(application) {
  const status = first(application, ["status", "pipelineStatus"], "new");
  const isReceived = appState.mode === "received";
  const isWithdrawn = status === "withdrawn";
  const who = isReceived ? applicantName(application) : first(application, ["teamName", "vacancyTitle", "title"], "Equipe");
  const message = first(application, ["message", "coverMessage", "note"], "");
  const id = appId(application);
  const applicantUid = first(application, ["applicantUid", "profileUid"], "");
  const statuses = [["new", "Novo candidato"], ["reviewing", "Em análise"], ["trial_scheduled", "Teste agendado"], ["approved", "Aprovado"], ["rejected", "Não selecionado"]];
  const applicantActions = isReceived && !isWithdrawn ? `
    ${applicantUid && id ? `<button class="mb-button secondary small" type="button" data-action="view-applicant-profile" data-id="${esc(id)}" data-profile-uid="${esc(applicantUid)}" data-name="${esc(applicantName(application))}">Ver currículo</button>` : ""}
    ${applicantUid ? `<button class="mb-button yellow small" type="button" data-action="contact-applicant" data-profile-uid="${esc(applicantUid)}" data-name="${esc(applicantName(application))}">Entrar em contato</button>` : ""}
    <select class="mb-control" data-status-select="${esc(id)}" aria-label="Etapa da candidatura">${statuses.map(([value, label]) => `<option value="${value}" ${value === status ? "selected" : ""}>${label}</option>`).join("")}</select>
    <button class="mb-button small" type="button" data-action="update-application" data-id="${esc(id)}">Atualizar etapa</button>` : "";
  const sentActions = !isReceived && !isWithdrawn
    ? `<button class="mb-button danger small" type="button" data-action="withdraw-application" data-id="${esc(id)}">Retirar candidatura</button>`
    : "";
  const withdrawalNotice = isWithdrawn
    ? `<p class="mb-help">${isReceived ? "O candidato retirou esta candidatura." : "Você retirou esta candidatura. Ela permanece no histórico da organização."}</p>`
    : "";
  return `<article class="mb-applicant${isWithdrawn ? " is-withdrawn" : ""}"><div><div class="mb-inline"><h3>${esc(who)}</h3><span class="mb-status-pill ${esc(status)}">${esc(APP_STATUS[status] || status)}</span></div><p>${esc(message || "Sem mensagem adicional.")}</p>${withdrawalNotice}</div><div class="mb-applicant-actions">${applicantActions}${sentActions}</div></article>`;
}
async function loadApplications() {
  const root = $("#applicationsList");
  if (!appState.user) {
    $("#applicationCount").textContent = "";
    root.innerHTML = emptyState("Entre para ver candidaturas", "As candidaturas são privadas e vinculadas à sua conta.", '<button class="mb-button" type="button" data-action="signin">Entrar na plataforma</button>');
    return;
  }
  root.innerHTML = '<div class="mb-skeleton"></div>';
  try {
    const result = await appState.service.listApplications(appState.user.uid, appState.mode);
    appState.applications = normalizeResults(result, ["applications", "items", "results"]);
    $("#applicationCount").textContent = `${appState.applications.length} registro(s)`;
    root.innerHTML = appState.applications.length ? appState.applications.map(renderApplication).join("") :
      emptyState(appState.mode === "received" ? "Nenhuma candidatura recebida" : "Nenhuma candidatura enviada", appState.mode === "received" ? "Quando alguém se candidatar às suas vagas, o processo aparecerá aqui." : "Demonstre interesse em uma vaga para acompanhar sua candidatura aqui.");
  } catch (error) {
    root.innerHTML = `<div class="mb-state"><h3>Não foi possível carregar</h3><p>${esc(friendlyError(error))}</p><button class="mb-button secondary" type="button" data-action="retry">Tentar novamente</button></div>`;
  }
}
function contactRequestId(request) { return first(request, ["id", "requestId"], ""); }
function renderContactRequest(request) {
  const isReceived = appState.contactRequestMode === "received";
  const status = first(request, ["status"], "pending");
  const id = contactRequestId(request);
  const team = first(request, ["teamName"], "Equipe");
  const vacancy = first(request, ["vacancyTitle"], "Interesse no jogador");
  const message = first(request, ["message"], "");
  const created = dateLabel(request.createdAt);
  const actions = status === "pending" && isReceived
    ? `<button class="mb-button yellow small" type="button" data-action="accept-contact-request" data-id="${esc(id)}">Aceitar e compartilhar contato</button><button class="mb-button secondary small" type="button" data-action="decline-contact-request" data-id="${esc(id)}">Recusar</button>`
    : status === "accepted"
      ? `<button class="mb-button small" type="button" data-action="view-request-contact" data-id="${esc(id)}">${isReceived ? "Ver contato do time" : "Ver contato do jogador"}</button>`
      : "";
  const statusHelp = status === "pending"
    ? isReceived
      ? "Ao aceitar, o link do time e o contato que você escolher compartilhar ficarão visíveis para os dois."
      : "Aguardando o jogador. Seu link só será liberado se ele aceitar."
    : status === "declined" && !isReceived
      ? "O jogador recusou o pedido. Nenhum contato foi compartilhado."
      : "";
  return `<article class="mb-applicant mb-contact-request-card">
    <div><div class="mb-inline"><h3>${esc(team)}</h3><span class="mb-status-pill ${status === "declined" ? "rejected" : esc(status)}">${esc(CONTACT_REQUEST_STATUS[status] || status)}</span></div>
      <p><strong>${esc(vacancy)}</strong>${created ? ` · ${esc(created)}` : ""}</p>
      <p>${esc(message || "A equipe demonstrou interesse no seu currículo.")}</p>
      ${statusHelp ? `<p class="mb-help">${esc(statusHelp)}</p>` : ""}
    </div>
    <div class="mb-applicant-actions">${actions}</div>
  </article>`;
}
async function loadContactRequests() {
  const root = $("#contactRequestsList");
  if (!appState.user) {
    $("#contactRequestCount").textContent = "";
    root.innerHTML = emptyState("Entre para ver seus interesses", "Pedidos de contato são privados e ficam vinculados à sua conta.", '<button class="mb-button" type="button" data-action="signin">Entrar na plataforma</button>');
    return;
  }
  root.innerHTML = '<div class="mb-skeleton"></div>';
  try {
    const result = await appState.service.listContactRequests(appState.user.uid, appState.contactRequestMode);
    appState.contactRequests = normalizeResults(result, ["requests", "items", "results"]);
    const count = appState.contactRequests.length;
    $("#contactRequestCount").textContent = `${count} ${count === 1 ? "pedido" : "pedidos"} · até 50 mais recentes`;
    root.innerHTML = count
      ? appState.contactRequests.map(renderContactRequest).join("")
      : emptyState(
          appState.contactRequestMode === "received" ? "Nenhum interesse recebido" : "Nenhum pedido enviado",
          appState.contactRequestMode === "received"
            ? "Quando uma equipe sem link de contato compartilhado demonstrar interesse, o pedido aparecerá aqui."
            : "Pedidos enviados para jogadores sem link de contato compartilhado aparecerão aqui."
        );
  } catch (error) {
    root.innerHTML = `<div class="mb-state"><h3>Não foi possível carregar os interesses</h3><p>${esc(friendlyError(error))}</p><button class="mb-button secondary" type="button" data-action="retry-contact-requests">Tentar novamente</button></div>`;
    $("#contactRequestCount").textContent = "Falha ao carregar";
  }
}
async function viewApplicantProfile(applicationId, profileUid, name = "Candidato") {
  const application = appState.applications.find(item => appId(item) === applicationId);
  if (!appState.user || appState.mode !== "received" || !application ||
      first(application, ["applicantUid", "profileUid"], "") !== profileUid) {
    return toast("Não foi possível confirmar esta candidatura.");
  }

  openModal(`Currículo · ${name}`, "Detalhes do perfil compartilhados pelo candidato.", `
    <div class="mb-state" aria-live="polite"><h3>Carregando currículo</h3><p>Buscando os detalhes do perfil.</p></div>`,
  [{ label: "Fechar", action: "close-modal", class: "secondary" }]);
  const request = appState.profileModalRequest;
  try {
    const profile = await appState.service.getApplicantProfile(appState.user.uid, applicationId, profileUid);
    if (profile.contactAvailable !== true) {
      const links = await appState.service.getProfileContactLinks(appState.user.uid, profileUid);
      profile.contactAvailable = links.length > 0;
    }
    if (request !== appState.profileModalRequest || !$("#modal").classList.contains("open")) return;
    $("#modalBody").innerHTML = profileDetail(profile, { allowContactCheck: true });
  } catch (error) {
    if (request !== appState.profileModalRequest || !$("#modal").classList.contains("open")) return;
    $("#modalBody").innerHTML = `<div class="mb-state"><h3>Não foi possível abrir o currículo</h3><p>${esc(friendlyError(error))}</p></div>`;
  }
}
async function updateApplication(id) {
  const status = $(`[data-status-select="${CSS.escape(id)}"]`)?.value;
  if (!status) return;
  try {
    await appState.service.updateApplicationStatus(appState.user.uid, id, status);
    toast("Etapa da candidatura atualizada.");
    await loadApplications();
  } catch (error) { toast(friendlyError(error)); }
}
async function withdrawApplication(id) {
  if (!requireUser()) return;
  if (!window.confirm("Retirar sua candidatura? A organização verá que você desistiu. Esta ação não pode ser desfeita.")) return;
  try {
    await appState.service.withdrawApplication(appState.user.uid, id);
    toast("Candidatura retirada.");
    if ($("#panel-applications").classList.contains("active") && appState.mode === "sent") {
      await loadApplications();
    }
  } catch (error) { toast(friendlyError(error)); }
}
async function openContactLinks(profileUid, name = "jogador") {
  if (!appState.user) {
    toast("Entre em uma conta cadastrada para acessar os links de contato.");
    signIn();
    return;
  }
  try {
    const result = await appState.service.getProfileContactLinks(appState.user.uid, profileUid);
    showContactLinks(normalizeResults(result, ["links", "items", "results"]), name);
  } catch (error) {
    toast(friendlyError(error));
  }
}
function showContactLinks(links, name = "jogador") {
  const buttons = links.map(link => {
    const href = safeUrl(first(link, ["url", "href", "link"], ""));
    return href ? `<a class="mb-button yellow mb-contact-open-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(first(link, ["label", "platform", "name"], "Abrir contato"))}</a>` : "";
  }).filter(Boolean);
  if (!buttons.length) {
    toast("Este jogador não tem links de contato disponíveis.");
    return false;
  }
  openModal(`Contato · ${name}`, "Links escolhidos e compartilhados pelo próprio jogador.", `<div class="mb-contact-options">${buttons.join("")}</div>`, [
    { label: "Fechar", action: "close-modal", class: "secondary" }
  ]);
  return true;
}
async function loadFavorites() {
  const root = $("#favoritesList");
  if (!appState.user) {
    root.innerHTML = emptyState("Entre para salvar favoritos", "Sua lista de jogadores favoritos fica privada na sua conta.", '<button class="mb-button" type="button" data-action="signin">Entrar na plataforma</button>');
    return;
  }
  root.innerHTML = '<div class="mb-skeleton"></div>';
  try {
    const result = await appState.service.listFavorites(appState.user.uid);
    appState.favorites = normalizeResults(result, ["favorites", "profiles", "items", "results"]);
    if (appState.favorites.length && typeof appState.favorites[0] === "string") {
      const ids = new Set(appState.favorites);
      appState.favorites = appState.profiles.filter(item => ids.has(recordId(item)));
    }
    root.innerHTML = appState.favorites.length ? `<div class="mb-grid">${appState.favorites.map(profile => cardForProfile(profile, appState.favorites.map(recordId))).join("")}</div>` :
      emptyState("Sua lista começa aqui", "Toque na estrela de um currículo para guardá-lo para depois.");
  } catch (error) {
    root.innerHTML = `<div class="mb-state"><h3>Não foi possível carregar favoritos</h3><p>${esc(friendlyError(error))}</p><button class="mb-button secondary" type="button" data-action="retry">Tentar novamente</button></div>`;
  }
}
async function toggleFavorite(uid) {
  if (!requireUser()) return;
  const isFavorite = appState.favorites.some(item => (typeof item === "string" ? item : recordId(item)) === uid);
  try {
    await appState.service.setFavorite(appState.user.uid, uid, !isFavorite);
    appState.favorites = isFavorite ? appState.favorites.filter(item => (typeof item === "string" ? item : recordId(item)) !== uid) :
      [...appState.favorites, appState.profiles.find(item => recordId(item) === uid) || uid];
    toast(isFavorite ? "Removido dos favoritos." : "Adicionado aos favoritos.");
    await loadPlayers();
    if ($("#panel-favorites").classList.contains("active")) await loadFavorites();
  } catch (error) { toast(friendlyError(error)); }
}
async function applyToVacancy(id) {
  if (!requireUser()) return;
  const vacancy = appState.vacancies.find(item => recordId(item) === id);
  if (!vacancy) return toast("Esta vaga não está mais disponível.");
  openModal("Demonstrar interesse", `Candidatura privada para ${vacancyName(vacancy)}.`, `<form id="applyForm">${field("message", "Conte brevemente sobre seu interesse", "", "textarea", { full: true, required: true, maxlength: 600, placeholder: "Apresente-se e fale sobre sua disponibilidade." })}<p class="mb-help">A mensagem será compartilhada com o responsável por esta vaga. Não inclua telefone ou e-mail.</p></form>`, [
    { label: "Cancelar", action: "close-modal", class: "secondary" },
    { label: "Enviar candidatura", action: "send-application", data: `data-id="${esc(id)}"` }
  ]);
}
async function sendApplication(id) {
  const form = $("#applyForm");
  if (!form.reportValidity()) return;
  try {
    await appState.service.applyToVacancy(appState.user.uid, id, form.elements.message.value.trim());
    closeModal();
    toast("Candidatura enviada. Você poderá acompanhar a resposta em Candidaturas.");
    if ($("#panel-applications").classList.contains("active")) loadApplications();
  } catch (error) { toast(friendlyError(error)); }
}
async function startContactRequest(profileUid, name = "jogador") {
  if (!requireUser()) return;
  if (profileUid === appState.user.uid) return toast("Esse é o seu próprio currículo.");
  const profile = [...appState.profiles, ...appState.favorites]
    .find(item => recordId(item) === profileUid);
  if (profile?.contactAvailable === true) {
    return toast("Este jogador já compartilhou um link. Use o botão CONTATO.");
  }

  try {
    const result = await appState.service.listMyVacancies(appState.user.uid);
    const vacancies = normalizeResults(result, ["vacancies", "items", "results"])
      .filter(vacancy => {
        if (first(vacancy, ["status"], "") !== "open") return false;
        if (!vacancy.expiresAt) return true;
        const expiresAt = vacancy.expiresAt?.toDate?.() || new Date(vacancy.expiresAt);
        return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
      });
    if (!vacancies.length) {
      openModal("Publique uma vaga primeiro", "O pedido de interesse identifica a equipe por uma vaga aberta da sua conta.", "<p class=\"mb-help\">Crie ou reabra uma vaga da equipe antes de enviar o pedido ao jogador.</p>", [
        { label: "Ir para Meu espaço", action: "go-my-space" },
        { label: "Fechar", action: "close-modal", class: "secondary" }
      ]);
      return;
    }

    const options = vacancies.map(vacancy => [
      recordId(vacancy),
      `${first(vacancy, ["teamName"], "Equipe")} — ${first(vacancy, ["title"], "Vaga")}`
    ]);
    const form = `<form id="contactRequestForm" class="mb-form">
      ${field("vacancyId", "Vaga da sua equipe", options[0][0], "select", { required: true, options })}
      ${field("message", "Mensagem para o jogador", "", "textarea", { full: true, required: true, maxlength: 500, placeholder: "Conte por que sua equipe tem interesse neste jogador." })}
      ${field("contactUrl", "Link de contato da equipe", "", "url", { full: true, required: true, maxlength: 240, placeholder: "https://wa.me/... ou link de convite" })}
      <p class="mb-help mb-field full">O jogador receberá o pedido em Interesses. Seu link de contato só ficará visível se ele aceitar.</p>
    </form>`;
    openModal(`Tenho interesse · ${name}`, "Pedido privado para um currículo sem contato compartilhado.", form, [
      { label: "Cancelar", action: "close-modal", class: "secondary" },
      { label: "Enviar pedido", action: "send-contact-request", data: `data-id="${esc(profileUid)}"` }
    ]);
  } catch (error) {
    toast(friendlyError(error));
  }
}
async function sendContactRequest(profileUid) {
  const form = $("#contactRequestForm");
  if (!form?.reportValidity()) return;
  const contactUrl = safeUrl(form.elements.contactUrl.value.trim());
  if (!contactUrl) return toast("Informe um link de contato válido.");
  try {
    await appState.service.createContactRequest(
      appState.user.uid,
      profileUid,
      form.elements.vacancyId.value,
      form.elements.message.value.trim(),
      contactUrl
    );
    closeModal();
    toast("Pedido enviado. O link da equipe só será compartilhado após o aceite.");
    if ($("#panel-contact-requests").classList.contains("active")) {
      appState.contactRequestMode = "sent";
      $$("#contactRequestMode button").forEach(button =>
        button.classList.toggle("active", button.dataset.contactMode === "sent"));
      await loadContactRequests();
    }
  } catch (error) {
    if (/já compartilhou um link/.test(error?.message || "")) {
      await openContactLinks(profileUid);
      return;
    }
    toast(friendlyError(error));
  }
}
function acceptContactRequest(id) {
  openModal("Aceitar e compartilhar contato", "O link da equipe e o seu ficarão visíveis somente para vocês dois.", `<form id="acceptContactRequestForm">${field("contactUrl", "Link que você quer compartilhar", "", "url", { full: true, required: true, maxlength: 240, placeholder: "https://wa.me/... ou seu perfil social" })}<p class="mb-help">Esse link será privado e liberado apenas para a equipe deste pedido.</p></form>`, [
    { label: "Cancelar", action: "close-modal", class: "secondary" },
    { label: "Aceitar e compartilhar", action: "confirm-contact-request", data: `data-id="${esc(id)}"` }
  ]);
}
async function confirmContactRequest(id) {
  const form = $("#acceptContactRequestForm");
  if (!form?.reportValidity()) return;
  const contactUrl = safeUrl(form.elements.contactUrl.value.trim());
  if (!contactUrl) return toast("Informe um link de contato válido.");
  try {
    await appState.service.acceptContactRequest(appState.user.uid, id, contactUrl);
    closeModal();
    toast("Pedido aceito. Os contatos foram compartilhados somente entre vocês.");
    if ($("#panel-contact-requests").classList.contains("active")) await loadContactRequests();
  } catch (error) { toast(friendlyError(error)); }
}
async function declineContactRequest(id) {
  if (!window.confirm("Recusar este pedido? Nenhum contato será compartilhado.")) return;
  try {
    await appState.service.declineContactRequest(appState.user.uid, id);
    toast("Pedido recusado. Nenhum contato foi compartilhado.");
    if ($("#panel-contact-requests").classList.contains("active")) await loadContactRequests();
  } catch (error) { toast(friendlyError(error)); }
}
async function openRequestContact(id) {
  try {
    const contact = await appState.service.getSharedContactForRequest(appState.user.uid, id);
    const href = safeUrl(contact.url);
    if (!href) return toast("O contato compartilhado não está disponível.");
    openModal(contact.label || "Contato compartilhado", "Este link foi liberado após o aceite do pedido.", `<div class="mb-contact-options"><a class="mb-button yellow mb-contact-open-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Abrir contato</a></div>`, [
      { label: "Fechar", action: "close-modal", class: "secondary" }
    ]);
  } catch (error) { toast(friendlyError(error)); }
}
async function reportContent(kind, id) {
  if (!requireUser()) return;
  openModal("Denunciar conteúdo", "A denúncia será analisada pela equipe autorizada.", `<form id="reportForm">${field("reason", "Conte o que há de errado", "", "textarea", { full: true, required: true, maxlength: 500, placeholder: "Descreva o motivo da denúncia." })}</form>`, [
    { label: "Cancelar", action: "close-modal", class: "secondary" },
    { label: "Enviar denúncia", action: "send-report", data: `data-kind="${esc(kind)}" data-id="${esc(id)}"` }
  ]);
}
async function sendReport(kind, id) {
  const form = $("#reportForm");
  if (!form.reportValidity()) return;
  try {
    await appState.service.reportContent(appState.user.uid, { kind, targetId: id, reason: form.elements.reason.value.trim() });
    closeModal();
    toast("Denúncia enviada à equipe de moderação.");
  } catch (error) { toast(friendlyError(error)); }
}
async function setProfileStatus(status) {
  if (!requireUser()) return;
  try {
    await appState.service.setProfileStatus(appState.user.uid, status);
    appState.ownProfile = { ...appState.ownProfile, status };
    toast(status === "published" ? "Currículo publicado." : "Currículo pausado.");
    await loadMySpace();
    await loadPlayers();
  } catch (error) { toast(friendlyError(error)); }
}
async function deleteProfile() {
  if (!requireUser() || !window.confirm("Remover seu currículo? Esta ação não pode ser desfeita.")) return;
  try {
    await appState.service.deleteMyProfile(appState.user.uid);
    appState.ownProfile = null;
    toast("Currículo removido.");
    await loadMySpace();
    await loadPlayers();
  } catch (error) { toast(friendlyError(error)); }
}
async function setVacancyStatus(id, status) {
  const vacancy = appState.ownVacancies.find(item => recordId(item) === id);
  if (!vacancy) return;
  try {
    await appState.service.updateVacancy(appState.user.uid, id, { ...vacancy, status });
    toast(status === "open" ? "Vaga reaberta." : "Vaga encerrada.");
    await loadMySpace();
    await loadVacancies();
  } catch (error) { toast(friendlyError(error)); }
}
function profileOwnerCard(profile) {
  if (!profile) return emptyState("Ainda não tem currículo?", "Crie seu perfil para apresentar sua experiência, funções e objetivos competitivos.", '<button class="mb-button" type="button" data-action="edit-profile">Criar meu currículo</button>');
  const status = first(profile, ["status", "publicationStatus"], "draft");
  const published = ["published", "active", "open"].includes(String(status).toLowerCase());
  return `<article class="mb-card" style="margin-bottom:20px"><div class="mb-card-top"><div><h3 style="margin:0;font:800 25px var(--mb-display);text-transform:uppercase">Meu currículo</h3><p style="margin:5px 0;color:#71817b;font-size:11px">Seu perfil está <span class="mb-status-pill ${published ? "" : "paused"}">${published ? "Publicado" : "Pausado ou não publicado"}</span></p></div><button class="mb-button secondary small" type="button" data-action="edit-profile">Editar</button></div><p class="mb-card-desc">${esc(first(profile, ["bio", "description"], "Adicione uma apresentação para ajudar as equipes a conhecer seu perfil."))}</p><div class="mb-actions"><button class="mb-button small" type="button" data-action="set-profile-status" data-status="${published ? "paused" : "published"}">${published ? "Pausar currículo" : "Publicar currículo"}</button><button class="mb-button danger small" type="button" data-action="delete-profile">Remover currículo</button></div></article>`;
}
function ownVacancyCard(vacancy) {
  const id = recordId(vacancy);
  const status = first(vacancy, ["status"], "open");
  const expiresAt = vacancy.expiresAt?.toDate?.() || (vacancy.expiresAt ? new Date(vacancy.expiresAt) : null);
  const expired = expiresAt instanceof Date && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now();
  const closed = expired || ["closed", "filled", "paused"].includes(String(status).toLowerCase());
  const expiryLabel = expiresAt instanceof Date && Number.isFinite(expiresAt.getTime())
    ? `Válida até ${expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
    : "Prazo não informado";
  const label = expired ? "Expirada" : closed ? "Encerrada" : "Aberta";
  return `<article class="mb-card" style="margin-bottom:10px"><div class="mb-vacancy-head"><div><h3>${esc(vacancyTitle(vacancy))}</h3><p class="mb-team">${esc(vacancyName(vacancy))}</p></div><span class="mb-open-pill ${closed ? "closed" : ""}">${label}</span></div><div class="mb-card-foot"><span class="mb-help">${esc(expiryLabel)} · publicação sua</span><div class="mb-actions"><button class="mb-button secondary small" type="button" data-action="edit-vacancy" data-id="${esc(id)}">Editar</button><button class="mb-button small" type="button" data-action="vacancy-status" data-status="${closed ? "open" : "closed"}" data-id="${esc(id)}">${closed ? "Reabrir" : "Encerrar"}</button></div></div></article>`;
}
async function loadMySpace() {
  const root = $("#mySpaceContent");
  if (!appState.user) {
    root.innerHTML = emptyState("Seu espaço de recrutamento", "Entre com sua conta da Plataforma Freitas para criar e gerenciar currículos ou vagas.", '<button class="mb-button" type="button" data-action="signin">Entrar na plataforma</button>');
    return;
  }
  root.innerHTML = '<div class="mb-skeleton"></div>';
  try {
    const [profile, vacancies] = await Promise.all([
      appState.service.getMyProfile(appState.user.uid),
      appState.service.listMyVacancies(appState.user.uid)
    ]);
    appState.ownProfile = profile?.profile ?? profile?.data ?? profile ?? null;
    appState.ownVacancies = normalizeResults(vacancies, ["vacancies", "items", "results"]);
    root.innerHTML = `<div class="mb-layout-two"><div>${profileOwnerCard(appState.ownProfile)}<div class="mb-panel-head" style="margin-top:24px"><div><h2 style="font-size:27px">Vagas da minha equipe</h2><p>Edite, encerre ou reabra publicações existentes.</p></div><button class="mb-button small" type="button" data-action="new-vacancy">Nova vaga</button></div>${appState.ownVacancies.length ? appState.ownVacancies.map(ownVacancyCard).join("") : emptyState("Nenhuma vaga criada", "Publique uma vaga quando sua equipe estiver buscando novos talentos.", '<button class="mb-button" type="button" data-action="new-vacancy">Publicar vaga</button>')}</div><aside class="mb-side-note"><strong>Seu perfil, suas regras</strong>Currículos públicos não mostram e-mail ou telefone. Adicione somente links sociais que você quer compartilhar.<br><br><strong>Sem dados inventados</strong>O Mercado da Bala não estima idade, estatísticas ou verificação. Informe experiência e conquistas com clareza.</aside></div>`;
  } catch (error) {
    root.innerHTML = `<div class="mb-state"><h3>Não foi possível carregar seu espaço</h3><p>${esc(friendlyError(error))}</p><button class="mb-button secondary" type="button" data-action="retry">Tentar novamente</button></div>`;
  }
}
async function loadModeration() {
  const root = $("#moderationList");
  if (!appState.user || !["admin", "ceo"].includes(String(appState.role).toLowerCase())) {
    root.innerHTML = '<div class="mb-admin-warning">Esta área está disponível somente para contas com função de administrador ou CEO.</div>';
    return;
  }
  root.innerHTML = '<div class="mb-skeleton"></div>';
  try {
    const result = await appState.service.listModerationQueue(appState.user.uid);
    appState.moderation = normalizeResults(result, ["reports", "queue", "items", "results"]);
    root.innerHTML = appState.moderation.length ? appState.moderation.map(item => {
      const kind = first(item, ["kind", "contentKind"], "profile");
      const id = first(item, ["targetId", "contentId", "id"], "");
      const reason = first(item, ["reason", "reportReason"], "Sem justificativa informada");
      return `<article class="mb-applicant"><div><div class="mb-inline"><h3>${esc(first(item, ["title", "targetName"], `${kind === "vacancy" ? "Vaga" : "Currículo"} denunciado`))}</h3><span class="mb-status-pill pending">Pendente</span></div><p>${esc(reason)}</p><span class="mb-help">Referência: ${esc(id)}</span></div><div class="mb-inline"><button class="mb-button small" data-action="moderate" data-kind="${esc(kind)}" data-id="${esc(id)}" data-status="approved" type="button">Manter</button><button class="mb-button danger small" data-action="moderate" data-kind="${esc(kind)}" data-id="${esc(id)}" data-status="removed" type="button">Remover conteúdo</button></div></article>`;
    }).join("") : emptyState("Fila sem denúncias", "Quando houver itens para análise, eles aparecerão aqui.");
  } catch (error) {
    root.innerHTML = `<div class="mb-state"><h3>Não foi possível carregar a fila</h3><p>${esc(friendlyError(error))}</p><button class="mb-button secondary" type="button" data-action="retry">Tentar novamente</button></div>`;
  }
}
async function moderate(kind, targetId, status) {
  if (!requireUser()) return;
  let reason = "";
  if (status === "removed" && !window.confirm("Remover este conteúdo da vitrine?")) return;
  if (status === "removed") reason = window.prompt("Motivo da decisão (obrigatório):", "")?.trim() || "";
  if (status === "removed" && !reason) return toast("Informe um motivo para registrar a decisão.");
  try {
    await appState.service.moderateContent(appState.user.uid, { kind, targetId, status, reason });
    toast("Decisão de moderação registrada.");
    await loadModeration();
  } catch (error) { toast(friendlyError(error)); }
}
async function refreshAll() {
  clearError();
  await Promise.all([loadPlayers(), loadVacancies()]);
}
function updateAdminRole() {
  const tab = $("#moderationTab");
  const allowed = !!appState.user && ["admin", "ceo"].includes(String(appState.role).toLowerCase());
  tab.classList.toggle("mb-hidden", !allowed);
}
async function onUserChanged(user) {
  const accountChanged = (appState.user?.uid || null) !== (user?.uid || null);
  if (accountChanged && $("#modal").classList.contains("open")) closeModal();
  appState.user = user || null;
  appState.role = "";
  appState.ownProfile = null;
  appState.ownVacancies = [];
  appState.favorites = [];
  appState.contactRequests = [];
  $("#sessionLabel").textContent = user ? (user.displayName || "Sessão conectada") : "Navegação pública";
  $("#signInButton").textContent = user ? "Conta conectada" : "Entrar para anunciar";
  $("#signInButton").disabled = !!user;
  if (user && appState.service) {
    try {
      appState.role = await appState.service.getCurrentUserRole(user.uid) || "";
      const favs = await appState.service.listFavoriteIds(user.uid);
      appState.favorites = normalizeResults(favs, ["favorites", "items", "profiles", "results"]);
    } catch (error) { console.warn("Mercado da Bala: dados privados indisponíveis", error); }
  }
  updateAdminRole();
  await refreshAll();
}
function getFilterValues(form) {
  return [...form.querySelectorAll("input,select")];
}

document.addEventListener("click", async event => {
  const tab = event.target.closest("[data-tab]");
  if (tab) { setPanel(tab.dataset.tab); return; }
  const mode = event.target.closest("[data-mode]");
  if (mode) {
    appState.mode = mode.dataset.mode;
    $$("#applicationMode button").forEach(button => button.classList.toggle("active", button === mode));
    loadApplications();
    return;
  }
  const contactMode = event.target.closest("[data-contact-mode]");
  if (contactMode) {
    appState.contactRequestMode = contactMode.dataset.contactMode;
    $$("#contactRequestMode button").forEach(button =>
      button.classList.toggle("active", button === contactMode));
    loadContactRequests();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) {
    if (event.target === $("#modal")) closeModal();
    return;
  }
  const { action: name, id, kind, status, profileUid } = action.dataset;
  switch (name) {
    case "signin": signIn(); break;
    case "close-modal": closeModal(); break;
    case "retry": await refreshAll(); if ($("#panel-my-space").classList.contains("active")) loadMySpace(); break;
    case "edit-profile": openProfileForm(); break;
    case "save-profile": await saveProfile(); break;
    case "new-vacancy": openVacancyForm(null); break;
    case "save-vacancy": await saveVacancy(id); break;
    case "edit-vacancy": openVacancyForm(appState.ownVacancies.find(item => recordId(item) === id)); break;
    case "vacancy-status": await setVacancyStatus(id, status); break;
    case "set-profile-status": await setProfileStatus(status); break;
    case "delete-profile": await deleteProfile(); break;
    case "view-profile": await viewProfile(id); break;
    case "request-contact": await startContactRequest(id, action.dataset.name || "jogador"); break;
    case "send-contact-request": await sendContactRequest(id); break;
    case "accept-contact-request": acceptContactRequest(id); break;
    case "confirm-contact-request": await confirmContactRequest(id); break;
    case "decline-contact-request": await declineContactRequest(id); break;
    case "view-request-contact": await openRequestContact(id); break;
    case "retry-contact-requests": await loadContactRequests(); break;
    case "go-my-space": closeModal(); setPanel("my-space"); break;
    case "contact-profile": {
      const profile = appState.profiles.find(item => recordId(item) === id) || appState.favorites.find(item => recordId(item) === id);
      await openContactLinks(id, action.dataset.name || (profile ? profileName(profile) : "jogador"));
      break;
    }
    case "contact-applicant": await openContactLinks(profileUid, action.dataset.name || "candidato"); break;
    case "view-applicant-profile": await viewApplicantProfile(id, profileUid, action.dataset.name || "Candidato"); break;
    case "view-vacancy": event.preventDefault(); viewVacancy(id); break;
    case "favorite": await toggleFavorite(id); break;
    case "apply": await applyToVacancy(id); break;
    case "send-application": await sendApplication(id); break;
    case "report": await reportContent(kind, id); break;
    case "send-report": await sendReport(kind, id); break;
    case "update-application": await updateApplication(id); break;
    case "withdraw-application": await withdrawApplication(id); break;
    case "moderate": await moderate(kind, id, status); break;
    case "clear-player-filters": $("#playerFilters").querySelectorAll("input,select").forEach(input => { input.value = ""; }); loadPlayers(); break;
    case "clear-vacancy-filters": $("#vacancyFilters").querySelectorAll("input,select").forEach(input => { input.value = ""; }); loadVacancies(); break;
  }
});

$("#signInButton").addEventListener("click", signIn);
$("#playerFilters").addEventListener("input", () => { clearTimeout(loadPlayers.timer); loadPlayers.timer = setTimeout(loadPlayers, 220); });
$("#playerFilters").addEventListener("change", loadPlayers);
$("#vacancyFilters").addEventListener("input", () => { clearTimeout(loadVacancies.timer); loadVacancies.timer = setTimeout(loadVacancies, 220); });
$("#vacancyFilters").addEventListener("change", loadVacancies);
$("#modal").addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
window.addEventListener("keydown", event => { if (event.key === "Escape" && $("#modal").classList.contains("open")) closeModal(); });

async function boot() {
  try {
    // Firebase is initialized by the existing config/firebase.js module, not here.
    const firebaseStarted = Date.now();
    while (!window.firebaseReady && window.firebaseReady !== false && Date.now() - firebaseStarted < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const module = await import("../js/mercado-da-bala-data.mjs");
    if (typeof module.createMercadoDaBalaService !== "function") throw new Error("O módulo de dados não exporta createMercadoDaBalaService.");
    appState.service = module.createMercadoDaBalaService({ auth: window.firebaseAuth, db: window.firebaseDb });
    if (window.firebaseAuth) {
      const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
      onAuthStateChanged(window.firebaseAuth, onUserChanged);
    } else {
      $("#sessionLabel").textContent = "Navegação pública";
      $("#mySpaceContent").innerHTML = emptyState("Sessão indisponível", "A navegação pública está liberada, mas a autenticação da Plataforma Freitas não está pronta.");
      await refreshAll();
    }
  } catch (error) {
    console.error("Falha ao iniciar Mercado da Bala", error);
    const message = /mercado-da-bala-data/.test(error?.message || "")
      ? "O serviço de dados do Mercado da Bala ainda não está disponível. A integração esperada é ../js/mercado-da-bala-data.mjs; as listagens reais não serão substituídas por dados de exemplo."
      : friendlyError(error);
    showError(message, false);
    $("#playersList").innerHTML = `<div class="mb-state" style="grid-column:1/-1"><h3>Serviço de dados indisponível</h3><p>${esc(message)}</p></div>`;
    $("#vacanciesList").innerHTML = `<div class="mb-state" style="grid-column:1/-1"><h3>Serviço de dados indisponível</h3><p>${esc(message)}</p></div>`;
    $("#playerCount").textContent = "Indisponível";
    $("#vacancyCount").textContent = "Indisponível";
  }
}
boot();
