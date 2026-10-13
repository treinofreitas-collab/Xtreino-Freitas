// Admin: Links dos eventos (links fixos por evento + horário)
import { eventAccessRequest } from './event-access-client.mjs';

const CACHE_TTL = 60 * 1000;
const MANAGER_ROLES = ['ceo', 'admin', 'gerente'];
const VIEWER_ROLES = ['socio', 'sócio'];

const state = {
  uid: null, links: [], events: [], canManage: false,
  loadedAt: 0, loading: false, busy: false, editingId: null, error: '', filter: ''
};
let authHooked = false;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function currentRole() { return String(window.lastAppliedRole || '').toLowerCase().trim(); }
function roleAllowed() { const r = currentRole(); return MANAGER_ROLES.includes(r) || VIEWER_ROLES.includes(r); }
function canEdit() { return state.canManage && MANAGER_ROLES.includes(currentRole()); }
function sectionVisible() { const el = $('sectionEventLinks'); return !!el && el.style.display !== 'none'; }

function resetState() {
  Object.assign(state, { uid: null, links: [], events: [], canManage: false, loadedAt: 0, editingId: null, error: '', filter: '', loading: false, busy: false });
}

function hookAuth() {
  if (authHooked || !window.firebaseAuth) return;
  authHooked = true;
  import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js').then(({ onAuthStateChanged }) => {
    onAuthStateChanged(window.firebaseAuth, (user) => {
      if ((user?.uid || null) !== state.uid) { resetState(); render(); }
    });
  }).catch(() => {});
}

function normSchedule(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  let m = s.match(/^(\d{1,2})h$/) || s.match(/^(\d{1,2})$/);
  if (m) { const h = +m[1]; return h <= 23 ? `${h}h` : null; }
  m = s.match(/^(\d{1,2})[:h](\d{2})$/);
  if (m) { const h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return null; return mi === 0 ? `${h}h` : `${String(h).padStart(2, '0')}:${m[2]}`; }
  return null;
}
function validUrl(u) {
  try { const x = new URL(String(u).trim()); return (x.protocol === 'http:' || x.protocol === 'https:') && !!x.hostname; } catch { return false; }
}
function eventLabel(link) {
  const ev = state.events.find(e => e.id === link.eventType || e.eventType === link.eventType);
  return ev?.label || link.label || link.eventType;
}
function scheduleSortKey(s) { const m = String(s).match(/^(\d{1,2})(?:[h:](\d{2}))?/); return m ? (+m[1]) * 60 + (+(m[2] || 0)) : 9999; }
function errMsg(e) { return (e && (e.message || e.error)) ? String(e.message || e.error) : 'Falha inesperada. Tente novamente.'; }

function toast(type, msg) {
  const fn = type === 'success' ? window.showSuccessToast : window.showErrorToast;
  if (typeof fn === 'function') fn(msg);
}
function setStatus(type, msg) {
  const el = $('eventLinksStatus'); if (!el) return;
  if (!msg) { el.className = 'hidden'; el.textContent = ''; return; }
  el.className = type === 'error'
    ? 'mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm'
    : 'mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm';
  el.textContent = msg;
}

async function load(force = false) {
  const uid = window.firebaseAuth?.currentUser?.uid || null;
  if (!uid) { resetState(); render(); return; }
  if (state.uid && state.uid !== uid) resetState();
  if (!force && state.loadedAt && Date.now() - state.loadedAt < CACHE_TTL) { render(); return; }
  if (state.loading) return;
  state.uid = uid;
  state.loading = true; state.error = ''; render();
  try {
    const res = await eventAccessRequest('list');
    if ((window.firebaseAuth?.currentUser?.uid || null) !== uid) return;
    if (!Array.isArray(res?.links) || !Array.isArray(res?.events) || typeof res?.canManage !== 'boolean') {
      throw new Error('Resposta inválida ao carregar os links.');
    }
    state.links = Array.isArray(res?.links) ? res.links : [];
    state.events = Array.isArray(res?.events) ? res.events : [];
    state.canManage = !!res?.canManage;
    state.loadedAt = Date.now();
  } catch (e) {
    if ((window.firebaseAuth?.currentUser?.uid || null) === uid) state.error = errMsg(e);
  } finally {
    if ((window.firebaseAuth?.currentUser?.uid || null) === uid) { state.loading = false; render(); }
  }
}

