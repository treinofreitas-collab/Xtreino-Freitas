import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapMatchResultTeamsToRoster,
  calculateMatchResultStandings,
  getMatchResultSetIssues,
  parseMatchResultLog,
  parseMatchResultRoster,
  resolveMatchResultTeam,
} from './freefire-matchresult.mjs';
import {
  getModoLigaLeaderboardLogoCenterY,
  getModoLigaTemplateRowCenter,
  resolveModoLigaTeamLogo,
} from './admin-freefire-scoring.mjs';

const rosterText = `⃟🩵 𝑻𝑰𝑴𝑬 𝑨: 4S-CEO🍀
⃟🩵 𝑻𝑰𝑴𝑬 𝑩: 4S-ELITE🍀
⃟🩵 𝑻𝑰𝑴𝑬 𝑪: TNG SPORTS 🍀
⃟🩵 𝑻𝑰𝑴𝑬 𝑫: 4K easy🍀
⃟🩵 𝑻𝑰𝑴𝑬 𝑬: Murasaki🍀
⃟🩵 𝑻𝑰𝑴𝑬 𝑭: Konoha
⃟🩵 𝑻𝑰𝑴𝑬 𝑮: NOX SPORTS 🍀
⃟🩵 𝑻𝑰𝑴𝑬 𝑯: Reino
⃟🩵 𝑻𝑰𝑴𝑬 𝑰: PHAMTON X
⃟🩵 𝑻𝑰𝑴𝑬 𝑱: F2 ESPORTS
⃟🩵 𝑻𝑰𝑴𝑬 𝑲: Máfia
⃟🩵 𝑻𝑰𝑴𝑬 𝑳: G3NERETIONSX
⃟🩵 𝑻𝑰𝑴𝑬 𝑴: ZORVAGG
⃟🩵 𝑻𝑰𝑴𝑬 𝑵: JOVENS DO 13
⃟🩵 𝑻𝑰𝑴𝑬 𝑶: FLAMENGO`;

const roster = parseMatchResultRoster(rosterText).roster;

test('centers the leaderboard logo in its template row', () => {
  assert.equal(
    getModoLigaLeaderboardLogoCenterY(1024, 4),
    getModoLigaTemplateRowCenter(1024, 4),
  );
});

test('parses the 15 styled team slots and removes decorative emojis', () => {
  const parsed = parseMatchResultRoster(rosterText);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.roster.length, 15);
  assert.equal(parsed.roster[0].teamName, '4S-CEO');
  assert.equal(parsed.roster[6].teamName, 'NOX SPORTS');
});

test('recognizes AVT Kelly, Maxim, and Andrew labels in official roster lists', () => {
  const avatarSlots = new Map([
    [3, ['AVT Kelly', 'KELLY CREW']],
    [7, ['AVT Maxim', 'MAXIM CREW']],
    [11, ['AVT Andrew', 'ANDREW CREW']],
  ]);
  const text = Array.from({ length: 15 }, (_, index) => {
    const slot = index + 1;
    const avatar = avatarSlots.get(slot);
    if (avatar) {
      const [label, teamName] = avatar;
      return `⃟🩵 𝑨𝑽𝑻 ${label.slice(4).toLocaleUpperCase('pt-BR')}: ${teamName}`;
    }
    return `TIME ${String.fromCharCode(64 + slot)}: TEAM ${slot}`;
  }).join('\n');
  const parsed = parseMatchResultRoster(text);

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    [parsed.roster[2], parsed.roster[6], parsed.roster[10]].map(team => [
      team.slot,
      team.label,
      team.teamName,
    ]),
    [
      [3, 'AVT KELLY', 'KELLY CREW'],
      [7, 'AVT MAXIM', 'MAXIM CREW'],
      [11, 'AVT ANDREW', 'ANDREW CREW'],
    ],
  );

  const mapped = mapMatchResultTeamsToRoster({
    teams: ['KELLY CREW', 'MAXIM CREW', 'ANDREW CREW'].map(teamName => ({ teamName })),
  }, parsed.roster);
  assert.deepEqual(
    mapped.teams.map(team => [team.slot, team.slotLabel]),
    [[3, 'AVT KELLY'], [7, 'AVT MAXIM'], [11, 'AVT ANDREW']],
  );
});

