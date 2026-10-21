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