function fillForm(link) {
  const sel = $('eventLinksEvent'); if (!sel) return;
  state.editingId = link ? link.id : null;
  let evId = '';
  if (link) {
    const ev = state.events.find(e => e.id === link.eventType || e.eventType === link.eventType);
    evId = ev ? ev.id : '';
  }
  sel.value = evId;
  $('eventLinksSchedule').value = link ? link.schedule : '';
  $('eventLinksUrl').value = link ? link.url : '';
  $('eventLinksActive').checked = link ? link.active !== false : true;
  $('eventLinksFormTitle').textContent = link ? 'Editar link' : 'Novo link';
  $('eventLinksSubmit').textContent = link ? 'Salvar alterações' : 'Adicionar link';
  $('eventLinksCancel').classList.toggle('hidden', !link);
  $('eventLinksFormError').classList.add('hidden');
}

function upsertLocal(link) {
  if (!link || !link.id) return;
  const i = state.links.findIndex(l => l.id === link.id);
  if (i >= 0) state.links[i] = link; else state.links.push(link);
}

async function save(payload, successMsg) {
  if (state.busy || !canEdit()) return false;
  const uid = window.firebaseAuth?.currentUser?.uid;
  state.busy = true; setStatus(); render();
  try {
    const res = await eventAccessRequest('save', payload);
    if (uid !== window.firebaseAuth?.currentUser?.uid) return false;
    if (!res?.link?.id) throw new Error('Resposta inválida ao salvar o link.');
    if (payload.previousId && payload.previousId !== res.link.id) state.links = state.links.filter(link => link.id !== payload.previousId);
    upsertLocal(res.link);
    state.loadedAt = Date.now();
    setStatus('success', successMsg); toast('success', successMsg);
    return true;
  } catch (e) {
    if (uid !== window.firebaseAuth?.currentUser?.uid) return false;
    const m = errMsg(e); setStatus('error', m); toast('error', m);
    return false;
  } finally { if (uid === window.firebaseAuth?.currentUser?.uid) { state.busy = false; render(); } }
}

async function submitForm(ev) {
  ev.preventDefault();
  const errEl = $('eventLinksFormError');
  const fail = (m) => { errEl.textContent = m; errEl.classList.remove('hidden'); };
  const eventType = $('eventLinksEvent').value;
  const schedule = normSchedule($('eventLinksSchedule').value);
  const url = $('eventLinksUrl').value.trim();
  if (!eventType) return fail('Selecione o evento.');
  if (!schedule) return fail('Horário inválido. Use o formato 19h ou 19:30.');
  if (!validUrl(url)) return fail('Informe uma URL válida começando com http:// ou https://.');
  errEl.classList.add('hidden');
  const editing = state.editingId;
  const ok = await save({ eventType, schedule, url, active: $('eventLinksActive').checked, previousId: editing || undefined },
    editing ? 'Link atualizado.' : 'Link adicionado.');
  if (ok) fillForm(null);
}

async function toggle(id) {
  const link = state.links.find(l => l.id === id); if (!link) return;
  const ev = state.events.find(e => e.id === link.eventType || e.eventType === link.eventType);
  await save({ eventType: ev ? ev.id : link.eventType, schedule: link.schedule, url: link.url, active: link.active === false },
    link.active === false ? 'Link reativado.' : 'Link desativado.');
}

async function remove(id) {
  const link = state.links.find(l => l.id === id); if (!link || !canEdit() || state.busy) return;
  const uid = window.firebaseAuth?.currentUser?.uid;
  const ok = typeof window.showConfirm === 'function'
    ? await window.showConfirm('Excluir link', `Excluir o link de ${eventLabel(link)} às ${link.schedule}? Esta ação não pode ser desfeita.`, 'Excluir')
    : window.confirm('Excluir este link?');
  if (!ok || uid !== window.firebaseAuth?.currentUser?.uid || !canEdit()) return;
  state.busy = true; setStatus(); render();
  try {
    await eventAccessRequest('remove', { id });
    if (uid !== window.firebaseAuth?.currentUser?.uid) return;
    state.links = state.links.filter(l => l.id !== id);
    if (state.editingId === id) fillForm(null);
    setStatus('success', 'Link excluído.'); toast('success', 'Link excluído.');
  } catch (e) {
    if (uid !== window.firebaseAuth?.currentUser?.uid) return;
    const m = errMsg(e); setStatus('error', m); toast('error', m);
  } finally { if (uid === window.firebaseAuth?.currentUser?.uid) { state.busy = false; render(); } }
}