test('extracts only slot assignments from a decorated Modo Liga announcement', () => {
  const text = `ㅤㅤ 𝑴𝑶𝑫𝑶 𝑳𝑰𝑮𝑨 𝑭𝑹𝑬𝑰𝑻𝑨𝑺 » 22𝐇
ㅤ┉────┉────┉────┉────┉
🔐➺ 𝑺𝑨𝑳𝑨 𝑬 𝑺𝑬𝑵𝑯𝑨 𝟏𝟎𝑴𝑰𝑵 𝑨𝑵𝑻𝑬𝑺
🏷️➺ 𝑹𝑬𝑮𝑹𝑨𝑺 𝑵𝑨 𝑫𝑬𝑺𝑪𝑹𝑰𝑪̧𝑨̃𝑶!
⃟🩵 𝑻𝑰𝑴𝑬 𝑨: RANGERS SPORT A
⃟🩵 𝑻𝑰𝑴𝑬 𝑩: RANGERS SPORTS B
⃟🩵 𝑨𝑽𝑻 𝑲𝑬𝑳𝑳𝒀: TEAM KELLY
⃟🩵 𝑻𝑰𝑴𝑬 𝑫: XTREM
⃟🩵 𝑻𝑰𝑴𝑬 𝑬: VORTEX
⃟🩵 𝑻𝑰𝑴𝑬 𝑭: TEAM F
⃟🩵 𝑨𝑽𝑻 𝑴𝑨𝑿𝑰𝑴: TEAM MAXIM
⃟🩵 𝑻𝑰𝑴𝑬 𝑯: VORTEX ESPORTS
⃟🩵 𝑻𝑰𝑴𝑬 𝑰: TEAM I
⃟🩵 𝑻𝑰𝑴𝑬 𝑱: TEAM J
⃟🩵 𝑨𝑽𝑻 𝑨𝑵𝑫𝑹𝑬𝑾: TEAM ANDREW
⃟🩵 𝑻𝑰𝑴𝑬 𝑳: TEAM L
⃟🩵 𝑻𝑰𝑴𝑬 𝑴: TEAM M
⃟🩵 𝑻𝑰𝑴𝑬 𝑵: TEAM N
⃟🩵 𝑻𝑰𝑴𝑬 𝑶: TEAM O
⌞📽️⌝ 𝑺𝑻𝑹𝑬𝑨𝑴𝑬𝑹: SMITHZEIRA
⎾‣⏌FREITAS TV | @Xtreino_freitas`;
  const parsed = parseMatchResultRoster(text);

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.lineCount, 15);
  assert.equal(parsed.roster[0].teamName, 'RANGERS SPORT A');
  assert.equal(parsed.roster[14].teamName, 'TEAM O');
  assert.deepEqual(
    [parsed.roster[2], parsed.roster[6], parsed.roster[10]].map(team => [
      team.slot,
      team.label,
      team.teamName,
    ]),
    [
      [3, 'AVT KELLY', 'TEAM KELLY'],
      [7, 'AVT MAXIM', 'TEAM MAXIM'],
      [11, 'AVT ANDREW', 'TEAM ANDREW'],
    ],
  );
});

test('accepts TIME P and later letter labels within the 15 roster positions', () => {
  const text = Array.from({ length: 15 }, (_, index) => {
    const slot = index + 1;
    const label = slot === 14 ? 'TIME R' : slot === 15 ? 'TIME P' : `TIME ${String.fromCharCode(64 + slot)}`;
    return `⃟🩵 ${label}: TEAM ${slot}`;
  }).join('\n');
  const parsed = parseMatchResultRoster(text);

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.lineCount, 15);
  assert.deepEqual(
    [parsed.roster[13], parsed.roster[14]].map(team => [team.slot, team.label, team.teamName]),
    [
      [14, 'TIME R', 'TEAM 14'],
      [15, 'TIME P', 'TEAM 15'],
    ],
  );
});

