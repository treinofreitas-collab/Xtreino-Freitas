import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateGeneralRankingImport,
  buildGeneralRankingSessionTeams,
  generalRankingSessionKey,
  parseGeneralRankingImport,
  rankGeneralRankingRows,
} from '../../artifacts/xtreino/public/js/freefire-general-ranking.mjs';
import {
  chooseLatestGeneralRankingLogo,
  syncGeneralRankingLogoToTeam,
} from '../../artifacts/xtreino/public/js/freefire-general-ranking-store.mjs';

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
