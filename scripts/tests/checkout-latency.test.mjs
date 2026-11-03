import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../artifacts/xtreino/public/script.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../../artifacts/xtreino/public/index.html', import.meta.url), 'utf8');
const availabilityMessagesStart = source.indexOf('function getAvailabilityFailureMessage(');
const availabilityMessagesEnd = source.indexOf('async function checkMultipleSlotAvailability(', availabilityMessagesStart);
const availabilityMessages = source.slice(availabilityMessagesStart, availabilityMessagesEnd);
function extract(name, next) {
    const start = source.indexOf(`async function ${name}(`);
    return source.slice(start, source.indexOf(next, start));
}
const availabilityCheck = extract('checkMultipleSlotAvailability', 'async function updateOccupiedAndRefreshButtons');
const buttonOrderStart = source.indexOf('function setSchedulePaymentButtonOrder(');
const buttonOrderEnd = source.indexOf('\nfunction _updateFreeSlotPaymentUI', buttonOrderStart);
const buttonOrderFunction = source.slice(buttonOrderStart, buttonOrderEnd);
const tokens = extract('useTokensForEvent', 'async function loadCampSemifinalLinksFromFirestore');
const registrations = extract('createRegistrationsForEvent', '// --- Edição de Perfil ---')
    .replace(/await import\('https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-firestore\.js'\)/g, 'sdk');
const slotAllocator = extract('allocateSlotsFromDB', '// ===== Helper: calcula o texto do slot')
    .replace(/await import\('https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-firestore\.js'\)/g, 'sdk');
const selected = [{ date: '2026-10-13', schedule: 'Terça - 19h' }];
const team = [{ name: 'Equipe teste', email: 'teste@example.test', phone: '11999999999' }];
const allocation = {
    slotCountsByHour: { '19': 0 },
    maxSlotsByHour: { '19': 0 },
    duplicateCounts: [{ '19': 0 }],
};
const scheduleConfig = {
    'modo-liga': { label: 'MODO LIGA', price: 3, modo: 'LIGA', vagas: 12, grupos: 1 },
};
function setup(overrides = {}) {
    const calls = [];
    const context = {
        console, appliedScheduleCoupon: null, scheduleOriginalTotal: 3,
        scheduleConfig, scheduleCache: {},
        getActiveScheduleConfig: eventType => scheduleConfig[eventType],
        getActiveEventRegistrationMetadata: () => ({}),
        canSpendTokens: () => true,
        checkMultipleSlotAvailability: async () => { calls.push('check'); return { available: true, allocation }; },
        createRegistrationsForEvent: async () => { calls.push('persist'); return { regIds: ['r1'], assignedSlots: [{ team: 'Equipe teste', schedule: '19h' }] }; },
        payOrderWithTokens: async () => { calls.push('debit'); },
        closeScheduleModal: () => { calls.push('close'); },
        showSlotConfirmationModal: () => { calls.push('confirm'); },
        showErrorToast: () => { calls.push('error'); },
        showSuccessToast: () => {},
        ...overrides,
    };
    vm.createContext(context);
    new vm.Script(tokens).runInContext(context);
    return { context, calls };
}
const verified = {
    eventType: 'modo-liga',
    numberOfTeams: 1,
    timesByDate: { '2026-10-13': ['Terça - 19h'] },
    allocationByDate: { '2026-10-13': allocation },
};

test('availability failures explain auth, timeout, and server outages without allowing checkout', () => {
    const context = {};
    vm.createContext(context);
    new vm.Script(availabilityMessages).runInContext(context);
    assert.match(context.getAvailabilityFailureMessage(401), /sessão não foi reconhecida/);
    assert.match(context.getAvailabilityFailureMessage(403), /não está autorizada/);
    assert.match(context.getAvailabilityFailureMessage(503), /serviço de confirmação de vagas está indisponível/);
    assert.match(context.getAvailabilityFailureMessage(0, { name: 'AbortError' }), /demorou mais que o esperado/);
    assert.match(context.getAvailabilityFailureMessage(0, new Error('network failed')), /Verifique sua conexão/);
    assert.match(indexHtml, /script\.js\?v=booking-allocation-server-1/);
});