test('matches exact names despite accents and generic esports suffixes', () => {
  assert.equal(resolveMatchResultTeam('NOX SPORTS', roster).team.teamName, 'NOX SPORTS');
  assert.equal(resolveMatchResultTeam('F2 ESPORTS', roster).team.teamName, 'F2 ESPORTS');
});

test('maps BLACKPACK exactly and does not let BLACK DRAGONS claim its slot', () => {
  const officialRoster = Array.from({ length: 15 }, (_, index) => ({
    slot: index + 1,
    label: `TIME ${String.fromCharCode(65 + index)}`,
    teamName: index === 7 ? 'BLACK PACK' : '',
  }));
  const parsedDrop = {
    teams: [
      { teamName: 'black dragons', rank: 1, kills: 4 },
      { teamName: 'BLACKPACK', rank: 2, kills: 3 },
    ],
  };

  assert.equal(resolveMatchResultTeam('BLACKPACK', officialRoster).status, 'exact');
  const mapped = mapMatchResultTeamsToRoster(parsedDrop, officialRoster);
  assert.deepEqual(
    mapped.teams.map(team => [team.sourceTeamName, team.teamName, team.slot]),
    [['BLACKPACK', 'BLACK PACK', 8]],
  );
  assert.deepEqual(mapped.ignored, ['black dragons']);
  assert.deepEqual(mapped.errors, []);
  assert.ok(mapped.warnings.some(warning => warning.includes('correspondência exata')));
});

test('adds the same BLACKPACK team across separate match logs', () => {
  const officialRoster = [{ slot: 8, label: 'TIME H', teamName: 'BLACK PACK' }];
  const firstDrop = mapMatchResultTeamsToRoster({
    teams: [{ teamName: 'BLACKPACK', rank: 1, kills: 4 }],
  }, officialRoster);
  const secondDrop = mapMatchResultTeamsToRoster({
    teams: [{ teamName: 'BLACKPACK', rank: 2, kills: 3 }],
  }, officialRoster);
  const standings = calculateMatchResultStandings(
    [
      { index: 0, parsed: firstDrop },
      { index: 1, parsed: secondDrop },
    ],
    2,
    officialRoster,
  );

  assert.deepEqual(
    standings.map(({ teamName, slot, wins, kills, points }) => ({
      teamName, slot, wins, kills, points,
    })),
    [{ teamName: 'BLACK PACK', slot: 8, wins: 1, kills: 7, points: 28 }],
  );
});

test('matches a unique exact keyword in an abbreviated or expanded team name', () => {
  assert.equal(resolveMatchResultTeam('LINE CEO', roster).team.teamName, '4S-CEO');
  assert.equal(resolveMatchResultTeam('MAFIA ALPHA', roster).team.teamName, 'Máfia');
});

test('treats EQP as EQUIPE and maps the exact team instead of a competing name', () => {
  const officialRoster = [
    { slot: 1, label: 'TIME A', teamName: 'EQP MAL' },
    { slot: 2, label: 'TIME B', teamName: 'EQUIPE RIPA' },
  ];
  const resolution = resolveMatchResultTeam('Eqp ripa', officialRoster);
  const mapped = mapMatchResultTeamsToRoster({
    teams: [{ teamName: 'Eqp ripa', rank: 1, kills: 5 }],
  }, officialRoster);

  assert.equal(resolution.status, 'exact');
  assert.equal(resolution.team.teamName, 'EQUIPE RIPA');
  assert.deepEqual(
    mapped.teams.map(team => [team.sourceTeamName, team.teamName, team.slot, team.matchType]),
    [['Eqp ripa', 'EQUIPE RIPA', 2, 'exact']],
  );
  assert.deepEqual(mapped.ignored, []);
  assert.deepEqual(mapped.warnings, []);
});

