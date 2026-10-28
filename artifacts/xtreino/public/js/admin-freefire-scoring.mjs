import { createMatchResultView } from './admin-freefire-matchresult-view.mjs';
import {
  MATCHRESULT_EVENT_TYPES,
  MAX_MATCHRESULT_FILE_BYTES,
  calculateMatchResultStandings,
  getMatchResultSetIssues,
  mapMatchResultTeamsToRoster,
  parseMatchResultRoster,
  parseMatchResultLog,
  matchResultTeamKey,
} from './freefire-matchresult.mjs';
import {
  SPEC_LOGO_HOURS,
  loadModoLigaSpecLogoCatalog,
  specLogoCodeForLetter,
} from './admin-spec-logos.mjs';

const EVENTS = [
  ['TREINO FREITAS', 'treino'],
  ['INTENSIVO FREITAS', 'intensivo'],
  ['CAMP FREITAS', 'camp'],
  ['SEMANAL FREITAS', 'semanal'],
];
const PLACE_POINTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0];
const SUPPORTED_IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_ANALYSIS_IMAGE_BYTES = 800 * 1024;
const MAX_ANALYSIS_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_ANALYSIS_REQUEST_BYTES = 5_700_000;
const MAX_DROPPED_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;
const DB_NAME = 'freitas-freefire-config';
const DB_STORE = 'table-templates';
const MODO_LIGA_FIRST_ROW_CENTER = 0.4493;
const MODO_LIGA_ROW_PITCH = 0.031;
const MODO_LIGA_TEMPLATE_LAYOUT = Object.freeze({
  logoCenterX: 0.1304,
  logoSize: 0.028,
  teamNameCenterX: 0.2803,
  teamNameMaxWidth: 0.255,
  winsCenterX: 0.4375,
  killsCenterX: 0.4902,
  pointsCenterX: 0.5444,
});
const MODO_LIGA_LOGO_TYPE = 'freefire-modo-liga-team-logo';
const MODO_LIGA_LOGO_COLLECTION = 'championship_config';
const ORGANIZATION_LOGO_URL = new URL('../assets/freefire-organizacao-logo.webp?v=logo-fallback-2', import.meta.url).href;
const MAX_TEAM_LOGO_FILE_BYTES = 5 * 1024 * 1024;
let modoLigaLogoCatalog = new Map();
let modoLigaLogoLoadPromise = null;

export function getModoLigaTemplateLayout(imageWidth) {
  return Object.fromEntries(
    Object.entries(MODO_LIGA_TEMPLATE_LAYOUT).map(([key, ratio]) => [key, imageWidth * ratio]),
  );
}

export function getModoLigaTemplateRowCenter(imageHeight, rowIndex) {
  return imageHeight * (MODO_LIGA_FIRST_ROW_CENTER + rowIndex * MODO_LIGA_ROW_PITCH);
}

export function getModoLigaTop3LogoLayout(imageWidth, imageHeight) {
  return MODO_LIGA_TOP3_LOGO_POSITIONS.map(position => ({
    centerX: imageWidth * position.centerX,
    centerY: imageHeight * position.centerY,
    size: imageWidth * position.size,
  }));
}

export function getCenteredContainRect(sourceWidth, sourceHeight, centerX, centerY, maxWidth, maxHeight = maxWidth) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function getModoLigaTop3Teams(standings, logoCatalog = modoLigaLogoCatalog) {
  return standings.slice(0, 3).map((team, index) => ({
    ...team,
    podiumPosition: index + 1,
    customLogo: team.logoAsset || logoCatalog?.get?.(matchResultTeamKey(team.teamName)) || null,
  }));
}

export function applyMatchResultStandingsLogos(standings, roster, fallbackLogoUrl = ORGANIZATION_LOGO_URL) {
  const teams = Array.isArray(roster) ? roster : [];
  const byName = new Map(teams
    .map(team => [matchResultTeamKey(team?.teamName), team])
    .filter(([key]) => Boolean(key)));
  const bySlot = new Map(teams.map(team => [Number(team?.slot), team]));

  return (Array.isArray(standings) ? standings : []).map(row => {
    const team = byName.get(matchResultTeamKey(row?.teamName)) || bySlot.get(Number(row?.slot));
    return {
      ...row,
      logoUrl: team?.logoUrl || fallbackLogoUrl,
      logoSource: team?.logoSource || 'organization',
      logoAsset: team?.logoAsset || null,
    };
  });
}

export function getModoLigaSpecLogoForSlot(slot, logoCatalog = matchResultState?.specLogoCatalog) {
  const slotNumber = Number(slot);
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 15) return null;
  const letter = String.fromCharCode(64 + slotNumber);
  const code = specLogoCodeForLetter(letter);
  return code ? logoCatalog?.get?.(code) || null : null;
}

export function buildModoLigaPurchaseLogoCatalog(registrations, roster) {
  const catalog = new Map();
  const eligibleStatuses = new Set(['paid', 'approved', 'confirmed']);
  if (!Array.isArray(registrations) || !Array.isArray(roster) || !roster.length) return catalog;

  for (const registration of registrations) {
    const status = String(registration?.status || '').trim().toLowerCase();
    if (!eligibleStatuses.has(status)) continue;

    const purchasedTeamName = String(
      registration.teamName || registration.team || registration.squadName || '',
    ).trim();
    const logoUrl = String(
      registration.teamLogoUrl || registration.teamLogoThumb || registration.logoUrl || '',
    ).trim();
    if (!purchasedTeamName || !logoUrl) continue;

    const match = resolveMatchResultTeam(purchasedTeamName, roster);
    if (!['exact', 'partial'].includes(match.status) || !match.team?.teamName) continue;

    const key = matchResultTeamKey(match.team.teamName);
    if (!key) continue;
    const timestamp = purchaseTimestampMs(
      registration.paidAt ?? registration.updatedAt ?? registration.createdAt,
    );
    const hasOriginalLogo = Boolean(registration.teamLogoUrl);
    const current = catalog.get(key);
    if (
      !current ||
      timestamp > current.purchaseTimestamp ||
      (timestamp === current.purchaseTimestamp && hasOriginalLogo && !current.hasOriginalLogo)
    ) {
      catalog.set(key, {
        teamName: match.team.teamName,
        logoUrl,
        storagePath: String(registration.teamLogoStoragePath || ''),
        purchaseTimestamp: timestamp,
        hasOriginalLogo,
      });
    }
  }

  return catalog;
}

