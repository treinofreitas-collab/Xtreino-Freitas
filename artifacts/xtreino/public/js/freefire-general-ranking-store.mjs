import {
  aggregateGeneralRankingImport,
  buildGeneralRankingSessionTeams,
  generalRankingTeamKey,
  generalRankingSessionKey,
  MIN_GENERAL_RANKING_SEED_ROWS,
  parseGeneralRankingImport,
  rankGeneralRankingRows,
} from './freefire-general-ranking.mjs?v=general-ranking-logo-time-1';

const TEAM_COLLECTION = 'freefire_general_ranking';
const SESSION_COLLECTION = 'freefire_general_ranking_sessions';
const META_COLLECTION = 'freefire_general_ranking_meta';
const META_ID = 'current';
const IMPORT_BATCH_SIZE = 400;

function databaseOrThrow(db = window.firebaseDb) {
  if (!db) throw new Error('O banco de dados do ranking não está disponível.');
  return db;
}

function teamDocumentId(key) {
  return `team_${String(key || '').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/gu, '').slice(0, 110)}`;
}

function timestampMs(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function chooseLatestGeneralRankingLogo(candidates, current = null) {
  const validCandidates = candidates
    .filter(candidate => candidate?.logoUrl)
    .sort((first, second) =>
      (second.updatedAtMs || 0) - (first.updatedAtMs || 0) ||
      ({ purchase: 3, custom: 2, association: 1 }[second.source] || 0) -
      ({ purchase: 3, custom: 2, association: 1 }[first.source] || 0));
  const newest = validCandidates[0];
  if (!newest) return null;

  const currentLogoUrl = String(current?.logoUrl || '');
  const currentLogoTimestamp = timestampMs(current?.logoUpdatedAt);
  if (currentLogoUrl === newest.logoUrl &&
      String(current?.logoSource || '') === newest.source &&
      currentLogoTimestamp >= (newest.updatedAtMs || 0)) return null;
  if (currentLogoUrl && currentLogoTimestamp > (newest.updatedAtMs || 0)) return null;
  return newest;
}

export async function syncGeneralRankingLogoToTeam(db, {
  teamName,
  logoUrl,
  source = 'association',
  updatedAtMs = Date.now(),
} = {}) {
  const targetDb = databaseOrThrow(db);
  const key = generalRankingTeamKey(teamName);
  const candidateUrl = String(logoUrl || '').trim();
  if (
    !key ||
    (!/^https:\/\//i.test(candidateUrl) &&
      (!candidateUrl.startsWith('/') || candidateUrl.startsWith('//')))
  ) return false;

  await getFirestoreFunctions();
  const { runTransaction, serverTimestamp } = window.__freefireRankingFirestore;
  const rankingRef = rankingCollections(targetDb).teamRef(key);
  return runTransaction(targetDb, async transaction => {
    const snapshot = await transaction.get(rankingRef);
    if (!snapshot.exists()) return false;
    const latest = chooseLatestGeneralRankingLogo([{
      logoUrl: candidateUrl,
      source,
      updatedAtMs: Number(updatedAtMs || 0),
    }], snapshot.data());
    if (!latest) return false;
    transaction.update(rankingRef, {
      logoUrl: latest.logoUrl,
      logoSource: latest.source,
      logoUpdatedAt: latest.updatedAtMs || Date.now(),
      updatedAt: serverTimestamp(),
    });
    return true;
  });
}

function rankingCollections(db) {
  const { collection, doc } = window.__freefireRankingFirestore;
  return {
    teams: collection(db, TEAM_COLLECTION),
    teamRef: key => doc(db, TEAM_COLLECTION, teamDocumentId(key)),
    sessions: collection(db, SESSION_COLLECTION),
    sessionRef: id => doc(db, SESSION_COLLECTION, id),
    metaRef: doc(db, META_COLLECTION, META_ID),
  };
}

async function getFirestoreFunctions() {
  if (!window.__freefireRankingFirestore) {
    window.__freefireRankingFirestore = await import(
      'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'
    );
  }
  return window.__freefireRankingFirestore;
}

function importFingerprint(source) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${source.length}`;
}

export async function importGeneralRankingSeed(db, sourceText, onProgress = () => {}, logoCatalog = {}) {
  const targetDb = databaseOrThrow(db);
  const parsed = parseGeneralRankingImport(sourceText);
  if (parsed.errors.length) throw new Error(parsed.errors.join(' '));
  if (parsed.rows.length < MIN_GENERAL_RANKING_SEED_ROWS) {
    throw new Error(
      `O arquivo tem só ${parsed.rows.length} linhas válidas; confira se exportou a classificação completa (mínimo de ${MIN_GENERAL_RANKING_SEED_ROWS}).`,
    );
  }
  const teams = aggregateGeneralRankingImport(parsed.rows);
  if (!teams.length) throw new Error('O arquivo não contém equipes válidas para importar.');

  await getFirestoreFunctions();
  const { getDoc, serverTimestamp, setDoc, writeBatch } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const metaSnapshot = await getDoc(refs.metaRef);
  const previousMeta = metaSnapshot.exists() ? metaSnapshot.data() : {};
  const sourceHash = importFingerprint(String(sourceText));
  if (previousMeta.initialImportStatus === 'complete') {
    throw new Error('A base inicial do Ranking Geral já foi importada.');
  }
  if (
    previousMeta.initialImportStatus === 'in_progress' &&
    previousMeta.sourceHash &&
    previousMeta.sourceHash !== sourceHash
  ) {
    throw new Error('Uma importação incompleta já começou com outro arquivo. Reenvie o mesmo arquivo para retomá-la.');
  }

  await setDoc(refs.metaRef, {
    initialImportStatus: 'in_progress',
    sourceHash,
    sourceRows: parsed.rows.length,
    uniqueTeams: teams.length,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  for (let start = 0; start < teams.length; start += IMPORT_BATCH_SIZE) {
    const batch = writeBatch(targetDb);
    const page = teams.slice(start, start + IMPORT_BATCH_SIZE);
    for (const team of page) {
      batch.set(refs.teamRef(team.key), {
        teamKey: team.key,
        teamName: team.teamName,
        baselinePoints: team.baselinePoints,
        totalPoints: team.baselinePoints,
        sessionPoints: 0,
        wins: 0,
        kills: 0,
        sourceRows: team.sourceRows,
        sourceNames: team.sourceNames,
        sourcePosition: Number.isInteger(team.sourcePosition) ? team.sourcePosition : null,
        ...(logoCatalog[team.key]?.logoUrl ? {
          logoUrl: logoCatalog[team.key].logoUrl,
          logoSource: logoCatalog[team.key].logoSource || '',
          logoUpdatedAt: Number(logoCatalog[team.key].logoUpdatedAt || 0),
        } : {}),
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
    onProgress({
      completed: Math.min(start + page.length, teams.length),
      total: teams.length,
      sourceRows: parsed.rows.length,
    });
  }

  await setDoc(refs.metaRef, {
    initialImportStatus: 'complete',
    sourceHash,
    sourceRows: parsed.rows.length,
    uniqueTeams: teams.length,
    importedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { sourceRows: parsed.rows.length, uniqueTeams: teams.length };
}

export async function upsertGeneralRankingSession(db, {
  eventType,
  date,
  hour,
  standings,
  updatedBy = '',
}) {
  const targetDb = databaseOrThrow(db);
  const sessionId = generalRankingSessionKey(eventType, date, hour);
  const teams = buildGeneralRankingSessionTeams(standings);
  if (!teams.length) throw new Error('Não há equipes pontuadas para registrar no Ranking Geral.');

  await getFirestoreFunctions();
  const {
    getDoc,
    runTransaction,
    serverTimestamp,
  } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const sessionRef = refs.sessionRef(sessionId);

  return runTransaction(targetDb, async transaction => {
    const [metaSnapshot, previousSessionSnapshot] = await Promise.all([
      transaction.get(refs.metaRef),
      transaction.get(sessionRef),
    ]);
    const meta = metaSnapshot.exists() ? metaSnapshot.data() : {};
    if (meta.initialImportStatus !== 'complete') {
      throw new Error('Importe primeiro a base inicial do Ranking Geral.');
    }
    const oldTeams = Array.isArray(previousSessionSnapshot.data()?.teams)
      ? previousSessionSnapshot.data().teams
      : [];
    const oldByKey = new Map(oldTeams.map(team => [team.key, team]));
    const nextByKey = new Map(teams.map(team => [team.key, team]));
    const allKeys = [...new Set([...oldByKey.keys(), ...nextByKey.keys()])];
    const teamRefs = new Map(allKeys.map(key => [key, refs.teamRef(key)]));
    const teamSnapshots = new Map();
    for (const key of allKeys) {
      teamSnapshots.set(key, await transaction.get(teamRefs.get(key)));
    }

    for (const key of allKeys) {
      const previous = oldByKey.get(key) || { points: 0, wins: 0, kills: 0 };
      const next = nextByKey.get(key) || { points: 0, wins: 0, kills: 0 };
      const snapshot = teamSnapshots.get(key);
      const current = snapshot.exists() ? snapshot.data() : {};
      const currentPoints = Number(current.sessionPoints || 0);
      const currentWins = Number(current.wins || 0);
      const currentKills = Number(current.kills || 0);
      const sessionPoints = Math.max(0, currentPoints - Number(previous.points || 0) + Number(next.points || 0));
      const wins = Math.max(0, currentWins - Number(previous.wins || 0) + Number(next.wins || 0));
      const kills = Math.max(0, currentKills - Number(previous.kills || 0) + Number(next.kills || 0));
      const incoming = nextByKey.get(key);
      const latestLogo = incoming?.logoUrl
        ? chooseLatestGeneralRankingLogo([{
            logoUrl: incoming.logoUrl,
            source: String(incoming.logoSource || ''),
            updatedAtMs: Number(incoming.logoUpdatedAt || 0),
          }], current)
        : null;
      transaction.set(teamRefs.get(key), {
        teamKey: key,
        teamName: current.teamName || incoming?.teamName || previous.teamName || key,
        baselinePoints: Number(current.baselinePoints || 0),
        sessionPoints,
        wins,
        kills,
        totalPoints: Number(current.baselinePoints || 0) + sessionPoints,
        ...(latestLogo ? {
          logoUrl: latestLogo.logoUrl,
          logoSource: latestLogo.source,
          logoUpdatedAt: latestLogo.updatedAtMs || 0,
        } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(sessionRef, {
      sessionId,
      eventType,
      eventLabel: 'TREINO MODO LIGA',
      ...(eventType === 'treino-freitas' ? { eventLabel: 'TREINO FREITAS' } : {}),
      date,
      hour: String(hour).replace(/[^\d]/g, '').padStart(2, '0'),
      teams,
      updatedBy: String(updatedBy || ''),
      updatedAt: serverTimestamp(),
    });
    return { sessionId, teamCount: teams.length };
  });
}

export async function getGeneralRankingMeta(db) {
  const targetDb = databaseOrThrow(db);
  await getFirestoreFunctions();
  const { getDoc } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const snapshot = await getDoc(refs.metaRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function getGeneralRankingTop(db, pageSize = 3) {
  const targetDb = databaseOrThrow(db);
  await getFirestoreFunctions();
  const { getDocs, limit, orderBy, query } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const snapshot = await getDocs(query(refs.teams, orderBy('totalPoints', 'desc'), limit(pageSize)));
  return rankGeneralRankingRows(
    snapshot.docs.map(document => ({ id: document.id, ...document.data() })),
  );
}

export async function getGeneralRankingPage(db, {
  cursor = null,
  pageSize = 40,
} = {}) {
  const targetDb = databaseOrThrow(db);
  await getFirestoreFunctions();
  const { getDocs, limit, orderBy, query, startAfter } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const parts = [refs.teams, orderBy('totalPoints', 'desc'), limit(pageSize)];
  if (cursor) parts.splice(2, 0, startAfter(cursor));
  const snapshot = await getDocs(query(...parts));
  return {
    rows: snapshot.docs.map(document => ({ id: document.id, ...document.data() })),
    cursor: snapshot.docs.at(-1) || null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export async function getGeneralRankingTeamPosition(db, teamKey) {
  const targetDb = databaseOrThrow(db);
  await getFirestoreFunctions();
  const { getCountFromServer, getDoc, query, where } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const snapshot = await getDoc(refs.teamRef(teamKey));
  if (!snapshot.exists()) return null;
  const team = { id: snapshot.id, ...snapshot.data() };
  const higherQuery = query(refs.teams, where('totalPoints', '>', Number(team.totalPoints || 0)));
  const countSnapshot = await getCountFromServer(higherQuery);
  return { ...team, rank: countSnapshot.data().count + 1 };
}

export async function getGeneralRankingTeamPositionByName(db, teamName) {
  const key = generalRankingTeamKey(teamName);
  return key ? getGeneralRankingTeamPosition(db, key) : null;
}

export async function getGeneralRankingTeamPositionsByNames(db, teamNames) {
  const targetDb = databaseOrThrow(db);
  await getFirestoreFunctions();
  const { getCountFromServer, getDocs, query, where } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const keys = [...new Set((Array.isArray(teamNames) ? teamNames : [])
    .map(generalRankingTeamKey)
    .filter(Boolean))];
  const teams = [];
  for (let index = 0; index < keys.length; index += 30) {
    const pageKeys = keys.slice(index, index + 30);
    const snapshot = await getDocs(query(refs.teams, where('teamKey', 'in', pageKeys)));
    teams.push(...snapshot.docs.map(document => ({ id: document.id, ...document.data() })));
  }
  const points = [...new Set(teams.map(team => Number(team.totalPoints || 0)))];
  const rankByPoints = new Map();
  await Promise.all(points.map(async totalPoints => {
    const countSnapshot = await getCountFromServer(
      query(refs.teams, where('totalPoints', '>', totalPoints)),
    );
    rankByPoints.set(totalPoints, countSnapshot.data().count + 1);
  }));
  return new Map(teams.map(team => [
    team.teamKey,
    { ...team, rank: rankByPoints.get(Number(team.totalPoints || 0)) || 1 },
  ]));
}
