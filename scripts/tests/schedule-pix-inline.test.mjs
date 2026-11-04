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
    assert.match(productOpen, /attachStorePixSelectionListeners\(modal\)/);
    assert.doesNotMatch(productOpen, /getStorePixPending\(eventType\)/);
    assert.match(productOpen, /submitBtn\.type = 'button'/);
    assert.match(productOpen, /submitBtn\.style\.display = 'none'/);

    const eventOpenStart = productOpenEnd;
    const eventOpenEnd = script.indexOf('// Detectar evento grátis', eventOpenStart);
    const eventOpen = script.slice(eventOpenStart, eventOpenEnd);
    assert.match(eventOpen, /submitBtn\.type = 'submit'/);
    assert.match(eventOpen, /submitBtn\.style\.display = ''/);
});

test('store Pix reuses a pending reference only for the exact product selection', () => {
    const helpersStart = script.indexOf('const STORE_PIX_PENDING_KEY');
    const productStart = script.indexOf('async function handleProductPurchase(');
    const productEnd = script.indexOf('// Compra de produtos da loja usando Tokens', productStart);
    const productFlow = script.slice(helpersStart, productEnd);

    assert.ok(helpersStart >= 0 && productStart > helpersStart && productEnd > productStart);
    assert.match(productFlow, /paymentMethod === 'pix'/);
    assert.match(productFlow, /selectionKey = await buildStorePixSelectionKey/);
    assert.match(productFlow, /getStorePixPending\(productId,\s*selectionKey\)/);
    assert.match(productFlow, /getStorePixPendingByReference\(externalReference\)/);
    assert.match(productFlow, /createOrResumeStorePix\(existingPix, cfg, formSnapshot\)/);
    assert.match(productFlow, /createOrResumeStorePix\(pending, cfg, formSnapshot\)/);
    assert.match(productFlow, /pendingByReference/);
    assert.match(productFlow, /external_reference: pending\.externalReference/);
    assert.match(productFlow, /create-pix-payment/);
    assert.match(productFlow, /confirm-purchase/);
    assert.match(productFlow, /externalRef = `digital_\$\{docRef\.id\}`/);
    assert.doesNotMatch(productFlow, /Já existe um Pix pendente para/);
    assert.doesNotMatch(productFlow, /getStorePixPending\(productId\)/);
});