export function getModoLigaPurchaseLookupRoster(parsedRoster) {
  if (!Array.isArray(parsedRoster?.roster)) return [];
  const blockingErrors = (parsedRoster.errors || []).filter(error =>
    !String(error).startsWith('A lista precisa conter exatamente 15') &&
    !String(error).endsWith('informe o nome da equipe.'),
  );
  if (blockingErrors.length) return [];
  return parsedRoster.roster.filter(team => Boolean(String(team?.teamName || '').trim()));
}

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
  imageQualityMode: 'auto',
};
function blankMatchResultDrop(index) {
  return { index, fileName: '', parsed: null, reviewed: false };
}
function createMatchResultSession(eventType) {
  return {
    eventType,
    eventHour: '',
    dropCount: 1,
    drops: Array.from({ length: 5 }, (_, index) => blankMatchResultDrop(index)),
    roster: [],
    rosterText: '',
    rosterFileName: '',
    rosterDirty: false,
    rosterError: '',
    logoStatus: '',
    logoBusySlots: new Set(),
    specLogoCatalog: new Map(),
    specLogoLoadedHour: '',
    specLogoLoading: false,
    specLogoRequestId: 0,
    specLogoStatus: 'Selecione o horário para carregar as logos SPEC pela letra dos slots.',
    purchaseLogoRows: [],
    purchaseLogoLoaded: false,
    purchaseLogoAttempted: false,
    purchaseLogoBusy: false,
    purchaseLogoStatus: '',
    template: null,
    templateError: '',
  };
}
const matchResultSessions = new Map(
  MATCHRESULT_EVENT_TYPES.map(({ value }) => [value, createMatchResultSession(value)]),
);
let matchResultState = matchResultSessions.get('modo-liga');
let matchResultView = null;
let activeScoringMode = 'images';
let bundledMatchResultTemplate = null;
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
async function loadMatchResultTemplate() {
  matchResultState.templateError = '';
  try {
    if (matchResultState.eventType === 'modo-liga') {
      if (!bundledMatchResultTemplate) {
        const url = new URL('../assets/freefire-modo-liga.webp', import.meta.url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Modelo de Modo Liga indisponível.');
        bundledMatchResultTemplate = {
          blob: await response.blob(),
          name: 'TABELA_FREITAS_15_SLOTS.webp',
          bundled: true,
        };
      }
      matchResultState.template = bundledMatchResultTemplate;
      return;
    }

    matchResultState.template = null;
  } catch (error) {
    matchResultState.template = null;
    matchResultState.templateError = error.message || 'Não foi possível carregar o modelo deste evento.';
  }
}

function matchResultDropView(drop) {
  const parsed = drop.parsed;
  const mapping = parsed ? mapMatchResultTeamsToRoster(parsed, matchResultState.roster) : null;
  const errors = [
    ...(parsed?.errors || []),
    ...(mapping?.errors || []),
    ...(mapping?.teams || []).flatMap(team => team.errors || []),
  ];
  return {
    index: drop.index,
    fileName: drop.fileName,
    teams: (mapping?.teams || []).map(team => ({
      teamName: team.teamName,
      sourceTeamName: team.sourceTeamName,
      slotLabel: team.slotLabel,
      matchType: team.matchType,
      rank: team.rank,
      kills: team.kills,
      playerCount: team.playerCount,
    })),
    errors,
    warnings: [...(parsed?.warnings || []), ...(mapping?.warnings || [])],
    ignoredTeams: mapping?.ignored || [],
    reviewed: drop.reviewed,
  };
}

function matchResultViewState() {
  const drops = matchResultState.drops.slice(0, matchResultState.dropCount);
  const mappedDrops = matchResultState.drops.map(drop => {
    if (!drop.parsed) return drop;
    const mapping = mapMatchResultTeamsToRoster(drop.parsed, matchResultState.roster);
    return {
      ...drop,
      parsed: {
        ...drop.parsed,
        teams: mapping.teams,
        errors: [...drop.parsed.errors, ...mapping.errors],
        warnings: [...drop.parsed.warnings, ...mapping.warnings],
      },
    };
  });
  const hasAllRosterNames = matchResultState.roster.length === 15 &&
    matchResultState.roster.every(team => Boolean(team.teamName?.trim()));
  const rosterTextValidation = parseMatchResultRoster(matchResultState.rosterText);
  const rosterDraft = rosterTextValidation.roster;
  const purchaseLookupRoster = getModoLigaPurchaseLookupRoster(rosterTextValidation);
  const canManageLogos = matchResultState.eventType === 'modo-liga' &&
    canOpen() && !readOnly();
  const purchaseLogoCatalog = buildModoLigaPurchaseLogoCatalog(
    matchResultState.purchaseLogoRows,
    rosterDraft,
  );
  const rosterWithLogos = rosterDraft.map(team => {
    const key = matchResultTeamKey(team.teamName);
    const customLogo = modoLigaLogoCatalog.get(key);
    const purchasedLogo = purchaseLogoCatalog.get(key);
    const specLogo = getModoLigaSpecLogoForSlot(team.slot, matchResultState.specLogoCatalog);
    const logo = specLogo || customLogo || purchasedLogo;
    return {
      ...team,
      logoUrl: logo?.logoUrl || ORGANIZATION_LOGO_URL,
      logoSource: specLogo ? 'spec' : customLogo ? 'custom' : purchasedLogo ? 'purchase' : 'organization',
      logoAsset: logo || null,
      logoBusy: matchResultState.logoBusySlots.has(Number(team.slot)),
    };
  });
  const rosterIssue = matchResultState.rosterError ||
    (!hasAllRosterNames
      ? rosterTextValidation.lineCount > 15
        ? `A lista tem ${rosterTextValidation.lineCount} linhas. Use exatamente 15 equipes.`
        : 'Preencha os 15 nomes; os slots aparecem automaticamente ao colar a lista.'
      : '');
  const issues = rosterIssue || matchResultState.rosterDirty
    ? [rosterIssue || 'Termine de editar a lista para atualizar os slots automaticamente.']
    : getMatchResultSetIssues(mappedDrops, matchResultState.dropCount);
  const standings = calculateMatchResultStandings(
    mappedDrops,
    matchResultState.dropCount,
    matchResultState.roster,
  );
  const standingsWithLogos = applyMatchResultStandingsLogos(
    standings,
    rosterWithLogos,
    ORGANIZATION_LOGO_URL,
  );
  const allReviewed = drops.every(drop => drop.parsed && drop.reviewed);
  const templateAvailable = matchResultState.eventType === 'modo-liga' &&
    Boolean(matchResultState.template?.blob);
  const specLogosReady = matchResultState.eventType !== 'modo-liga' ||
    (Boolean(matchResultState.eventHour) &&
      !matchResultState.specLogoLoading &&
      matchResultState.specLogoLoadedHour === matchResultState.eventHour);
  const canExport = !rosterIssue && !matchResultState.rosterDirty &&
    issues.length === 0 && allReviewed && templateAvailable && specLogosReady && standings.length === 15;
  const canExportTop3 = matchResultState.eventType === 'modo-liga' &&
    !rosterIssue && !matchResultState.rosterDirty &&
    issues.length === 0 && allReviewed && specLogosReady && standings.length === 15;
  let summary = matchResultState.exportMessage || '';
  if (!summary) {
    if (rosterIssue) summary = rosterIssue;
    else if (matchResultState.eventType === 'modo-liga' && !matchResultState.eventHour) {
      summary = 'Selecione o horário do Modo Liga para vincular as logos SPEC aos slots corretos.';
    }
    else if (matchResultState.eventType === 'modo-liga' && matchResultState.specLogoLoading) {
      summary = `Carregando logos SPEC de ${matchResultState.eventHour}H…`;
    }
    else if (matchResultState.eventType === 'modo-liga' &&
      matchResultState.specLogoLoadedHour !== matchResultState.eventHour) {
      summary = matchResultState.specLogoStatus || `Não foi possível carregar as logos SPEC de ${matchResultState.eventHour}H.`;
    }
     else if (matchResultState.rosterDirty) summary = 'Termine de editar a lista para atualizar os slots automaticamente.';
    else if (matchResultState.templateError) summary = matchResultState.templateError;
    else if (issues.length) summary = issues[0];
    else if (!allReviewed) summary = 'Revise e confirme cada queda selecionada antes de exportar.';
    else if (matchResultState.eventType !== 'modo-liga') {
      summary = 'A prévia está pronta. A exportação será liberada quando o modelo próprio deste evento for integrado.';
    } else if (!templateAvailable) summary = 'O modelo visual de Modo Liga não carregou.';
    else summary = `${standings.length} equipes calculadas em ${matchResultState.dropCount} ${matchResultState.dropCount === 1 ? 'queda' : 'quedas'}.`;
  }
  const eventLabel = MATCHRESULT_EVENT_TYPES.find(event => event.value === matchResultState.eventType)?.label || 'Evento';
  return {
    eventType: matchResultState.eventType,
    eventLabel,
    eventHour: matchResultState.eventHour,
    eventHours: SPEC_LOGO_HOURS,
    dropCount: matchResultState.dropCount,
    drops: drops.map(matchResultDropView),
    standings: standingsWithLogos,
    rosterText: matchResultState.rosterText,
    rosterFileName: matchResultState.rosterFileName,
    rosterDraft,
    rosterCount: rosterDraft.filter(team => team.teamName?.trim()).length,
    rosterDirty: matchResultState.rosterDirty,
    rosterError: matchResultState.rosterError,
    logoStatus: matchResultState.logoStatus,
    specLogoStatus: matchResultState.specLogoStatus,
    purchaseLogoStatus: matchResultState.purchaseLogoStatus,
    purchaseLogoLoaded: matchResultState.purchaseLogoLoaded,
    purchaseLogoBusy: matchResultState.purchaseLogoBusy,
    canImportPurchaseLogos: canOpen() && matchResultState.eventType === 'modo-liga' &&
      !matchResultState.rosterError && purchaseLookupRoster.length > 0,
    canManageLogos,
    showTeamLogos: matchResultState.eventType === 'modo-liga',
    template: {
      name: matchResultState.template?.name || '',
      available: templateAvailable,
      bundled: Boolean(matchResultState.template?.bundled),
    },
    canExport,
    summary,
  };
}

function updateMatchResultRosterText(text, fileName = '') {
  const rosterText = String(text ?? '');
  const parsed = parseMatchResultRoster(rosterText);
  const nextRoster = parsed.errors.length ? [] : parsed.roster;
  const previousSignature = JSON.stringify(matchResultState.roster.map(team => [
    Number(team.slot),
    String(team.teamName || '').trim(),
  ]));
  const nextSignature = JSON.stringify(nextRoster.map(team => [
    Number(team.slot),
    String(team.teamName || '').trim(),
  ]));
  matchResultState.rosterText = rosterText;
  matchResultState.rosterFileName = fileName;
  matchResultState.roster = nextRoster;
  matchResultState.rosterDirty = parsed.errors.length > 0;
  matchResultState.rosterError = parsed.errors
    .filter(error => !error.startsWith('A lista precisa conter exatamente 15') &&
      !error.endsWith('informe o nome da equipe.'))
    .join(' ');
  matchResultState.exportMessage = '';
  if (previousSignature !== nextSignature) {
    matchResultState.drops.forEach(drop => { if (drop.parsed) drop.reviewed = false; });
  }
  render();
  if (
    matchResultState.eventType === 'modo-liga' &&
    !matchResultState.purchaseLogoLoaded &&
    !matchResultState.purchaseLogoAttempted &&
    getModoLigaPurchaseLookupRoster(parsed).length > 0
  ) {
    matchResultState.purchaseLogoAttempted = true;
    loadModoLigaPurchaseLogos();
  }
}

async function loadModoLigaLogoCatalog(force = false) {
  if (modoLigaLogoLoadPromise) return modoLigaLogoLoadPromise;
  if (!force && modoLigaLogoCatalog.size) return;
  const session = matchResultState;
  if (!window.firebaseDb) {
    session.logoStatus = 'Logos personalizadas indisponíveis; será usada a logo padrão Freitas.';
    return;
  }

  modoLigaLogoLoadPromise = (async () => {
    const { collection, getDocs, query, where } =
      await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const snapshot = await getDocs(query(
      collection(window.firebaseDb, MODO_LIGA_LOGO_COLLECTION),
      where('type', '==', MODO_LIGA_LOGO_TYPE),
    ));
    const nextCatalog = new Map();
    snapshot.forEach(item => {
      const data = item.data();
      const key = matchResultTeamKey(data.teamName);
      if (key && data.logoUrl) {
        nextCatalog.set(key, {
          teamName: String(data.teamName || ''),
          logoUrl: String(data.logoUrl),
          storagePath: String(data.storagePath || ''),
        });
      }
    });
    modoLigaLogoCatalog = nextCatalog;
    session.logoStatus = nextCatalog.size
      ? `${nextCatalog.size} logo(s) personalizada(s) carregada(s); as demais usam a logo Freitas.`
      : 'Times sem logo personalizada usarão a logo Freitas.';
  })().catch(error => {
    session.logoStatus = `Não foi possível carregar as logos personalizadas. A logo Freitas será usada como padrão. (${error.message || 'erro de acesso'})`;
  }).finally(() => {
    modoLigaLogoLoadPromise = null;
  });
  return modoLigaLogoLoadPromise;
}

function getModoLigaLogoCatalogForRoster(roster = matchResultState.roster) {
  const catalog = buildModoLigaPurchaseLogoCatalog(
    matchResultState.purchaseLogoRows,
    roster,
  );
  // A logo uploaded manually by an admin remains the highest-priority choice.
  modoLigaLogoCatalog.forEach((logo, key) => catalog.set(key, logo));
  return catalog;
}

async function loadModoLigaSpecLogos(hour, force = false) {
  const session = matchResultSessions.get('modo-liga');
  const selectedHour = String(hour || '');
  if (!SPEC_LOGO_HOURS.includes(selectedHour)) return;
  if (!force && session.specLogoLoadedHour === selectedHour) return;

  const requestId = ++session.specLogoRequestId;
  session.specLogoCatalog = new Map();
  session.specLogoLoading = true;
  session.specLogoStatus = `Buscando logos SPEC de ${selectedHour}H…`;
  if (matchResultState === session) render();

  try {
    const catalog = await loadModoLigaSpecLogoCatalog(selectedHour);

    if (requestId !== session.specLogoRequestId || session.eventHour !== selectedHour) return;
    session.specLogoCatalog = catalog;
    session.specLogoLoadedHour = selectedHour;
    session.specLogoStatus = catalog.size
      ? `${catalog.size} logo(s) SPEC carregada(s) para ${selectedHour}H. A associação usa a letra do slot; esta logo tem prioridade.`
      : `Nenhuma logo SPEC cadastrada para ${selectedHour}H. As logos por nome e a logo Freitas continuam como alternativa.`;
  } catch (error) {
    if (requestId === session.specLogoRequestId && session.eventHour === selectedHour) {
      session.specLogoCatalog = new Map();
      session.specLogoLoadedHour = '';
      session.specLogoStatus = `Não foi possível carregar as logos SPEC de ${selectedHour}H. ${error?.message || ''}`.trim();
    }
  } finally {
    if (requestId === session.specLogoRequestId) {
      session.specLogoLoading = false;
      if (matchResultState === session) render();
    }
  }
}

async function loadModoLigaPurchaseLogos() {
  const session = matchResultState;
  if (session.eventType !== 'modo-liga' || session.purchaseLogoBusy) return;
  const parsedRoster = parseMatchResultRoster(session.rosterText);
  const purchaseLookupRoster = getModoLigaPurchaseLookupRoster(parsedRoster);
  if (!purchaseLookupRoster.length || session.rosterError) {
    session.purchaseLogoStatus = 'Informe pelo menos um nome de time válido para buscar as logos.';
    render();
    return;
  }
  if (!window.firebaseDb || !window.firebaseAuth?.currentUser) {
    session.purchaseLogoStatus = 'Entre no painel para buscar logos das compras do Modo Liga.';
    render();
    return;
  }

  session.purchaseLogoAttempted = true;
  session.purchaseLogoBusy = true;
  session.purchaseLogoStatus = 'Buscando logos nas compras aprovadas do Modo Liga…';
  render();
  try {
    const { collection, getDocs, query, where } =
      await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const snapshot = await getDocs(query(
      collection(window.firebaseDb, 'registrations'),
      where('eventType', '==', 'modo-liga'),
    ));
    session.purchaseLogoRows = snapshot.docs.map(item => item.data());
    session.purchaseLogoLoaded = true;
    const matchedCount = buildModoLigaPurchaseLogoCatalog(
      session.purchaseLogoRows,
      purchaseLookupRoster,
    ).size;
    session.purchaseLogoStatus = matchedCount
      ? `Encontramos ${matchedCount} logo${matchedCount === 1 ? '' : 's'} para ${purchaseLookupRoster.length} time${purchaseLookupRoster.length === 1 ? '' : 's'} informado${purchaseLookupRoster.length === 1 ? '' : 's'}. A logo manual continua prioritária.`
      : `Nenhuma logo corresponde aos ${purchaseLookupRoster.length} times informados. Confira os nomes nas inscrições.`;
  } catch (error) {
    session.purchaseLogoStatus = `Não foi possível buscar logos das compras do Modo Liga. (${error.message || 'erro de acesso'})`;
  } finally {
    session.purchaseLogoBusy = false;
    render();
  }
}

function prepareModoLigaTeamLogo(file) {
  if (!file || !SUPPORTED_IMAGES.has(file.type)) {
    throw new Error('Escolha uma logo PNG, JPG ou WebP.');
  }
  if (file.size > MAX_TEAM_LOGO_FILE_BYTES) {
    throw new Error('A logo precisa ter até 5 MB.');
  }
  return createImageBitmap(file).then(bitmap => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close?.();
      throw new Error('Não foi possível preparar a logo.');
    }
    const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    bitmap.close?.();
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível converter a logo.')), 'image/webp', 0.9);
    });
  }).catch(error => {
    if (error instanceof Error && error.message.includes('logo')) throw error;
    throw new Error('Não foi possível abrir essa imagem como logo.');
  });
}

