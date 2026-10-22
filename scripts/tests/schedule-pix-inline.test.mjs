import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../artifacts/xtreino/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../../artifacts/xtreino/public/script.js', import.meta.url), 'utf8');

test('event Pix QR is embedded in the schedule checkout instead of a separate overlay', () => {
    const scheduleStart = html.indexOf('<div id="scheduleModal"');
    const scheduleEnd = html.indexOf('<!-- Free WhatsApp Modal -->', scheduleStart);
    const pixStart = html.indexOf('<div id="pixPaymentModal"');

    assert.ok(scheduleStart >= 0 && scheduleEnd > scheduleStart);
    assert.ok(pixStart > scheduleStart && pixStart < scheduleEnd);
    assert.equal((html.match(/id="pixPaymentModal"/g) || []).length, 1);
    assert.doesNotMatch(html.slice(pixStart, html.indexOf('>', pixStart)), /fixed inset-0|bg-black/);
    assert.match(html, /id="pixQrImg"/);
    assert.match(html, /id="pixCopiaCola"/);
    assert.match(html, /Concluído/);
});

test('store products show a separate Pix button above token payment', () => {
    const pixButtonStart = html.indexOf('id="productPixBtn"');
    const tokenButtonStart = html.indexOf('id="schedPayTokens"');
    const panelStart = html.indexOf('id="productPixPanel"');
    const scheduleStart = html.indexOf('<div id="scheduleModal"');
    const scheduleEnd = html.indexOf('<!-- Free WhatsApp Modal -->', scheduleStart);

    assert.ok(pixButtonStart >= 0 && pixButtonStart < tokenButtonStart);
    assert.ok(panelStart > scheduleStart && panelStart < scheduleEnd);
    assert.match(html.slice(pixButtonStart - 60, pixButtonStart), /type="button"/);
    assert.match(html, /id="productPixQrImg"/);
    assert.match(html, /id="productPixCopyCode"/);
    assert.match(html, /id="productPixConfirmed"/);

    const productOpenStart = script.indexOf('if (cfg.isProduct) {', script.indexOf('function openScheduleModal'));
    const productOpenEnd = script.indexOf('setSchedulePaymentButtonOrder(true);', productOpenStart);
    const productOpen = script.slice(productOpenStart, productOpenEnd);
    assert.match(productOpen, /productPixBtn/);
    assert.match(productOpen, /window\._activeStoreProduct = \{ productId: eventType, cfg \}/);
    assert.match(productOpen, /showStorePixQRCode|showStorePixRecovery/);
    assert.match(productOpen, /submitBtn\.type = 'button'/);
    assert.match(productOpen, /submitBtn\.style\.display = 'none'/);

    const eventOpenStart = productOpenEnd;
    const eventOpenEnd = script.indexOf('// Detectar evento grátis', eventOpenStart);
    const eventOpen = script.slice(eventOpenStart, eventOpenEnd);
    assert.match(eventOpen, /submitBtn\.type = 'submit'/);
    assert.match(eventOpen, /submitBtn\.style\.display = ''/);
});

test('store Pix reuses a pending reference only for the same product', () => {
    const helpersStart = script.indexOf('const STORE_PIX_PENDING_KEY');
    const productStart = script.indexOf('async function handleProductPurchase(');
    const productEnd = script.indexOf('// Compra de produtos da loja usando Tokens', productStart);
    const productFlow = script.slice(helpersStart, productEnd);

    assert.ok(helpersStart >= 0 && productStart > helpersStart && productEnd > productStart);
    assert.match(productFlow, /paymentMethod === 'pix'/);
    assert.match(productFlow, /getStorePixPending\(productId\)/);
    assert.match(productFlow, /getStorePixPendingByReference\(externalReference\)/);
    assert.match(productFlow, /createOrResumeStorePix\(existingPix, cfg\)/);
    assert.match(productFlow, /createOrResumeStorePix\(pending, cfg\)/);
    assert.match(productFlow, /external_reference: pending\.externalReference/);
    assert.match(productFlow, /create-pix-payment/);
    assert.match(productFlow, /confirm-purchase/);
    assert.match(productFlow, /externalRef = `digital_\$\{docRef\.id\}`/);
    assert.doesNotMatch(productFlow, /Já existe um Pix pendente para/);
});