test('does not match different teams by the shared generic word TROPA', () => {
  const officialRoster = [
    { slot: 5, label: 'TIME E', teamName: 'TROPA DOS PP' },
  ];
  const mapped = mapMatchResultTeamsToRoster({
    teams: [
      { teamName: 'Tropa do badu', rank: 10 },
      { teamName: 'TROPA DOS PP', rank: 11 },
    ],
  }, officialRoster);

  assert.equal(resolveMatchResultTeam('Tropa do badu', officialRoster).status, 'unmatched');
  assert.equal(resolveMatchResultTeam('TROPA DOS PP', officialRoster).status, 'exact');
  assert.deepEqual(
    mapped.teams.map(team => [team.sourceTeamName, team.teamName, team.matchType]),
    [['TROPA DOS PP', 'TROPA DOS PP', 'exact']],
  );
  assert.deepEqual(mapped.ignored, ['Tropa do badu']);
  assert.deepEqual(mapped.errors, []);
});

test('matches a one-character-short team name when there is only one candidate', () => {
  assert.equal(resolveMatchResultTeam('KONOH + TIME F', roster).team.teamName, 'Konoha');
});

test('matches a short code only when the roster has one candidate', () => {
  assert.equal(resolveMatchResultTeam('4K', roster).team.teamName, '4K easy');
  assert.equal(resolveMatchResultTeam('F2', roster).team.teamName, 'F2 ESPORTS');
});

test('does not guess when a short organization code points to multiple teams', () => {
  const result = resolveMatchResultTeam('4S-SPORTS', roster);
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates.map(team => team.teamName), ['4S-CEO', '4S-ELITE']);
});

test('uses an identified organization sibling to map the remaining A/B team', () => {
  const splitOrganizationRoster = [
    { slot: 1, label: 'TIME A', teamName: 'REAL CRIA A' },
    { slot: 2, label: 'TIME B', teamName: 'REAL CRIA B' },
  ];
  const parsed = {
    teams: [
      { teamName: 'REAL CRIA', rank: 3 },
      { teamName: 'REAL CRIA B', rank: 1 },
    ],
  };
  const mapped = mapMatchResultTeamsToRoster(parsed, splitOrganizationRoster);

  assert.deepEqual(
    mapped.teams.map(team => [team.sourceTeamName, team.teamName, team.slot]),
    [
      ['REAL CRIA', 'REAL CRIA A', 1],
      ['REAL CRIA B', 'REAL CRIA B', 2],
    ],
  );
  assert.deepEqual(mapped.ignored, []);
  assert.ok(mapped.warnings.some(warning => warning.includes('REAL CRIA A')));
});

test('keeps an organization-only name ambiguous when no sibling is identified', () => {
  const splitOrganizationRoster = [
    { slot: 1, label: 'TIME A', teamName: 'REAL CRIA A' },
    { slot: 2, label: 'TIME B', teamName: 'REAL CRIA B' },
  ];
  const mapped = mapMatchResultTeamsToRoster(
    { teams: [{ teamName: 'REAL CRIA', rank: 3 }] },
    splitOrganizationRoster,
  );

  assert.deepEqual(mapped.teams, []);
  assert.deepEqual(mapped.ignored, ['REAL CRIA']);
  assert.ok(mapped.warnings.some(warning => warning.includes('REAL CRIA A, REAL CRIA B')));
});

test('keeps names that have no convincing candidate unmatched', () => {
  assert.equal(resolveMatchResultTeam('STG KILLERS', roster).status, 'unmatched');
});