function logoDocumentId(teamName) {
  const key = matchResultTeamKey(teamName);
  if (!key) throw new Error('Preencha um nome de time válido antes de enviar a logo.');
  const safeKey = key.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/gu, '').slice(0, 100);
  return `freefire_modo_liga_logo_${safeKey}`;
}

function modoLigaLogoStoragePaths(teamName, userId, uploadedAtMs) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId || /[\\/]/.test(safeUserId)) {
    throw new Error('Não foi possível identificar uma pasta segura para salvar esta logo.');
  }
  const safeTeamName = String(teamName || 'time').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const fileName = `${safeTeamName}_${uploadedAtMs}`;
  return {
    primary: `teams/modo-liga/logos/${fileName}`,
    userScoped: `profile-photos/${safeUserId}/team-logos/modo-liga/${fileName}`,
  };
}

async function saveModoLigaTeamLogo(slot, file) {
  const session = matchResultState;
  const team = session.roster.find(item => Number(item.slot) === Number(slot));
  if (!team?.teamName?.trim()) {
    session.logoStatus = 'Cole a lista de slots antes de enviar a logo do time.';
    render();
    return;
  }
  if (session.eventType !== 'modo-liga') return;
  if (!window.firebaseDb || !window.firebaseStorage || !window.firebaseAuth?.currentUser) {
    session.logoStatus = 'Entre no painel novamente para salvar logos personalizadas.';
    render();
    return;
  }

  const key = matchResultTeamKey(team.teamName);
  const docId = logoDocumentId(team.teamName);
  const oldLogo = modoLigaLogoCatalog.get(key);
  session.logoBusySlots.add(Number(slot));
  session.logoStatus = `Enviando logo de ${team.teamName}…`;
  render();

  let uploadedRef = null;
  try {
    const blob = await prepareModoLigaTeamLogo(file);
    const [{ ref, uploadBytes, getDownloadURL, deleteObject }, { doc, setDoc, serverTimestamp }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js'),
      import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'),
    ]);
    const paths = modoLigaLogoStoragePaths(
      team.teamName,
      window.firebaseAuth.currentUser.uid,
      Date.now(),
    );
    const uploadOptions = {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
    };
    const uploadAtPath = async path => {
      const targetRef = ref(window.firebaseStorage, path);
      const uploaded = await uploadBytes(targetRef, blob, uploadOptions);
      uploadedRef = uploaded.ref;
      return {
        storagePath: uploaded.ref.fullPath,
        logoUrl: await getDownloadURL(uploaded.ref),
      };
    };
    let savedLogo;
    try {
      savedLogo = await uploadAtPath(paths.primary);
    } catch (primaryError) {
      if (primaryError?.code !== 'storage/unauthorized') throw primaryError;
      if (uploadedRef) {
        try { await deleteObject(uploadedRef); } catch { /* ignore an unauthorized partial upload */ }
      }
      uploadedRef = null;
      savedLogo = await uploadAtPath(paths.userScoped);
    }
    const { storagePath, logoUrl } = savedLogo;
    await setDoc(doc(window.firebaseDb, MODO_LIGA_LOGO_COLLECTION, docId), {
      type: MODO_LIGA_LOGO_TYPE,
      teamName: team.teamName.trim(),
      logoUrl,
      storagePath,
      updatedAt: serverTimestamp(),
    });
    modoLigaLogoCatalog.set(key, {
      teamName: team.teamName.trim(),
      logoUrl,
      storagePath,
      blob,
    });
    if (oldLogo?.storagePath && oldLogo.storagePath !== storagePath) {
      deleteObject(ref(window.firebaseStorage, oldLogo.storagePath)).catch(() => {});
    }
    session.logoStatus = `Logo personalizada salva para ${team.teamName}.`;
  } catch (error) {
    if (uploadedRef) {
      try {
        const { deleteObject } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
        await deleteObject(uploadedRef);
      } catch { /* preserve the previous saved logo if cleanup is unavailable */ }
    }
    session.logoStatus = error?.code === 'storage/unauthorized'
      ? 'O Firebase Storage bloqueou os caminhos de envio. Verifique se as regras permitem gravação para usuários autenticados.'
      : error.message || 'Não foi possível salvar esta logo.';
  } finally {
    session.logoBusySlots.delete(Number(slot));
    render();
  }
}

