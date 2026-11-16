import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  accountRankingTeamId,
  aggregateGeneralRankingImport,
  buildGeneralRankingSessionTeams,
  generalRankingSessionKey,
  parseGeneralRankingImport,
  rankGeneralRankingRows,
} from '../../artifacts/xtreino/public/js/freefire-general-ranking.mjs';
import {
  chooseLatestGeneralRankingLogo,
  getGeneralRankingSessions,
  syncGeneralRankingLogoToTeam,
  upsertGeneralRankingSession,
} from '../../artifacts/xtreino/public/js/freefire-general-ranking-store.mjs';

const imageScoringSource = readFileSync(
  new URL('../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs', import.meta.url),
  'utf8',
);

test('downloads the JPEG before saving ranking data and labels the selected training date', () => {
  const exportStart = imageScoringSource.indexOf('async function exportJpeg()');
  const exportEnd = imageScoringSource.indexOf('export async function openFreefireScoringAdmin()', exportStart);
  const exportImplementation = imageScoringSource.slice(exportStart, exportEnd);
  const downloadIndex = exportImplementation.indexOf('triggerBlobDownload(blob');
  const backgroundSaveIndex = exportImplementation.indexOf('scheduleImageRankingSave()');

  assert.ok(exportStart >= 0 && exportEnd > exportStart, 'image-mode JPEG exporter should exist');
  assert.ok(downloadIndex >= 0 && backgroundSaveIndex > downloadIndex, 'start the download before scheduling ranking sync');
  assert.doesNotMatch(exportImplementation, /await\s+persistImageModeGeneralRanking\s*\(/);
  assert.match(imageScoringSource, /Ranking Geral salvo para o treino de \$\{date\}, às \$\{hour\}h/);
});
test('loads authorized ranking history without returning editor identity data', async () => {
  const originalWindow = globalThis.window;
  let requestedCollection = '';
  globalThis.window = {
    __freefireRankingFirestore: {
      collection: (_db, name) => ({ name }),
      doc: (_db, collection, id) => ({ collection, id }),
      getDocs: async reference => {
        requestedCollection = reference.name;
        return {
          docs: [
            {
              id: 'treino-freitas_2026-11-13_21',
              data: () => ({
                eventType: 'treino-freitas',
                eventLabel: 'TREINO FREITAS',
                date: '2026-11-13',
                hour: '21',
                teams: [{ teamName: 'FOLTEST PRO', points: 1258, wins: 1, kills: 12 }],
                updatedBy: 'private-user-id',
              }),
            },
            {
              id: 'invalid',
              data: () => ({ eventType: 'intensivo', date: '2026-11-13', hour: '20', teams: [] }),
            },
          ],
        };
      },
    },
  };

  try {
    const sessions = await getGeneralRankingSessions({});
    assert.equal(requestedCollection, 'freefire_general_ranking_sessions');
    assert.equal(sessions.length, 1);
    assert.deepEqual(sessions[0], {
      sessionId: 'treino-freitas_2026-11-13_21',
      eventType: 'treino-freitas',
      eventLabel: 'TREINO FREITAS',
      date: '2026-11-13',
      hour: '21',
      teams: [{ teamName: 'FOLTEST PRO', points: 1258, wins: 1, kills: 12 }],
      updatedAt: null,
    });
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('shows five ranking sessions per page with date and hour filters', () => {
  assert.match(imageScoringSource, /const RANKING_HISTORY_PAGE_SIZE = 5;/);
  assert.match(imageScoringSource, /id="ffRankingHistoryDate" type="date"/);
  assert.match(imageScoringSource, /id="ffRankingHistoryHour"/);
  assert.match(imageScoringSource, /id="ffRankingHistoryClearDate"/);
  assert.match(imageScoringSource, /filteredSessions\.slice\(start,\s*start \+ RANKING_HISTORY_PAGE_SIZE\)/);
  assert.match(imageScoringSource, /state\.rankingHistoryDate = String\(e\.target\.value \|\| ''\)/);
  assert.match(imageScoringSource, /state\.rankingHistoryHour = String\(e\.target\.value \|\| ''\)/);
});

test('imports Challenge.place Markdown standings with position, name, and points', () => {
  const imported = parseGeneralRankingImport([
    '| Standings | P |',
    '| --- | --- |',
    '| 1 | ![XLT IPHINITY](team.svg) | XLT IPHINITY | 1258 |',
    '| 2 | ![OS AFUNDA](team.svg) | OS AFUNDA | 1152 |',
  ].join('\n'));

  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.rows.map(({ teamName, points }) => ({ teamName, points })), [
    { teamName: 'XLT IPHINITY', points: 1258 },
    { teamName: 'OS AFUNDA', points: 1152 },
  ]);
});

test('imports CSV with quoted team names and common header labels', () => {
  const imported = parseGeneralRankingImport([
    'Position,Competitor,Points',
    '1,"TEAM, FÊNIX",463',
    '2,"OS AFUNDA",1152',
  ].join('\n'));

  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.rows.map(({ teamName, points }) => ({ teamName, points })), [
    { teamName: 'TEAM, FÊNIX', points: 463 },
    { teamName: 'OS AFUNDA', points: 1152 },
  ]);
});

test('imports downloaded HTML table rows using the image alt or team text', () => {
  const imported = parseGeneralRankingImport(`
    <table>
      <tr><th>Position</th><th>Team</th><th>Points</th></tr>
      <tr><td>1</td><td><img alt="XLT IPHINITY" src="team.png"> XLT IPHINITY</td><td>1258</td></tr>
      <tr><td>2</td><td>OS AFUNDA</td><td>1152</td></tr>
    </table>
  `);

  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.rows.map(({ teamName, points }) => ({ teamName, points })), [
    { teamName: 'XLT IPHINITY', points: 1258 },
    { teamName: 'OS AFUNDA', points: 1152 },
  ]);
});

test('imports the Challenge.place standings table without its schedule and preserves numeric team names', () => {
  const imported = parseGeneralRankingImport(`
    <table>
      <tr><th colspan="4">Standings</th><th>P</th></tr>
      <tr><td></td><td>1</td><td><img alt="7 ÂNGULOS OFC"></td><td>7 ÂNGULOS OFC</td><td>690</td></tr>
      <tr><td></td><td>2</td><td><img alt="777"></td><td>777</td><td>24</td></tr>
      <tr><td></td><td>3</td><td><img alt="]"></td><td>]</td><td>0</td></tr>
    </table>
    <table>
      <tr><th></th><th>Competitor</th><th></th><th>P</th></tr>
      <tr><td>1</td><td>APOCALIPSE</td><td></td><td>39</td></tr>
    </table>
  `);

  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.rows.map(({ teamName, points }) => ({ teamName, points })), [
    { teamName: '7 ÂNGULOS OFC', points: 690 },
    { teamName: '777', points: 24 },
    { teamName: ']', points: 0 },
  ]);
  const teams = aggregateGeneralRankingImport(imported.rows);
  assert.equal(teams.length, 3);
  assert.equal(teams.find(team => team.teamName === ']').baselinePoints, 0);
});

