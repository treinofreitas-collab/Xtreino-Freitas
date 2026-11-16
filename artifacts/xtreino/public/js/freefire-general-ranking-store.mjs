import {
  aggregateGeneralRankingImport,
  buildGeneralRankingSessionTeams,
  generalRankingTeamKey,
  generalRankingSessionKey,
  MIN_GENERAL_RANKING_SEED_ROWS,
  parseGeneralRankingImport,
  rankGeneralRankingRows,
} from './freefire-general-ranking.mjs?v=ranking-team-identity-1';

const TEAM_COLLECTION = 'freefire_general_ranking';
const SESSION_COLLECTION = 'freefire_general_ranking_sessions';
const META_COLLECTION = 'freefire_general_ranking_meta';
const TEAM_LINK_COLLECTION = 'freefire_general_ranking_team_links';
const META_ID = 'current';
const IMPORT_BATCH_SIZE = 400;

function databaseOrThrow(db = window.firebaseDb) {
  if (!db) throw new Error('O banco de dados do ranking não está disponível.');
  return db;
}

function teamDocumentId(key) {
  return `team_${String(key || '').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/gu, '').slice(0, 110)}`;
}

function identityTeamDocumentId(team) {
  const nameId = teamDocumentId(team?.nameKey || generalRankingTeamKey(team?.teamName));
  const identity = String(team?.rankingTeamId || '').trim();
  return identity
    ? `${nameId}_id_${encodeURIComponent(identity).replace(/%/g, '_').slice(0, 500)}`
    : nameId;
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
  rankingTeamId = '',
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
  const refs = rankingCollections(targetDb);
  const identity = String(rankingTeamId || '').trim();
  const legacyRef = refs.teamRef(key);
  const linkRef = identity ? refs.teamLinkRef(identity) : null;
  return runTransaction(targetDb, async transaction => {
    const [legacySnapshot, linkSnapshot] = await Promise.all([
      transaction.get(legacyRef),
      linkRef ? transaction.get(linkRef) : Promise.resolve(null),
    ]);
    const mappedDocumentId = String(linkSnapshot?.exists() ? linkSnapshot.data()?.rankingDocumentId || '' : '');
    const legacy = legacySnapshot.exists() ? legacySnapshot.data() : {};
    if (!identity && (legacy.rankingTeamId || legacy.teamId)) return false;
    const rankingRef = mappedDocumentId
      ? window.__freefireRankingFirestore.doc(targetDb, TEAM_COLLECTION, mappedDocumentId)
      : identity && (legacy.rankingTeamId === identity || legacy.teamId === identity)
        ? legacyRef
        : identity
          ? refs.teamRefById({ nameKey: key, teamName, rankingTeamId: identity })
          : legacyRef;
    const snapshot = (
      (!mappedDocumentId && (!identity || legacy.rankingTeamId === identity || legacy.teamId === identity)) ||
      mappedDocumentId === legacyRef.id
    ) ? legacySnapshot : await transaction.get(rankingRef);
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
    teamRefById: team => doc(db, TEAM_COLLECTION, identityTeamDocumentId(team)),
    teamLinkRef: teamId => doc(db, TEAM_LINK_COLLECTION, String(teamId || '')),
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
    const oldByKey = new Map(oldTeams.map(team => {
      const nameKey = String(team.nameKey || generalRankingTeamKey(team.teamName || team.key) || '');
      const rankingTeamId = String(team.rankingTeamId || '').trim();
      const key = rankingTeamId ? `id:${rankingTeamId}` : `name:${nameKey}`;
      return [key, { ...team, key, nameKey, rankingTeamId }];
    }));
    const nextByKey = new Map(teams.map(team => [team.key, team]));
    const allKeys = [...new Set([...oldByKey.keys(), ...nextByKey.keys()])];
    const nextIdentityKeys = new Set(nextByKey.keys());
    const identityTeams = new Map(allKeys.map(key => [key, nextByKey.get(key) || oldByKey.get(key)]));
    const legacyRefs = new Map();
    const linkRefs = new Map();
    for (const team of identityTeams.values()) {
      if (!legacyRefs.has(team.nameKey)) legacyRefs.set(team.nameKey, refs.teamRef(team.nameKey));
      if (team.rankingTeamId && !linkRefs.has(team.rankingTeamId)) {
        linkRefs.set(team.rankingTeamId, refs.teamLinkRef(team.rankingTeamId));
      }
    }

    const linkSnapshots = new Map();
    for (const [teamId, ref] of linkRefs) linkSnapshots.set(teamId, await transaction.get(ref));
    const legacySnapshots = new Map();
    for (const [nameKey, ref] of legacyRefs) legacySnapshots.set(nameKey, await transaction.get(ref));

    const resolveTeamRef = team => {
      const linkSnapshot = team.rankingTeamId ? linkSnapshots.get(team.rankingTeamId) : null;
      if (linkSnapshot?.exists()) {
        const documentId = String(linkSnapshot.data()?.rankingDocumentId || '');
        if (documentId) return window.__freefireRankingFirestore.doc(targetDb, TEAM_COLLECTION, documentId);
      }
      const legacySnapshot = legacySnapshots.get(team.nameKey);
      const legacyData = legacySnapshot?.exists() ? legacySnapshot.data() : {};
      if (
        !team.rankingTeamId &&
        nextIdentityKeys.has(team.key) &&
        (legacyData.rankingTeamId || legacyData.teamId)
      ) {
        throw new Error(
          `A equipe "${team.teamName}" já está vinculada a um ID. Identifique a equipe desta sessão antes de salvar para não misturar pontuações.`,
        );
      }
      if (
        team.rankingTeamId &&
        (legacyData.rankingTeamId === team.rankingTeamId || legacyData.teamId === team.rankingTeamId)
      ) {
        return refs.teamRef(team.nameKey);
      }
      return team.rankingTeamId ? refs.teamRefById(team) : refs.teamRef(team.nameKey);
    };

    const documentGroups = new Map();
    for (const key of allKeys) {
      const identity = identityTeams.get(key);
      const teamRef = resolveTeamRef(identity);
      const documentKey = teamRef.path || `${teamRef.collection || TEAM_COLLECTION}/${teamRef.id || ''}`;
      const group = documentGroups.get(documentKey) || {
        teamRef,
        previous: { points: 0, wins: 0, kills: 0 },
        next: { points: 0, wins: 0, kills: 0 },
        names: [],
        nameKey: identity.nameKey,
        rankingTeamId: '',
        incoming: null,
      };
      const previous = oldByKey.get(key);
      const next = nextByKey.get(key);
      for (const field of ['points', 'wins', 'kills']) {
        group.previous[field] += Number(previous?.[field] || 0);
        group.next[field] += Number(next?.[field] || 0);
      }
      const teamName = String(next?.teamName || previous?.teamName || '').trim();
      if (teamName && !group.names.includes(teamName)) group.names.push(teamName);
      group.rankingTeamId ||= String(identity.rankingTeamId || '');
      if (next) group.incoming = next;
      documentGroups.set(documentKey, group);
    }

    const teamSnapshots = new Map();
    for (const [documentKey, group] of documentGroups) {
      teamSnapshots.set(documentKey, await transaction.get(group.teamRef));
    }

    for (const [documentKey, group] of documentGroups) {
      const snapshot = teamSnapshots.get(documentKey);
      const current = snapshot.exists() ? snapshot.data() : {};
      const currentPoints = Number(current.sessionPoints || 0);
      const currentWins = Number(current.wins || 0);
      const currentKills = Number(current.kills || 0);
      const sessionPoints = Math.max(0, currentPoints - group.previous.points + group.next.points);
      const wins = Math.max(0, currentWins - group.previous.wins + group.next.wins);
      const kills = Math.max(0, currentKills - group.previous.kills + group.next.kills);
      const incoming = group.incoming;
      const latestLogo = incoming?.logoUrl
        ? chooseLatestGeneralRankingLogo([{
            logoUrl: incoming.logoUrl,
            source: String(incoming.logoSource || ''),
            updatedAtMs: Number(incoming.logoUpdatedAt || 0),
          }], current)
        : null;
      transaction.set(group.teamRef, {
        teamKey: current.teamKey || group.nameKey,
        teamName: current.teamName || incoming?.teamName || group.names[0] || group.nameKey,
        baselinePoints: Number(current.baselinePoints || 0),
        sessionPoints,
        wins,
        kills,
        totalPoints: Number(current.baselinePoints || 0) + sessionPoints,
        ...(group.rankingTeamId ? { rankingTeamId: group.rankingTeamId } : {}),
        ...(latestLogo ? {
          logoUrl: latestLogo.logoUrl,
          logoSource: latestLogo.source,
          logoUpdatedAt: latestLogo.updatedAtMs || 0,
        } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (group.rankingTeamId) {
        const linkRef = refs.teamLinkRef(group.rankingTeamId);
        transaction.set(linkRef, {
          rankingTeamId: group.rankingTeamId,
          rankingDocumentId: group.teamRef.id,
          teamName: current.teamName || incoming?.teamName || group.names[0] || group.nameKey,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
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

export async function getGeneralRankingSessions(db) {
  const targetDb = databaseOrThrow(db);
  await getFirestoreFunctions();
  const { getDocs } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const snapshot = await getDocs(refs.sessions);
  return snapshot.docs
    .map(document => {
      const data = document.data() || {};
      return {
        sessionId: String(data.sessionId || document.id || ''),
        eventType: String(data.eventType || ''),
        eventLabel: String(data.eventLabel || ''),
        date: String(data.date || ''),
        hour: String(data.hour || ''),
        teams: Array.isArray(data.teams) ? data.teams : [],
        updatedAt: data.updatedAt || null,
      };
    })
    .filter(session =>
      ['treino-freitas', 'modo-liga'].includes(session.eventType) &&
      /^\d{4}-\d{2}-\d{2}$/.test(session.date) &&
      session.sessionId,
    );
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
  return rankTeamPositions(targetDb, teams, refs);
}

export async function getGeneralRankingTeamPositionsByIds(db, teamIds) {
  const targetDb = databaseOrThrow(db);
  await getFirestoreFunctions();
  const { getDocs, query, where } = window.__freefireRankingFirestore;
  const refs = rankingCollections(targetDb);
  const ids = [...new Set((Array.isArray(teamIds) ? teamIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))];
  const teams = [];
  for (let index = 0; index < ids.length; index += 30) {
    const pageIds = ids.slice(index, index + 30);
    const snapshot = await getDocs(query(refs.teams, where('rankingTeamId', 'in', pageIds)));
    teams.push(...snapshot.docs.map(document => ({ id: document.id, ...document.data() })));
  }
  return rankTeamPositions(targetDb, teams, refs);
}

async function rankTeamPositions(db, teams, refs) {
  const { getCountFromServer, query, where } = window.__freefireRankingFirestore;
  const points = [...new Set(teams.map(team => Number(team.totalPoints || 0)))];
  const rankByPoints = new Map();
  await Promise.all(points.map(async totalPoints => {
    const countSnapshot = await getCountFromServer(
      query(refs.teams, where('totalPoints', '>', totalPoints)),
    );
    rankByPoints.set(totalPoints, countSnapshot.data().count + 1);
  }));
  const entries = [];
  for (const team of teams) {
    const ranked = { ...team, rank: rankByPoints.get(Number(team.totalPoints || 0)) || 1 };
    if (team.teamKey) entries.push([String(team.teamKey), ranked]);
    if (team.rankingTeamId) entries.push([String(team.rankingTeamId), ranked]);
  }
  return new Map(entries);
}