async function resetModoLigaTeamLogo(slot) {
  const session = matchResultState;
  const team = session.roster.find(item => Number(item.slot) === Number(slot));
  if (!team?.teamName?.trim()) return;
  const key = matchResultTeamKey(team.teamName);
  const existing = modoLigaLogoCatalog.get(key);
  if (!existing) return;
  if (!window.firebaseDb || !window.firebaseStorage || !window.firebaseAuth?.currentUser) {
    session.logoStatus = 'Entre no painel novamente para alterar logos salvas.';
    render();
    return;
  }

  session.logoBusySlots.add(Number(slot));
  session.logoStatus = `Restaurando a logo Freitas para ${team.teamName}…`;
  render();
  try {
    const [{ ref, deleteObject }, { doc, deleteDoc }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js'),
      import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'),
    ]);
    await deleteDoc(doc(window.firebaseDb, MODO_LIGA_LOGO_COLLECTION, logoDocumentId(team.teamName)));
    modoLigaLogoCatalog.delete(key);
    if (existing.storagePath) {
      try { await deleteObject(ref(window.firebaseStorage, existing.storagePath)); } catch { /* logo override is already removed */ }
    }
    session.logoStatus = `A logo Freitas voltou a ser o padrão para ${team.teamName}.`;
  } catch (error) {
    session.logoStatus = error.message || 'Não foi possível restaurar a logo padrão.';
  } finally {
    session.logoBusySlots.delete(Number(slot));
    render();
  }
}