test('uses summed individual kills when MatchResult header kill and total scores disagree', () => {
  const parsed = parseMatchResultLog(`TeamName: REAL CRIA B Rank: 7 KillScore: 3 RankScore: 4 TotalScore: 7
NAME: Oxzinn 23% ID: 1854436016 KILL: 0
NAME: fancyffz ID: 0 KILL: 3
NAME: fancyffz ID: 0 KILL: 3
NAME: fancyffz ID: 0 KILL: 3`);
  const team = parsed.teams[0];

  assert.equal(team.kills, 9);
  assert.equal(team.rankPoints, 4);
  assert.deepEqual(team.errors, []);
  assert.ok(parsed.warnings.some(warning => warning.includes('soma individual (9)')));
  assert.ok(parsed.warnings.some(warning => warning.includes('abates individuais (13)')));
  assert.deepEqual(getMatchResultSetIssues([{ index: 0, parsed }], 1), []);

  const standings = calculateMatchResultStandings(
    [{ index: 0, parsed }],
    1,
    [{ slot: 2, teamName: 'REAL CRIA B' }],
  );
  assert.deepEqual(
    standings.map(({ teamName, kills, points }) => ({ teamName, kills, points })),
    [{ teamName: 'REAL CRIA B', kills: 9, points: 13 }],
  );
});

test('maps only the unique team and leaves ambiguous or unknown log names out', () => {
  const parsed = {
    teams: [
      { teamName: 'LINE CEO', rank: 1 },
      { teamName: '4S-SPORTS', rank: 2 },
      { teamName: 'STG KILLERS', rank: 3 },
      { teamName: 'NOX SPORTS', rank: 4 },
    ],
  };
  const mapped = mapMatchResultTeamsToRoster(parsed, roster);

  assert.deepEqual(
    mapped.teams.map(team => [team.sourceTeamName, team.teamName, team.matchType]),
    [
      ['LINE CEO', '4S-CEO', 'partial'],
      ['NOX SPORTS', 'NOX SPORTS', 'exact'],
    ],
  );
  assert.deepEqual(mapped.ignored, ['4S-SPORTS', 'STG KILLERS']);
  assert.ok(mapped.warnings.some(warning => warning.includes('4S-CEO, 4S-ELITE')));
});

test('logo priority is manual, SPEC, purchase, then recovered association', () => {
  const manual = { logoUrl: 'manual.png', updatedAtMs: 1 };
  const spec = { logoUrl: 'spec.png', updatedAtMs: 2 };
  const purchase = { logoUrl: 'purchase.png', updatedAtMs: 999 };
  const recovered = { logoUrl: 'recovered.png', updatedAtMs: 1000 };

  assert.equal(resolveModoLigaTeamLogo({
    manualLogo: manual,
    specLogo: spec,
    purchaseLogo: purchase,
    associationLogo: recovered,
  }).logoUrl, 'manual.png');
  assert.equal(resolveModoLigaTeamLogo({
    specLogo: spec,
    purchaseLogo: purchase,
    associationLogo: recovered,
  }).logoUrl, 'spec.png');
  assert.equal(resolveModoLigaTeamLogo({
    purchaseLogo: purchase,
    associationLogo: recovered,
  }).logoUrl, 'purchase.png');
  assert.equal(resolveModoLigaTeamLogo({
    associationLogo: recovered,
  }).logoUrl, 'recovered.png');
});

test('ranking can still select the newest logo across sources', () => {
  const result = resolveModoLigaTeamLogo({
    specLogo: { logoUrl: 'spec.png', updatedAtMs: 1 },
    purchaseLogo: { logoUrl: 'purchase.png', updatedAtMs: 2 },
    associationLogo: { logoUrl: 'recovered.png', updatedAtMs: 3 },
    preferNewest: true,
  });

  assert.equal(result.logoUrl, 'recovered.png');
  assert.equal(resolveModoLigaTeamLogo({
    specLogo: { logoUrl: 'spec.png', updatedAtMs: 5 },
    purchaseLogo: { logoUrl: 'purchase.png', updatedAtMs: 5 },
    preferNewest: true,
  }).logoUrl, 'purchase.png');
});