test('availability client sends team candidates and fails closed without allocation data', async () => {
    let requestBody;
    let responseBody = {
        available: true,
        allocation: {
            slotCountsByHour: { '19': 0 },
            maxSlotsByHour: { '19': 0 },
            duplicateCounts: [{ '19': 0 }],
        },
    };
    const context = {
        AbortController, setTimeout, clearTimeout, console,
        document: { getElementById: () => ({ dataset: {} }) },
        authenticatedPaymentFetch: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return { ok: true, json: async () => responseBody };
        },
        logError: () => {},
    };
    vm.createContext(context);
    new vm.Script(availabilityMessages + availabilityCheck).runInContext(context);

    const result = await context.checkMultipleSlotAvailability(
        '2026-10-13',
        ['Terça - 19h'],
        'modo-liga',
        1,
        [{ name: 'Equipe teste', email: 'TESTE@example.test' }],
    );
    assert.equal(result.available, true);
    assert.deepEqual(requestBody.teamCandidates, [{ name: 'Equipe teste', email: 'teste@example.test' }]);

    responseBody = { available: true };
    const incomplete = await context.checkMultipleSlotAvailability(
        '2026-10-13', ['Terça - 19h'], 'modo-liga', 1, [{ name: 'Equipe teste', email: 'teste@example.test' }]
    );
    assert.equal(incomplete.available, false);
    assert.match(incomplete.message, /Nenhuma cobrança foi iniciada/);
});

test('event modal puts Pix checkout first and keeps token checkout second', () => {
    const elements = {
        schedPayTokens: { id: 'schedPayTokens' },
        schedSubmit: { id: 'schedSubmit' },
    };
    const container = {
        children: [elements.schedPayTokens, elements.schedSubmit],
        insertBefore(node, reference) {
            this.children.splice(this.children.indexOf(node), 1);
            this.children.splice(this.children.indexOf(reference), 0, node);
        },
    };
    Object.values(elements).forEach(button => { button.parentElement = container; });
    const context = {
        document: { getElementById: id => elements[id] },
    };
    vm.createContext(context);
    new vm.Script(buttonOrderFunction).runInContext(context);

    context.setSchedulePaymentButtonOrder(true);
    assert.deepEqual(container.children.map(button => button.id), ['schedSubmit', 'schedPayTokens']);
    context.setSchedulePaymentButtonOrder(false);
    assert.deepEqual(container.children.map(button => button.id), ['schedPayTokens', 'schedSubmit']);
    assert.match(source, /Gerar QR Code Pix/);
});

const schedulePixHelpersStart = source.indexOf('function buildSchedulePixSelectionKey(');
const schedulePixHelpersEnd = source.indexOf('async function submitSchedule(', schedulePixHelpersStart);
const submission = source.slice(schedulePixHelpersStart, schedulePixHelpersEnd)
    + extract('submitSchedule', '// ===== Helper: busca registrações');
function setupSubmission(result) {
    const calls = [];
    const values = { name: 'Equipe teste', email: 'teste@example.test', phone: '11999999999' };
    const elements = {
        scheduleModal: { dataset: { eventType: 'modo-liga' } },
        schedDate: { value: '2026-10-13' },
        schedSubmit: { disabled: false, textContent: 'Pagar' },
        schedPayTokens: { disabled: false },
    };
    const context = {
        console,
        window: { isLoggedIn: true, _freeHoursMap: {} },
        document: {
            getElementById: id => elements[id],
            querySelectorAll: () => [{
                id: 'team1',
                querySelector: selector => {
                    const field = selector.match(/data-field="(\w+)"/)?.[1];
                    return field ? { value: values[field] } : null;
                },
            }],
        },
        scheduleConfig,
        getActiveScheduleConfig: eventType => scheduleConfig[eventType],
        selectedDates: ['2026-10-13'], selectedTimes: selected, teams: [],
        appliedScheduleCoupon: null,
        isValidScheduleDate: () => true,
        waitForFirebase: async () => { calls.push('ready'); },
        checkMultipleSlotAvailability: async () => { calls.push('check'); return result; },
        getEventPrice: () => 3,
        useTokensForEvent: async (...args) => { calls.push('tokens'); context.proof = args[6]; },
        alert: () => { calls.push('blocked'); },
    };
    vm.createContext(context);
    new vm.Script(submission).runInContext(context);
    return { context, calls, elements };
}

test('event submit uses the server lock/capacity check without duplicate client lock queries', async () => {
    assert.doesNotMatch(submission, /event_global_locks|event_hour_locks|_lockPromise/);
    const { context, calls, elements } = setupSubmission({ available: true, allocation });
    await context.submitSchedule({ preventDefault() {} }, true);
    assert.deepEqual(calls, ['ready', 'check', 'tokens']);
    assert.equal(JSON.stringify(context.proof), JSON.stringify(verified));
    assert.equal(context.window._scheduleSubmitting, false);
    assert.equal(elements.schedPayTokens.disabled, false);
});

test('a server-blocked or failed availability check stops both payment methods before persistence or payment', async () => {
    for (const useTokens of [true, false]) {
        for (const result of [
            { available: false, message: 'Horário bloqueado pelo administrador.' },
            { available: false, message: 'Não foi possível confirmar as vagas.' },
        ]) {
            const { context, calls } = setupSubmission(result);
            await context.submitSchedule({ preventDefault() {} }, useTokens);
            assert.deepEqual(calls, ['ready', 'check', 'blocked']);
            assert.equal(context.window._scheduleSubmitting, false);
        }
    }
});