test('merges duplicate imported names and adds their baseline points', () => {
  const imported = parseGeneralRankingImport([
    'Position,Team,Points',
    '1,XLT IPHINITY,1258',
    '7,xlt  iphinity,895',
    '2,OS AFUNDA,1152',
  ].join('\n'));

  const teams = aggregateGeneralRankingImport(imported.rows);
  const xlt = teams.find(team => team.key === 'xlt iphinity');
  assert.equal(xlt.teamName, 'XLT IPHINITY');
  assert.equal(xlt.baselinePoints, 2153);
  assert.equal(xlt.sourceRows, 2);
  assert.deepEqual(xlt.sourceNames, ['XLT IPHINITY', 'xlt iphinity']);
  assert.equal(teams.length, 2);
});

test('identifies only eligible ranking events by date and hour', () => {
  assert.equal(generalRankingSessionKey('treino-freitas', '2026-11-11', '19h'), 'treino-freitas_2026-11-11_19');
  assert.equal(generalRankingSessionKey('modo-liga', '2026-11-11', '14'), 'modo-liga_2026-11-11_14');
  assert.throws(() => generalRankingSessionKey('intensivo', '2026-11-11', '19'), /não participa/);
  assert.throws(() => generalRankingSessionKey('modo-liga', '', '14'), /data/);
  assert.throws(() => generalRankingSessionKey('modo-liga', '2026-11-11', ''), /horário/);
});

test('builds one team contribution from duplicate rows and assigns shared ranks on ties', () => {
  const teams = buildGeneralRankingSessionTeams([
    { teamName: 'XLT IPHINITY', points: 20, wins: 1, kills: 8, logoUrl: 'logo.svg', logoSource: 'purchase' },
    { teamName: 'xlt iphInity', points: 3, wins: 0, kills: 3 },
    { teamName: 'OS AFUNDA', points: 23, wins: 1, kills: 11 },
  ]);

  assert.deepEqual(teams.map(({ teamName, points, wins, kills, logoUrl, logoSource }) => ({
    teamName, points, wins, kills, logoUrl, logoSource,
  })), [
    { teamName: 'OS AFUNDA', points: 23, wins: 1, kills: 11, logoUrl: '', logoSource: '' },
    { teamName: 'XLT IPHINITY', points: 23, wins: 1, kills: 11, logoUrl: 'logo.svg', logoSource: 'purchase' },
  ]);
  assert.deepEqual(rankGeneralRankingRows(teams).map(row => row.rank), [1, 1]);
});

