import assert from 'node:assert/strict';
import test from 'node:test';
import { getGeneralRankingTeamSessionStats } from '../../artifacts/xtreino/public/js/freefire-general-ranking.mjs';

test('calculates per-training averages and shows the latest date and event for tied records', () => {
  const stats = getGeneralRankingTeamSessionStats([
    { points: 30, kills: 8, date: '2026-11-17', hour: '18', eventLabel: 'TREINO FREITAS' },
    { points: 50, kills: 12, date: '2026-11-18', hour: '20', eventLabel: 'MODO LIGA' },
    { points: 50, kills: 9, date: '2026-11-19', hour: '21', eventLabel: 'TREINO FREITAS' },
  ]);

  assert.equal(stats.averagePoints, 130 / 3);
  assert.equal(stats.averageKills, 29 / 3);
  assert.deepEqual(stats.recordPoints, {
    value: 50,
    session: { date: '2026-11-19', hour: '21', eventLabel: 'TREINO FREITAS' },
  });
  assert.deepEqual(stats.recordKills, {
    value: 12,
    session: { date: '2026-11-18', hour: '20', eventLabel: 'MODO LIGA' },
  });
});

test('returns no averages or records when there are no saved sessions', () => {
  assert.deepEqual(getGeneralRankingTeamSessionStats([]), {
    averagePoints: null,
    averageKills: null,
    recordPoints: null,
    recordKills: null,
  });
});