test('pending store Pix records are isolated by product and cleared by exact reference', () => {
    const helpersStart = script.indexOf('const STORE_PIX_PENDING_KEY');
    const helpersEnd = script.indexOf('function setStorePixPaymentUi(', helpersStart);
    const helpers = script.slice(helpersStart, helpersEnd);
    const storage = new Map([
        ['xtreino_store_pix_pending_user-1', JSON.stringify({
            productId: 'passe-booyah',
            externalReference: 'digital_booyah_order',
            amount: 8,
            userId: 'user-1',
        })],
    ]);
    const context = vm.createContext({
        window: { firebaseAuth: { currentUser: { uid: 'user-1' } } },
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
    });
    vm.runInContext(`${helpers}
        globalThis.getPending = getStorePixPending;
        globalThis.getByReference = getStorePixPendingByReference;
        globalThis.savePending = saveStorePixPending;
        globalThis.clearPending = clearStorePixPending;`, context);

    assert.equal(context.getPending('passe-booyah').externalReference, 'digital_booyah_order');
    assert.equal(context.getPending('sensibilidade'), null);

    context.savePending({
        productId: 'sensibilidade',
        externalReference: 'digital_sensibilidade_order',
        amount: 3,
    });

    assert.equal(context.getPending('passe-booyah').externalReference, 'digital_booyah_order');
    assert.equal(context.getPending('sensibilidade').externalReference, 'digital_sensibilidade_order');
    assert.equal(context.getByReference('digital_sensibilidade_order').productId, 'sensibilidade');

    context.clearPending('digital_booyah_order');
    assert.equal(context.getPending('passe-booyah'), null);
    assert.equal(context.getPending('sensibilidade').externalReference, 'digital_sensibilidade_order');

    const persisted = JSON.parse(storage.get('xtreino_store_pix_pending_user-1'));
    assert.deepEqual(Object.keys(persisted.pendingByProduct), ['sensibilidade']);
});

test('a created Pix stays on the schedule screen and blocks duplicate submissions while pending', () => {
    const submitStart = script.indexOf('async function submitSchedule(');
    const submitEnd = script.indexOf('// ===== Helper: busca registrações por eventType', submitStart);
    const submit = script.slice(submitStart, submitEnd);
    const paymentStart = submit.indexOf('// --- CHAMAR MERCADO PAGO ---');
    const paymentFlow = submit.slice(paymentStart);

    assert.ok(submitStart >= 0 && submitEnd > submitStart);
    assert.match(submit, /window\._scheduleSubmitting\s*\|\|\s*window\._schedulePixPending/);
    assert.ok(paymentStart >= 0);
    assert.match(paymentFlow, /renderSchedulePixFallback\(data, cfg, finalPrice\)/);
    assert.match(paymentFlow, /setSchedulePixCheckoutState/);
    assert.doesNotMatch(paymentFlow, /closeScheduleModal\(\)/);
    assert.doesNotMatch(paymentFlow, /Minha Conta/);
});

test('closing the successful Pix confirmation does not redirect to Minha Conta', () => {
    const closeStart = script.indexOf('window.closePixModal = function() {');
    const closeEnd = script.indexOf('\n};', closeStart);
    const closePixModal = script.slice(closeStart, closeEnd);

    assert.ok(closeStart >= 0 && closeEnd > closeStart);
    assert.match(closePixModal, /closeScheduleModal\(\)/);
    assert.doesNotMatch(closePixModal, /window\.location/);
});

test('fallback displays the QR and copy code in the checkout and locks payment buttons', () => {
    const helperStart = script.indexOf('function setSchedulePixCheckoutState(');
    const helperEnd = script.indexOf('window.openPixModal =', helperStart);
    const helpers = script.slice(helperStart, helperEnd);
    const elementIds = [
        'pixPaymentModal', 'pixLoading', 'pixContent', 'pixConfirmed',
        'pixEventLabel', 'pixAmount', 'pixQrSection', 'pixCopyLabel',
        'pixCopySection', 'pixQrImg', 'pixCopiaCola', 'pixStatusText',
        'schedSubmit', 'schedPayTokens',
    ];
    const elements = new Map();
    for (const id of elementIds) {
        const classes = new Set(id === 'pixPaymentModal' ? ['hidden'] : []);
        elements.set(id, {
            classList: {
                add: name => classes.add(name),
                remove: name => classes.delete(name),
                contains: name => classes.has(name),
                toggle(name, force) {
                    if (force === undefined) {
                        classes.has(name) ? classes.delete(name) : classes.add(name);
                    } else {
                        force ? classes.add(name) : classes.delete(name);
                    }
                },
            },
            textContent: '',
            value: '',
            src: '',
            disabled: false,
        });
    }
    const context = vm.createContext({
        document: { getElementById: id => elements.get(id) || null },
        window: {},
    });
    vm.runInContext(`${helpers}\nglobalThis.renderFallback = renderSchedulePixFallback;\nglobalThis.setPixState = setSchedulePixCheckoutState;`, context);

    context.renderFallback(
        { qr_code: '000201pix-copy-code', qr_code_base64: 'aGVsbG8=' },
        { label: 'Treino Modo Liga' },
        3,
    );
    context.setPixState('pending');

    assert.equal(elements.get('pixPaymentModal').classList.contains('hidden'), false);
    assert.equal(elements.get('pixEventLabel').textContent, 'Treino Modo Liga');
    assert.equal(elements.get('pixAmount').textContent, 'R$ 3,00');
    assert.equal(elements.get('pixQrImg').src, 'data:image/png;base64,aGVsbG8=');
    assert.equal(elements.get('pixCopiaCola').value, '000201pix-copy-code');
    assert.equal(elements.get('schedSubmit').disabled, true);
    assert.equal(elements.get('schedPayTokens').disabled, true);
    assert.equal(context.window._schedulePixPending, true);
});
