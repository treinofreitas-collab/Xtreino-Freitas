import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Camp Season 7 starts bookings on November 18 and bypasses stale script caches', async () => {
  const script = await readFile(
    new URL('../../artifacts/xtreino/public/script.js', import.meta.url),
    'utf8',
  );
  const homepage = await readFile(
    new URL('../../artifacts/xtreino/public/index.html', import.meta.url),
    'utf8',
  );

  assert.match(script, /const CAMP_SEASON_7_START_DATE = '2026-11-18'/);
  assert.match(script, /function isCampSeason7ScheduleConfig\(config\)/);
  assert.match(script, /dateInput\.min = startDate/);
  assert.match(script, /dateInput\.value = todayStr > startDate \? todayStr : startDate/);
  assert.match(script, /dateStr >= \(activeConfig\.startDate \|\| CAMP_SEASON_7_START_DATE\)/);
  assert.match(script, /campSeason7ModalLabel\(ev\.name\)/);
  assert.ok(script.includes('As vagas do Camp Season 7 estão disponíveis a partir de 18/11/2026.'));
  assert.ok(script.includes('O Camp Season 7 começa em 18/11/2026.'));
  assert.match(script, /isCampSeason7ScheduleConfig\(activeDateConfig\)/);
  assert.ok(script.includes('A data selecionada não está disponível para este evento.'));
  assert.match(script, /const displayName = isSeason7 \? campSeason7ModalLabel\(ev\.name\)/);
  assert.match(script, /Para outros eventos, permitir de hoje em diante[\s\S]*?dateInput\.min = todayStr;\s*dateInput\.value = todayStr;\s*dateInput\.removeAttribute\('max'\);\s*updateSelectedDate\(\);/);
  assert.match(script, /<div class="product-title">\$\{displayName\}<\/div>/);
  assert.ok(script.includes(
    "adminEventId: document.getElementById('scheduleModal')?.dataset?.adminEventId || null",
  ));
  assert.match(homepage, /script\.js\?v=camp-season-7-start-20261118-v4/);
});
