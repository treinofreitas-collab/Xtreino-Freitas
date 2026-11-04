import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../../artifacts/xtreino/public/client.js', import.meta.url),
  'utf8',
);
const clientPage = readFileSync(
  new URL('../../artifacts/xtreino/public/client.html', import.meta.url),
  'utf8',
);

test('event orders load registrations without depending on store orders', () => {
  const start = source.indexOf('async function loadOrders() {');
  const end = source.indexOf('// Cache de downloadLinks', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const loader = source.slice(start, end);

  assert.match(loader, /fetchUserDocs\('registrations', 200, true\)/);
  assert.doesNotMatch(loader, /fetchUserDocs\('orders'/);
});

test('event orders subscribe only to registration changes', () => {
  const start = source.indexOf('function _startOrdersAutoRefresh() {');
  const end = source.indexOf('function _stopOrdersAutoRefresh()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const subscription = source.slice(start, end);

  assert.match(subscription, /}, \['registrations'\]\);/);
});

test('the client and its updated cache are versioned together', () => {
  assert.match(clientPage, /client\.js\?v=pending-dashboard-qr-3/);
  assert.match(source, /user-docs-store\.mjs\?v=customer-orders-query-isolation-2/);
});
