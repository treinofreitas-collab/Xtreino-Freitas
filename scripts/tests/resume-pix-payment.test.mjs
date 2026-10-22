import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const endpointSource = readFileSync(
    new URL('../../netlify/functions/resume-pix-payment.js', import.meta.url),
    'utf8',
);

function createHarness({
    checkout = {
        userId: 'buyer-1',
        method: 'mercadopago',
        kind: 'event',
        status: 'pending',
        orderId: 'schedule-123',
        amountCents: 300,
        pixPaymentId: 'mp-123',
        title: 'Treino Freitas',
        providerDescription: 'Treino Freitas — 21/10 19h',
        pixExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    },
    payment = {
        id: 'mp-123',
        status: 'pending',
        external_reference: 'schedule-123',
        currency_id: 'BRL',
        transaction_amount: 3,
        payment_method_id: 'pix',
        date_of_expiration: new Date(Date.now() + 10 * 60_000).toISOString(),
        point_of_interaction: { transaction_data: { qr_code: 'pix-copy-code', qr_code_base64: 'cXJjb2Rl' } },
    },
    searchPayments = [],
    completeResult = { status: 'paid' },
} = {}) {
    const calls = { paymentIds: [], searches: [], completions: [], updates: [] };
    const checkoutRef = {
        async get() {
            return { exists: Boolean(checkout), data: () => checkout };
        },
        async update(value) {
            calls.updates.push(value);
        },
    };
    const db = {
        collection(name) {
            assert.equal(name, 'purchase_checkouts');
            return { doc: reference => {
                assert.equal(reference, 'schedule-123');
                return checkoutRef;
            } };
        },
    };
    const dependencies = {
        '../shared/firebase-admin': {
            getAdmin: () => ({ firestore: () => db }),
            verifyFirebaseUser: async event => {
                if (!event.user) throw Object.assign(new Error('Faça login.'), { statusCode: 401 });
                return event.user;
            },
        },
        '../shared/credit-token-order': {
            fetchPaymentById: async id => {
                calls.paymentIds.push(id);
                return payment;
            },
            findPaymentsByExternalReference: async reference => {
                calls.searches.push(reference);
                return searchPayments;
            },
        },
        '../shared/purchase': {
            completePurchase: async (...args) => {
                calls.completions.push(args);
                return completeResult;
            },
        },
        '../shared/token-purchase': {
            jsonResponse: (statusCode, body) => ({ statusCode, body: JSON.stringify(body) }),
            parseJsonBody: event => JSON.parse(event.body || '{}'),
        },
    };
    const module = { exports: {} };
    const context = vm.createContext({
        Date,
        JSON,
        Math,
        Number,
        String,
        console: { error() {} },
        process: { env: { MP_ACCESS_TOKEN: 'test-token' } },
    });
    const loadModule = vm.runInContext(
        `(function(require, module, exports) { ${endpointSource}\n})`,
        context,
    );
    loadModule(name => {
        if (!dependencies[name]) throw new Error(`Unexpected dependency: ${name}`);
        return dependencies[name];
    }, module, module.exports);

    return { handler: module.exports.handler, calls };
}

function request(user = { uid: 'buyer-1' }, reference = 'schedule-123') {
    return {
        httpMethod: 'POST',
        user,
        body: JSON.stringify({ external_reference: reference }),
    };
}

function body(response) {
    return JSON.parse(response.body);
}

test('resumes only the existing active Pix for the authenticated checkout', async () => {
    const { handler, calls } = createHarness();

    const response = await handler(request());

    assert.equal(response.statusCode, 200);
    assert.equal(body(response).status, 'pending');
    assert.equal(body(response).qr_code, 'pix-copy-code');
    assert.equal(body(response).description, 'Treino Freitas — 21/10 19h');
    assert.deepEqual(calls.paymentIds, ['mp-123']);
    assert.deepEqual(calls.searches, []);
    assert.deepEqual(calls.completions, []);
});

test('does not expose a checkout owned by another account', async () => {
    const { handler, calls } = createHarness();

    const response = await handler(request({ uid: 'another-user' }));

    assert.equal(response.statusCode, 403);
    assert.deepEqual(calls.paymentIds, []);
    assert.deepEqual(calls.searches, []);
});

test('reports expired Pix without creating another payment', async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    const { handler, calls } = createHarness({
        checkout: {
            userId: 'buyer-1', method: 'mercadopago', kind: 'event', status: 'pending',
            orderId: 'schedule-123', amountCents: 300, pixPaymentId: 'mp-123',
        },
        payment: {
            id: 'mp-123', status: 'pending', external_reference: 'schedule-123',
            currency_id: 'BRL', transaction_amount: 3, payment_method_id: 'pix',
            date_of_expiration: expired,
            point_of_interaction: { transaction_data: { qr_code: 'old-code', qr_code_base64: 'cXJjb2Rl' } },
        },
    });

    const response = await handler(request());

    assert.equal(response.statusCode, 200);
    assert.equal(body(response).status, 'expired');
    assert.equal(body(response).qr_code, undefined);
    assert.deepEqual(calls.completions, []);
});

test('confirms an already-approved payment through the trusted settlement path', async () => {
    const { handler, calls } = createHarness({
        payment: {
            id: 'mp-123', status: 'approved', external_reference: 'schedule-123',
            currency_id: 'BRL', transaction_amount: 3, payment_method_id: 'pix',
        },
    });

    const response = await handler(request());

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body(response), { status: 'paid' });
    assert.equal(calls.completions.length, 1);
    assert.equal(calls.completions[0][0], 'schedule-123');
    assert.equal(calls.completions[0][1].uid, 'buyer-1');
});

test('refuses ambiguous payments found by exact reference instead of showing a possibly duplicate QR', async () => {
    const checkout = {
        userId: 'buyer-1', method: 'mercadopago', kind: 'product', status: 'pending',
        orderId: 'schedule-123', amountCents: 300, title: 'Produto',
    };
    const activePayment = id => ({
        id, status: 'pending', external_reference: 'schedule-123',
        currency_id: 'BRL', transaction_amount: 3, payment_method_id: 'pix',
        date_of_expiration: new Date(Date.now() + 10 * 60_000).toISOString(),
        point_of_interaction: { transaction_data: { qr_code: `code-${id}`, qr_code_base64: 'cXJjb2Rl' } },
    });
    const { handler, calls } = createHarness({
        checkout,
        payment: null,
        searchPayments: [activePayment('mp-1'), activePayment('mp-2')],
    });

    const response = await handler(request());

    assert.equal(response.statusCode, 409);
    assert.equal(body(response).status, 'review');
    assert.deepEqual(calls.searches, ['schedule-123']);
    assert.deepEqual(calls.updates, []);
});
