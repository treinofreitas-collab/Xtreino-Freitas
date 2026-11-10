import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

import {
  buildConfirmedPreviousDropReferences,
  calculateStandings,
  getImageDropValidationIssue,
  getOfficialRosterFingerprint,
  normalizeAnalyzedPlacement,
  normalizeExtractedKillCount,
  sumReadablePlayerKills,
} from '../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs';

const netlifySource = await readFile(
  new URL('../../netlify/functions/freefire-analyze.js', import.meta.url),
  'utf8',
);
const apiSource = await readFile(
  new URL('../../artifacts/api-server/src/routes/freefire-scoring.ts', import.meta.url),
  'utf8',
);
const scoringSource = await readFile(
  new URL('../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs', import.meta.url),
  'utf8',
);

function loadNetlifyNormalizer() {
  const start = netlifySource.indexOf('function normalizeKillCount(');
  const end = netlifySource.indexOf('\nfunction normalizePreviousDropReferences(', start);
  assert.ok(start >= 0 && end > start, 'normalization helpers should exist');

  const context = {
    ApiError: class ApiError extends Error {},
    isRecord: value => typeof value === 'object' && value !== null && !Array.isArray(value),
  };
  vm.runInNewContext(
    `${netlifySource.slice(start, end)}\nglobalThis.normalizePlacements = normalizePlacements;`,
    context,
  );
  return context.normalizePlacements;
}

