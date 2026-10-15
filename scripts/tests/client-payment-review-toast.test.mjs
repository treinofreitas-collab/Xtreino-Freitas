import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../artifacts/xtreino/public/client.js', import.meta.url), 'utf8');
const reconcileStart = source.indexOf('async function performPendingPaymentReconciliation()');
const reconcileEnd = source.indexOf('async function processSuccessfulPayment(', reconcileStart);
const reconcile = source.slice(reconcileStart, reconcileEnd);
const processStart = reconcileEnd;
const processEnd = source.indexOf('// Token purchase functions', processStart);
const processPayment = source.slice(processStart, processEnd);

function setup({ registrations = [], orders = [], paymentStatus = 'needs_review' } = {}) {
    const calls = [];
    const toasts = [];
    const storage = new Map();
    const context = vm.createContext({
        console,
        currentUser: { uid: 'buyer' },
        auth: { currentUser: { uid: 'buyer' } },
        fetchUserDocs: async collection => collection === 'registrations' ? registrations : orders,
        isTokenPurchaseOrder: () => false,
        confirmPayment: async (user, reference) => {
            calls.push({ user: user.uid, reference });
            return { status: paymentStatus, message: 'Checkout precisa de conferência.' };
        },
        paymentCompleted: result => result.status === 'paid',
        showToast: (...args) => toasts.push(args),
        sessionStorage: {
            setItem: (key, value) => storage.set(key, value),
            getItem: key => storage.get(key) ?? null,
            removeItem: key => storage.delete(key),
        },
        document: { querySelector: () => null },
        setTimeout: callback => { callback(); return 1; },
    });

    vm.runInContext(`
        let _pendingReconcilePromise = null;
        let _pendingReconciledAt = 0;
        ${reconcile}
        ${processPayment}
        globalThis.reconcile = performPendingPaymentReconciliation;
        globalThis.processPayment = processSuccessfulPayment;
    `, context);

    return { context, calls, toasts, storage };
}

test('reconciliation groups distinct needs_review references into one warning and does not approve them', async () => {
    const pending = reference => ({ id: reference, data: { status: 'pending', external_reference: reference } });
    const { context, calls, toasts } = setup({
        registrations: [pending('ref-a'), pending('ref-b')],
        orders: [pending('ref-a'), pending('ref-c')],
    });

    await context.reconcile();

    assert.deepEqual(calls.map(call => call.reference).sort(), ['ref-a', 'ref-b', 'ref-c']);
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0][0], 'warning');
    assert.match(toasts[0][1], /^3 compras precisam de conferência manual/);
    assert.match(toasts[0][1], /Nenhuma foi aprovada automaticamente/);
    assert.equal(toasts[0][2], 'Verificação necessária');
});

test('a direct payment return still shows its individual review warning', async () => {
    const { context, toasts } = setup();

    await context.processPayment('return-ref');

    assert.equal(toasts.length, 1);
    assert.equal(toasts[0][0], 'warning');
    assert.equal(toasts[0][1], 'Checkout precisa de conferência.');
    assert.equal(toasts[0][2], 'Verificação necessária');
});
