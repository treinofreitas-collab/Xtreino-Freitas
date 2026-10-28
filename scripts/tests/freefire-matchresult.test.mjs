import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMatchResultView } from '../../artifacts/xtreino/public/js/admin-freefire-matchresult-view.mjs';
import {
  buildModoLigaPurchaseLogoCatalog,
  getModoLigaTemplateLayout,
  getModoLigaTemplateRowCenter,
  getModoLigaTop3LogoLayout,
  parseRoster,
  withModoLigaPurchaseTimeout,
} from '../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs';
import { specLogoCodeForLetter } from '../../artifacts/xtreino/public/js/admin-spec-logos.mjs';
import {
  LBFF_PLACEMENT_POINTS_15,
  calculateMatchResultStandings,
  getMatchResultSetIssues,
  mapMatchResultTeamsToRoster,
  matchResultTeamKey,
  parseMatchResultRoster,
  parseMatchResultLog,
  resolveMatchResultTeam,
} from '../../artifacts/xtreino/public/js/freefire-matchresult.mjs';

test('imports the team key normalizer used by the Modo Liga scoring view', async () => {
  const source = await readFile(
    new URL('../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /import\s*\{[^}]*\bmatchResultTeamKey\b[^}]*\}\s*from\s*['"]\.\/freefire-matchresult\.mjs['"]/s,
  );
});

test('includes the Freitas logo used as the empty-slot fallback', async () => {
  const image = await readFile(
    new URL('../../artifacts/xtreino/public/assets/freefire-organizacao-logo.webp', import.meta.url),
  );
  assert.equal(image.subarray(0, 4).toString(), 'RIFF');
  assert.equal(image.subarray(8, 12).toString(), 'WEBP');
});