function render() {
  const root = $('eventLinksRoot'); if (!root) return;
  if (!root.dataset.built) build(root);
  const editable = canEdit();
  $('eventLinksFormWrap').classList.toggle('hidden', !editable);
  $('eventLinksReadonly').classList.toggle('hidden', editable || !state.loadedAt);
  const sel = $('eventLinksEvent');
  const cur = sel.value;
  const prompt = state.loading ? 'Carregando eventos...' : state.events.length ? 'Selecione o evento' : 'Nenhum evento cadastrado';
  sel.innerHTML = `<option value="">${prompt}</option>` +
    state.events.map(e => `<option value="${esc(e.id)}">${esc(e.label || e.id)}</option>`).join('');
  sel.value = cur;
  root.querySelectorAll('#eventLinksForm input, #eventLinksForm select, #eventLinksForm button').forEach(el => {
    el.disabled = state.busy || state.loading || !state.events.length; el.style.pointerEvents = ''; el.style.opacity = '';
  });
  const refresh = $('eventLinksRefresh');
  refresh.disabled = state.loading; refresh.style.pointerEvents = 'auto'; refresh.style.opacity = state.loading ? '0.6' : '1';
  refresh.innerHTML = `<i class="fas fa-sync-alt ${state.loading ? 'fa-spin' : ''}"></i><span>Atualizar</span>`;
  const filterEl = $('eventLinksFilter');
  filterEl.disabled = false; filterEl.readOnly = false; filterEl.style.pointerEvents = 'auto'; filterEl.style.opacity = '1';

  const list = $('eventLinksList');
  const active = state.links.filter(l => l.active !== false).length;
  $('eventLinksCount').textContent = state.loadedAt ? `${state.links.length} links, ${active} ativos` : '';

  if (state.error) {
    $('eventLinksLoadError').classList.remove('hidden');
    $('eventLinksLoadErrorMsg').textContent = state.error + (state.loadedAt ? ' Exibindo os últimos dados carregados.' : '');
  } else $('eventLinksLoadError').classList.add('hidden');

  if (state.loading && !state.loadedAt) {
    list.innerHTML = Array.from({ length: 3 }).map(() =>
      '<div class="h-16 rounded-lg bg-gray-100 animate-pulse"></div>').join('');
    return;
  }
  if (!state.loadedAt) { list.innerHTML = ''; return; }
  const f = state.filter.trim().toLowerCase();
  const rows = state.links
    .filter(l => !f || `${eventLabel(l)} ${l.schedule} ${l.url}`.toLowerCase().includes(f))
    .sort((a, b) => eventLabel(a).localeCompare(eventLabel(b)) || scheduleSortKey(a.schedule) - scheduleSortKey(b.schedule));
  if (!rows.length) {
    list.innerHTML = `<div class="border border-dashed border-gray-300 rounded-xl p-8 text-center">
      <i class="fas fa-link text-gray-300 text-2xl mb-2"></i>
      <p class="text-sm font-semibold text-gray-700">${f ? 'Nenhum link corresponde à busca.' : 'Nenhum link cadastrado ainda.'}</p>
      <p class="text-xs text-gray-500 mt-1">${f ? 'Ajuste o filtro para ver outros resultados.' : (editable ? 'Use o formulário acima para vincular um link a um evento e horário.' : 'Quando a equipe cadastrar links, eles aparecem aqui.')}</p></div>`;
    return;
  }
  list.innerHTML = rows.map(l => {
    const on = l.active !== false;
    const editing = state.editingId === l.id;
    const actions = editable ? `
      <div class="flex items-center gap-2 shrink-0">
        <button data-act="edit" data-id="${esc(l.id)}" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50" ${state.busy ? 'disabled' : ''}>Editar</button>
        <button data-act="toggle" data-id="${esc(l.id)}" class="px-3 py-1.5 text-xs font-semibold rounded-lg border ${on ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}" ${state.busy ? 'disabled' : ''}>${on ? 'Desativar' : 'Reativar'}</button>
        <button data-act="remove" data-id="${esc(l.id)}" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50" ${state.busy ? 'disabled' : ''}>Excluir</button>
      </div>` : '';
    return `<div class="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border ${editing ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200'} ${on ? '' : 'opacity-70'}">
      <div class="w-16 shrink-0 text-center"><div class="text-lg font-bold text-gray-800 tabular-nums">${esc(l.schedule)}</div></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-sm text-gray-800">${esc(eventLabel(l))}</span>
          <span class="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}">${on ? 'Ativo' : 'Inativo'}</span>
        </div>
        <a href="${validUrl(l.url) ? esc(l.url) : '#'}" target="_blank" rel="noopener noreferrer" class="block text-xs text-blue-600 hover:underline truncate mt-0.5" style="pointer-events:auto;opacity:1">${esc(l.url)}</a>
      </div>${actions}</div>`;
  }).join('');
}

