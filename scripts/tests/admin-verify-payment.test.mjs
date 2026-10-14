import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../artifacts/xtreino/public/admin.js', import.meta.url), 'utf8');
const binding = source.slice(source.indexOf('  function bindManageHourActions('),
    source.indexOf('  async function openManageHourModal('));
const start = source.indexOf('      const handleListClick = async (e) => {');
const handler = source.slice(start, source.indexOf('      bindManageHourActions(', start))
    .replace("await import('./js/payment-client.js')", 'await loadPaymentClient()');

function setup(status = 'needs_review') {
    let resolve;
    const response = new Promise(r => { resolve = r; });
    const calls = [];
    const context = vm.createContext({
        window: { firebaseAuth: { currentUser: { uid: 'admin' } } },
        console,
        showToast: (...args) => calls.push(['toast', ...args]),
        loadPaymentClient: async () => ({
            confirmPayment: async (user, reference) => {
                calls.push(['verify', user.uid, reference]);
                return response;
            },
        }),
        loadBoard: async () => calls.push(['board']),
        openManageHourModal: (...args) => calls.push(['modal', ...args]),
        date: '2026-10-14', eventType: 'liga', hour: '14h',
        rawEventId: 'raw-event-id', evFieldType: 'eventType',
    });
    vm.runInContext(`${binding}\n${handler}\nglobalThis.handle = handleListClick;`, context);
    const button = {
        disabled: false, innerHTML: 'Verificar',
        getAttribute: key => key === 'data-ext-ref' ? 'schedule_test' : 'reg-id',
    };
    const event = { target: { closest: selector => selector === '[data-verify-reg-id]' ? button : null } };
    return {
        context, calls, button, event,
        finish: () => resolve({ status, message: 'Uma conferência é necessária.' }),
    };
}

test('reopening the hour modal replaces both click handlers rather than accumulating them', async () => {
    const { context } = setup();
    const confirmed = {}, pending = {};
    let oldCalls = 0, newCalls = 0;
    context.bindManageHourActions(confirmed, pending, () => oldCalls++);
    context.bindManageHourActions(confirmed, pending, () => newCalls++);
    confirmed.onclick({});
    pending.onclick({});
    assert.equal(oldCalls, 0);
    assert.equal(newCalls, 2);
    context.bindManageHourActions(confirmed, null, () => newCalls++);
    confirmed.onclick({});
    assert.equal(newCalls, 3);
});

test('rapid duplicate clicks produce only one provider check and one review notice', async () => {
    const { context, calls, button, event, finish } = setup();
    const first = context.handle(event);
    await context.handle(event);
    assert.equal(button.disabled, true);
    finish();
    await first;
    assert.equal(calls.filter(call => call[0] === 'verify').length, 1);
    assert.equal(calls.filter(call => call[0] === 'toast').length, 1);
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, 'Verificar');
    assert.equal(calls.filter(call => call[0] === 'modal').length, 0);
});

test('confirmed payment refreshes the same event/hour without duplicate requests', async () => {
    const { context, calls, event, finish } = setup('paid');
    const first = context.handle(event);
    await context.handle(event);
    finish();
    await first;
    assert.deepEqual(calls.filter(call => call[0] === 'modal'),
        [['modal', '2026-10-14', 'liga', '14h', 'raw-event-id', 'eventType']]);
    assert.equal(calls.filter(call => call[0] === 'board').length, 1);
    assert.equal(calls.filter(call => call[0] === 'verify').length, 1);
});