test('versions the organization logo URL to avoid stale missing-image caches', async () => {
  const source = await readFile(
    new URL('../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /freefire-organizacao-logo\.webp\?v=logo-fallback-2/);
});

test('loads the scoring module with a fresh cache version', async () => {
  const adminScript = await readFile(
    new URL('../../artifacts/xtreino/public/admin.js', import.meta.url),
    'utf8',
  );
  assert.match(
    adminScript,
    /import\s*\(['"]\.\/js\/admin-freefire-scoring\.mjs\?v=logo-export-1['"]\)/,
  );
});

test('loads admin.js with the matching cache version', async () => {
  const adminPage = await readFile(
    new URL('../../artifacts/xtreino/public/admin.html', import.meta.url),
    'utf8',
  );
  assert.match(adminPage, /src="admin\.js\?v=streamer-prize-1"/);
});

test('ships compact Modo Liga logo sizing and controls in the release view module', async () => {
  const source = await readFile(
    new URL('../../artifacts/xtreino/public/js/admin-freefire-matchresult-view.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /\.mr-view \.mr-roster-grid-logos\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(source, /\.mr-view \.mr-roster-logo\{display:block;width:34px;height:34px;object-fit:contain/);
  assert.match(source, /onRosterLogoFile/);
  assert.match(source, /onImportPurchaseLogos/);
});

test('versions the MatchResult view module import used for logo layout', async () => {
  const source = await readFile(
    new URL('../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /admin-freefire-matchresult-view\.mjs\?v=logo-layout-3/);
});

test('includes the logo bitmap helper and Top 3 assets required by exports', async () => {
  const source = await readFile(
    new URL('../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs', import.meta.url),
    'utf8',
  );
  const helperIndex = source.indexOf('async function loadLogoBitmap(');
  const top3ExportIndex = source.indexOf('async function exportModoLigaTop3Jpeg(');
  assert.ok(helperIndex >= 0 && helperIndex < top3ExportIndex);
  assert.equal(getModoLigaTop3LogoLayout(1000, 600).length, 3);
  assert.ok((await readFile(new URL('../../artifacts/xtreino/public/assets/freefire-modo-liga-top3.webp', import.meta.url))).length > 0);
  assert.ok((await readFile(new URL('../../artifacts/xtreino/public/assets/freefire-modo-liga-top3-placeholder.png', import.meta.url))).length > 0);
});

test('imports and displays logos from approved Modo Liga purchases', () => {
  const roster = parseMatchResultRoster([
    'TIME A: ONYX GAMING',
    'TIME B: AKATSUKI',
  ].join('\n')).roster;
  const catalog = buildModoLigaPurchaseLogoCatalog([
    {
      teamName: 'ONYX GAMING',
      status: 'approved',
      teamLogoUrl: '/logos/onyx-old.webp',
      createdAt: '2026-10-20T12:00:00.000Z',
    },
    {
      teamName: 'ONYX GAMING',
      status: 'paid',
      teamLogoUrl: '/logos/onyx-current.webp',
      createdAt: '2026-10-25T12:00:00.000Z',
    },
  ], roster);

  assert.equal(catalog.get(matchResultTeamKey('ONYX GAMING'))?.logoUrl, '/logos/onyx-current.webp');
});

test('ends a stalled Modo Liga purchase-logo lookup with a timeout', async () => {
  await assert.rejects(
    withModoLigaPurchaseTimeout(
      new Promise(() => {}),
      5,
      'Consulta do Firebase excedeu o tempo limite.',
    ),
    /Consulta do Firebase excedeu o tempo limite/,
  );
});

test('routes purchase-logo retries and renders their logo-resolved roster', async () => {
  const source = await readFile(
    new URL('../../artifacts/xtreino/public/js/admin-freefire-scoring.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /\bresolveMatchResultTeam\b/);
  assert.match(source, /rosterDraft:\s*rosterWithLogos/);
  assert.match(source, /onImportPurchaseLogos:\s*\(\)\s*=>\s*\{\s*loadModoLigaPurchaseLogos/);
});

function teamBlock(teamName, rank, playerKills, overrides = {}) {
  const kills = playerKills.reduce((sum, value) => sum + value, 0);
  const rankPoints = LBFF_PLACEMENT_POINTS_15[rank - 1];
  const reportedKills = overrides.reportedKills ?? kills;
  const reportedRankPoints = overrides.reportedRankPoints ?? rankPoints;
  const totalPoints = overrides.reportedTotalPoints ?? kills + rankPoints;
  return [
    `TeamName: ${teamName}  Rank: ${rank}  KillScore: ${reportedKills}  RankScore: ${reportedRankPoints}  TotalScore: ${totalPoints}`,
    ...playerKills.map((value, index) => `NAME: Player ${index + 1}  ID: ${1000 + index}  KILL: ${value}`),
  ].join('\n');
}

test('parses 15-team MatchResult logs and recomputes placement and kill totals', () => {
  const text = Array.from({ length: 15 }, (_, index) =>
    teamBlock(`Equipe ${index + 1}`, index + 1, [index === 0 ? 4 : 0, 1, 0, 0]),
  ).join('\n');
  const result = parseMatchResultLog(text);

  assert.equal(result.teams.length, 15);
  assert.equal(result.valid, true);
  assert.equal(result.teams[0].teamName, 'Equipe 1');
  assert.equal(result.teams[0].kills, 5);
  assert.equal(result.teams[0].rankPoints, 12);
  assert.equal(result.teams[14].rankPoints, 0);
  assert.deepEqual(result.errors, []);
});

test('flags header totals that disagree with individual player kills or LBFF points', () => {
  const result = parseMatchResultLog(teamBlock('Equipe A', 2, [2, 1], {
    reportedKills: 9,
    reportedRankPoints: 8,
    reportedTotalPoints: 14,
  }));

  assert.equal(result.valid, false);
  assert.match(result.teams[0].errors.join(' '), /KillScore do cabeçalho/);
  assert.match(result.teams[0].errors.join(' '), /RankScore informado/);
  assert.match(result.teams[0].errors.join(' '), /TotalScore informado/);
});

test('normalizes equivalent team names and requires one file for every selected drop', () => {
  assert.equal(matchResultTeamKey('  ＴＥＡＭ　A  '), matchResultTeamKey('team a'));
  assert.deepEqual(
    getMatchResultSetIssues([{ parsed: parseMatchResultLog(teamBlock('Equipe A', 1, [1])) }], 2),
    ['Adicione um arquivo MatchResult para cada queda selecionada.'],
  );
});

test('centers all 15 Modo Liga rows inside the supplied table slots', () => {
  const templateRowCenters = [
    459.9, 491.6, 523.4, 555.1, 586.9, 618.6, 650.4, 682.1,
    713.8, 745.6, 777.3, 809.1, 840.8, 872.6, 904.3,
  ];
  templateRowCenters.forEach((center, index) => {
    assert.ok(
      Math.abs(getModoLigaTemplateRowCenter(1024, index) - center) < 1.2,
      `slot ${index + 1} should be centered at approximately ${center}px`,
    );
  });
});

test('aligns Modo Liga logos, names, and score values to the updated template columns', () => {
  const layout = getModoLigaTemplateLayout(1024);

  assert.deepEqual(
    {
      logoCenterX: layout.logoCenterX,
      teamNameCenterX: layout.teamNameCenterX,
      winsCenterX: layout.winsCenterX,
      killsCenterX: layout.killsCenterX,
      pointsCenterX: layout.pointsCenterX,
    },
    {
      logoCenterX: 133.5296,
      teamNameCenterX: 287.0272,
      winsCenterX: 448,
      killsCenterX: 501.9648,
      pointsCenterX: 557.4656,
    },
  );
  assert.equal(layout.logoSize, 28.672);
});

test('shows logo upload controls only for the Modo Liga slot list', () => {
  const container = {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
    replaceChildren() {},
    contains() { return false; },
  };
  const view = createMatchResultView(container);
  const rosterDraft = Array.from({ length: 15 }, (_, index) => ({
    slot: index + 1,
    teamName: `Time ${index + 1}`,
    logoUrl: index === 0 ? '/assets/logo-time-1.webp' : '/assets/freefire-organizacao-logo.webp?v=logo-fallback-2',
    logoSource: index === 0 ? 'custom' : 'organization',
  }));
  const baseState = {
    rosterDraft,
    rosterCount: 15,
    standings: [{
      rank: 1,
      slot: 1,
      teamName: 'Time 1',
      wins: 2,
      kills: 3,
      points: 15,
      logoUrl: '/assets/logo-time-1.webp',
    }],
    organizationLogoUrl: '/assets/freefire-organizacao-logo.webp?v=logo-fallback-2',
    drops: [],
    canManageLogos: true,
    canImportPurchaseLogos: true,
    purchaseLogoBusy: false,
    purchaseLogoStatus: 'Encontramos 1 logo para 3 times informados.',
    canExport: false,
    canExportTop3: true,
  };

  view.render({ ...baseState, eventType: 'modo-liga' });
  assert.equal((container.innerHTML.match(/data-roster-logo="/g) || []).length, 15);
  assert.match(container.innerHTML, /data-roster-logo-reset="1"/);
  assert.match(container.innerHTML, /class="ff-roster-grid mr-roster-grid-logos"/);
  assert.match(container.innerHTML, /class="mr-standing-logo" src="\/assets\/logo-time-1\.webp"/);
  assert.match(container.innerHTML, /logo Freitas é usada por padrão/);
  assert.match(container.innerHTML, /data-export-top3/);
  assert.match(container.innerHTML, /ponto de interrogação/);
  assert.match(container.innerHTML, /data-import-purchase-logos/);
  assert.match(container.innerHTML, /Buscar logos nas compras/);
  assert.match(container.innerHTML, /Encontramos 1 logo para 3 times informados/);

  view.render({ ...baseState, eventType: 'modo-liga', rosterDraft: [], rosterCount: 0 });
  assert.equal(
    (container.innerHTML.match(/class="mr-roster-logo" src="\/assets\/freefire-organizacao-logo\.webp\?v=logo-fallback-2"/g) || []).length,
    15,
  );

  const withoutOrganizationLogo = {
    ...baseState,
    eventType: 'modo-liga',
    rosterDraft: [],
    rosterCount: 0,
  };
  delete withoutOrganizationLogo.organizationLogoUrl;
  view.render(withoutOrganizationLogo);
  assert.equal(
    (container.innerHTML.match(/class="mr-roster-logo" src="\/assets\/freefire-organizacao-logo\.webp\?v=logo-fallback-2"/g) || []).length,
    15,
  );

  view.render({ ...baseState, eventType: 'acesso' });
  assert.doesNotMatch(container.innerHTML, /data-roster-logo="/);
  assert.doesNotMatch(container.innerHTML, /data-roster-logo-reset="/);
  assert.doesNotMatch(container.innerHTML, /data-export-top3/);
  assert.doesNotMatch(container.innerHTML, /class="ff-roster-grid mr-roster-grid-logos"/);
  assert.doesNotMatch(container.innerHTML, /class="mr-roster-logo"/);
  assert.doesNotMatch(container.innerHTML, /data-import-purchase-logos/);
  assert.match(container.innerHTML, /class="ff-roster-row"/);
  view.destroy();
});

test('parses pasted lettered roster names immediately for image analysis slots', () => {
  const names = [
    'ALPHA STRIKE', 'BRAVO RED', 'CHARLIE BLOCK', 'DELTA FORCE',
    'ECHO FLAME', 'FALCON PRO', 'GHOST HUNTERS', 'HORIZON E-SPORTS',
    'IRON CAVALRY', 'JUPITER UNITY', 'KRAKEN SHARKS', 'LUNAR DN',
  ];
  const roster = parseRoster(names.map((name, index) =>
    `⃟🩵 𝑻𝑰𝑴𝑬 ${String.fromCharCode(65 + index)}: ${name} 🍀`,
  ).join('\n'));

  assert.equal(roster.length, 12);
  assert.equal(roster[0].teamName, 'ALPHA STRIKE');
  assert.equal(roster[11].teamName, 'LUNAR DN');

  const mixedFormats = parseRoster(names.map((name, index) =>
    index % 2
      ? `⃟🩵 𝑺𝑳𝑶𝑻 ${String(index + 1).padStart(2, '0')}: ${name} 🍀`
      : `${index + 1}, ${name}`,
  ).join('\n'));
  assert.equal(mixedFormats[0].teamName, 'ALPHA STRIKE');
  assert.equal(mixedFormats[11].teamName, 'LUNAR DN');
});

test('parses decorated 15-slot roster text supplied for each scoring run', () => {
  const names = [
    'ALPHA STRIKE', 'BRAVO RED', 'CHARLIE BLOCK', 'DELTA FORCE', 'ECHO FLAME',
    'FALCON PRO', 'GHOST HUNTERS', 'HORIZON E-SPORTS', 'IRON CAVALRY',
    'JUPITER UNITY', 'KRAKEN SHARKS', 'LUNAR DN', 'MAMMOTH', 'NEBULA JACK', 'NORTH BLADE',
  ];
  const text = names.map((name, index) =>
    `⃟🩵 𝑻𝑰𝑴𝑬 ${String.fromCharCode(65 + index)}: ${name} 🍀`,
  ).join('\n');
  const result = parseMatchResultRoster(text);

  assert.deepEqual(result.errors, []);
  assert.equal(result.roster.length, 15);
  assert.equal(result.roster[0].teamName, 'ALPHA STRIKE');
  assert.equal(result.roster[14].teamName, 'NORTH BLADE');
  assert.match(parseMatchResultRoster('TIME A:\nTIME B:').errors.join(' '), /exatamente 15/);
});

test('accepts numbered CSV rows and skips a header row', () => {
  const names = Array.from({ length: 15 }, (_, index) => `SQUAD ${String.fromCharCode(65 + index)}`);
  const result = parseMatchResultRoster([
    'Posição,Equipe',
    ...names.map((name, index) => `${index + 1},${name}`),
  ].join('\n'));

  assert.deepEqual(result.errors, []);
  assert.equal(result.roster.length, 15);
  assert.equal(result.roster[0].teamName, 'SQUAD A');
  assert.equal(result.roster[14].teamName, 'SQUAD O');
});

test('places explicitly numbered roster entries in their matching slots', () => {
  const names = Array.from({ length: 15 }, (_, index) => `SQUAD ${String.fromCharCode(65 + index)}`);
  const result = parseMatchResultRoster(
    names.map((name, index) => `${15 - index},${name}`).join('\n'),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.roster[0].teamName, 'SQUAD O');
  assert.equal(result.roster[14].teamName, 'SQUAD A');
});

test('maps clear partial names to official slots and excludes teams outside the submitted roster', () => {
  const names = [
    'ALPHA STRIKE', 'BRAVO RED', 'CHARLIE BLOCK', 'DELTA FORCE', 'ECHO FLAME',
    'FALCON PRO', 'GHOST HUNTERS', 'HORIZON E-SPORTS', 'IRON CAVALRY',
    'JUPITER UNITY', 'KRAKEN SHARKS', 'LUNAR DN', 'MAMMOTH', 'NEBULA JACK', 'NORTH BLADE',
  ];
  const roster = parseMatchResultRoster(names.map((name, index) =>
    `TIME ${String.fromCharCode(65 + index)}: ${name}`,
  ).join('\n')).roster;
  const parsed = parseMatchResultLog([
    teamBlock('FALCON', 1, [2]),
    teamBlock('TIME DE OUTRA LIGA', 2, [9]),
  ].join('\n'));
  const mapped = mapMatchResultTeamsToRoster(parsed, roster);
  const standings = calculateMatchResultStandings([
    { index: 0, parsed: { ...parsed, teams: mapped.teams, errors: mapped.errors } },
  ], 1, roster);

  assert.equal(resolveMatchResultTeam('HORIZON E', roster).team.teamName, 'HORIZON E-SPORTS');
  assert.equal(resolveMatchResultTeam('TEAM', roster).status, 'unmatched');
  assert.deepEqual(mapped.teams.map(team => [team.teamName, team.kills]), [['FALCON PRO', 2]]);
  assert.deepEqual(mapped.ignored, ['TIME DE OUTRA LIGA']);
  assert.equal(standings.length, 15);
  assert.equal(standings[0].teamName, 'FALCON PRO');
  assert.equal(standings[0].points, 14);
  assert.equal(standings.find(team => team.teamName === 'ALPHA STRIKE').points, 0);
});

test('maps stylized Israel 67 glyphs to the official roster and preserves its score', () => {
  const roster = Array.from({ length: 15 }, (_, index) => ({
    slot: index + 1,
    label: `TIME ${String.fromCharCode(65 + index)}`,
    teamName: `EQUIPE ${index + 1}`,
  }));
  roster[12].teamName = 'ISRAEL 67';

  const parsed = parseMatchResultLog(teamBlock('ISRⱯEL⁶⁷', 2, [3, 2, 1]));
  const mapped = mapMatchResultTeamsToRoster(parsed, roster);
  const standings = calculateMatchResultStandings([{
    index: 0,
    parsed: { ...parsed, teams: mapped.teams, errors: mapped.errors },
  }], 1, roster);
  const israel = standings.find(team => team.teamName === 'ISRAEL 67');

  assert.deepEqual(mapped.ignored, []);
  assert.equal(mapped.teams[0].slot, 13);
  assert.equal(mapped.teams[0].matchType, 'partial');
  assert.equal(israel.kills, 6);
  assert.equal(israel.points, 15);
  assert.equal(
    resolveMatchResultTeam('ISRⱯEL⁶⁷', [
      { slot: 1, teamName: 'ISRAEL 67' },
      { slot: 2, teamName: 'ISRɐEL 67' },
    ]).status,
    'ambiguous',
  );
});

test('does not guess when a shortened name has multiple official matches', () => {
  const result = resolveMatchResultTeam('ALPHA', [
    { slot: 1, teamName: 'ALPHA ONE' },
    { slot: 2, teamName: 'ALPHA OPS' },
  ]);

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.candidates.length, 2);
});

test('aggregates B!, A!, and P! across drops and preserves earned points for a missed drop', () => {
  const firstDrop = {
    parsed: parseMatchResultLog([
      teamBlock('Equipe A', 1, [3, 1]),
      teamBlock('Equipe B', 2, [2, 0]),
      teamBlock('Equipe C', 15, [0, 0]),
    ].join('\n')),
  };
  const secondDrop = {
    parsed: parseMatchResultLog([
      teamBlock('Equipe B', 1, [4, 1]),
      teamBlock('Equipe C', 14, [2, 0]),
    ].join('\n')),
  };
  const standings = calculateMatchResultStandings([firstDrop, secondDrop], 2);

  assert.deepEqual(standings.map(({ teamName, wins, kills, points }) => ({
    teamName, wins, kills, points,
  })), [
    { teamName: 'Equipe B', wins: 1, kills: 7, points: 28 },
    { teamName: 'Equipe A', wins: 1, kills: 4, points: 16 },
    { teamName: 'Equipe C', wins: 0, kills: 2, points: 2 },
  ]);
});

test('renders the Modo Liga hour selector for SPEC logo matching', () => {
  const container = {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
    replaceChildren() { this.innerHTML = ''; },
  };
  const view = createMatchResultView(container);

  view.render({
    eventType: 'modo-liga',
    eventLabel: 'Modo Liga',
    eventHour: '19',
    eventHours: ['19', '20', '21', '22', '23', '00'],
    dropCount: 1,
    drops: [],
    standings: [],
    rosterText: '',
    rosterDraft: [],
    rosterCount: 0,
    canManageLogos: false,
    canExport: false,
    canExportTop3: false,
    template: { available: true },
    specLogoStatus: '3 logos SPEC carregadas.',
  });

  assert.match(container.innerHTML, /Horário do Modo Liga/);
  assert.match(container.innerHTML, /<option value="19" selected>19H<\/option>/);
  assert.match(container.innerHTML, /data-event-hour/);
});

test('renders MatchResult safely and keeps exports blocked for missing event artwork', () => {
  const container = {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
    replaceChildren() { this.innerHTML = ''; },
  };
  const view = createMatchResultView(container);

  view.render({
    eventType: 'acesso',
    eventLabel: 'Acesso <evento>',
    dropCount: 1,
    drops: [{ index: 0, fileName: 'queda.log', teams: [], errors: [], warnings: [], reviewed: true }],
    standings: [{ rank: 1, teamName: '<script>alert(1)</script>', wins: 1, kills: 3, points: 15 }],
    rosterText: '',
    rosterFileName: '',
    rosterCount: 0,
    rosterDraft: [],
    rosterDirty: false,
    rosterError: '',
    template: { available: false, bundled: false },
    canExport: false,
    summary: 'A prévia está pronta.',
  });

  assert.match(container.innerHTML, /Acesso &lt;evento&gt;/);
  assert.match(container.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(container.innerHTML, /Modelo próprio aguardando envio/);
  assert.match(container.innerHTML, /Lista oficial de slots/);
  assert.match(container.innerHTML, /Cole lista ou CSV/);
  assert.match(container.innerHTML, /Importar ou arrastar lista/);
  assert.doesNotMatch(container.innerHTML, /Analisar lista|data-apply-roster/);
  assert.match(container.innerHTML, /accept="\.csv,\.txt,text\/csv,text\/plain"/);
  assert.match(container.innerHTML, /placeholder="TIME A: Nome do time/);
  assert.match(container.innerHTML, /data-roster-text[^>]*><\/textarea>/);
  assert.match(container.innerHTML, /data-roster-slot="15"/);
  assert.match(container.innerHTML, /0 \/ 15 slots preenchidos/);
  assert.doesNotMatch(container.innerHTML, /OS MELHORES|A7 RED/);
  assert.match(container.innerHTML, /disabled/);
  assert.doesNotMatch(container.innerHTML, /data-template-file/);
  view.destroy();
  assert.equal(container.innerHTML, '');
});