test('token submit reuses only the same verified selection, persisting before debit and showing confirmation afterward', async () => {
    const { context, calls } = setup();
    await context.useTokensForEvent('modo-liga', 1, 3, team, selected, ['2026-10-13'], verified);
    assert.deepEqual(calls, ['persist', 'debit', 'close', 'confirm']);
});

test('direct token call and changed selections recheck availability; an unavailable slot never persists or debits', async () => {
    for (const proof of [null, { ...verified, numberOfTeams: 2 }, { ...verified, timesByDate: {} }, { ...verified, eventType: 'other' }]) {
        const { context, calls } = setup({ checkMultipleSlotAvailability: async () => ({ available: false }) });
        await context.useTokensForEvent('modo-liga', 1, 3, team, selected, ['2026-10-13'], proof);
        assert.deepEqual(calls, ['error']);
    }
});

test('failed reservation persistence never requests a token debit', async () => {
    const { context, calls } = setup({ createRegistrationsForEvent: async () => { throw new Error('write failed'); } });
    await context.useTokensForEvent('modo-liga', 1, 3, team, selected, ['2026-10-13'], verified);
    assert.deepEqual(calls, ['error']);
});

test('coupon reporting does not block a server-confirmed token booking', async () => {
    const { context, calls } = setup({
        appliedScheduleCoupon: { id: 'c1', code: 'TEST', _origPrice: 5 },
        recordCouponUsage: () => new Promise(() => {}),
    });
    await context.useTokensForEvent('modo-liga', 1, 3, team, selected, ['2026-10-13'], verified);
    assert.deepEqual(calls, ['persist', 'debit', 'close', 'confirm']);
});

test('token reservations use server aggregates without reading other registrations', async () => {
    const writes = [];
    const releases = [];
    let allocationRead;
    const allocationByDate = {
        '2026-10-13': {
            slotCountsByHour: { '19': 0, '20': 0 },
            maxSlotsByHour: { '19': 0, '20': 0 },
            duplicateCounts: [{ '19': 0, '20': 0 }],
        },
    };
    const { context } = setup({
        window: { firebaseDb: {}, firebaseAuth: { currentUser: { uid: 'buyer' } }, currentUserProfile: {} },
        _equipeAtual: null,
        allocateSlotsFromDB: async (type, counts, dates, allocations) => {
            allocationRead = allocations;
            return { 'Terça - 19h': 1, 'Terça - 20h': 1 };
        },
        normalizeHour: value => value,
        getEventPrice: () => 3, computeSlotDisplay: n => `Slot ${n}`,
        getActiveAffiliateCode: () => null,
        createPendingAffiliateSale: async () => {},
        sdk: {
            collection: () => ({}), serverTimestamp: () => 123, query: () => {}, where: () => {}, getDocs: () => {},
            addDoc: (_, payload) => {
                const i = writes.push(payload) - 1;
                return new Promise(resolve => releases.push(() => resolve({ id: `r${i + 1}` })));
            },
        },
    });
    new vm.Script(registrations).runInContext(context);
    const pending = context.createRegistrationsForEvent('modo-liga', ['2026-10-13'], team,
        { '2026-10-13': ['Terça - 19h', 'Terça - 20h'] }, 'tokens_test', 'pending', null, allocationByDate);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(allocationRead, allocationByDate);
    assert.equal(writes.length, 2, 'both writes started before either completed');
    assert.ok(writes.every(p => p.status === 'pending' && p.userId === 'buyer' && !p.paymentStatus));
    releases.reverse().forEach(resolve => resolve());
    const result = await pending;
    assert.deepEqual([...result.regIds], ['r1', 'r2']);
    assert.equal(result.assignedSlots[0].regId, 'r1');
    assert.equal(result.assignedSlots[1].regId, 'r2');
});

test('slot allocation uses server counts and never queries customer registrations', async () => {
    const transaction = { reads: 0, writes: [] };
    const context = {
        window: { firebaseDb: {} },
        sdk: {
            doc: (_db, collection, id) => ({ collection, id }),
            runTransaction: async (_db, callback) => callback({
                get: async () => {
                    transaction.reads++;
                    return { exists: () => false, data: () => ({}) };
                },
                set: (_ref, counts) => transaction.writes.push(counts),
            }),
        },
        console,
    };
    vm.createContext(context);
    new vm.Script(slotAllocator).runInContext(context);
    const starts = await context.allocateSlotsFromDB(
        'modo-liga',
        { 'Terça - 19h': 2 },
        ['2026-10-13'],
        { '2026-10-13': { slotCountsByHour: { '19': 5 } } },
    );
    assert.deepEqual(JSON.parse(JSON.stringify(starts)), { 'Terça - 19h': 6 });
    assert.equal(transaction.reads, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(transaction.writes)), [{ '19h': 7 }]);
});
