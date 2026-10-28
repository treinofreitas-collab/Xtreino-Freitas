import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

import {
  calculateStandings,
  normalizeExtractedKillCount,
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
  const end = netlifySource.indexOf('\nfunction normalizePlayerName(', start);
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
  const end = apiSource.indexOf('\nfunction normalizePlayerName(', start);
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

test('preserves a clearly read zero and reports the real team/players mismatch', () => {
  const normalizePlacements = loadNetlifyNormalizer();
  const result = asPlainObject(normalizePlacements({
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

  assert.equal(result.placements[0].kills, 4);
  assert.deepEqual(result.placements[0].players.map(player => player.kills), [2, 1, 0]);
  assert.equal(result.placements[0].confidence, 'low');
  assert.match(result.placements[0].notes, /soma individual \(3\) difere do total \(4\)/);
});

test('keeps missing team and player kills unreadable instead of coercing them to zero', () => {
  const normalizePlacements = loadNetlifyNormalizer();
  const result = asPlainObject(normalizePlacements({
    placements: [{
      position: 1,
      slot: 1,
      kills: null,
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
  assert.match(result.placements[0].notes, /Total de abates da equipe ilegível/);
  assert.match(result.placements[0].notes, /Abates ilegíveis para 2 jogadores/);
  assert.doesNotMatch(result.placements[0].notes, /soma individual \(0\)/);
});

test('the Replit API server also preserves unreadable counts as null', () => {
  const normalizePlacements = loadApiServerNormalizer();
  const result = asPlainObject(normalizePlacements({
    placements: [{
      position: 1,
      slot: 1,
      kills: null,
      players: [{ name: 'Jogador A', kills: '', lobbySlot: 1 }],
      confidence: 'high',
    }],
  }, teams));

  assert.equal(result.placements[0].kills, null);
  assert.equal(result.placements[0].players[0].kills, null);
  assert.equal(result.placements[0].confidence, 'low');
  assert.match(result.placements[0].notes, /Total de abates da equipe ilegível/);
  assert.match(result.placements[0].notes, /Abates ilegíveis para 1 jogador/);
});

test('the preview preserves explicit zero, leaves unknown counts blank, and excludes them from standings', () => {
  assert.equal(normalizeExtractedKillCount(0), 0);
  assert.equal(normalizeExtractedKillCount('0'), 0);
  assert.equal(normalizeExtractedKillCount(null), null);
  assert.equal(normalizeExtractedKillCount(''), null);
  assert.equal(normalizeExtractedKillCount('ilegível'), null);

  const standings = calculateStandings(
    [{ slot: 1, teamName: 'Equipe 1' }],
    [{
      analyzed: true,
      placements: [{ position: 1, slot: 1, kills: null }],
    }],
    1,
  );
  assert.equal(standings[0].wins, 0);
  assert.equal(standings[0].kills, 0);
  assert.equal(standings[0].points, 0);
  assert.match(scoringSource, /!Number\.isInteger\(placement\.kills\) \|\| placement\.kills < 0/);
  assert.match(scoringSource, /Abates ilegíveis/);
});

test('the Replit API route uses strict kill parsing instead of Number coercion', () => {
  assert.match(apiSource, /function normalizeKillCount\(value: unknown\): number \| null/);
  assert.match(apiSource, /const kills = normalizeKillCount\(item\.kills\)/);
  assert.match(apiSource, /const playerKills = normalizeKillCount\(player\.kills\)/);
  assert.doesNotMatch(apiSource, /const playerKills = Number\(player\.kills\)/);
});