function loadApiServerNormalizer() {
  const start = apiSource.indexOf('function normalizeKillCount(');
  const end = apiSource.indexOf('\nfunction normalizePreviousDropReferences(', start);
  assert.ok(start >= 0 && end > start, 'API server normalization helpers should exist');

  const compiled = ts.transpileModule(
    `${apiSource.slice(start, end)}\nglobalThis.normalizePlacements = normalizePlacements;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const context = {
    ApiError: class ApiError extends Error {},
    isRecord: value => typeof value === 'object' && value !== null && !Array.isArray(value),
  };
  vm.runInNewContext(compiled, context);
  return context.normalizePlacements;
}

function asPlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}

const teams = Array.from({ length: 12 }, (_, index) => ({
  slot: index + 1,
  teamName: `Equipe ${index + 1}`,
}));
const rosterFingerprint = getOfficialRosterFingerprint(teams);
function lobbyRosterFor(slot, names) {
  return [{ slot, players: names.map(name => ({ name })) }];
}

function completeDrop(overrides = {}) {
  const placements = overrides.placements || Array.from({ length: 12 }, (_, index) => ({
    position: index + 1,
    slot: index + 1,
    kills: 0,
  }));
  return {
    analyzed: true,
    reviewed: true,
    rosterFingerprint,
    ...overrides,
    placements: placements.map(placement => ({
      ...placement,
      players: Array.isArray(placement.players) ? placement.players : [{
        name: `Jogador ${placement.slot ?? placement.position}`,
        kills: placement.kills,
        lobbySlot: placement.slot ?? null,
      }],
    })),
  };
}

for (const [service, loadNormalizer] of [
  ['Netlify', loadNetlifyNormalizer],
  ['API server', loadApiServerNormalizer],
]) {
  test(`${service} uses the sum of individual kills instead of the printed team total`, () => {
    const normalizePlacements = loadNormalizer();
    const result = asPlainObject(normalizePlacements({
      lobbyRoster: lobbyRosterFor(1, ['Jogador A', 'Jogador B', 'Jogador C']),
      placements: [{
        position: 1,
        slot: 1,
        kills: 4,
        players: [
          { name: 'Jogador A', kills: 2, lobbySlot: 1 },
          { name: 'Jogador B', kills: 1, lobbySlot: 1 },
          { name: 'Jogador C', kills: 0, lobbySlot: 1 },
        ],
        confidence: 'high',
      }],
    }, teams));
    const placement = result.placements[0];

    assert.equal(placement.kills, 3);
    assert.deepEqual(placement.players.map(player => player.kills), [2, 1, 0]);
    assert.equal(placement.confidence, 'high');
    assert.match(placement.notes, /Soma individual \(3\) usada; total do placar \(4\) ignorado/);
    const drop = completeDrop({ placements: [placement] });
    assert.equal(calculateStandings(teams, [drop], 1)[0].kills, 3);
    const mismatchedDrop = completeDrop({
      placements: [{ ...placement, kills: 4 }],
    });
    assert.equal(getImageDropValidationIssue(mismatchedDrop, teams), '');
    assert.equal(
      calculateStandings(teams, [mismatchedDrop], 1).find(team => team.slot === 1).kills,
      3,
    );
  });

  test(`${service} sums only readable individual kills without treating unreadable as zero`, () => {
    const normalizePlacements = loadNormalizer();
    const result = asPlainObject(normalizePlacements({
      lobbyRoster: lobbyRosterFor(1, ['Jogador A', 'Jogador B', 'Jogador C']),
      placements: [{
        position: 1,
        slot: 1,
        kills: 19,
        players: [
          { name: 'Jogador A', kills: 5, lobbySlot: 1 },
          { name: 'Jogador B', kills: null, lobbySlot: 1 },
          { name: 'Jogador C', kills: 2, lobbySlot: 1 },
        ],
        confidence: 'high',
      }],
    }, teams));
    const placement = result.placements[0];

    assert.equal(placement.kills, 7);
    assert.equal(placement.confidence, 'high');
    assert.ok(!placement.reviewFields.includes('kills'));
    assert.match(placement.notes, /Soma legível \(7\) usada; 1 abate\(s\) ilegível\(eis\) ignorado\(s\)/);
    assert.match(placement.notes, /total do placar \(19\) ignorado/);
    assert.equal(sumReadablePlayerKills(placement.players), 7);
  });

  test(`${service} keeps readable kills for players with unreadable nicknames`, () => {
    const normalizePlacements = loadNormalizer();
    const result = asPlainObject(normalizePlacements({
      lobbyRoster: lobbyRosterFor(1, ['Jogador A']),
      placements: [{
        position: 1,
        slot: 1,
        kills: null,
        players: [
          { name: '', kills: 5 },
          { name: 'Jogador A', kills: 4, lobbySlot: 1 },
        ],
        confidence: 'high',
      }],
    }, teams));
    const placement = result.placements[0];

    assert.deepEqual(
      placement.players.map(player => [player.name, player.kills]),
      [['', 5], ['Jogador A', 4]],
    );
    assert.equal(placement.kills, 9);
    assert.ok(placement.reviewFields.includes('players'));
    assert.match(placement.notes, /sem nick legível/);
  });
}

test('keeps missing team and player kills unreadable instead of coercing them to zero', () => {
  const normalizePlacements = loadNetlifyNormalizer();
  const result = asPlainObject(normalizePlacements({
    lobbyRoster: lobbyRosterFor(1, ['Jogador A', 'Jogador B']),
    placements: [{
      position: 1,
      slot: 1,
      kills: 19,
      players: [
        { name: 'Jogador A', kills: null, lobbySlot: 1 },
        { name: 'Jogador B', kills: '', lobbySlot: 1 },
      ],
      confidence: 'high',
    }],
  }, teams));

  assert.equal(result.placements[0].kills, null);
  assert.deepEqual(result.placements[0].players.map(player => player.kills), [null, null]);
  assert.equal(result.placements[0].confidence, 'low');
  assert.match(result.placements[0].notes, /Nenhum abate individual legível; soma não calculada/);
  assert.match(result.placements[0].notes, /Total do placar \(19\) ignorado/);
  assert.match(result.placements[0].notes, /2 abate\(s\) individual\(is\) ilegível\(eis\)/);
  assert.doesNotMatch(result.placements[0].notes, /soma individual \(0\)/);
});

test('the Replit API server also preserves unreadable counts as null', () => {
  const normalizePlacements = loadApiServerNormalizer();
  const result = asPlainObject(normalizePlacements({
    lobbyRoster: lobbyRosterFor(1, ['Jogador A']),
    placements: [{
      position: 1,
      slot: 1,
      kills: 19,
      players: [{ name: 'Jogador A', kills: '', lobbySlot: 1 }],
      confidence: 'high',
    }],
  }, teams));

  assert.equal(result.placements[0].kills, null);
  assert.equal(result.placements[0].players[0].kills, null);
  assert.equal(result.placements[0].confidence, 'low');
  assert.match(result.placements[0].notes, /Nenhum abate individual legível; soma não calculada/);
  assert.match(result.placements[0].notes, /Total do placar \(19\) ignorado/);
  assert.match(result.placements[0].notes, /1 abate\(s\) individual\(is\) ilegível\(eis\)/);
});

for (const [service, loadNormalizer] of [
  ['Netlify', loadNetlifyNormalizer],
  ['API server', loadApiServerNormalizer],
]) {
  test(`${service} trusts a consistent lobby slot over the scoreboard grouping`, () => {
    const normalizePlacements = loadNormalizer();
    const result = asPlainObject(normalizePlacements({
      lobbyRoster: lobbyRosterFor(12, ['Jogador A', 'Jogador B']),
      placements: [{
        position: 3,
        slot: 3,
        kills: 13,
        players: [
          { name: 'Jogador A', kills: 7, lobbySlot: 12 },
          { name: 'Jogador B', kills: 6, lobbySlot: 12 },
        ],
        confidence: 'high',
        notes: 'Divergência entre o slot do lobby e o agrupamento do placar. Os jogadores indicam o slot 12; confira a equipe atribuída.',
      }],
    }, teams));
    const placement = result.placements[0];

    assert.equal(placement.slot, 12);
    assert.equal(placement.teamName, 'Equipe 12');
    assert.equal(placement.confidence, 'high');
    assert.ok(!placement.reviewFields.includes('slot'));
    assert.match(placement.notes, /Slot 12 associado pela lista de jogadores do lobby/);
    assert.doesNotMatch(placement.notes, /Divergência entre o slot do lobby|Os jogadores indicam o slot/);
  });

  test(`${service} keeps mixed player lobby slots under manual review`, () => {
    const normalizePlacements = loadNormalizer();
    const result = asPlainObject(normalizePlacements({
      lobbyRoster: [
        ...lobbyRosterFor(12, ['Jogador A', 'Jogador B']),
        ...lobbyRosterFor(3, ['Jogador C']),
      ],
      placements: [{
        position: 3,
        slot: 3,
        kills: 13,
        players: [
          { name: 'Jogador A', kills: 5, lobbySlot: 12 },
          { name: 'Jogador B', kills: 5, lobbySlot: 12 },
          { name: 'Jogador C', kills: 3, lobbySlot: 3 },
        ],
        confidence: 'high',
      }],
    }, teams));
    const placement = result.placements[0];

    assert.equal(placement.slot, 12);
    assert.ok(placement.reviewFields.includes('slot'));
    assert.equal(placement.confidence, 'low');
    assert.match(placement.notes, /mais de um slot/);
  });

  test(`${service} keeps kill uncertainty separate from a resolved lobby slot`, () => {
    const normalizePlacements = loadNormalizer();
    const result = asPlainObject(normalizePlacements({
      lobbyRoster: lobbyRosterFor(12, ['Jogador A', 'Jogador B']),
      placements: [{
        position: 3,
        slot: 3,
        kills: null,
        players: [
          { name: 'Jogador A', kills: 7, lobbySlot: 12 },
          { name: 'Jogador B', kills: 6, lobbySlot: 12 },
        ],
        confidence: 'high',
      }],
    }, teams));
    const placement = result.placements[0];

    assert.equal(placement.slot, 12);
    assert.ok(!placement.reviewFields.includes('slot'));
    assert.ok(!placement.reviewFields.includes('kills'));
    assert.equal(placement.kills, 13);
  });
}

test('the preview preserves explicit zero and leaves unknown counts blank', () => {
  assert.equal(normalizeExtractedKillCount(0), 0);
  assert.equal(normalizeExtractedKillCount('0'), 0);
  assert.equal(normalizeExtractedKillCount(null), null);
  assert.equal(normalizeExtractedKillCount(''), null);
  assert.equal(normalizeExtractedKillCount('ilegível'), null);

  const standings = calculateStandings(teams, [completeDrop({
    placements: [
      { position: 1, slot: 1, kills: null },
      ...Array.from({ length: 11 }, (_, index) => ({
        position: index + 2,
        slot: index + 2,
        kills: 0,
      })),
    ],
  })], 1);
  assert.equal(standings[0].wins, 0);
  assert.equal(standings[0].kills, 0);
  assert.equal(standings[0].points, 0);
  assert.match(scoringSource, /individualKills === null/);
  assert.doesNotMatch(scoringSource, /p\.kills !== kills/);
  assert.equal(sumReadablePlayerKills([{ kills: 0 }, { kills: null }]), 0);
  assert.equal(sumReadablePlayerKills([{ kills: null }, { kills: '' }]), null);
  assert.match(scoringSource, /Nenhum abate individual legível/);
});

test('anonymous duplicate-player entries stay visible and contribute to the row sum', () => {
  const players = [{ name: '', kills: 5 }, { name: '', kills: 4 }];
  assert.equal(sumReadablePlayerKills(players), 9);
  assert.match(scoringSource, /Jogador sem associação/);
});

test('a missing or stale aggregate does not block confirmation when individual kills are readable', () => {
  const placement = normalizeAnalyzedPlacement({
    position: 1,
    slot: 1,
    kills: null,
    players: [{ name: '', kills: '5' }, { name: 'Jogador B', kills: 4 }],
  }, teams);
  const drop = completeDrop({ placements: [placement] });

  assert.equal(placement.kills, 9);
  assert.equal(getImageDropValidationIssue(drop, teams), '');
  assert.equal(calculateStandings(teams, [drop], 1).find(team => team.slot === 1).kills, 9);
});

test('reviewed partial drops contribute and leave absent or unidentified teams at zero', () => {
  const validDrop = completeDrop({
    placements: Array.from({ length: 12 }, (_, index) => ({
      position: index + 1,
      slot: index + 1,
      kills: index === 0 ? 2 : 0,
    })),
  });
  const validStandings = calculateStandings(teams, [validDrop], 1, { rosterConfirmed: true });
  assert.equal(validStandings.find(team => team.slot === 1).points, 14);

  const absentTeamDrop = completeDrop({
    placements: validDrop.placements.slice(0, 11),
  });
  assert.equal(getImageDropValidationIssue(absentTeamDrop, teams), '');
  const absentTeamStandings = calculateStandings(teams, [absentTeamDrop], 1, { rosterConfirmed: true });
  assert.equal(absentTeamStandings.find(team => team.slot === 1).points, 14);
  assert.equal(absentTeamStandings.find(team => team.slot === 12).points, 0);

  const unidentifiedTeamDrop = completeDrop({
    placements: [
      ...validDrop.placements.slice(0, 11),
      { position: 12, slot: null, kills: 7 },
    ],
  });
  assert.equal(getImageDropValidationIssue(unidentifiedTeamDrop, teams), '');
  const unidentifiedStandings = calculateStandings(teams, [unidentifiedTeamDrop], 1, { rosterConfirmed: true });
  assert.equal(unidentifiedStandings.find(team => team.slot === 12).points, 0);

  for (const invalidDrop of [
    { ...validDrop, reviewed: false },
    { ...validDrop, placements: [{ position: 1, slot: 1, kills: null }] },
    { ...validDrop, rosterFingerprint: 'stale-map' },
  ]) {
    const standings = calculateStandings(teams, [invalidDrop], 1, { rosterConfirmed: true });
    assert.equal(standings.find(team => team.slot === 1).points, 0);
  }
  assert.match(getImageDropValidationIssue(
    completeDrop({ placements: [{ position: 1, slot: null, kills: 2 }] }),
    teams,
  ), /Identifique pelo menos uma equipe/);
  assert.equal(
    calculateStandings(teams, [validDrop], 1, { rosterConfirmed: false }).find(team => team.slot === 1).points,
    0,
  );
  const duplicateNames = teams.map(team => ({ ...team }));
  duplicateNames[1].teamName = duplicateNames[0].teamName;
  assert.match(getImageDropValidationIssue(validDrop, duplicateNames), /nomes de equipe repetidos/);
});

test('both image-analysis backends tell Gemini not to invent absent teams', () => {
  for (const source of [netlifySource, apiSource]) {
    assert.match(source, /A queda pode ter menos de 12 equipes participantes/);
    assert.match(source, /Equipes ausentes ou sem slot identificado ficam zeradas na tabela/);
    assert.match(source, /retorne slot:null/);
    assert.match(source, /referências históricas abaixo vêm somente de quedas anteriores confirmadas/);
    assert.match(source, /mantenha confidence no máximo como medium/);
    assert.match(source, /Inclua jogadores visíveis mesmo se o nick estiver ilegível/);
    assert.match(source, /Nunca copie posições ou abates antigos/);
    assert.match(source, /uma evidência única sem conflito pode determinar o slot/);
    assert.match(source, /mesmo que o agrupamento\/etiqueta do placar sugira outro/);
  }
});

test('only earlier reviewed drops with the same roster contribute player-to-slot references', () => {
  const confirmed = completeDrop({
    placements: [
      {
        slot: 2,
        players: [
          { name: 'Reserva da Equipe 2', kills: 8, lobbySlot: 2 },
          { name: '', kills: 2 },
        ],
      },
      { slot: null, players: [{ name: 'Sem slot', kills: 4, lobbySlot: null }] },
    ],
  });
  const unreviewed = completeDrop({
    reviewed: false,
    placements: [{ slot: 3, players: [{ name: 'Não usar', kills: 4, lobbySlot: 3 }] }],
  });
  const staleRoster = completeDrop({
    rosterFingerprint: 'mapa-antigo',
    placements: [{ slot: 4, players: [{ name: 'Mapa antigo', kills: 2, lobbySlot: 4 }] }],
  });
  const currentDrop = completeDrop({
    placements: [{ slot: 5, players: [{ name: 'Queda atual', kills: 1, lobbySlot: 5 }] }],
  });

  assert.deepEqual(
    buildConfirmedPreviousDropReferences(
      [confirmed, unreviewed, staleRoster, currentDrop],
      3,
      teams,
    ),
    [{
      dropNumber: 1,
      confirmed: true,
      placements: [{ slot: 2, players: [{ name: 'Reserva da Equipe 2' }] }],
    }],
  );
});

test('the latest confirmed drop, not a pending drop, controls the final tie-break', () => {
  const firstDrop = completeDrop({
    placements: Array.from({ length: 12 }, (_, index) => ({
      position: index === 0 ? 2 : index === 1 ? 3 : index === 2 ? 1 : index + 1,
      slot: index + 1,
      kills: 0,
    })),
  });
  const secondDrop = completeDrop({
    placements: Array.from({ length: 12 }, (_, index) => ({
      position: index === 0 ? 3 : index === 1 ? 2 : index === 2 ? 1 : index + 1,
      slot: index + 1,
      kills: 0,
    })),
  });
  const pendingDrop = {
    ...completeDrop(),
    reviewed: false,
    placements: Array.from({ length: 12 }, (_, index) => ({
      position: index === 0 ? 1 : index === 1 ? 12 : index === 2 ? 2 : index + 1,
      slot: index + 1,
      kills: 0,
    })),
  };
  const standings = calculateStandings(teams, [firstDrop, secondDrop, pendingDrop], 3, {
    rosterConfirmed: true,
  });

  assert.equal(standings[1].slot, 2);
  assert.equal(standings[2].slot, 1);
  assert.equal(standings[1].points, 17);
  assert.equal(standings[2].points, 17);
});

test('the Replit API route uses strict kill parsing instead of Number coercion', () => {
  assert.match(apiSource, /function normalizeKillCount\(value: unknown\): number \| null/);
  assert.match(apiSource, /const reportedTeamKills = normalizeKillCount\(item\.kills\)/);
  assert.match(apiSource, /const kills = hasReadablePlayerKills \? playerKillsTotal : null/);
  assert.match(apiSource, /const playerKills = normalizeKillCount\(player\.kills\)/);
  assert.doesNotMatch(apiSource, /const playerKills = Number\(player\.kills\)/);
});

test('the prompts and final standings use only sums of readable individual kills', () => {
  for (const source of [netlifySource, apiSource]) {
    assert.match(source, /kills da equipe deve ser sempre a soma dos abates individuais legíveis/i);
    assert.match(source, /total agregado impresso no placar serve somente como conferência/i);
  }
  assert.match(scoringSource, /sumReadablePlayerKills\(p\.players\)/);
  assert.match(scoringSource, /data-edit-player-kills/);
  assert.match(scoringSource, /data-kill-total/);
});

test('the current lobby roster overrides a conflicting scoreboard slot in both backends', () => {
  const result = {
    lobbyRoster: [{ slot: 3, players: [{ name: 'XLT Iphinity' }] }],
    placements: [{
      position: 1,
      slot: 8,
      teamName: 'Equipe 8',
      kills: 5,
      players: [
        { name: 'xlt iphinity', kills: 3, lobbySlot: 8 },
        { name: 'Reserva', kills: 2, lobbySlot: 5 },
      ],
      confidence: 'high',
      notes: '',
    }],
    unmatchedPlayers: [],
  };

  for (const [name, normalize] of [
    ['Netlify', loadNetlifyNormalizer()],
    ['API server', loadApiServerNormalizer()],
  ]) {
    const normalized = asPlainObject(normalize(result, teams));
    assert.equal(normalized.placements[0].slot, 3, `${name} should use the lobby slot`);
    assert.equal(normalized.placements[0].teamName, 'Equipe 3');
    assert.equal(normalized.placements[0].players[0].lobbySlot, 3);
    assert.equal(normalized.placements[0].players[0].lobbyRosterMatched, true);
    assert.equal(normalized.placements[0].players[1].lobbySlot, null);
    assert.equal(normalized.placements[0].players[1].lobbyRosterMatched, false);
  }
});

test('a missing structured lobby roster triggers manual review instead of trusting model slots', () => {
  for (const [name, normalize] of [
    ['Netlify', loadNetlifyNormalizer()],
    ['API server', loadApiServerNormalizer()],
  ]) {
    const normalized = asPlainObject(normalize({
      placements: [{
        position: 1,
        slot: 8,
        kills: 2,
        players: [{ name: 'Player X', kills: 2, lobbySlot: 1 }],
        confidence: 'high',
      }],
      unmatchedPlayers: [],
    }, teams));
    const placement = normalized.placements[0];
    assert.equal(placement.players[0].lobbySlot, null, `${name} must not trust the unverified player slot`);
    assert.equal(placement.confidence, 'low');
    assert.ok(placement.reviewFields.includes('slot'));
    assert.ok(placement.reviewFields.includes('players'));
    assert.match(placement.notes, /lista estruturada do lobby não foi retornada/);
  }
});

test('a nickname mapped to multiple lobby slots stays unassigned', () => {
  for (const [name, normalize] of [
    ['Netlify', loadNetlifyNormalizer()],
    ['API server', loadApiServerNormalizer()],
  ]) {
    const normalized = asPlainObject(normalize({
      lobbyRoster: [
        ...lobbyRosterFor(2, ['Nick Duplicado']),
        ...lobbyRosterFor(9, ['nick duplicado']),
      ],
      placements: [{
        position: 1,
        slot: 2,
        kills: 4,
        players: [{ name: 'Nick Duplicado', kills: 4, lobbySlot: 2 }],
        confidence: 'high',
      }],
      unmatchedPlayers: [],
    }, teams));
    const placement = normalized.placements[0];
    assert.equal(placement.slot, null, `${name} should not guess between lobby slots`);
    assert.equal(placement.teamName, null);
    assert.equal(placement.players[0].lobbySlot, null);
    assert.ok(placement.reviewFields.includes('slot'));
    assert.ok(placement.reviewFields.includes('players'));
  }
});
