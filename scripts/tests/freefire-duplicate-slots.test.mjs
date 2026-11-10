import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { sumReadablePlayerKills } from '../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs';

const sources = [
  {
    name: 'Netlify',
    path: new URL('../../netlify/functions/freefire-analyze.js', import.meta.url),
    typescript: false,
  },
  {
    name: 'API server',
    path: new URL('../../artifacts/api-server/src/routes/freefire-scoring.ts', import.meta.url),
    typescript: true,
  },
];

async function loadHelpers(source, typescript) {
  const start = source.indexOf('function normalizePlayerName(');
  const endCandidates = [
    source.indexOf('\nfunction getAiClient(', start),
    source.indexOf('\nrouter.post(', start),
    source.indexOf('\nexports.handler =', start),
  ].filter(index => index >= 0);
  const end = Math.min(...endCandidates);
  assert.ok(start >= 0 && end > start, 'independent-reading helpers should exist');

  let code = `${source.slice(start, end)}
globalThis.testHelpers = {
  normalizePreviousDropReferences,
  duplicateSlotGroups,
  clearDuplicateSlots,
  duplicatePlayerGroups,
  resolveDuplicatePlayersUsingLobby,
  clearDuplicatePlayers,
  addDuplicatePlayersToUnmatched,
  reconcilePlacements,
  getThirdReviewPositions,
};`;
  if (typescript) {
    code = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  }

  const context = {
    formatKillCount: value => Number.isInteger(value) ? String(value) : 'ilegível',
  };
  vm.runInNewContext(code, context);
  return context.testHelpers;
}

const loaded = await Promise.all(sources.map(async source => ({
  ...source,
  text: await readFile(source.path, 'utf8'),
})));

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeResult(overrides = {}) {
  return {
    placements: Array.from({ length: 12 }, (_, index) => {
      const slot = index + 1;
      const override = overrides[slot] || {};
      return {
        position: slot,
        slot,
        teamName: `Equipe ${slot}`,
        kills: slot,
        players: [{ name: `Jogador ${slot}`, kills: override.kills ?? slot, lobbySlot: slot }],
        confidence: 'high',
        reviewFields: [],
        readAgreement: '',
        notes: '',
        ...override,
        players: override.players || [{ name: `Jogador ${slot}`, kills: override.kills ?? slot, lobbySlot: slot }],
      };
    }),
    unmatchedPlayers: [],
  };
}

