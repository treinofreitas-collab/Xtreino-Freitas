import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapMatchResultTeamsToRoster,
  parseMatchResultRoster,
  resolveMatchResultTeam,
} from './freefire-matchresult.mjs';
import { resolveModoLigaTeamLogo } from './admin-freefire-scoring.mjs';

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

test('parses the 15 styled team slots and removes decorative emojis', () => {
  const parsed = parseMatchResultRoster(rosterText);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.roster.length, 15);
  assert.equal(parsed.roster[0].teamName, '4S-CEO');
  assert.equal(parsed.roster[6].teamName, 'NOX SPORTS');
});

test('matches exact names despite accents and generic esports suffixes', () => {
  assert.equal(resolveMatchResultTeam('NOX SPORTS', roster).team.teamName, 'NOX SPORTS');
  assert.equal(resolveMatchResultTeam('F2 ESPORTS', roster).team.teamName, 'F2 ESPORTS');
});

test('matches a unique exact keyword in an abbreviated or expanded team name', () => {
  assert.equal(resolveMatchResultTeam('LINE CEO', roster).team.teamName, '4S-CEO');
  assert.equal(resolveMatchResultTeam('MAFIA ALPHA', roster).team.teamName, 'Máfia');
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

test('keeps names that have no convincing candidate unmatched', () => {
  assert.equal(resolveMatchResultTeam('STG KILLERS', roster).status, 'unmatched');
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