function build(root) {
  root.dataset.built = '1';
  root.innerHTML = `
    <div id="eventLinksStatus" class="hidden"></div>
    <div id="eventLinksLoadError" class="hidden mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 flex items-center justify-between gap-3">
      <span id="eventLinksLoadErrorMsg"></span>
      <button type="button" id="eventLinksRetry" class="px-3 py-1 text-xs font-semibold rounded border border-red-300 bg-white hover:bg-red-100" style="pointer-events:auto;opacity:1">Tentar novamente</button>
    </div>
    <div id="eventLinksReadonly" class="hidden mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600">
      <i class="fas fa-eye mr-1"></i>Modo somente visualização. Apenas CEO, Admin e Gerente podem alterar links.
    </div>
    <div id="eventLinksFormWrap" class="hidden mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50">
      <h4 id="eventLinksFormTitle" class="font-semibold text-sm text-gray-800 mb-3">Novo link</h4>
      <form id="eventLinksForm" class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end" novalidate>
        <label class="md:col-span-3 text-xs font-medium text-gray-600">Evento
          <select id="eventLinksEvent" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"></select></label>
        <label class="md:col-span-2 text-xs font-medium text-gray-600">Horário
          <input id="eventLinksSchedule" type="text" placeholder="19h ou 19:30" class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"></label>
        <label class="md:col-span-4 text-xs font-medium text-gray-600">URL de acesso
          <input id="eventLinksUrl" type="url" placeholder="https://..." class="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"></label>
        <label class="md:col-span-1 flex items-center gap-2 text-xs font-medium text-gray-600 pb-2.5">
          <input id="eventLinksActive" type="checkbox" checked class="rounded"> Ativo</label>
        <div class="md:col-span-2 flex gap-2">
          <button id="eventLinksSubmit" type="submit" class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">Adicionar link</button>
          <button id="eventLinksCancel" type="button" class="hidden px-3 py-2 border border-gray-300 bg-white rounded-lg text-xs font-semibold hover:bg-gray-100">Cancelar</button>
        </div>
      </form>
      <p class="text-[11px] text-gray-500 mt-2">O link vale para todas as datas do evento naquele horário. Aceita qualquer URL http ou https.</p>
      <div id="eventLinksFormError" class="hidden mt-2 text-xs text-red-600"></div>
    </div>
    <div class="flex items-center justify-between gap-3 mb-3">
      <input id="eventLinksFilter" type="search" placeholder="Filtrar por evento, horário ou URL" class="w-full md:w-72 border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
      <span id="eventLinksCount" class="text-xs text-gray-500 whitespace-nowrap"></span>
    </div>
    <div id="eventLinksList" class="space-y-2"></div>`;
  $('eventLinksForm').addEventListener('submit', submitForm);
  $('eventLinksCancel').addEventListener('click', () => { fillForm(null); render(); });
  $('eventLinksRetry').addEventListener('click', () => load(true));
  $('eventLinksRefresh').addEventListener('click', () => load(true));
  $('eventLinksFilter').addEventListener('input', (e) => { state.filter = e.target.value; render(); });
  $('eventLinksList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') {
      fillForm(state.links.find(l => l.id === id)); render();
      $('eventLinksFormWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (b.dataset.act === 'toggle') toggle(id);
    else if (b.dataset.act === 'remove') remove(id);
  });
}

export async function openEventLinksAdmin(opts = {}) {
  if (!roleAllowed() || !sectionVisible()) return;
  hookAuth();
  const root = $('eventLinksRoot');
  if (root && !root.dataset.built) build(root);
  if (!state.editingId) fillForm(null);
  await load(!!opts.force);
}
