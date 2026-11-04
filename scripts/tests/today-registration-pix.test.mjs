import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const clientSource = readFileSync(
  new URL('../../artifacts/xtreino/public/client.js', import.meta.url),
  'utf8',
);

const expiryStart = clientSource.indexOf('const PENDING_PIX_TTL_MS =');
const expiryEnd = clientSource.indexOf('async function loadDashboard', expiryStart);
assert.notEqual(expiryStart, -1);
assert.notEqual(expiryEnd, -1);
const expiryHelpers = clientSource.slice(expiryStart, expiryEnd);

function filterUpcoming(registrations, today, now) {
  const context = vm.createContext({});
  return vm.runInContext(
    `${expiryHelpers}; filterTodayRegistrations(registrations, today, now)`,
    Object.assign(context, { registrations, today, now }),
  );
}

test('upcoming trainings keep active pending Pix rows and remove them at expiry', () => {
  const now = Date.parse('2026-10-22T12:00:00.000Z');
  const rows = filterUpcoming([
    { id: 'active-pix', data: {
      status: 'pending', date: '2026-10-22',
      pixExpiresAt: new Date(now + 60_000).toISOString(),
    } },
    { id: 'expired-pix', data: {
      status: 'pending', date: '2026-10-22',
      pixExpiresAt: new Date(now - 1).toISOString(),
    } },
    { id: 'active-legacy', data: {
      status: 'pending', date: '2026-10-22',
      createdAt: new Date(now - 29 * 60 * 1000),
    } },
    { id: 'expired-legacy', data: {
      status: 'pending', date: '2026-10-22',
      createdAt: new Date(now - 30 * 60 * 1000 - 1),
    } },
    { id: 'confirmed', data: { status: 'confirmed', date: '2026-10-22' } },
  ], '2026-10-22', now);

  assert.deepEqual(Array.from(rows, row => row.id), [
    'active-pix',
    'active-legacy',
    'confirmed',
  ]);
});

test('upcoming pending rows expose Pix recovery and automatically refresh at expiry', () => {
  const start = clientSource.indexOf('async function loadTodayRegistrations()');
  const end = clientSource.indexOf('function buildPendingPaymentGroups', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const upcomingLoader = clientSource.slice(start, end);

  assert.match(upcomingLoader, /filterTodayRegistrations\(allRegs, hoje\)/);
  assert.match(upcomingLoader, /data-resume-pix/);
  assert.match(upcomingLoader, /data-pending-payment-result/);
  assert.match(clientSource, /function scheduleTodayRegistrationsExpiryReload\(registrations, userId\)/);
  assert.match(clientSource, /if \(currentUser\?\.uid === userId\) void loadTodayRegistrations\(\)/);
  assert.match(clientSource, /todayRegistrations\.addEventListener\('click'/);
});
