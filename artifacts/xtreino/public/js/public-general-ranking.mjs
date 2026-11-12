import { getGeneralRankingPage } from './freefire-general-ranking-store.mjs?v=ranking-logo-auto-6';

const PAGE_SIZE = 40;
const rowsRoot = document.getElementById('publicGeneralRankingRows');
const statusRoot = document.getElementById('publicGeneralRankingStatus');
const moreButton = document.getElementById('loadMorePublicGeneralRanking');

let cursor = null;
let loadedCount = 0;
let lastPoints = null;
let lastRank = 0;
let loading = false;
let hasMore = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function safeLogoUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate, document.baseURI);
    return parsed.protocol === 'https:' || parsed.origin === window.location.origin
      ? parsed.href
      : '';
  } catch {
    return '';
  }
}

function showLoadedRankingLogo(image) {
  image.style.opacity = '1';
  if (image.nextElementSibling) image.nextElementSibling.style.display = 'none';
}

function showRankingLogoFallback(image) {
  image.style.display = 'none';
  if (image.nextElementSibling) image.nextElementSibling.style.display = 'grid';
}

function bindRankingLogoEvents(container) {
  for (const image of container.querySelectorAll('img[data-ranking-logo="true"]:not([data-ranking-logo-bound])')) {
    image.dataset.rankingLogoBound = 'true';
    image.addEventListener('load', () => showLoadedRankingLogo(image), { once: true });
    image.addEventListener('error', () => showRankingLogoFallback(image), { once: true });
    if (image.complete) {
      if (image.naturalWidth > 0) showLoadedRankingLogo(image);
      else showRankingLogoFallback(image);
    }
  }
}

function renderRankingRow(team, rank) {
  const name = String(team.teamName || 'Equipe');
  const points = Number(team.totalPoints || 0).toLocaleString('pt-BR');
  const logoUrl = safeLogoUrl(team.logoUrl);
  const initials = escapeHtml(name.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || '?');
  const logo = logoUrl
    ? `<img data-ranking-logo="true" src="${escapeHtml(logoUrl)}" alt="" loading="lazy" style="opacity:0" class="h-10 w-10 shrink-0 rounded-lg bg-slate-100 object-contain p-1"><span aria-hidden="true" class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-sm font-black text-teal-700">${initials}</span>`
    : `<span aria-hidden="true" class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-sm font-black text-teal-700">${initials}</span>`;
  const rankColor = rank === 1
    ? 'text-amber-600'
    : rank === 2
      ? 'text-slate-500'
      : rank === 3
        ? 'text-orange-700'
        : 'text-slate-400';

  return `<article class="flex items-center gap-3 px-4 py-3 sm:px-5">
    <span class="w-10 shrink-0 text-center text-sm font-black ${rankColor}">#${Number(rank).toLocaleString('pt-BR')}</span>
    ${logo}
    <span class="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">${escapeHtml(name)}</span>
    <span class="shrink-0 text-sm font-black text-teal-700">${points} pts</span>
  </article>`;
}

function showFailure(message) {
  if (statusRoot) statusRoot.textContent = message;
  if (moreButton) {
    moreButton.hidden = false;
    moreButton.disabled = false;
    moreButton.textContent = 'Tentar novamente';
  }
}

async function waitForFirestore() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (window.firebaseDb) return window.firebaseDb;
    if (window.firebaseReady === false) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('A conexão com o banco de dados não ficou disponível.');
}

async function loadNextPage() {
  if (!rowsRoot || loading || !hasMore && loadedCount > 0) return;
  loading = true;
  if (moreButton) {
    moreButton.disabled = true;
    moreButton.textContent = 'Carregando...';
  }
  if (statusRoot) statusRoot.textContent = 'Buscando equipes...';

  try {
    const db = await waitForFirestore();
    const page = await getGeneralRankingPage(db, { cursor, pageSize: PAGE_SIZE });
    if (!page.rows.length && loadedCount === 0) {
      rowsRoot.innerHTML = '<div class="p-5 text-center text-sm text-slate-500">A base inicial do ranking ainda não foi importada.</div>';
      if (statusRoot) statusRoot.textContent = '';
    } else {
      if (loadedCount === 0) rowsRoot.replaceChildren();
      const markup = page.rows.map(team => {
        const points = Number(team.totalPoints || 0);
        const rank = lastPoints === points ? lastRank : loadedCount + 1;
        lastPoints = points;
        lastRank = rank;
        loadedCount += 1;
        return renderRankingRow(team, rank);
      }).join('');
      rowsRoot.insertAdjacentHTML('beforeend', markup);
      bindRankingLogoEvents(rowsRoot);
      if (statusRoot) statusRoot.textContent = `${loadedCount.toLocaleString('pt-BR')} equipes carregadas.`;
    }
    cursor = page.cursor;
    hasMore = page.hasMore;
  } catch (error) {
    const message = error?.code === 'permission-denied'
      ? 'A leitura pública do ranking ainda não foi liberada nas regras do Firestore.'
      : `Não foi possível carregar o ranking (${error?.code || error?.message || 'erro'}).`;
    if (loadedCount === 0 && rowsRoot) {
      rowsRoot.innerHTML = `<div class="p-5 text-center text-sm text-rose-700">${escapeHtml(message)}</div>`;
    }
    showFailure(message);
  } finally {
    loading = false;
    if (moreButton) {
      moreButton.hidden = !hasMore && loadedCount > 0;
      moreButton.disabled = false;
      moreButton.textContent = hasMore ? 'Carregar mais equipes' : 'Tentar novamente';
    }
  }
}

moreButton?.addEventListener('click', loadNextPage);
void loadNextPage();