async function importMatchResultRosterFiles(files) {
  const selected = Array.from(files || []);
  if (selected.length !== 1) {
    matchResultState.rosterError = 'Selecione um arquivo CSV ou TXT por vez.';
    render();
    return;
  }
  const file = selected[0];
  const isTextFile = /\.(csv|txt)$/i.test(file.name) ||
    ['text/plain', 'text/csv'].includes(file.type);
  if (!isTextFile) {
    matchResultState.rosterError = 'Importe somente uma lista em arquivo CSV ou TXT.';
    render();
    return;
  }
  if (file.size > MAX_MATCHRESULT_FILE_BYTES) {
    matchResultState.rosterError = 'O arquivo da lista precisa ter até 2 MB.';
    render();
    return;
  }
  try {
    updateMatchResultRosterText(await file.text(), file.name);
    return;
  } catch {
    matchResultState.rosterError = 'Não foi possível ler o arquivo da lista.';
  }
  render();
}

async function readMatchResultFile(dropIndex, file) {
  const drop = matchResultState.drops[dropIndex];
  if (!drop || !file) return;
  drop.fileName = file.name;
  drop.reviewed = false;
  matchResultState.exportMessage = '';
  if (file.size > MAX_MATCHRESULT_FILE_BYTES) {
    drop.parsed = {
      teams: [],
      errors: ['O arquivo excede o limite de 2 MB.'],
      warnings: [],
      valid: false,
    };
  } else {
    try {
      drop.parsed = parseMatchResultLog(await file.text());
    } catch {
      drop.parsed = {
        teams: [],
        errors: ['Não foi possível ler este arquivo de texto.'],
        warnings: [],
        valid: false,
      };
    }
  }
  render();
}

async function changeMatchResultHour(hour) {
  const session = matchResultSessions.get('modo-liga');
  const selectedHour = String(hour || '');
  if (selectedHour && !SPEC_LOGO_HOURS.includes(selectedHour)) return;
  session.eventHour = selectedHour;
  session.specLogoCatalog = new Map();
  session.specLogoLoadedHour = '';
  session.specLogoRequestId += 1;
  session.specLogoLoading = false;
  session.exportMessage = '';
  session.specLogoStatus = selectedHour
    ? `Buscando logos SPEC de ${selectedHour}H…`
    : 'Selecione o horário para carregar as logos SPEC pela letra dos slots.';
  render();
  if (selectedHour) await loadModoLigaSpecLogos(selectedHour);
}

async function changeMatchResultEvent(eventType) {
  if (!MATCHRESULT_EVENT_TYPES.some(event => event.value === eventType)) return;
  matchResultSessions.set(matchResultState.eventType, matchResultState);
  matchResultState = matchResultSessions.get(eventType) || createMatchResultSession(eventType);
  matchResultSessions.set(eventType, matchResultState);
  await Promise.all([
    loadMatchResultTemplate(),
    eventType === 'modo-liga' ? loadModoLigaLogoCatalog() : Promise.resolve(),
    eventType === 'modo-liga' && matchResultState.eventHour
      ? loadModoLigaSpecLogos(matchResultState.eventHour, true)
      : Promise.resolve(),
  ]);
  render();
}