test('keeps same-named teams separate when their ranking IDs differ', () => {
  const teams = buildGeneralRankingSessionTeams([
    { teamName: 'RANGERS', rankingTeamId: 'team-a', points: 10, wins: 1, kills: 4 },
    { teamName: 'RANGERS', rankingTeamId: 'team-b', points: 7, wins: 0, kills: 7 },
    { teamName: 'Rangers', rankingTeamId: 'team-a', points: 3, wins: 0, kills: 3 },
  ]);

  assert.equal(teams.length, 2);
  assert.deepEqual(
    teams.map(team => [team.rankingTeamId, team.teamName, team.points]).sort(),
    [['team-a', 'RANGERS', 13], ['team-b', 'RANGERS', 7]],
  );
});

test('generates one account identity per account and normalized team name', () => {
  assert.equal(accountRankingTeamId('user-1', 'Rangers'), accountRankingTeamId('user-1', ' RÁNGERS '));
  assert.notEqual(accountRankingTeamId('user-1', 'Rangers'), accountRankingTeamId('user-2', 'Rangers'));
});

function createRankingFirestore(seed = {}) {
  const records = new Map(Object.entries(seed));
  const writes = [];
  const reference = (collectionName, id) => ({
    collection: collectionName,
    id,
    path: `${collectionName}/${id}`,
  });
  return {
    writes,
    firestore: {
      collection: (_db, collectionName) => ({ name: collectionName }),
      doc: (_db, collectionName, id) => reference(collectionName, id),
      runTransaction: async (_db, callback) => callback({
        get: async ref => ({
          exists: () => records.has(ref.path),
          data: () => records.get(ref.path) || {},
        }),
        set: (ref, data, options) => writes.push({ kind: 'set', ref, data, options }),
        update: (ref, data) => writes.push({ kind: 'update', ref, data }),
      }),
      serverTimestamp: () => 'server-time',
    },
  };
}