for (const source of loaded) {
  test(`${source.name}: only confirmed earlier player-slot associations are reused`, async () => {
    const { normalizePreviousDropReferences } = await loadHelpers(source.text, source.typescript);
    const officialTeams = Array.from({ length: 12 }, (_, index) => ({
      slot: index + 1,
      teamName: `Equipe ${index + 1}`,
    }));
    const references = plain(normalizePreviousDropReferences([
      {
        dropNumber: 1,
        confirmed: true,
        placements: [
          { slot: 2, players: [{ name: 'Reserva_A' }] },
          { slot: 3, players: [{ name: 'Nick Divergente' }] },
        ],
      },
      {
        dropNumber: 2,
        confirmed: true,
        placements: [
          { slot: 2, players: [{ name: 'reserva a' }] },
          { slot: 5, players: [{ name: 'Nick Divergente' }] },
        ],
      },
      {
        dropNumber: 3,
        confirmed: true,
        placements: [{ slot: 8, players: [{ name: 'Queda atual' }] }],
      },
      {
        dropNumber: 2,
        confirmed: false,
        placements: [{ slot: 9, players: [{ name: 'Não revisado' }] }],
      },
    ], 3, officialTeams));

    assert.deepEqual(references, {
      consistent: [{
        playerName: 'Reserva_A',
        slot: 2,
        teamName: 'Equipe 2',
        dropNumbers: [1, 2],
      }],
      ambiguous: [{
        playerName: 'Nick Divergente',
        slots: [3, 5],
        teamNames: ['Equipe 3', 'Equipe 5'],
        dropNumbers: [1, 2],
      }],
    });
  });

  test(`${source.name}: two independent identical reads reach agreement`, async () => {
    const { reconcilePlacements } = await loadHelpers(source.text, source.typescript);
    const first = makeResult();
    const second = makeResult();
    const reconciled = plain(reconcilePlacements(first, second));

    assert.equal(reconciled.placements.length, 12);
    assert.equal(reconciled.placements[0].slot, 1);
    assert.equal(reconciled.placements[0].kills, 1);
    assert.equal(reconciled.placements[0].readAgreement, '2 leituras concordam');
    assert.deepEqual(reconciled.placements[0].reviewFields, []);
  });

  test(`${source.name}: a third read resolves a two-of-three disagreement but keeps manual review`, async () => {
    const { reconcilePlacements, getThirdReviewPositions } = await loadHelpers(source.text, source.typescript);
    const first = makeResult({ 3: { kills: 4 } });
    const second = makeResult({ 3: { kills: 5 } });
    const preliminary = reconcilePlacements(first, second);
    const targets = getThirdReviewPositions(first, second, preliminary);
    assert.deepEqual(plain(targets), [3]);

    const third = makeResult({ 3: { kills: 5 } });
    const reconciled = plain(reconcilePlacements(first, second, third, new Set(targets)));
    assert.equal(reconciled.placements[2].kills, 5);
    assert.ok(reconciled.placements[2].reviewFields.includes('kills'));
    assert.equal(reconciled.placements[2].readAgreement, '2 de 3 concordam — revisar');
  });

  test(`${source.name}: identifies which player's kill count differs between reads`, async () => {
    const { reconcilePlacements } = await loadHelpers(source.text, source.typescript);
    const players = finalKill => [
      { name: "mary d' mel", kills: 1 },
      { name: 'honiime', kills: 2 },
      { name: 'GO LORD', kills: 2 },
      { name: 'GO KILLUA X', kills: finalKill },
    ];
    const first = makeResult({ 3: { kills: 7, players: players(2) } });
    const second = makeResult({ 3: { kills: 6, players: players(1) } });
    const third = makeResult({ 3: { kills: 6, players: players(1) } });
    const reconciled = plain(reconcilePlacements(first, second, third, new Set([3])));
    const placement = reconciled.placements[2];

    assert.equal(placement.kills, 7);
    assert.equal(placement.players.reduce((total, player) => total + player.kills, 0), 7);
    assert.match(placement.notes, /GO KILLUA X \(1ª: 2 · 2ª: 1 · 3ª: 1\)/);
    assert.ok(placement.reviewFields.includes('kills'));
  });

  test(`${source.name}: reconciled kills keep only the selected read's sum note`, async () => {
    const { reconcilePlacements } = await loadHelpers(source.text, source.typescript);
    const first = makeResult({
      3: { kills: 7, notes: 'Soma individual (7) usada; total do placar (6) ignorado.' },
    });
    const second = makeResult({
      3: { kills: 6, notes: 'Soma individual (6) usada; total do placar (5) ignorado.' },
    });
    const third = makeResult({
      3: { kills: 6, notes: 'Soma individual (6) usada; total do placar (6) ignorado.' },
    });
    const reconciled = plain(reconcilePlacements(first, second, third, new Set([3])));
    const placement = reconciled.placements[2];

    assert.equal(placement.kills, 7);
    assert.equal(placement.players[0].kills, 7);
    assert.doesNotMatch(placement.notes, /Soma individual \(6\) usada; total do placar \(5\) ignorado/);
    assert.match(placement.notes, /Soma individual \(7\) usada; total do placar \(6\) ignorado/);
    assert.match(placement.notes, /Abates divergentes \(1ª: 7 · 2ª: 6 · 3ª: 6\)/);
  });

  test(`${source.name}: no majority keeps the highest individual sum provisional for review`, async () => {
    const { reconcilePlacements } = await loadHelpers(source.text, source.typescript);
    const first = makeResult({ 3: { kills: 4 } });
    const second = makeResult({ 3: { kills: 5 } });
    const third = makeResult({ 3: { kills: 6 } });
    const reconciled = plain(reconcilePlacements(first, second, third, new Set([3])));

    assert.equal(reconciled.placements[2].kills, 6);
    assert.equal(reconciled.placements[2].players[0].kills, 6);
    assert.ok(reconciled.placements[2].reviewFields.includes('kills'));
    assert.equal(reconciled.placements[2].readAgreement, 'Revisão manual');
  });

  test(`${source.name}: duplicate slot assignments are cleared instead of guessed`, async () => {
    const { duplicateSlotGroups, clearDuplicateSlots } = await loadHelpers(source.text, source.typescript);
    const placements = [
      { ...makeResult().placements[4], slot: 6, teamName: 'Equipe 6' },
      { ...makeResult().placements[7], slot: 6, teamName: 'Equipe 6' },
    ];
    const groups = duplicateSlotGroups(placements);
    const unresolved = plain(clearDuplicateSlots(placements, groups));

    assert.deepEqual(unresolved.map(placement => placement.slot), [null, null]);
    assert.deepEqual(plain(duplicateSlotGroups(unresolved)), []);
    assert.ok(unresolved.every(placement => placement.confidence === 'low'));
    assert.ok(unresolved.every(placement => placement.reviewFields.includes('slot')));
    assert.ok(unresolved.every(placement => /associe manualmente/.test(placement.notes)));
  });

  test(`${source.name}: ambiguous duplicate names are removed but readable row kills are retained`, async () => {
    const {
      duplicatePlayerGroups,
      resolveDuplicatePlayersUsingLobby,
      clearDuplicatePlayers,
      addDuplicatePlayersToUnmatched,
      reconcilePlacements,
      getThirdReviewPositions,
    } = await loadHelpers(source.text, source.typescript);
    const repeatedPlayer = { name: 'Nick Repetido', kills: 2, lobbySlot: null };
    const rowPlayers = [
      repeatedPlayer,
      { name: 'Jogador A', kills: 3, lobbySlot: 2 },
      { name: 'Jogador B', kills: 4, lobbySlot: 2 },
    ];
    const first = makeResult({
      2: { kills: 9, players: rowPlayers },
      7: { kills: 2, players: [{ ...repeatedPlayer, name: 'nick-repetido' }] },
    });
    const second = makeResult({
      2: { kills: 9, players: rowPlayers },
      7: { kills: 2, players: [{ ...repeatedPlayer, name: 'nick-repetido' }] },
    });

    const preliminary = reconcilePlacements(first, second);
    const groups = duplicatePlayerGroups(preliminary.placements);
    assert.equal(groups.length, 1);
    assert.deepEqual(plain(groups[0].positions), [2, 7]);
    assert.deepEqual(
      plain(getThirdReviewPositions(first, second, preliminary)),
      [2, 7],
    );

    const resolution = resolveDuplicatePlayersUsingLobby(preliminary.placements, groups);
    assert.equal(resolution.unresolvedGroups.length, 1);
    const cleaned = plain(clearDuplicatePlayers(preliminary.placements, resolution.unresolvedGroups));
    assert.deepEqual(cleaned[1].players.map(player => player.name), ['', 'Jogador A', 'Jogador B']);
    assert.deepEqual(cleaned[1].players.map(player => player.kills), [2, 3, 4]);
    assert.equal(cleaned[1].kills, 9);
    assert.equal(sumReadablePlayerKills(cleaned[1].players), 9);
    assert.equal(cleaned[1].players[0].lobbySlot, null);
    assert.equal(cleaned[1].players[0].lobbyRosterMatched, false);
    assert.equal(cleaned[6].players[0].name, '');
    assert.equal(cleaned[6].kills, 2);
    assert.equal(sumReadablePlayerKills(cleaned[6].players), 2);
    assert.ok(cleaned[1].reviewFields.includes('players'));
    assert.ok(cleaned[6].reviewFields.includes('players'));
    assert.ok(cleaned[1].notes.includes('Nick Repetido'));
    assert.match(cleaned[1].notes, /soma da linha: 9/);
    assert.deepEqual(
      plain(addDuplicatePlayersToUnmatched(preliminary.unmatchedPlayers, groups)),
      ['Nick Repetido'],
    );
  });

  test(`${source.name}: a unique lobby roster match keeps a duplicate player with the correct team`, async () => {
    const { duplicatePlayerGroups, resolveDuplicatePlayersUsingLobby } =
      await loadHelpers(source.text, source.typescript);
    const placements = [
      {
        ...makeResult().placements[0],
        position: 1,
        slot: 8,
        teamName: 'Equipe 8',
        players: [
          { name: 'Nick Compartilhado', kills: 2, lobbySlot: 3, lobbyRosterMatched: true },
          { name: 'Companheiro A', kills: 1, lobbySlot: 3, lobbyRosterMatched: true },
        ],
      },
      {
        ...makeResult().placements[1],
        position: 2,
        slot: 3,
        teamName: 'Equipe 3',
        players: [
          { name: 'nick-compartilhado', kills: 2, lobbySlot: 3, lobbyRosterMatched: true },
          { name: 'Reserva B', kills: 1, lobbySlot: null, lobbyRosterMatched: false },
        ],
      },
    ];
    const officialTeams = [
      { slot: 3, teamName: 'Equipe 3' },
      { slot: 8, teamName: 'Equipe 8' },
    ];
    const groups = duplicatePlayerGroups(placements);
    const result = plain(resolveDuplicatePlayersUsingLobby(placements, groups, officialTeams));

    assert.deepEqual(result.unresolvedGroups, []);
    assert.deepEqual(result.placements[0].players.map(player => player.name), ['Nick Compartilhado', 'Companheiro A']);
    assert.deepEqual(result.placements[1].players.map(player => player.name), ['Reserva B']);
    assert.equal(result.placements[0].slot, 3);
    assert.equal(result.placements[0].teamName, 'Equipe 3');
    assert.equal(result.placements[0].kills, 3);
    assert.equal(result.placements[1].kills, 1);
    assert.match(result.placements[0].notes, /lista do lobby/);
  });

  test(`${source.name}: an official team name distinguishes its row from an unidentified duplicate`, async () => {
    const { duplicatePlayerGroups, resolveDuplicatePlayersUsingLobby } =
      await loadHelpers(source.text, source.typescript);
    const placements = [
      {
        ...makeResult().placements[0],
        position: 1,
        slot: 12,
        teamName: 'TEMPEST',
        players: [{ name: 'OG ZIKA', kills: 2, lobbySlot: 12, lobbyRosterMatched: true }],
      },
      {
        ...makeResult().placements[11],
        position: 12,
        slot: null,
        teamName: 'Não identificada',
        players: [{ name: 'OG ZIKA', kills: 2, lobbySlot: null, lobbyRosterMatched: false }],
      },
    ];
    const groups = duplicatePlayerGroups(placements);
    const result = plain(resolveDuplicatePlayersUsingLobby(
      placements,
      groups,
      [{ slot: 12, teamName: 'TEMPEST' }],
    ));

    assert.deepEqual(result.unresolvedGroups, []);
    assert.deepEqual(result.placements[0].players.map(player => player.name), ['OG ZIKA']);
    assert.deepEqual(result.placements[1].players, []);
    assert.equal(result.placements[0].slot, 12);
    assert.equal(result.placements[0].teamName, 'TEMPEST');
  });

  test(`${source.name}: AI instructions forbid assigning a nickname to multiple teams`, () => {
    assert.match(source.text, /cada nick, normalizado sem diferença de maiúsculas, acentos ou símbolos decorativos, pode ser associado a somente uma equipe\/slot nesta queda/);
    assert.match(source.text, /Extraia primeiro lobbyRoster das fotos do lobby/);
    assert.match(source.text, /mantenha-o somente na colocação cujo slot corresponde ao lobby/);
    assert.match(source.text, /liste-o em unmatchedPlayers/);
  });

  test(`${source.name}: current-drop reads stay independent and the third targets conflicts`, () => {
    assert.doesNotMatch(source.text, /JSON\.stringify\(firstResult\)/);
    assert.match(source.text, /const thirdTargetPositions = getThirdReviewPositions/);
    assert.match(source.text, /generateJsonWithRetry\(thirdPrompt, images\)/);
    assert.match(source.text, /Comece do zero para a queda atual: não receba nem use respostas das leituras anteriores desta queda/);
    assert.match(source.text, /Não use os resultados de leituras anteriores desta queda/);
    assert.match(source.text, /Faça uma terceira leitura independente/);
  });
}
