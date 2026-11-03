import test from 'node:test';
import assert from 'node:assert/strict';
import { isDisplayableEventRegistration } from '../../artifacts/xtreino/public/js/customer-event-orders.mjs';

test('event history includes every confirmed payment status', () => {
  for (const status of ['paid', 'confirmed', 'approved', 'lisagem_gratis', 'CONFIRMED']) {
    assert.equal(isDisplayableEventRegistration({ status }), true, status);
  }
});

test('event history includes token purchases and excludes unpaid registrations', () => {
  assert.equal(isDisplayableEventRegistration({ status: 'pending', paidWithTokens: true }), true);
  assert.equal(isDisplayableEventRegistration({ status: 'pending' }), false);
  assert.equal(isDisplayableEventRegistration({ status: 'cancelled' }), false);
  assert.equal(isDisplayableEventRegistration({}), false);
});
