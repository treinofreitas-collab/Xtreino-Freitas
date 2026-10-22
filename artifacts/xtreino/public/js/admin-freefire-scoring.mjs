const EVENTS = [
  ['TREINO FREITAS', 'treino'],
  ['INTENSIVO FREITAS', 'intensivo'],
  ['CAMP FREITAS', 'camp'],
  ['SEMANAL FREITAS', 'semanal'],
];
const PLACE_POINTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0];
const SUPPORTED_IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_ANALYSIS_IMAGE_BYTES = 900 * 1024;
const DB_NAME = 'freitas-freefire-config';
const DB_STORE = 'table-templates';
function createSession(event) {
  return {
    event,
    dropsCount: 3,
    teams: Array.from({ length: 12 }, (_, i) => ({ slot: i + 1, teamName: '' })),
    rosterText: '',
    rosterImages: [],
    slotImages: [],
    drops: Array.from({ length: 5 }, blankDrop),
    activeDrop: 0,
  };
}
const sessions = new Map(EVENTS.map(([, key]) => [key, createSession(key)]));
const imagePreviewUrls = new Map();
const state = {
  ...createSession('treino'),
  busy: false, error: '', message: '', built: false, template: null, templateName: '',
};
let previewUrl = '';
function blankDrop() { return { resultImages: [], placements: [], unmatchedPlayers: [], analyzed: false, reviewed: false }; }
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const allowed = ['ceo', 'socio', 'sócio', 'gerente', 'admin'];
function canOpen() { return allowed.includes(String(window.lastAppliedRole || window.adminRoleLower || '').toLowerCase().trim()); }
function readOnly() { return ['socio', 'sócio'].includes(String(window.lastAppliedRole || window.adminRoleLower || '').toLowerCase().trim()); }
function visible() { return $('sectionFreefireScoring')?.style.display !== 'none'; }

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getTemplate(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function putTemplate(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function loadTemplate() {
  try {
    const value = await getTemplate(state.event);
    state.template = value?.blob || null;
    state.templateName = value?.name || '';
  } catch (error) {
    state.template = null;
    state.templateName = '';
    state.error = `Não foi possível acessar o modelo local neste navegador: ${error.message}`;
  }
}
export function parseRoster(text) {
  const parsed = new Map();
  String(text || '').split(/\r?\n/).forEach(line => {
    const normalizedLine = line.normalize('NFKC').trim().replace(
      /^[\s\u200b\ufeff\p{M}\p{P}\p{S}\p{Extended_Pictographic}\u200d\ufe0e\ufe0f]+(?=(?:slot\b|\d{1,2}\s*(?:[,;:.\-]|\s)))/iu,
      '',
    );
    const match = normalizedLine.match(/^\s*(?:slot\s*)?(\d{1,2})\s*(?:[,;:.\-]\s*|\s+)(.+?)\s*$/i);
    if (!match) return;
    const slot = Number(match[1]);
    const name = match[2]
      .trim()
      .replace(/[\s\u200b\ufeff]*[\p{Extended_Pictographic}\u200d\ufe0e\ufe0f]+[\s\u200b\ufeff]*$/gu, '')
      .trim();
    if (Number.isInteger(slot) && slot >= 1 && slot <= 12 && name) parsed.set(slot, name);
  });
  return Array.from({ length: 12 }, (_, i) => ({ slot: i + 1, teamName: parsed.get(i + 1) || '' }));
}
function hasCompleteRoster() {
  return state.teams.length === 12 && state.teams.every(team => team.teamName.trim());
}
function canAnalyzeDrop(drop) {
  return !state.busy && state.slotImages.length === 3 && !!drop.resultImages.length &&
    hasCompleteRoster();
}
function validateImageFiles(files, maxCount) {
  if (!files.length || files.length > maxCount) throw new Error(`Selecione de 1 a ${maxCount} imagens para esta etapa.`);
  if (files.some(file => !SUPPORTED_IMAGES.has(file.type))) throw new Error('Use imagens PNG, JPG ou WebP.');
}
function saveActiveSession() {
  sessions.set(state.event, {
    event: state.event,
    dropsCount: state.dropsCount,
    teams: state.teams,
    rosterText: state.rosterText,
    rosterImages: state.rosterImages,
    slotImages: state.slotImages,
    drops: state.drops,
    activeDrop: state.activeDrop,
  });
}
function dropReviewIssue(drop) {
  if (!drop.analyzed || !drop.placements.length) return 'Analise todas as quedas selecionadas antes de exportar.';
  if (!drop.reviewed) return 'Confirme que revisou todos os dados desta queda.';
  const positions = new Set();
  const slots = new Set();
  for (const placement of drop.placements) {
    const position = Number(placement.position);
    const slot = Number(placement.slot);
    if (!Number.isInteger(position) || position < 1 || position > 12) return 'Corrija as colocações para valores entre 1 e 12.';
    if (!Number.isInteger(slot) || slot < 1 || slot > 12 || !state.teams[slot - 1]?.teamName.trim()) return 'Associe cada colocação a um slot com equipe.';
    if (positions.has(position)) return 'Há colocações repetidas nesta queda.';
    if (slots.has(slot)) return 'Há equipes repetidas nesta queda.';
    if (!Number.isInteger(Number(placement.kills)) || Number(placement.kills) < 0) return 'Corrija os abates desta queda.';
    positions.add(position);
    slots.add(slot);
  }
  return '';
}
function canExport() {
  return !!state.template && hasCompleteRoster() &&
    state.drops.slice(0, state.dropsCount).every(drop => !dropReviewIssue(drop)) &&
    standings().some(row => row.teamName) && !state.busy;
}
function exportIssue() {
  if (!state.template) return 'Envie o modelo em branco deste evento para habilitar o PNG.';
  if (!hasCompleteRoster()) return 'Preencha os nomes dos 12 slots antes de exportar.';
  const issue = state.drops.slice(0, state.dropsCount).map(dropReviewIssue).find(Boolean);
  return issue || 'O PNG mantém as dimensões originais do modelo.';
}
function setNotice(type, message) {
  state.error = type === 'error' ? message : '';
  state.message = type === 'success' ? message : '';
  const box = $('ffNotice');
  if (!box) return;
  box.className = `ff-notice ${type}`;
  box.textContent = message;
}
function render() {
  const root = $('freefireScoringRoot');
  if (!root || !canOpen() || !visible()) return;
  if (!state.built) build(root);
  $('ffEvent').value = state.event;
  $('ffDrops').value = String(state.dropsCount);
  const viewer = readOnly();
  $('ffEvent').disabled = viewer;
  $('ffDrops').disabled = viewer;
  $('ffRosterText').disabled = viewer;
  $('ffTemplateUpload').disabled = viewer;
  $('ffRosterUpload').disabled = viewer;
  $('ffAnalyzeRoster').disabled = viewer || state.busy || !state.rosterImages.length;
  $('ffTemplateName').textContent = state.templateName || 'Nenhum modelo configurado para este evento';
  $('ffTemplateHint').textContent = state.template ? 'Modelo salvo somente neste navegador.' : 'Envie o modelo oficial em branco para liberar a exportação.';
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = state.template ? URL.createObjectURL(state.template) : '';
  $('ffTemplatePreview').innerHTML = state.template
    ? `<img alt="Prévia do modelo ${esc(state.event)}" src="${previewUrl}">`
    : '<div class="ff-template-empty"><span>—</span><b>Modelo indisponível</b><small>Não há arte de tabela cadastrada para este evento.</small></div>';
  $('ffRosterText').value = state.rosterText;
  $('ffRosterRows').innerHTML = state.teams.map(team => `
    <label class="ff-roster-row"><span class="ff-slot">${String(team.slot).padStart(2, '0')}</span>
      <input data-team-slot="${team.slot}" aria-label="Equipe do slot ${team.slot}" value="${esc(team.teamName)}" placeholder="Nome da equipe" ${viewer ? 'disabled' : ''}></label>`).join('');
  $('ffDropTabs').innerHTML = Array.from({ length: state.dropsCount }, (_, i) =>
    `<button type="button" class="ff-drop-tab ${i === state.activeDrop ? 'active' : ''}" data-drop="${i}">QUEDA ${String(i + 1).padStart(2, '0')}<small>${state.drops[i].reviewed ? 'Revisado' : state.drops[i].analyzed ? 'Aguardando revisão' : 'Pendente'}</small></button>`).join('');
  const dropIndex = Math.min(state.activeDrop || 0, state.dropsCount - 1);
  state.activeDrop = dropIndex;
  const drop = state.drops[dropIndex];
  $('ffCurrentDrop').textContent = `Queda ${dropIndex + 1}`;
  renderSelectedImages('ffSlotFiles', 'ffSlotPreviews', state.slotImages, 'lobby', !viewer && !state.busy);
  renderSelectedImages('ffResultFiles', 'ffResultPreviews', drop.resultImages, 'result', !viewer && !state.busy);
  $('ffSlotHelp').textContent = state.slotImages.length === 3
    ? '3 fotos cadastradas. Elas serão reutilizadas em todas as quedas deste evento.'
    : `Adicione ${3 - state.slotImages.length} foto(s) do lobby para liberar a análise das quedas.`;
  const totalImageBytes = [...state.slotImages, ...drop.resultImages].reduce((total, file) => total + file.size, 0);
  $('ffAnalyzeDrop').disabled = viewer || !canAnalyzeDrop(drop);
  const uploadHelp = $('ffUploadHelp');
  uploadHelp.classList.remove('error');
  uploadHelp.textContent = totalImageBytes
    ? `Imagens selecionadas: ${(totalImageBytes / 1024 / 1024).toFixed(1)} MB. Elas serão otimizadas automaticamente e enviadas ao clicar em “Analisar esta queda”.`
    : 'Você pode adicionar as imagens uma por vez. Até 3 do lobby e 2 do placar; elas serão otimizadas e enviadas ao clicar em “Analisar esta queda”.';
  $('ffSlotUpload').disabled = viewer;
  $('ffResultUpload').disabled = viewer;
  $('ffExtraction').classList.toggle('ff-readonly', viewer);
  $('ffBusy').classList.toggle('hidden', !state.busy);
  $('ffBusyLabel').textContent = 'Otimizando imagens e analisando';
  const ranked = standings();
  $('ffStandingsCount').textContent = ranked.filter(row => row.teamName).length ? `${ranked.filter(row => row.teamName).length} equipes` : 'Aguardando resultados';
  $('ffStandings').innerHTML = ranked.filter(row => row.teamName).map((row, index) => `
    <tr><td class="ff-rank">${String(index + 1).padStart(2, '0')}</td><td><strong>${esc(row.teamName)}</strong><small>Slot ${String(row.slot).padStart(2, '0')}</small></td>
    <td>${row.wins}</td><td>${row.kills}</td><td class="ff-total">${row.points}</td></tr>`).join('') ||
    '<tr><td colspan="5" class="ff-empty-row">Cadastre as equipes e analise os resultados para montar o placar.</td></tr>';
  $('ffExport').disabled = !canExport();
  $('ffExportNote').textContent = exportIssue();
  renderPlacements(drop);
  if (state.error) setNotice('error', state.error);
  else if (state.message) setNotice('success', state.message);
  else $('ffNotice').className = 'ff-notice hidden';
}
function filesLabel(files) {
  return files.length ? files.map(file => file.name).join(' · ') : 'Nenhuma imagem selecionada';
}
export function appendImages(current, incoming, maxCount, label) {
  if (incoming.some(file => !SUPPORTED_IMAGES.has(file.type))) {
    throw new Error('Use somente imagens PNG, JPG ou WebP.');
  }
  const keys = new Set(current.map(file => `${file.name}\u0000${file.size}\u0000${file.lastModified}`));
  const additions = incoming.filter(file => {
    const key = `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  if (current.length + additions.length > maxCount) {
    throw new Error(`Você pode adicionar até ${maxCount} imagens ${label}. Já há ${current.length} selecionada(s).`);
  }
  return [...current, ...additions];
}
function renderSelectedImages(labelId, previewId, files, scope, allowRemove) {
  const label = $(labelId);
  label.textContent = filesLabel(files);
  label.title = files.map(file => file.name).join('\n');
  const previews = $(previewId);
  previews.innerHTML = files.map((file, index) => {
    let url = imagePreviewUrls.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      imagePreviewUrls.set(file, url);
    }
    return `<div class="ff-image-preview" title="${esc(file.name)}"><img src="${url}" alt=""><span class="ff-image-name">${esc(file.name)}</span>${allowRemove ? `<button type="button" class="ff-remove-image" data-remove-image="${scope}" data-image-index="${index}" aria-label="Remover ${esc(file.name)}" title="Remover imagem">×</button>` : ''}</div>`;
  }).join('');
}
function revokeImagePreviews(files) {
  files.forEach(file => {
    const url = imagePreviewUrls.get(file);
    if (!url) return;
    URL.revokeObjectURL(url);
    imagePreviewUrls.delete(file);
  });
}
function resetDropAnalysis(drop) {
  drop.analyzed = false;
  drop.reviewed = false;
  drop.placements = [];
  drop.unmatchedPlayers = [];
}
function removeUploadedImage(scope, index) {
  if (readOnly() || state.busy || !Number.isInteger(index) || index < 0) return;
  const currentDrop = state.drops[state.activeDrop];
  const files = scope === 'lobby' ? state.slotImages : currentDrop?.resultImages;
  const file = files?.[index];
  if (!file) return;

  const affectedDrops = scope === 'lobby'
    ? state.drops.filter(drop => drop.analyzed)
    : currentDrop?.analyzed ? [currentDrop] : [];
  if (affectedDrops.length) {
    const message = scope === 'lobby'
      ? 'Remover esta foto do lobby invalida as análises de todas as quedas já analisadas. Continuar?'
      : 'Remover esta foto invalida a análise desta queda. Continuar?';
    if (!window.confirm(message)) return;
  }

  files.splice(index, 1);
  revokeImagePreviews([file]);
  affectedDrops.forEach(resetDropAnalysis);
  render();
}
function confidenceValue(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'high') return 0.9;
    if (normalized === 'medium') return 0.6;
    if (normalized === 'low') return 0.3;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}
function renderPlacements(drop) {
  const wrap = $('ffExtraction');
  if (!drop.analyzed) {
    wrap.innerHTML = '<div class="ff-empty-extraction"><span class="ff-empty-mark">01</span><div><b>A extração aparece aqui para conferência</b><p>Envie as imagens do lobby e do placar. A análise só começa quando você clicar em analisar.</p></div></div>';
    return;
  }
  const low = drop.placements.filter(p => confidenceValue(p.confidence) < 0.75);
  const unmatched = drop.unmatchedPlayers || [];
  wrap.innerHTML = `
      ${(low.length || unmatched.length) ? `<div class="ff-review-alert"><b>Revisão necessária</b><span>${low.length ? `${low.length} leitura(s) com baixa confiança. ` : ''}${unmatched.length ? `${unmatched.length} jogador(es) sem equipe vinculada.` : ''}</span>
      ${unmatched.length ? `<small>Sem vínculo: ${unmatched.map(esc).join(' · ')}</small>` : ''}</div>` : '<div class="ff-clean-alert"><b>Extração pronta para revisão</b><span>Confira os dados antes de considerar esta queda final.</span></div>'}
    <div class="ff-table-scroll"><table class="ff-edit-table"><thead><tr><th>Slot</th><th>Equipe</th><th>Colocação</th><th>Abates</th><th>Leitura</th></tr></thead><tbody>
    ${drop.placements.map((p, i) => `<tr>
      <td><select data-edit="slot" data-index="${i}" aria-label="Slot da equipe" ${readOnly() ? 'disabled' : ''}><option value="" ${p.slot == null ? 'selected' : ''}>—</option>${Array.from({ length: 12 }, (_, x) => `<option value="${x + 1}" ${Number(p.slot) === x + 1 ? 'selected' : ''}>${String(x + 1).padStart(2, '0')}</option>`).join('')}</select></td>
      <td><strong class="ff-reviewed-team">${esc(state.teams[Number(p.slot) - 1]?.teamName || p.teamName || 'Não identificada')}</strong>
        ${p.players?.length ? `<small class="ff-player-list">Jogadores: ${p.players.map(player => `${esc(player.name)} (${Number(player.kills) || 0})`).join(' · ')}</small>` : ''}</td>
      <td><input data-edit="position" data-index="${i}" aria-label="Colocação" type="number" min="1" max="12" value="${esc(p.position)}" ${readOnly() ? 'disabled' : ''}></td>
      <td><input data-edit="kills" data-index="${i}" aria-label="Abates" type="number" min="0" value="${esc(p.kills)}" ${readOnly() ? 'disabled' : ''}></td>
      <td><span class="ff-confidence ${confidenceValue(p.confidence) < .75 ? 'low' : ''}">${Math.round(confidenceValue(p.confidence) * 100)}%</span>${p.notes ? `<small class="ff-row-note">${esc(p.notes)}</small>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="ff-empty-row">Nenhuma equipe identificada nesta queda.</td></tr>'}</tbody></table></div>
    ${drop.placements.length ? `<label class="ff-review-confirm"><input type="checkbox" data-review-drop ${drop.reviewed ? 'checked' : ''} ${readOnly() ? 'disabled' : ''}><span>Revisei as colocações, os slots e os abates desta queda, incluindo os avisos de jogadores sem vínculo.</span></label>` : ''}`;
}
export function calculateStandings(teams, drops, dropsCount) {
  const totals = new Map();
  teams.forEach(team => {
    if (!team.teamName.trim()) return;
    totals.set(team.slot, {
      slot: team.slot,
      teamName: team.teamName.trim(),
      wins: 0,
      kills: 0,
      points: 0,
      placementsByDrop: Array.from({ length: dropsCount }, () => null),
    });
  });
  const selectedDrops = drops.slice(0, dropsCount);
  selectedDrops.forEach((drop, dropIndex) => {
    if (!drop.analyzed) return;
    drop.placements.forEach(p => {
      const slot = Number(p.slot), total = totals.get(slot);
      if (!total) return;
      const pos = Number(p.position), kills = Math.max(0, Number(p.kills) || 0);
      if (!Number.isInteger(pos) || pos < 1 || pos > 12) return;
      total.placementsByDrop[dropIndex] = pos;
      total.wins += pos === 1 ? 1 : 0;
      total.kills += kills;
      total.points += PLACE_POINTS[pos - 1] + kills;
    });
  });
  const standings = [...totals.values()].sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.kills - a.kills || a.slot - b.slot
  );
  const samePrimaryScore = (a, b) =>
    a.points === b.points && a.wins === b.wins && a.kills === b.kills;

  for (let start = 0; start < standings.length;) {
    let end = start + 1;
    while (end < standings.length && samePrimaryScore(standings[start], standings[end])) end += 1;
    const tiedTeams = standings.slice(start, end);

    if (tiedTeams.length > 1) {
      const lastDropIndex = selectedDrops.length - 1;
      const allPlayedLastDrop = lastDropIndex >= 0 &&
        tiedTeams.every(team => team.placementsByDrop[lastDropIndex] !== null);

      if (allPlayedLastDrop) {
        tiedTeams.sort((a, b) =>
          a.placementsByDrop[lastDropIndex] - b.placementsByDrop[lastDropIndex] ||
          a.slot - b.slot
        );
      } else {
        const headToHeadWins = new Map(tiedTeams.map(team => [team.slot, 0]));
        for (let dropIndex = 0; dropIndex < selectedDrops.length; dropIndex += 1) {
          for (let left = 0; left < tiedTeams.length; left += 1) {
            for (let right = left + 1; right < tiedTeams.length; right += 1) {
              const teamA = tiedTeams[left], teamB = tiedTeams[right];
              const positionA = teamA.placementsByDrop[dropIndex];
              const positionB = teamB.placementsByDrop[dropIndex];
              if (positionA === null || positionB === null || positionA === positionB) continue;
              const winnerSlot = positionA < positionB ? teamA.slot : teamB.slot;
              headToHeadWins.set(winnerSlot, headToHeadWins.get(winnerSlot) + 1);
            }
          }
        }
        tiedTeams.sort((a, b) =>
          headToHeadWins.get(b.slot) - headToHeadWins.get(a.slot) ||
          a.slot - b.slot
        );
      }
      standings.splice(start, tiedTeams.length, ...tiedTeams);
    }
    start = end;
  }
  return standings;
}
function standings() {
  return calculateStandings(state.teams, state.drops, state.dropsCount);
}
function build(root) {
  state.built = true;
  root.innerHTML = `
    <header class="ff-hero">
      <div><div class="ff-eyebrow"><span></span> OPERAÇÕES / COMPETITIVO</div><h1>Placar <em>Free Fire</em></h1>
        <p>Da leitura do lobby à tabela oficial. Revise cada extração antes de fechar a pontuação.</p></div>
      <div class="ff-session"><span class="ff-session-dot"></span><div><b>Sessão em andamento</b><small>Dados não salvos após sair desta tela</small></div></div>
    </header>
    <div id="ffNotice" class="ff-notice hidden" role="status"></div>
    <div id="ffBusy" class="ff-busy hidden"><span class="ff-skeleton"></span><div><b id="ffBusyLabel">Analisando imagens</b><small>Isso pode levar alguns instantes. Não feche esta seção.</small></div></div>
    <div class="ff-layout">
      <div class="ff-work-column">
        <section class="ff-panel ff-event-panel">
          <div class="ff-panel-heading"><div class="ff-step">01</div><div><h2>Configuração do evento</h2><p>Selecione o formato e a quantidade de quedas.</p></div></div>
          <div class="ff-config-grid">
            <label class="ff-field">Evento<select id="ffEvent">${EVENTS.map(([label, key]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
            <label class="ff-field">Quantidade de quedas<select id="ffDrops">${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${n} ${n === 1 ? 'queda' : 'quedas'}</option>`).join('')}</select></label>
          </div>
          <div class="ff-template-config"><div class="ff-template-preview" id="ffTemplatePreview"></div><div class="ff-template-meta"><span class="ff-mini-label">TABELA EM BRANCO</span><b id="ffTemplateName"></b><small id="ffTemplateHint"></small><label class="ff-button ff-button-light" for="ffTemplateUpload"><i class="fas fa-upload"></i> Enviar ou substituir</label><input id="ffTemplateUpload" type="file" accept="image/png,image/jpeg,image/webp" hidden></div></div>
          <p class="ff-note">Cada evento mantém seu próprio modelo neste navegador. A imagem exportada preserva as dimensões originais do arquivo.</p>
        </section>
        <section class="ff-panel">
          <div class="ff-panel-heading"><div class="ff-step">02</div><div><h2>Lista oficial de slots</h2><p>Doze posições fixas. Um slot sem equipe não participa do placar.</p></div></div>
          <label class="ff-field">Cole lista ou CSV <span class="ff-field-hint">Aceita também a lista decorada com letras/números estilizados</span><textarea id="ffRosterText" rows="4" placeholder="1, Equipe Freitas&#10;⃟🩵 𝑺𝑳𝑶𝑻 𝟎𝟏: KЯ E-SPORT🍀&#10;..."></textarea></label>
          <div class="ff-roster-actions"><label class="ff-button ff-button-light" for="ffRosterUpload"><i class="fas fa-image"></i> Importar lista por imagem</label><input id="ffRosterUpload" type="file" accept="image/png,image/jpeg,image/webp,.csv,.txt" multiple hidden><span id="ffRosterFileLabel" class="ff-file-label">Nenhuma imagem selecionada</span><button type="button" id="ffAnalyzeRoster" class="ff-button ff-button-light" disabled><i class="fas fa-wand-magic-sparkles"></i> Analisar lista</button></div>
          <div id="ffRosterRows" class="ff-roster-grid"></div>
        </section>
        <section class="ff-panel ff-lobby-panel">
          <div class="ff-panel-heading"><div class="ff-step">03</div><div><h2>Slots do lobby</h2><p>Envie as 3 fotos uma vez. Elas serão reutilizadas em todas as quedas deste evento.</p></div></div>
          <div class="ff-lobby-upload">
            <label class="ff-upload-tile"><input id="ffSlotUpload" type="file" accept="image/png,image/jpeg,image/webp" multiple><i class="fas fa-border-all"></i><b>Slots do lobby (3 fotos)</b><small id="ffSlotFiles">Nenhuma imagem selecionada</small><span>Adicionar fotos</span></label>
            <div id="ffSlotPreviews" class="ff-image-previews" aria-live="polite"></div>
          </div>
          <p id="ffSlotHelp" class="ff-upload-help">Adicione as 3 fotos do lobby uma única vez.</p>
        </section>
        <section class="ff-panel ff-drop-panel">
          <div class="ff-panel-heading"><div class="ff-step">04</div><div><h2>Placar final por queda</h2><p>Envie o resultado de cada queda. As fotos fixas do lobby serão usadas automaticamente.</p></div></div>
          <div id="ffDropTabs" class="ff-drop-tabs"></div>
          <div class="ff-current-drop"><div><span class="ff-mini-label">IMAGENS DA</span><h3 id="ffCurrentDrop">Queda 1</h3></div>
            <div class="ff-image-inputs">
              <div class="ff-upload-column">
                <label class="ff-upload-tile"><input id="ffResultUpload" type="file" accept="image/png,image/jpeg,image/webp" multiple><i class="fas fa-list-ol"></i><b>Placar final (até 2 fotos)</b><small id="ffResultFiles">Nenhuma imagem selecionada</small><span>Adicionar fotos</span></label>
                <div id="ffResultPreviews" class="ff-image-previews" aria-live="polite"></div>
              </div>
            </div>
            <button type="button" id="ffAnalyzeDrop" class="ff-button ff-button-primary"><i class="fas fa-wand-magic-sparkles"></i> Analisar esta queda</button>
          </div>
          <p id="ffUploadHelp" class="ff-upload-help">As 3 fotos do lobby cadastradas acima serão reutilizadas nesta queda. Adicione até 2 fotos do placar; as imagens serão otimizadas ao analisar.</p>
          <div id="ffExtraction" class="ff-extraction"></div>
        </section>
      </div>
      <aside class="ff-panel ff-standings-panel">
        <div class="ff-standings-head"><div><span class="ff-mini-label">CLASSIFICAÇÃO GERAL</span><h2>Leaderboard</h2></div><span id="ffStandingsCount" class="ff-count"></span></div>
        <div class="ff-score-key"><span><b>B!</b> Vitórias</span><span><b>A!</b> Abates</span><span><b>P!</b> Pontos</span></div>
        <div class="ff-table-scroll"><table class="ff-standing-table"><thead><tr><th>#</th><th>Equipe</th><th>B!</th><th>A!</th><th>P!</th></tr></thead><tbody id="ffStandings"></tbody></table></div>
        <div class="ff-points-rule"><i class="fas fa-circle-info"></i><span><b>Pontuação oficial</b><br>12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0 pontos por colocação + 1 ponto por abate.<br><b>Desempate após P!:</b> B! → A! → colocação na última queda (se todos jogaram) → confronto direto (vitórias nas quedas em comum).</span></div>
        <button type="button" id="ffExport" class="ff-button ff-button-export" disabled><i class="fas fa-file-image"></i> Exportar tabela PNG</button>
        <p class="ff-export-note" id="ffExportNote">Envie o modelo em branco deste evento para habilitar o PNG.</p>
      </aside>
    </div>`;
  $('ffEvent').addEventListener('change', async e => {
    saveActiveSession();
    const nextEvent = e.target.value;
    const session = sessions.get(nextEvent) || createSession(nextEvent);
    sessions.set(nextEvent, session);
    Object.assign(state, session, { error: '', message: '' });
    await loadTemplate();
    render();
  });
  $('ffDrops').addEventListener('change', e => { state.dropsCount = Number(e.target.value); render(); });
  $('ffRosterText').addEventListener('input', e => {
    state.rosterText = e.target.value;
    const parsed = parseRoster(state.rosterText);
    state.teams = parsed;
    state.drops.forEach(drop => { if (drop.analyzed) drop.reviewed = false; });
    $('ffRosterRows').innerHTML = state.teams.map(team => `<label class="ff-roster-row"><span class="ff-slot">${String(team.slot).padStart(2, '0')}</span><input data-team-slot="${team.slot}" aria-label="Equipe do slot ${team.slot}" value="${esc(team.teamName)}" placeholder="Nome da equipe"></label>`).join('');
    $('ffAnalyzeDrop').disabled = !canAnalyzeDrop(state.drops[state.activeDrop || 0]);
    refreshStandings();
  });
  $('ffRosterRows').addEventListener('input', e => {
    const slot = Number(e.target.dataset.teamSlot);
    if (!slot) return;
    state.teams[slot - 1].teamName = e.target.value;
    state.drops.forEach(drop => { if (drop.analyzed) drop.reviewed = false; });
    state.rosterText = state.teams.filter(team => team.teamName.trim()).map(team => `${team.slot}, ${team.teamName}`).join('\n');
    $('ffRosterText').value = state.rosterText;
    $('ffAnalyzeDrop').disabled = !canAnalyzeDrop(state.drops[state.activeDrop || 0]);
    renderPlacements(state.drops[state.activeDrop || 0]);
    refreshStandings();
  });
  $('ffRosterUpload').addEventListener('change', async e => {
    const selected = [...e.target.files || []];
    const imageFiles = selected.filter(file => SUPPORTED_IMAGES.has(file.type));
    const textFiles = selected.filter(file => /\.(csv|txt)$/i.test(file.name) || ['text/plain', 'text/csv'].includes(file.type));
    const invalidFiles = selected.filter(file => !imageFiles.includes(file) && !textFiles.includes(file));
    state.rosterImages = imageFiles.length > 2 ? [] : imageFiles;
    if (imageFiles.length > 2) setNotice('error', 'Selecione no máximo duas imagens da lista oficial.');
    else if (invalidFiles.length) setNotice('error', 'Alguns arquivos foram ignorados. Use PNG, JPG, WebP, CSV ou TXT.');
    if (textFiles.length > 1) setNotice('error', 'Use apenas um arquivo CSV ou TXT por vez.');
    const textFile = textFiles[0];
    if (textFile) {
      try {
      state.rosterText = await textFile.text();
      state.teams = parseRoster(state.rosterText);
      state.drops.forEach(drop => { if (drop.analyzed) drop.reviewed = false; });
      } catch {
        setNotice('error', 'Não foi possível ler o arquivo da lista.');
      }
    }
    $('ffRosterFileLabel').textContent = state.rosterImages.length ? filesLabel(state.rosterImages) : 'Nenhuma imagem selecionada';
    e.target.value = '';
    render();
  });
  $('ffAnalyzeRoster').addEventListener('click', analyzeRoster);
  $('ffDropTabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-drop]');
    if (tab) { state.activeDrop = Number(tab.dataset.drop); render(); }
  });
  $('ffSlotUpload').addEventListener('change', e => {
    const selected = [...e.target.files];
    try {
      const next = appendImages(state.slotImages, selected, 3, 'do lobby');
      if (next.length !== state.slotImages.length) {
        state.slotImages = next;
        state.drops.forEach(drop => {
          if (!drop.analyzed) return;
          drop.analyzed = false; drop.reviewed = false; drop.placements = []; drop.unmatchedPlayers = [];
        });
      }
    } catch (error) {
      setNotice('error', error.message);
    }
    e.target.value = '';
    render();
  });
  $('ffResultUpload').addEventListener('change', e => {
    const selected = [...e.target.files];
    const drop = state.drops[state.activeDrop];
    try {
      const next = appendImages(drop.resultImages, selected, 2, 'do placar');
      if (next.length !== drop.resultImages.length) {
        drop.resultImages = next;
        drop.analyzed = false; drop.reviewed = false; drop.placements = []; drop.unmatchedPlayers = [];
      }
    } catch (error) {
      setNotice('error', error.message);
    }
    e.target.value = '';
    render();
  });
  const handleRemoveImage = e => {
    const button = e.target.closest('[data-remove-image]');
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    removeUploadedImage(button.dataset.removeImage, Number(button.dataset.imageIndex));
  };
  $('ffSlotPreviews').addEventListener('click', handleRemoveImage);
  $('ffResultPreviews').addEventListener('click', handleRemoveImage);
  $('ffAnalyzeDrop').addEventListener('click', analyzeDrop);
  $('ffExtraction').addEventListener('input', e => {
    if (e.target.matches('[data-review-drop]')) {
      state.drops[state.activeDrop].reviewed = e.target.checked;
      refreshStandings();
      return;
    }
    const field = e.target.dataset.edit;
    if (!field) return;
    const placement = state.drops[state.activeDrop].placements[Number(e.target.dataset.index)];
    if (!placement) return;
    state.drops[state.activeDrop].reviewed = false;
    placement[field] = field === 'slot'
      ? (e.target.value ? Number(e.target.value) : null)
      : field === 'teamName' ? e.target.value : Number(e.target.value);
    if (field === 'slot') placement.teamName = state.teams[Number(placement.slot) - 1]?.teamName || '';
    refreshStandings();
  });
  $('ffExtraction').addEventListener('change', e => {
    if (e.target.matches('[data-review-drop]')) {
      state.drops[state.activeDrop].reviewed = e.target.checked;
      render();
      return;
    }
    const field = e.target.dataset.edit;
    if (!field) return;
    const placement = state.drops[state.activeDrop].placements[Number(e.target.dataset.index)];
    if (placement) {
      state.drops[state.activeDrop].reviewed = false;
      placement[field] = field === 'slot'
        ? (e.target.value ? Number(e.target.value) : null)
        : field === 'teamName' ? e.target.value : Number(e.target.value);
      if (field === 'slot') placement.teamName = state.teams[Number(placement.slot) - 1]?.teamName || '';
      render();
    }
  });
  $('ffTemplateUpload').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Selecione um arquivo PNG, JPG ou WebP.');
      if (file.size > 25 * 1024 * 1024) throw new Error('O modelo deve ter até 25 MB.');
      await putTemplate(state.event, { blob: file, name: file.name });
      await loadTemplate();
      setNotice('success', 'Modelo atualizado e armazenado somente neste navegador.');
    } catch (error) { setNotice('error', error.message || 'Não foi possível salvar o modelo neste navegador.'); }
    e.target.value = '';
    render();
  });
  $('ffExport').addEventListener('click', exportPng);
  render();
}
function refreshStandings() {
  const sorted = standings();
  $('ffStandingsCount').textContent = sorted.filter(row => row.teamName).length ? `${sorted.filter(row => row.teamName).length} equipes` : 'Aguardando resultados';
  $('ffStandings').innerHTML = sorted.filter(row => row.teamName).map((row, index) =>
    `<tr><td class="ff-rank">${String(index + 1).padStart(2, '0')}</td><td><strong>${esc(row.teamName)}</strong><small>Slot ${String(row.slot).padStart(2, '0')}</small></td><td>${row.wins}</td><td>${row.kills}</td><td class="ff-total">${row.points}</td></tr>`).join('') ||
    '<tr><td colspan="5" class="ff-empty-row">Cadastre as equipes e analise os resultados para montar o placar.</td></tr>';
  $('ffExport').disabled = !canExport();
  $('ffExportNote').textContent = exportIssue();
}
export async function optimizeAnalysisImage(file) {
  if (file.size <= MAX_ANALYSIS_IMAGE_BYTES) return file;
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador não consegue otimizar a imagem. Tente usar imagens menores.');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (_) {
    throw new Error(`Não foi possível preparar ${file.name} para análise.`);
  }
  let scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  let quality = 0.9;
  let blob = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) break;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_ANALYSIS_IMAGE_BYTES) {
      bitmap.close?.();
      return blob;
    }
    if (quality > 0.66) quality -= 0.08;
    else { quality = 0.86; scale *= 0.82; }
  }
  bitmap.close?.();
  throw new Error(`Não foi possível reduzir ${file.name} para análise. Tente uma captura com menor resolução.`);
}
async function toPayload(file) {
  const optimized = await optimizeAnalysisImage(file);
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.readAsDataURL(optimized);
  });
  return { mimeType: optimized.type || file.type || 'application/octet-stream', base64 };
}
async function requestAnalyze(payload) {
  const user = window.firebaseAuth?.currentUser;
  if (!user) throw new Error('Sua sessão expirou. Entre novamente no painel.');
  const token = await user.getIdToken();
  let response;
  try {
    response = await fetch('/api/freefire/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    throw new Error('O serviço de análise está indisponível. Nenhuma imagem foi processada; tente novamente mais tarde.');
  }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).error || ''; } catch (_) {}
    if (response.status === 404 || response.status === 501) throw new Error('O endpoint de análise Free Fire não está disponível no servidor. Nenhuma pontuação foi aplicada.');
    throw new Error(detail || `Falha na análise (HTTP ${response.status}). Nenhuma pontuação foi aplicada.`);
  }
  return response.json();
}
async function analyzeRoster() {
  if (!state.rosterImages.length || state.busy) return;
  state.busy = true; state.error = ''; state.message = 'Analisando lista oficial…'; render();
  try {
    validateImageFiles(state.rosterImages, 2);
    const result = await requestAnalyze({ mode: 'roster', images: await Promise.all(state.rosterImages.map(toPayload)) });
    if (!Array.isArray(result.teams)) throw new Error('Resposta inválida do serviço: lista de equipes ausente.');
    const next = Array.from({ length: 12 }, (_, i) => ({ slot: i + 1, teamName: '' }));
    result.teams.forEach(team => {
      const slot = Number(team.slot);
      if (Number.isInteger(slot) && slot > 0 && slot <= 12) next[slot - 1] = { slot, teamName: String(team.teamName || '') };
    });
    state.teams = next;
    state.drops.forEach(drop => { if (drop.analyzed) drop.reviewed = false; });
    state.rosterText = next.filter(team => team.teamName).map(team => `${team.slot}, ${team.teamName}`).join('\n');
    state.message = 'Lista extraída. Revise e corrija os nomes e slots antes de continuar.';
  } catch (error) { state.error = error.message; state.message = ''; }
  finally { state.busy = false; render(); }
}
async function analyzeDrop() {
  const dropIndex = state.activeDrop, drop = state.drops[dropIndex];
  if (state.slotImages.length !== 3 || !drop.resultImages.length || state.busy) return;
  state.busy = true; state.error = ''; state.message = ''; render();
  try {
    if (!hasCompleteRoster()) throw new Error('Preencha os nomes dos 12 slots antes de analisar a queda.');
    if (state.slotImages.length !== 3) throw new Error('Cadastre as 3 fotos na área fixa de slots do lobby.');
    validateImageFiles(state.slotImages, 3);
    validateImageFiles(drop.resultImages, 2);
    validateImageFiles([...state.slotImages, ...drop.resultImages], 5);
    const [slotImages, resultImages] = await Promise.all([
      Promise.all(state.slotImages.map(toPayload)), Promise.all(drop.resultImages.map(toPayload)),
    ]);
    const result = await requestAnalyze({
      mode: 'drop', dropNumber: dropIndex + 1, teams: state.teams,
      slotImages, resultImages,
    });
    if (!Array.isArray(result.placements)) throw new Error('Resposta inválida do serviço: resultados da queda ausentes.');
    drop.placements = result.placements.map(item => {
      const slot = item.slot === null || item.slot === undefined || item.slot === '' ? null : Number(item.slot);
      return {
        position: Number(item.position) || 0,
        slot,
        teamName: slot ? state.teams[slot - 1]?.teamName || '' : '',
        kills: Math.max(0, Number(item.kills) || 0),
        players: Array.isArray(item.players) ? item.players : [],
        confidence: confidenceValue(item.confidence),
        notes: String(item.notes || ''),
      };
    });
    drop.unmatchedPlayers = Array.isArray(result.unmatchedPlayers) ? result.unmatchedPlayers.map(String) : [];
    drop.analyzed = true;
    drop.reviewed = false;
    state.message = `Queda ${dropIndex + 1} extraída. Revise colocação, equipe e abates antes de fechar a pontuação.`;
  } catch (error) { state.error = error.message; state.message = ''; }
  finally { state.busy = false; render(); }
}
async function exportPng() {
  if (!state.template) return;
  try {
    const bitmap = await createImageBitmap(state.template);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    await document.fonts.load('700 48px Stapel');
    const rows = standings();
    const rowTop = bitmap.height * 0.445;
    const rowPitch = bitmap.height * 0.03915;
    // Centers aligned to the empty cells in the supplied 1024px leaderboard template.
    const nameX = bitmap.width * 0.413;
    const winsX = bitmap.width * 0.663;
    const killsX = bitmap.width * 0.737;
    const pointsX = bitmap.width * 0.81;
    const fontSize = Math.max(24, Math.round(bitmap.width * 0.017));
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${fontSize}px Stapel`;
    ctx.fillStyle = '#171717';
    ctx.textAlign = 'center';
    rows.slice(0, 12).forEach((row, index) => {
      const y = rowTop + index * rowPitch;
      ctx.save();
      ctx.font = `700 ${fontSize}px Stapel`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#121212';
      const maxNameWidth = bitmap.width * 0.40;
      let name = row.teamName.toLocaleUpperCase('pt-BR');
      while (name.length > 2 && ctx.measureText(name).width > maxNameWidth) name = `${name.slice(0, -2).trim()}…`;
      ctx.fillText(name, nameX, y, maxNameWidth);
      ctx.fillText(String(row.wins), winsX, y);
      ctx.fillText(String(row.kills), killsX, y);
      ctx.fillText(String(row.points), pointsX, y);
      ctx.restore();
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('O navegador não conseguiu gerar o arquivo PNG.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freitas-${state.event}-leaderboard.png`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('success', `PNG exportado em ${bitmap.width} × ${bitmap.height} px.`);
  } catch (error) { setNotice('error', error.message || 'Falha ao exportar a tabela.'); }
  render();
}
export async function openFreefireScoringAdmin() {
  if (!canOpen() || !visible()) return;
  state.error = '';
  await loadTemplate();
  render();
}
