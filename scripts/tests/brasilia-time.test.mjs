import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const helperPath = fileURLToPath(new URL('../../artifacts/xtreino/public/js/brasilia-time.js', import.meta.url));
const source = readFileSync(helperPath, 'utf8');

function loadBrasiliaTime() {
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(source).runInContext(context);
  return context.window.BrasiliaTime;
}

test('Brasília date is independent of the device timezone at day boundaries', () => {
  const brasiliaTime = loadBrasiliaTime();
  const instant = Date.parse('2026-10-31T01:30:00.000Z');

  assert.equal(brasiliaTime.dateKey(instant), '2026-10-30');
  assert.equal(brasiliaTime.dateKey(Date.parse('2026-10-31T03:30:00.000Z')), '2026-10-31');
  assert.equal(brasiliaTime.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(brasiliaTime.addDays('2027-01-01', -1), '2026-12-31');
});

test('same real instant resolves to the same event date on devices in different timezones', () => {
  const probe = `
    const fs = require('node:fs');
    const vm = require('node:vm');
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(${JSON.stringify(helperPath)}, 'utf8'), context);
    const instant = Date.parse('2026-10-31T01:30:00.000Z');
    process.stdout.write(JSON.stringify({
      localDay: new Date(instant).getDate(),
      eventDate: context.window.BrasiliaTime.dateKey(instant),
    }));
  `;
  const results = ['UTC', 'Pacific/Honolulu', 'Pacific/Kiritimati'].map(timezone => (
    JSON.parse(execFileSync(process.execPath, ['-e', probe], {
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8',
    }))
  ));

  assert.deepEqual(results.map(result => result.eventDate), ['2026-10-30', '2026-10-30', '2026-10-30']);
  assert.notEqual(results[1].localDay, results[2].localDay);
});

test('Brasília weekday and booking-hour comparison use the event timezone', () => {
  const brasiliaTime = loadBrasiliaTime();
  const atBrasilia18h = Date.parse('2026-10-30T21:00:00.000Z');

  assert.equal(brasiliaTime.weekday('2026-10-30'), 5);
  assert.equal(brasiliaTime.minutesUntil('2026-10-30', 19, atBrasilia18h), 60);
  assert.equal(brasiliaTime.minutesUntil('2026-10-30', 19, atBrasilia18h + 61 * 60_000), -1);
  assert.equal(brasiliaTime.formatDate('2026-10-30', { weekday: 'long' }), 'sexta-feira');
});

test('invalid calendar dates are rejected instead of being normalized', () => {
  const brasiliaTime = loadBrasiliaTime();

  assert.equal(brasiliaTime.isValidDateKey('2026-02-30'), false);
  assert.equal(brasiliaTime.addDays('2026-02-30', 1), null);
  assert.equal(brasiliaTime.weekday('bad-date'), null);
});
