import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Camp Season 7 starts bookings on November 16 and bypasses stale script caches', async () => {
  const script = await readFile(
    new URL('../../artifacts/xtreino/public/script.js', import.meta.url),
    'utf8',
  );
  const homepage = await readFile(
    new URL('../../artifacts/xtreino/public/index.html', import.meta.url),
    'utf8',
  );

  assert.match(script, /const CAMP_SEASON_7_START_DATE = '2026-11-16'/);
  assert.match(script, /dateInput\.min = startDate/);
  assert.match(script, /dateStr >= \(activeConfig\.startDate \|\| CAMP_SEASON_7_START_DATE\)/);
  assert.ok(script.includes(
    "adminEventId: document.getElementById('scheduleModal')?.dataset?.adminEventId || null",
  ));
  assert.match(homepage, /script\.js\?v=camp-season-7-start-20261116/);
});