test('pending store Pix records preserve distinct selections for the same product', () => {
    const helpersStart = script.indexOf('const STORE_PIX_PENDING_KEY');
    const helpersEnd = script.indexOf('function setStorePixPaymentUi(', helpersStart);
    const helpers = script.slice(helpersStart, helpersEnd);
    const storage = new Map([
        ['xtreino_store_pix_pending_user-1', JSON.stringify({
            version: 2,
            userId: 'user-1',
            pendingByProduct: {
                'passe-booyah': {
                    productId: 'passe-booyah',
                    externalReference: 'digital_booyah_order',
                    amount: 8,
                    userId: 'user-1',
                },
            },
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

    assert.equal(context.getPending('passe-booyah', 'unknown-selection'), null);
    assert.equal(context.getByReference('digital_booyah_order').productId, 'passe-booyah');

    context.savePending({
        productId: 'sensibilidade',
        externalReference: 'digital_sensibilidade_order',
        selectionKey: 'sensibilidade-android',
        amount: 3,
    });

    assert.equal(context.getPending('passe-booyah', 'unknown-selection'), null);
    assert.equal(context.getPending('sensibilidade', 'sensibilidade-android').externalReference, 'digital_sensibilidade_order');
    assert.equal(context.getByReference('digital_sensibilidade_order').productId, 'sensibilidade');

    context.clearPending('digital_booyah_order');
    assert.equal(context.getByReference('digital_booyah_order'), null);
    assert.equal(context.getPending('sensibilidade', 'sensibilidade-android').externalReference, 'digital_sensibilidade_order');

    context.savePending({
        productId: 'imagens-aereas',
        externalReference: 'digital_aereas_one_map',
        selectionKey: 'aereas-one-map',
        amount: 2,
    });
    context.savePending({
        productId: 'imagens-aereas',
        externalReference: 'digital_aereas_three_maps',
        selectionKey: 'aereas-three-maps',
        amount: 5,
    });
    assert.equal(context.getPending('imagens-aereas', 'aereas-one-map').externalReference, 'digital_aereas_one_map');
    assert.equal(context.getPending('imagens-aereas', 'aereas-three-maps').externalReference, 'digital_aereas_three_maps');

    context.clearPending('digital_aereas_one_map');
    assert.equal(context.getPending('imagens-aereas', 'aereas-one-map'), null);
    assert.equal(context.getPending('imagens-aereas', 'aereas-three-maps').externalReference, 'digital_aereas_three_maps');

    const persisted = JSON.parse(storage.get('xtreino_store_pix_pending_user-1'));
    assert.equal(persisted.version, 3);
    assert.deepEqual(Object.keys(persisted.pendingByReference), ['digital_sensibilidade_order', 'digital_aereas_three_maps']);
});

test('a created Pix stays on the schedule screen and blocks duplicate submissions while pending', () => {
    const submitStart = script.indexOf('async function submitSchedule(');
    const submitEnd = script.indexOf('// ===== Helper: busca registrações por eventType', submitStart);
    const submit = script.slice(submitStart, submitEnd);
    const paymentStart = submit.indexOf('// --- CHAMAR MERCADO PAGO ---');
    const paymentFlow = submit.slice(paymentStart);

    assert.ok(submitStart >= 0 && submitEnd > submitStart);
    assert.match(submit, /if\s*\(window\._scheduleSubmitting\)\s*return/);
    assert.match(submit, /currentSelectionKey\s*===\s*window\._schedulePixSelectionKey/);
    assert.match(submit, /getActiveSchedulePixCheckout\(scheduleSelectionKey\)/);
    assert.ok(paymentStart >= 0);
    const assignedSlotsDeclaration = submit.indexOf('let assignedSlotsData = [];');
    const firestoreSaveTry = submit.indexOf('try {', submit.indexOf('// --- SALVAR NO FIRESTORE ---'));
    const pixModalArgsUse = submit.indexOf('(Array.isArray(assignedSlotsData) ? assignedSlotsData : [])');
    assert.ok(assignedSlotsDeclaration >= 0 && assignedSlotsDeclaration < firestoreSaveTry);
    assert.ok(firestoreSaveTry < pixModalArgsUse);
    assert.doesNotMatch(submit, /const assignedSlotsData = \[\]/);
    assert.match(paymentFlow, /renderSchedulePixFallback\(data, cfg, finalPrice\)/);
    assert.match(paymentFlow, /setSchedulePixCheckoutState/);
    assert.doesNotMatch(paymentFlow, /closeScheduleModal\(\)/);
    assert.doesNotMatch(paymentFlow, /Minha Conta/);
});

test('a pending Pix does not block opening a different event or hour checkout', () => {
    const openStart = script.indexOf('function openScheduleModal(');
    const openEnd = script.indexOf('\nfunction closeScheduleModal()', openStart);
    const openFlow = script.slice(openStart, openEnd);
    assert.ok(openStart >= 0 && openEnd > openStart);
    assert.doesNotMatch(openFlow, /if\s*\(window\._schedulePixPending\)/);
    assert.match(openFlow, /prepareSchedulePixForNewCheckout\(\)/);
    assert.match(openFlow, /O Pix anterior continua ativo por até 30 minutos/);

    const helperStart = script.indexOf('let _pixPollingInterval = null;');
    const helperEnd = script.indexOf('function renderSchedulePixFallback', helperStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart);
    const elements = new Map();
    for (const id of ['pixPaymentModal', 'schedSubmit', 'schedPayTokens']) {
        const classes = new Set(id === 'pixPaymentModal' ? ['flex'] : []);
        elements.set(id, {
            classList: {
                add: name => classes.add(name),
                remove: name => classes.delete(name),
                contains: name => classes.has(name),
            },
            disabled: true,
            textContent: '',
        });
    }
    const cleared = [];
    const context = vm.createContext({
        window: { _schedulePixPending: true, _schedulePixPaid: false },
        document: { getElementById: id => elements.get(id) || null },
        clearInterval: id => cleared.push(id),
    });
    vm.runInContext(`${script.slice(helperStart, helperEnd)}
        _pixPollingInterval = 10;
        _pixCountdownInterval = 11;
        globalThis.prepareNewCheckout = prepareSchedulePixForNewCheckout;`, context);

    assert.equal(context.prepareNewCheckout(), true);
    assert.deepEqual(cleared, [10, 11]);
    assert.equal(context.window._schedulePixPending, false);
    assert.equal(context.window._schedulePixPaid, false);
    assert.equal(elements.get('pixPaymentModal').classList.contains('hidden'), true);
    assert.equal(elements.get('pixPaymentModal').classList.contains('flex'), false);
    assert.equal(elements.get('schedSubmit').disabled, false);
    assert.equal(elements.get('schedPayTokens').disabled, false);
});

test('changing an event hour unlocks a new checkout and active selections reuse their existing Pix', () => {
    const helpersStart = script.indexOf('function buildSchedulePixSelectionKey(');
    const helpersEnd = script.indexOf('async function submitSchedule(', helpersStart);
    const helpers = script.slice(helpersStart, helpersEnd);
    assert.ok(helpersStart >= 0 && helpersEnd > helpersStart);

    const context = vm.createContext({
        window: { _schedulePixPending: true, _schedulePixPaid: false },
        selectedDates: [],
        selectedTimes: [{ date: '2026-10-22', schedule: '19h' }],
        scheduleConfig: {},
        document: {
            getElementById: id => id === 'scheduleModal'
                ? { dataset: { eventType: 'modo-liga', adminEventId: '' } }
                : id === 'schedDate' ? { value: '2026-10-22' } : null,
            querySelectorAll: () => [],
        },
        showToast: () => {},
        setSchedulePixCheckoutState: () => {},
    });
    vm.runInContext(`${helpers}
        globalThis.makeKey = buildSchedulePixSelectionKey;
        globalThis.currentKey = getCurrentSchedulePixSelectionKey;
        globalThis.handleSelectionChange = handleSchedulePixSelectionChange;
        globalThis.findActivePix = getActiveSchedulePixCheckout;
        globalThis.rememberPix = rememberSchedulePixCheckout;`, context);

    const oldKey = context.currentKey();
    const expiry = new Date(Date.now() + 60_000).toISOString();
    context.rememberPix(oldKey, 'schedule_old_ref', { expiration_date: expiry }, null);
    assert.equal(context.findActivePix(oldKey).externalReference, 'schedule_old_ref');

    context.window._schedulePixSelectionKey = oldKey;
    context.prepareSchedulePixForNewCheckout = () => {
        context.window._schedulePixPending = false;
        context.window._schedulePixSelectionKey = null;
        return true;
    };
    context.selectedTimes = [{ date: '2026-10-22', schedule: '20h' }];
    context.handleSelectionChange();

    assert.equal(context.window._schedulePixPending, false);
    assert.equal(context.window._schedulePixSelectionKey, null);
    assert.notEqual(context.currentKey(), oldKey);
    assert.equal(context.findActivePix(oldKey).externalReference, 'schedule_old_ref');
});

test('approved event Pix closes checkout and opens the slot confirmation with its access reference', () => {
    const helperStart = script.indexOf('function showPaidScheduleConfirmation(');
    const helperEnd = script.indexOf('\nwindow.openPixModal =', helperStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart);

    const classes = new Set(['flex']);
    const pixModal = {
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
        },
    };
    const calls = [];
    const context = vm.createContext({
        document: { getElementById: id => id === 'pixPaymentModal' ? pixModal : null },
        closeScheduleModal: () => calls.push({ action: 'close-checkout' }),
        showSlotConfirmationModal: (...args) => calls.push({ action: 'show-confirmation', args }),
    });
    vm.runInContext(`${script.slice(helperStart, helperEnd)}
        globalThis.confirmPaid = showPaidScheduleConfirmation;`, context);

    const slots = [{ team: 'Equipe teste', schedule: '16h', slotNum: 1 }];
    assert.equal(context.confirmPaid(slots, {
        label: 'TREINO FREITAS',
        eventType: 'treino-freitas',
        isLiga: false,
    }, 'schedule_ref_1'), true);

    assert.ok(classes.has('hidden'));
    assert.ok(!classes.has('flex'));
    assert.equal(calls[0].action, 'show-confirmation');
    assert.equal(calls[1].action, 'close-checkout');
    assert.deepEqual(calls[0].args, [slots, 'TREINO FREITAS', false, 'treino-freitas', null, 'schedule_ref_1']);
});

test('schedule Pix invokes slot confirmation only for a server-confirmed payment', () => {
    assert.ok(script.includes("authenticatedPaymentFetch('/.netlify/functions/confirm-purchase'"));
    assert.match(
        script,
        /if \(data\.status === 'paid' \|\| data\.status === 'already_paid'\) \{\s*await confirmPaid\(\);/
    );
    assert.match(script, /const confirmPaid = async \(\) => \{[\s\S]*?if \(typeof onPaid === 'function'\) await onPaid\(\);/);
    assert.match(script, /if \(pixConfirmationHandled\) return;/);
    assert.match(script, /showPaidScheduleConfirmation\(assignedSlotsData, cfg, externalRef\)/);
    const confirmationStart = script.indexOf('_pixConfirmFn = async () => {');
    const confirmationEnd = script.indexOf('\n    };', confirmationStart);
    const confirmationHandler = script.slice(confirmationStart, confirmationEnd);
    assert.ok(
        confirmationHandler.indexOf('showPaidScheduleConfirmation(')
        < confirmationHandler.indexOf('assignedSlotsData.map'),
        'show the confirmation before rendering optional QR details'
    );
});

test('event Pix is checked automatically and resumes when the tab is visible', () => {
    assert.doesNotMatch(html, /pixCheckStatusBtn|Já paguei — verificar agora/);
    assert.doesNotMatch(script, /pixCheckStatusBtn|checkPixPaymentStatusNow|_pixManualCheckFn/);
    assert.match(script, /document\.addEventListener\?\.\('visibilitychange', _pixVisibilityHandler\)/);
    assert.match(script, /startSchedulePixFallbackStatusChecks\(externalRef, assignedSlotsData, cfg\)/);
    assert.match(script, /data\.status === 'needs_review'/);
});

test('automatic Pix checks continue during review and after tab resume', async () => {
    const helperStart = script.indexOf('function clearSchedulePixStatusPolling(');
    const helperEnd = script.indexOf('\nfunction setSchedulePixCheckoutState', helperStart);
    const helpers = script.slice(helperStart, helperEnd);
    const elements = new Map([
        ['pixStatusText', { textContent: 'Aguardando pagamento...' }],
    ]);
    const listeners = new Map();
    const responses = [
        { status: 'needs_review', ok: false },
        { status: 'pending', ok: true },
        { status: 'paid', ok: true },
    ];
    const requests = [];
    const timerCalls = [];
    let nextTimerId = 1;
    const context = vm.createContext({
        window: {},
        document: {
            hidden: true,
            getElementById: id => elements.get(id) || null,
            addEventListener: (name, handler) => listeners.set(name, handler),
            removeEventListener: (name, handler) => {
                if (listeners.get(name) === handler) listeners.delete(name);
            },
        },
        setInterval: (fn, delay) => {
            timerCalls.push({ id: nextTimerId, fn, delay });
            return nextTimerId++;
        },
        clearInterval: id => timerCalls.push({ cleared: id }),
        authenticatedPaymentFetch: async (_url, options) => {
            requests.push(JSON.parse(options.body));
            const response = responses.shift();
            return { ok: response.ok, json: async () => ({ status: response.status }) };
        },
        forgetSchedulePixCheckout: () => {},
        setSchedulePixCheckoutState: () => {},
    });
    vm.runInContext(`
        let _pixPollingInterval = null;
        let _pixVisibilityHandler = null;
        let _pixFirestoreUnsubscribe = null;
        let _pixStatusPollingGeneration = 0;
        ${helpers}
        globalThis.paidCalls = 0;
    `, context);

    await context.startSchedulePixStatusChecks('ref_automatic_visibility', async () => {
        context.paidCalls += 1;
    });
    assert.match(elements.get('pixStatusText').textContent, /Pagamento em conferência/);
    assert.ok(!timerCalls.some(call => call.cleared === 1), 'review status should not stop automatic polling');

    timerCalls.find(call => call.delay === 5000).fn();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get('pixStatusText').textContent, 'Aguardando seu pagamento');
    context.document.hidden = false;
    await listeners.get('visibilitychange')();

    assert.equal(requests.length, 3);
    assert.deepEqual(requests, [
        { external_reference: 'ref_automatic_visibility' },
        { external_reference: 'ref_automatic_visibility' },
        { external_reference: 'ref_automatic_visibility' },
    ]);
    assert.equal(context.paidCalls, 1);
    assert.ok(timerCalls.some(call => call.delay === 5000));
    assert.ok(timerCalls.some(call => call.cleared === 1));
    assert.equal(listeners.has('visibilitychange'), false);
});

test('a paid Firestore registration wakes the open Pix modal and confirms once', async () => {
    const helperStart = script.indexOf('function clearSchedulePixStatusPolling(');
    const helperEnd = script.indexOf('\nfunction setSchedulePixCheckoutState', helperStart);
    const helpers = script.slice(helperStart, helperEnd);
    const listeners = new Map();
    const snapshots = [];
    const responses = [
        { status: 'pending', ok: true },
        { status: 'paid', ok: true },
    ];
    const requests = [];
    const timerCalls = [];
    let nextTimerId = 1;
    let unsubscribeCount = 0;
    const context = vm.createContext({
        window: { firebaseDb: {} },
        document: {
            hidden: false,
            getElementById: () => null,
            addEventListener: (name, handler) => listeners.set(name, handler),
            removeEventListener: (name, handler) => {
                if (listeners.get(name) === handler) listeners.delete(name);
            },
        },
        setInterval: (fn, delay) => {
            timerCalls.push({ id: nextTimerId, fn, delay });
            return nextTimerId++;
        },
        clearInterval: id => timerCalls.push({ cleared: id }),
        loadSchedulePixFirestoreApi: async () => ({
            collection: (_db, path) => path,
            where: (...args) => args,
            query: (collection, constraint) => ({ collection, constraint }),
            onSnapshot: (_query, onNext) => {
                snapshots.push(onNext);
                return () => { unsubscribeCount += 1; };
            },
        }),
        authenticatedPaymentFetch: async (_url, options) => {
            requests.push(JSON.parse(options.body));
            const response = responses.shift();
            return { ok: response.ok, json: async () => ({ status: response.status }) };
        },
        forgetSchedulePixCheckout: () => {},
        setSchedulePixCheckoutState: () => {},
        console: { warn: () => {} },
    });
    vm.runInContext(`
        let _pixPollingInterval = null;
        let _pixVisibilityHandler = null;
        let _pixFirestoreUnsubscribe = null;
        let _pixStatusPollingGeneration = 0;
        ${helpers}
        globalThis.paidCalls = 0;
    `, context);

    await context.startSchedulePixStatusChecks('ref_firestore_wakeup', async () => {
        context.paidCalls += 1;
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(snapshots.length, 1);
    snapshots[0]({ docs: [{ data: () => ({ status: 'paid' }) }] });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(requests.length, 2);
    assert.deepEqual(requests, [
        { external_reference: 'ref_firestore_wakeup' },
        { external_reference: 'ref_firestore_wakeup' },
    ]);
    assert.equal(context.paidCalls, 1);
    assert.equal(unsubscribeCount, 1);
    assert.equal(listeners.has('visibilitychange'), false);
});

test('reopening a saved Pix uses automatic checks when the full modal fails', () => {
    const helperStart = script.indexOf('function renderAndTrackExistingSchedulePix(');
    const helperEnd = script.indexOf('\nfunction handleSchedulePixSelectionChange', helperStart);
    const helper = script.slice(helperStart, helperEnd);
    const calls = [];
    const context = vm.createContext({
        renderSchedulePixFallback: (...args) => calls.push({ action: 'render', args }),
        startSchedulePixFallbackStatusChecks: (...args) => calls.push({ action: 'poll', args }),
    });
    vm.runInContext(`${helper}\nglobalThis.restore = renderAndTrackExistingSchedulePix;`, context);
    const slotData = [{ time: '19h' }];
    const cfg = { label: 'Treino Freitas' };
    context.restore({
        externalReference: 'ref_reopened',
        pixData: { qr_code: 'pix-code' },
        modalArgs: [{ qr_code: 'fallback-code' }, [], 'ref_args', slotData, cfg, 1],
    });

    assert.deepEqual(calls.map(call => call.action), ['render', 'poll']);
    assert.equal(calls[0].args[0].qr_code, 'pix-code');
    assert.deepEqual(calls[0].args.slice(1), [cfg, 1]);
    assert.deepEqual(calls[1].args, ['ref_reopened', slotData, cfg]);
    assert.ok(script.includes('renderAndTrackExistingSchedulePix(existingCheckout)'));
    assert.ok(script.includes('renderAndTrackExistingSchedulePix(existingSchedulePix)'));
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