test('stores same-named teams under separate ranking IDs', async () => {
  const originalWindow = globalThis.window;
  const mock = createRankingFirestore({
    'freefire_general_ranking_meta/current': { initialImportStatus: 'complete' },
  });
  globalThis.window = { __freefireRankingFirestore: mock.firestore };
  try {
    await upsertGeneralRankingSession({}, {
      eventType: 'treino-freitas',
      date: '2026-11-15',
      hour: '21h',
      standings: [
        { teamName: 'RANGERS', rankingTeamId: 'team-a', points: 12, kills: 2 },
        { teamName: 'RANGERS', rankingTeamId: 'team-b', points: 8, kills: 1 },
      ],
    });
    const teamWrites = mock.writes.filter(write =>
      write.ref.collection === 'freefire_general_ranking' && write.ref.id !== 'current');
    assert.equal(teamWrites.length, 2);
    assert.equal(new Set(teamWrites.map(write => write.ref.id)).size, 2);
    assert.deepEqual(teamWrites.map(write => write.data.totalPoints).sort((a, b) => a - b), [8, 12]);
    assert.equal(mock.writes.filter(write => write.ref.collection === 'freefire_general_ranking_team_links').length, 2);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('replaces a claimed legacy session on the same ranking row without moving its baseline', async () => {
  const originalWindow = globalThis.window;
  const mock = createRankingFirestore({
    'freefire_general_ranking_meta/current': { initialImportStatus: 'complete' },
    'freefire_general_ranking_sessions/treino-freitas_2026-11-15_21': {
      teams: [{ key: 'rangers', teamName: 'RANGERS', points: 10, wins: 1, kills: 3 }],
    },
    'freefire_general_ranking/team_rangers': {
      teamKey: 'rangers', teamName: 'RANGERS', rankingTeamId: 'team-a',
      baselinePoints: 100, sessionPoints: 10, wins: 1, kills: 3, totalPoints: 110,
    },
    'freefire_general_ranking_team_links/team-a': {
      rankingTeamId: 'team-a', rankingDocumentId: 'team_rangers',
    },
  });
  globalThis.window = { __freefireRankingFirestore: mock.firestore };
  try {
    await upsertGeneralRankingSession({}, {
      eventType: 'treino-freitas',
      date: '2026-11-15',
      hour: '21h',
      standings: [{ teamName: 'RANGERS', rankingTeamId: 'team-a', points: 5, kills: 2 }],
    });
    const rowWrite = mock.writes.find(write =>
      write.ref.collection === 'freefire_general_ranking' && write.ref.id === 'team_rangers');
    assert.equal(rowWrite.data.baselinePoints, 100);
    assert.equal(rowWrite.data.sessionPoints, 5);
    assert.equal(rowWrite.data.totalPoints, 105);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('refuses to add name-only points to a legacy row already claimed by an ID', async () => {
  const originalWindow = globalThis.window;
  const mock = createRankingFirestore({
    'freefire_general_ranking_meta/current': { initialImportStatus: 'complete' },
    'freefire_general_ranking/team_rangers': {
      teamKey: 'rangers', teamName: 'RANGERS', rankingTeamId: 'claimed-team-id',
      baselinePoints: 100, sessionPoints: 0, totalPoints: 100,
    },
  });
  globalThis.window = { __freefireRankingFirestore: mock.firestore };
  try {
    await assert.rejects(
      upsertGeneralRankingSession({}, {
        eventType: 'treino-freitas',
        date: '2026-11-15',
        hour: '21h',
        standings: [{ teamName: 'RANGERS', points: 12, kills: 2 }],
      }),
      /já está vinculada a um ID/,
    );
    assert.equal(mock.writes.length, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('does not send a name-only logo update to a ranking row that already has an ID', async () => {
  const originalWindow = globalThis.window;
  const mock = createRankingFirestore({
    'freefire_general_ranking/team_rangers': {
      teamKey: 'rangers', teamName: 'RANGERS', rankingTeamId: 'claimed-team-id',
      logoUrl: 'https://storage.example/current.webp', totalPoints: 100,
    },
  });
  globalThis.window = { __freefireRankingFirestore: mock.firestore };
  try {
    const updated = await syncGeneralRankingLogoToTeam({}, {
      teamName: 'RANGERS',
      logoUrl: 'https://storage.example/new.webp',
      updatedAtMs: 123,
    });
    assert.equal(updated, false);
    assert.equal(mock.writes.length, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('chooses the newest purchase or SPEC logo regardless of source priority', () => {
  const purchase = { logoUrl: 'purchase.webp', source: 'purchase', updatedAtMs: 200 };
  const spec = { logoUrl: 'spec.webp', source: 'association', updatedAtMs: 300 };

  assert.deepEqual(chooseLatestGeneralRankingLogo([purchase, spec]), spec);
  assert.deepEqual(
    chooseLatestGeneralRankingLogo([purchase, spec], {
      logoUrl: 'older.webp',
      logoSource: 'purchase',
      logoUpdatedAt: 100,
    }),
    spec,
  );
});

test('keeps a newer logo already saved on the public ranking row', () => {
  assert.equal(
    chooseLatestGeneralRankingLogo(
      [{ logoUrl: 'old-purchase.webp', source: 'purchase', updatedAtMs: 100 }],
      { logoUrl: 'new-spec.webp', logoSource: 'association', logoUpdatedAt: 200 },
    ),
    null,
  );
});

test('a saved team logo updates only an existing ranking row and preserves points', async () => {
  const originalWindow = globalThis.window;
  const writes = [];
  globalThis.window = {
    __freefireRankingFirestore: {
      collection: (_db, name) => ({ name }),
      doc: (_db, collection, id) => ({ collection, id }),
      runTransaction: async (_db, callback) => callback({
        get: async reference => ({
          exists: () => reference.collection === 'freefire_general_ranking',
          data: () => ({
            teamName: 'FOLTEST PRO',
            logoUrl: 'https://storage.example/old.webp',
            logoUpdatedAt: 100,
            totalPoints: 1258,
          }),
        }),
        update: (reference, patch) => writes.push({ reference, patch }),
      }),
      serverTimestamp: () => 'server timestamp',
    },
  };

  try {
    const updated = await syncGeneralRankingLogoToTeam({}, {
      teamName: 'FOLTEST PRO',
      logoUrl: 'https://storage.example/new.webp',
      source: 'custom',
      updatedAtMs: 200,
    });
    assert.equal(updated, true);
    assert.equal(writes[0].reference.collection, 'freefire_general_ranking');
    assert.equal(writes[0].reference.id, 'team_foltest_pro');
    assert.equal(writes[0].patch.logoUrl, 'https://storage.example/new.webp');
    assert.equal(writes[0].patch.totalPoints, undefined);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('a saved logo does not create a ranking row for an unranked team', async () => {
  const originalWindow = globalThis.window;
  const writes = [];
  globalThis.window = {
    __freefireRankingFirestore: {
      collection: (_db, name) => ({ name }),
      doc: (_db, collection, id) => ({ collection, id }),
      runTransaction: async (_db, callback) => callback({
        get: async () => ({ exists: () => false, data: () => ({}) }),
        update: (reference, patch) => writes.push({ reference, patch }),
      }),
      serverTimestamp: () => 'server timestamp',
    },
  };

  try {
    const updated = await syncGeneralRankingLogoToTeam({}, {
      teamName: 'EQUIPE NOVA',
      logoUrl: 'https://storage.example/new-team.webp',
      source: 'association',
      updatedAtMs: 200,
    });
    assert.equal(updated, false);
    assert.deepEqual(writes, []);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