async function exportMatchResultJpeg() {
  const data = matchResultViewState();
  if (!data.canExport) return;
  const bitmap = await createImageBitmap(matchResultState.template.blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu preparar a imagem.');
    context.drawImage(bitmap, 0, 0);
    await document.fonts.load('700 22px Stapel');

    const {
      logoCenterX: logoX,
      logoSize,
      teamNameCenterX: nameX,
      teamNameMaxWidth: maxNameWidth,
      winsCenterX: winsX,
      killsCenterX: killsX,
      pointsCenterX: pointsX,
    } = getModoLigaTemplateLayout(bitmap.width);
    const organizationLogo = await loadLogoBitmap(ORGANIZATION_LOGO_URL);
    logoBitmaps.set('organization', organizationLogo);

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const [index, team] of data.standings.slice(0, 15).entries()) {
      const y = getModoLigaTemplateRowCenter(bitmap.height, index);
      const specLogo = getModoLigaSpecLogoForSlot(team.slot, matchResultState.specLogoCatalog);
      const customLogo = specLogo || team.logoAsset || teamLogoCatalog.get(matchResultTeamKey(team.teamName));
      let teamLogo = organizationLogo;
      if (customLogo) {
        const cacheKey = customLogo.source === 'spec'
          ? `spec:${customLogo.code}`
          : customLogo.storagePath || customLogo.logoUrl;
        if (!logoBitmaps.has(cacheKey)) {
          try {
            logoBitmaps.set(cacheKey, await loadLogoBitmap(customLogo.logoUrl, customLogo.blob));
          } catch {
            missingCustomLogos.push(team.teamName);
            logoBitmaps.set(cacheKey, organizationLogo);
          }
        }
        teamLogo = logoBitmaps.get(cacheKey);
      }
      const logoRect = getCenteredContainRect(
        teamLogo.width,
        teamLogo.height,
        logoX,
        y,
        logoSize,
        logoSize,
      );
      context.drawImage(teamLogo, logoRect.x, logoRect.y, logoRect.width, logoRect.height);

      let fontSize = Math.round(bitmap.width * 0.0185);
      const name = team.teamName.toLocaleUpperCase('pt-BR');
      context.fillStyle = '#20302f';
      context.font = `700 ${fontSize}px Stapel, Arial, sans-serif`;
      while (fontSize > 12 && context.measureText(name).width > maxNameWidth) {
        fontSize -= 1;
        context.font = `700 ${fontSize}px Stapel, Arial, sans-serif`;
      }
      context.fillText(name, nameX, y, maxNameWidth);

      context.font = `700 ${Math.round(bitmap.width * 0.019)}px Stapel, Arial, sans-serif`;
      context.fillText(String(team.wins), winsX, y);
      context.fillText(String(team.kills), killsX, y);
      context.fillText(String(team.points), pointsX, y);
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('O navegador não conseguiu gerar o JPEG.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freitas-${matchResultState.eventType}-leaderboard.jpg`;
    link.click();
    URL.revokeObjectURL(url);
    const fallbackNote = missingCustomLogos.length
      ? ` ${missingCustomLogos.length} logo(s) SPEC/personalizada(s) não carregaram e foram substituídas pela Freitas.`
      : '';
    matchResultState.exportMessage = `Imagem exportada com ${data.standings.length} equipes e ${matchResultState.dropCount} ${matchResultState.dropCount === 1 ? 'queda' : 'quedas'}.${fallbackNote}`;
  } finally {
    bitmap.close?.();
    render();
  }
}

async function exportModoLigaTop3Jpeg() {
  const data = matchResultViewState();
  if (matchResultState.eventType !== 'modo-liga' || !data.canExportTop3) return;

  const templateResponse = await fetch(MODO_LIGA_TOP3_TEMPLATE_URL);
  if (!templateResponse.ok) throw new Error('O banner Top 3 do Modo Liga não carregou.');
  const bitmap = await createImageBitmap(await templateResponse.blob());
  const logoBitmaps = new Map();
  let questionMarkCount = 0;
  const missingCustomLogos = [];
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu preparar o banner Top 3.');
    context.drawImage(bitmap, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const questionMark = await loadLogoBitmap(MODO_LIGA_TOP3_PLACEHOLDER_URL);
    logoBitmaps.set('placeholder', questionMark);
    const positions = getModoLigaTop3LogoLayout(bitmap.width, bitmap.height);
    const topThree = getModoLigaTop3Teams(
      data.standings,
      getModoLigaLogoCatalogForRoster(matchResultState.roster),
    ).map(team => ({
      ...team,
      customLogo: getModoLigaSpecLogoForSlot(team.slot, matchResultState.specLogoCatalog) ||
        team.logoAsset || team.customLogo,
    }));

    for (const [index, team] of topThree.entries()) {
      let logo = questionMark;
      if (team.customLogo) {
        const cacheKey = team.customLogo.source === 'spec'
          ? `spec:${team.customLogo.code}`
          : `custom:${team.customLogo.storagePath || team.customLogo.logoUrl || matchResultTeamKey(team.teamName)}`;
        if (!logoBitmaps.has(cacheKey)) {
          try {
            logoBitmaps.set(
              cacheKey,
              await loadLogoBitmap(team.customLogo.logoUrl, team.customLogo.blob),
            );
          } catch {
            logoBitmaps.set(cacheKey, questionMark);
            missingCustomLogos.push(team.teamName);
          }
        }
        logo = logoBitmaps.get(cacheKey);
      } else {
        questionMarkCount += 1;
      }
      if (logo === questionMark && team.customLogo) questionMarkCount += 1;

      const { centerX, centerY, size } = positions[index];
      const logoRect = getCenteredContainRect(
        logo.width,
        logo.height,
        centerX,
        centerY,
        size,
        size,
      );
      context.drawImage(logo, logoRect.x, logoRect.y, logoRect.width, logoRect.height);
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('O navegador não conseguiu gerar o banner Top 3.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'freitas-modo-liga-top-3.jpg';
    link.click();
    URL.revokeObjectURL(url);
    const missingNote = missingCustomLogos.length
      ? ` Logo(s) sem carregamento: ${missingCustomLogos.join(', ')}.`
      : '';
    matchResultState.exportMessage = `Banner Top 3 exportado. ${questionMarkCount} time(s) aparecem com ponto de interrogação por não terem uma logo disponível.${missingNote}`;
  } finally {
    for (const logoBitmap of new Set(logoBitmaps.values())) logoBitmap.close?.();
    bitmap.close?.();
    render();
  }
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
      /^[\s\u200b\ufeff\p{M}\p{P}\p{S}\p{Extended_Pictographic}\u200d\ufe0e\ufe0f]+(?=(?:slot\b|time\b|team\b|\d{1,2}\s*(?:[,;:.\-]|\s)|[a-l]\s*(?:[,;:.\-]|\s)))/iu,
      '',
    );
    if (/^(?:slot|time|team|position|posi[cç][aã]o|rank)\s*[,;|]\s*(?:equipe|team|nome(?:\s+da\s+equipe)?|name)\b/iu.test(normalizedLine)) return;
    const prefixedEntry = normalizedLine.match(
      /^(?:slot|time|team)\s*([0-9]{1,2}|[a-l])\s*(?:[,;:.\-]\s*|\s+)(.+?)\s*$/iu,
    );
    const numberedEntry = normalizedLine.match(/^([0-9]{1,2})\s*(?:[,;:.\-]\s*|\s+)(.+?)\s*$/u);
    const letteredEntry = normalizedLine.match(/^([a-l])\s*[,;:.\-]\s*(.+?)\s*$/iu);
    const match = prefixedEntry || numberedEntry || letteredEntry;
    if (!match) return;
    const slot = /^\d{1,2}$/u.test(match[1])
      ? Number(match[1])
      : match[1].toLocaleUpperCase('en-US').charCodeAt(0) - 64;
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
  if (!state.template) return 'Envie o modelo em branco deste evento para habilitar o JPEG.';
  if (!hasCompleteRoster()) return 'Preencha os nomes dos 12 slots antes de exportar.';
  const issue = state.drops.slice(0, state.dropsCount).map(dropReviewIssue).find(Boolean);
  return issue || 'O JPEG preserva a proporção do modelo e limita o maior lado a 1080 px.';
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
  if (!state.built || !root.querySelector('#ffEvent') || !root.querySelector('#ffMatchResultView')) {
    build(root);
  }
  $('ffEvent').value = state.event;
  $('ffDrops').value = String(state.dropsCount);
  $('ffImageQualityMode').value = state.imageQualityMode;
  $('ffImageQualityHint').textContent = state.imageQualityMode === 'original'
    ? 'Envia as imagens sem recompressão ou redimensionamento. Limite total: 4 MB por análise.'
    : 'Arquivos até 800 KB vão sem alteração; os maiores podem ser reduzidos para caber no limite.';
  $('ffRosterFileLabel').textContent = state.rosterImages.length
    ? state.rosterImages.map(file => `${file.name} · ${file.size.toLocaleString('pt-BR')} bytes`).join(' | ')
    : 'Nenhuma imagem selecionada';
  const viewer = readOnly();
  $('ffEvent').disabled = viewer;
  $('ffDrops').disabled = viewer;
  $('ffImageQualityMode').disabled = viewer || state.busy;
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
    ? `Imagens selecionadas: ${(totalImageBytes / 1024 / 1024).toFixed(1)} MB. Arraste imagens diretamente para as áreas ou use os botões; elas serão enviadas ao analisar.`
    : 'Arraste imagens diretamente para as áreas ou use os botões. Até 3 fotos do lobby e 2 do placar; algumas páginas bloqueiam a importação direta.';
  $('ffSlotUpload').disabled = viewer;
  $('ffResultUpload').disabled = viewer;
  $('ffExtraction').classList.toggle('ff-readonly', viewer);
  $('ffBusy').classList.toggle('hidden', !state.busy);
  $('ffBusyLabel').textContent = state.imageQualityMode === 'original'
    ? 'Enviando imagens originais e analisando'
    : 'Otimizando imagens e analisando';
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

  const showMatchResult = activeScoringMode === 'matchresult';
  $('ffImageModeView').hidden = showMatchResult;
  $('ffMatchResultView').hidden = !showMatchResult;
  $('ffModeImages').setAttribute('aria-pressed', String(!showMatchResult));
  $('ffModeMatchResult').setAttribute('aria-pressed', String(showMatchResult));
  matchResultView?.render(matchResultViewState());
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
    return `<div class="ff-image-preview" title="${esc(file.name)}"><img src="${url}" alt=""><span class="ff-image-meta"><b>${esc(file.name)}</b><small data-image-meta="${index}">Lendo dimensões…</small></span>${allowRemove ? `<button type="button" class="ff-remove-image" data-remove-image="${scope}" data-image-index="${index}" aria-label="Remover ${esc(file.name)}" title="Remover imagem">×</button>` : ''}</div>`;
  }).join('');
  previews.querySelectorAll('.ff-image-preview img').forEach((image, index) => {
    const updateMeta = () => {
      const file = files[index];
      const meta = image.parentElement.querySelector('[data-image-meta]');
      if (!file || !meta) return;
      const dimensions = image.naturalWidth && image.naturalHeight
        ? `${image.naturalWidth} × ${image.naturalHeight} px`
        : 'Resolução indisponível';
      const bytes = `${file.size.toLocaleString('pt-BR')} bytes`;
      const status = state.imageQualityMode === 'original'
        ? 'vai como original'
        : file.size <= MAX_ANALYSIS_IMAGE_BYTES ? 'sem alteração' : 'será otimizada';
      meta.textContent = `${dimensions} · ${bytes} · ${status}`;
      meta.title = meta.textContent;
    };
    if (image.complete) updateMeta();
    else image.addEventListener('load', updateMeta, { once: true });
  });
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
    <nav class="ff-scoring-mode-switch" aria-label="Modo de pontuação">
      <button type="button" id="ffModeImages" aria-pressed="true">Analisar por imagens</button>
      <button type="button" id="ffModeMatchResult" aria-pressed="false">MatchResult · 15 equipes</button>
    </nav>
    <div id="ffImageModeView">
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
          <div class="ff-quality-setting"><label for="ffImageQualityMode">Qualidade das imagens para análise</label><select id="ffImageQualityMode"><option value="auto">Otimizar automaticamente (recomendado)</option><option value="original">Enviar original sem recompressão</option></select><small id="ffImageQualityHint"></small></div>
          <div class="ff-template-config"><div class="ff-template-preview" id="ffTemplatePreview"></div><div class="ff-template-meta"><span class="ff-mini-label">TABELA EM BRANCO</span><b id="ffTemplateName"></b><small id="ffTemplateHint"></small><label class="ff-button ff-button-light" for="ffTemplateUpload"><i class="fas fa-upload"></i> Enviar ou arrastar modelo</label><input id="ffTemplateUpload" type="file" accept="image/png,image/jpeg,image/webp" hidden></div></div>
          <p class="ff-note">Cada evento mantém seu próprio modelo neste navegador. O JPEG preserva a proporção e limita o maior lado a 1080 px.</p>
        </section>
        <section class="ff-panel">
          <div class="ff-panel-heading"><div class="ff-step">02</div><div><h2>Lista oficial de slots</h2><p>Doze posições fixas. Um slot sem equipe não participa do placar.</p></div></div>
          <label class="ff-field">Cole lista ou CSV <span class="ff-field-hint">Os slots são preenchidos automaticamente. Aceita TIME A–L, SLOT 01–12 e linhas numeradas.</span><textarea id="ffRosterText" rows="4" placeholder="TIME A: Nome do time&#10;1, Nome do time&#10;⃟🩵 𝑺𝑳𝑶𝑻 𝟎𝟏: KЯ E-SPORT🍀&#10;..."></textarea></label>
          <div class="ff-roster-actions"><label class="ff-button ff-button-light" for="ffRosterUpload"><i class="fas fa-image"></i> Importar ou arrastar lista</label><input id="ffRosterUpload" type="file" accept="image/png,image/jpeg,image/webp,.csv,.txt" multiple hidden><span id="ffRosterFileLabel" class="ff-file-label">Nenhuma imagem selecionada</span><button type="button" id="ffAnalyzeRoster" class="ff-button ff-button-light" disabled><i class="fas fa-wand-magic-sparkles"></i> Analisar foto da lista</button></div>
          <div id="ffRosterRows" class="ff-roster-grid"></div>
        </section>
        <section class="ff-panel ff-lobby-panel">
          <div class="ff-panel-heading"><div class="ff-step">03</div><div><h2>Slots do lobby</h2><p>Envie as 3 fotos uma vez. Elas serão reutilizadas em todas as quedas deste evento.</p></div></div>
          <div class="ff-lobby-upload">
            <label class="ff-upload-tile"><input id="ffSlotUpload" type="file" accept="image/png,image/jpeg,image/webp" multiple><i class="fas fa-border-all"></i><b>Slots do lobby (3 fotos)</b><small id="ffSlotFiles">Nenhuma imagem selecionada</small><span>Arraste ou clique para adicionar</span></label>
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
                <label class="ff-upload-tile"><input id="ffResultUpload" type="file" accept="image/png,image/jpeg,image/webp" multiple><i class="fas fa-list-ol"></i><b>Placar final (até 2 fotos)</b><small id="ffResultFiles">Nenhuma imagem selecionada</small><span>Arraste ou clique para adicionar</span></label>
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
        <button type="button" id="ffExport" class="ff-button ff-button-export" disabled><i class="fas fa-file-image"></i> Exportar tabela JPEG</button>
        <p class="ff-export-note" id="ffExportNote">Envie o modelo em branco deste evento para habilitar o JPEG.</p>
      </aside>
    </div>
    </div>
    <div id="ffMatchResultView" hidden></div>`;
  matchResultView = createMatchResultView($('ffMatchResultView'), {
    onEventChange: eventType => { changeMatchResultEvent(eventType); },
    onEventHourChange: hour => { changeMatchResultHour(hour); },
    onDropCountChange: count => {
      matchResultState.dropCount = Math.max(1, Math.min(5, Number(count) || 1));
      matchResultState.exportMessage = '';
      render();
    },
    onRosterTextInput: text => { updateMatchResultRosterText(text); },
    onRosterSlotInput: (slot, teamName) => {
      if (!Number.isInteger(slot) || slot < 1 || slot > 15) return;
      const draft = parseMatchResultRoster(matchResultState.rosterText).roster;
      draft[slot - 1].teamName = String(teamName ?? '');
      const text = draft.map((team, index) =>
        `TIME ${String.fromCharCode(65 + index)}: ${team.teamName}`,
      ).join('\n');
      updateMatchResultRosterText(text);
    },
    onRosterFiles: files => { importMatchResultRosterFiles(files); },
    onDropFile: (dropIndex, file) => { readMatchResultFile(dropIndex, file); },
    onClearDrop: dropIndex => {
      matchResultState.drops[dropIndex] = blankMatchResultDrop(dropIndex);
      matchResultState.exportMessage = '';
      render();
    },
    onDropReview: (dropIndex, reviewed) => {
      if (matchResultState.drops[dropIndex]) {
        matchResultState.drops[dropIndex].reviewed = reviewed;
        matchResultState.exportMessage = '';
        render();
      }
    },
    onExport: () => {
      exportMatchResultJpeg().catch(error => {
        matchResultState.exportMessage = error.message || 'Falha ao exportar a classificação.';
        render();
      });
    },
  });
  $('ffModeImages').addEventListener('click', () => {
    activeScoringMode = 'images';
    render();
  });
  $('ffModeMatchResult').addEventListener('click', async () => {
    activeScoringMode = 'matchresult';
    await loadMatchResultTemplate();
    render();
  });
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
  $('ffImageQualityMode').addEventListener('change', e => {
    state.imageQualityMode = e.target.value === 'original' ? 'original' : 'auto';
    render();
  });
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
  attachImageDropTarget(document.querySelector('label[for="ffTemplateUpload"]'), $('ffTemplateUpload'));
  attachImageDropTarget(document.querySelector('label[for="ffRosterUpload"]'), $('ffRosterUpload'));
  attachImageDropTarget($('ffSlotUpload').closest('.ff-upload-tile'), $('ffSlotUpload'));
  attachImageDropTarget($('ffResultUpload').closest('.ff-upload-tile'), $('ffResultUpload'));
  $('ffExport').addEventListener('click', exportJpeg);
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

function captureDroppedFiles(dataTransfer) {
  const files = [...(dataTransfer?.files || [])];
  if (files.length) return files;
  return [...(dataTransfer?.items || [])]
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean);
}

function normalizeDroppedFile(file) {
  if (SUPPORTED_IMAGES.has(file.type)) return file;
  if (file.type && file.type !== 'application/octet-stream') return file;
  const extension = file.name.toLowerCase().split('.').pop();
  const mime = extension === 'png' ? 'image/png'
    : ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg'
      : extension === 'webp' ? 'image/webp' : '';
  if (!mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

function imageUrlFromDrop(dataTransfer) {
  const uriList = (dataTransfer?.getData('text/uri-list') || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#')) || '';
  const html = dataTransfer?.getData('text/html') || '';
  if (html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const source = parsed.querySelector('img[src]')?.getAttribute('src');
    if (source) {
      try { return new URL(source, uriList || window.location.href).href; } catch { return source; }
    }
  }
  const downloadUrl = dataTransfer?.getData('DownloadURL') || '';
  const downloadMatch = downloadUrl.match(/^[^:]+:[^:]+:(https?:\/\/\S+)$/i);
  if (downloadMatch) return downloadMatch[1];
  if (uriList) return uriList;
  const plainText = (dataTransfer?.getData('text/plain') || '').trim();
  return /^https?:\/\//i.test(plainText) ? plainText : '';
}

function validateDroppedImageUrl(url) {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[');
  const isLocalHost = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local');
  if (url.origin !== window.location.origin && (url.protocol !== 'https:' || isIpAddress || isLocalHost)) {
    throw new Error('Por segurança, imagens da internet precisam usar um endereço HTTPS público.');
  }
}

function mimeFromImageUrl(url, responseType) {
  const mime = String(responseType || '').split(';')[0].trim().toLowerCase();
  if (SUPPORTED_IMAGES.has(mime)) return mime;
  const path = url.pathname.toLowerCase();
  if (/\.jpe?g$/.test(path)) return 'image/jpeg';
  if (/\.png$/.test(path)) return 'image/png';
  if (/\.webp$/.test(path)) return 'image/webp';
  return '';
}

function imageNameFromUrl(url, mime) {
  const extension = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
  let name = url.pathname.split('/').pop() || '';
  try { name = decodeURIComponent(name); } catch { /* Use the encoded filename as-is. */ }
  name = name.replace(/[^\p{L}\p{N}._-]+/gu, '-');
  if (!name || !/\.(png|jpe?g|webp)$/i.test(name)) name = `imagem-arrastada-${Date.now()}${extension}`;
  return name.slice(0, 120);
}

function imageImportError(message) {
  const error = new Error(message);
  error.name = 'ImageImportError';
  return error;
}

async function fetchDroppedImage(urlValue) {
  let url;
  try {
    url = new URL(urlValue, window.location.href);
  } catch {
    throw imageImportError('Não consegui identificar a imagem arrastada.');
  }
  validateDroppedImageUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let response;
    try {
      response = await fetch(url.href, {
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw imageImportError('O site de origem bloqueou a importação direta. Tente arrastar o arquivo de imagem ou usar o botão para selecioná-lo.');
    }
    if (!response.ok) throw imageImportError('Não foi possível buscar a imagem no site de origem.');
    const finalUrl = new URL(response.url || url.href);
    validateDroppedImageUrl(finalUrl);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_DROPPED_REMOTE_IMAGE_BYTES) {
      throw imageImportError('A imagem arrastada é muito grande. O limite para importação direta é 25 MB.');
    }
    let blob;
    try {
      blob = await response.blob();
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw imageImportError('Não consegui receber a imagem completa do site de origem.');
    }
    if (!blob.size || blob.size > MAX_DROPPED_REMOTE_IMAGE_BYTES) {
      throw imageImportError('A imagem arrastada está vazia ou ultrapassa o limite de 25 MB.');
    }
    const mime = mimeFromImageUrl(finalUrl, blob.type);
    if (!mime) throw imageImportError('O link arrastado não retornou uma imagem PNG, JPG ou WebP.');
    return new File([blob], imageNameFromUrl(finalUrl, mime), { type: mime, lastModified: Date.now() });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw imageImportError('A importação direta demorou demais. Tente arrastar a imagem novamente.');
    }
    if (error?.name === 'ImageImportError') throw error;
    throw imageImportError('O site de origem bloqueou a importação direta. Tente arrastar o arquivo de imagem ou usar o botão para selecioná-lo.');
  } finally {
    clearTimeout(timeout);
  }
}

function attachImageDropTarget(target, input) {
  if (!target || !input) return;
  let dragDepth = 0;
  const hasImagePayload = dataTransfer => {
    if (!dataTransfer) return false;
    if (dataTransfer.files?.length) return true;
    if ([...(dataTransfer.items || [])].some(item => item.kind === 'file')) return true;
    return [...(dataTransfer.types || [])]
      .some(type => ['files', 'text/uri-list', 'text/html', 'text/plain', 'downloadurl'].includes(type.toLowerCase()));
  };
  const clearDragState = () => {
    dragDepth = 0;
    target.classList.remove('ff-drop-target-active', 'ff-drop-target-loading');
    target.removeAttribute('aria-busy');
  };

  target.addEventListener('dragenter', event => {
    if (input.disabled || !hasImagePayload(event.dataTransfer)) return;
    event.preventDefault();
    dragDepth += 1;
    target.classList.add('ff-drop-target-active');
  });
  target.addEventListener('dragover', event => {
    if (input.disabled || !hasImagePayload(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
  target.addEventListener('dragleave', event => {
    if (!target.classList.contains('ff-drop-target-active')) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) target.classList.remove('ff-drop-target-active');
  });
  target.addEventListener('drop', async event => {
    if (!hasImagePayload(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    clearDragState();
    if (input.disabled) {
      setNotice('error', 'Este campo está somente para leitura.');
      return;
    }
    const files = captureDroppedFiles(event.dataTransfer);
    const imageUrl = files.length ? '' : imageUrlFromDrop(event.dataTransfer);
    try {
      let acceptedFiles = files.map(normalizeDroppedFile);
      if (!acceptedFiles.length && imageUrl) {
        target.classList.add('ff-drop-target-loading');
        target.setAttribute('aria-busy', 'true');
        acceptedFiles = [await fetchDroppedImage(imageUrl)];
      }
      if (!acceptedFiles.length) {
        throw new Error('Arraste um arquivo de imagem ou uma imagem da página para esta área.');
      }
      if (!input.multiple && acceptedFiles.length > 1) {
        throw new Error('Arraste uma imagem por vez para esta área.');
      }
      const transfer = new DataTransfer();
      acceptedFiles.forEach(file => transfer.items.add(file));
      input.files = transfer.files;
      state.error = '';
      state.message = '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) {
      setNotice('error', error.message || 'Não foi possível importar a imagem arrastada.');
    } finally {
      clearDragState();
    }
  });
}
async function toPayload(file) {
  const optimized = state.imageQualityMode === 'original' ? file : await optimizeAnalysisImage(file);
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.readAsDataURL(optimized);
  });
  return { mimeType: optimized.type || file.type || 'application/octet-stream', base64 };
}
function validateOriginalImageTotal(files) {
  if (state.imageQualityMode !== 'original') return;
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_ANALYSIS_TOTAL_IMAGE_BYTES) {
    throw new Error(`As imagens originais somam ${(totalBytes / 1024 / 1024).toFixed(2)} MB. O limite é 4 MB por análise; remova imagens ou use a otimização automática.`);
  }
}
async function requestAnalyze(payload) {
  const user = window.firebaseAuth?.currentUser;
  if (!user) throw new Error('Sua sessão expirou. Entre novamente no painel.');
  const token = await user.getIdToken();
  const body = JSON.stringify(payload);
  const bodyBytes = new TextEncoder().encode(body).byteLength;
  if (bodyBytes > MAX_ANALYSIS_REQUEST_BYTES) {
    throw new Error('O envio ultrapassa o limite seguro do serviço. Remova uma imagem ou use a otimização automática.');
  }
  let response;
  try {
    response = await fetch('/api/freefire/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
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
    validateOriginalImageTotal(state.rosterImages);
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
    validateOriginalImageTotal([...state.slotImages, ...drop.resultImages]);
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
async function exportJpeg() {
  if (!state.template) return;
  try {
    const bitmap = await createImageBitmap(state.template);
    const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('O navegador não conseguiu preparar a imagem JPEG.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
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
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('O navegador não conseguiu gerar o arquivo JPEG.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freitas-${state.event}-leaderboard.jpg`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('success', `JPEG exportado em ${canvas.width} × ${canvas.height} px (${Math.round(blob.size / 1024)} KB).`);
  } catch (error) { setNotice('error', error.message || 'Falha ao exportar a tabela.'); }
  render();
}
export async function openFreefireScoringAdmin() {
  if (!canOpen() || !visible()) return;
  state.error = '';
  let stage = 'montagem inicial';
  try {
    // Render the workspace first; optional templates and logo catalogs must not
    // prevent the scoring tools from opening when a network/storage request fails.
    render();
    stage = 'carregamento dos modelos e logos';
    await Promise.allSettled([
      loadTemplate(),
      loadMatchResultTemplate(),
      matchResultState.eventType === 'modo-liga' ? loadModoLigaLogoCatalog(true) : Promise.resolve(),
    ]);
    stage = 'atualização final da tela';
    render();
  } catch (cause) {
    const detail = cause?.message || String(cause || 'erro sem mensagem');
    const error = new Error(`Falha na etapa ${stage}: ${detail}`, { cause });
    error.scoringStage = stage;
    throw error;
  }
}
