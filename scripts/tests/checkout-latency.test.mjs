import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../artifacts/xtreino/public/script.js', import.meta.url), 'utf8');
function extract(name, next) {
    const start = source.indexOf(`async function ${name}(`);
    return source.slice(start, source.indexOf(next, start));
}
const tokens = extract('useTokensForEvent', 'async function loadCampSemifinalLinksFromFirestore');
const registrations = extract('createRegistrationsForEvent', '// --- Edição de Perfil ---')
    .replace(/await import\('https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-firestore\.js'\)/g, 'sdk');
const selected = [{ date: '2026-10-13', schedule: 'Terça - 19h' }];
const team = [{ name: 'Equipe teste', email: 'teste@example.test', phone: '11999999999' }];
function setup(overrides = {}) {
    const calls = [];
    const context = {
        console, appliedScheduleCoupon: null, scheduleOriginalTotal: 3,
        scheduleConfig: { 'modo-liga': { label: 'MODO LIGA', price: 3 } }, scheduleCache: {},
        canSpendTokens: () => true,
        checkMultipleSlotAvailability: async () => { calls.push('check'); return { available: true }; },
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
const verified = { eventType: 'modo-liga', numberOfTeams: 1, timesByDate: { '2026-10-13': ['Terça - 19h'] } };

const submission = extract('submitSchedule', '// ===== Helper: busca registrações');
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
        scheduleConfig: { 'modo-liga': { label: 'MODO LIGA', price: 3 } },
        selectedDates: ['2026-10-13'], selectedTimes: selected, teams: [],
        appliedScheduleCoupon: null,
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
    const { context, calls, elements } = setupSubmission({ available: true });
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

test('token reservations share a date-scoped read with allocation and persist concurrently in stable order', async () => {
    let reads = 0;
    const writes = [];
    const releases = [];
    let allocationRead;
    const { context } = setup({
        window: { firebaseDb: {}, firebaseAuth: { currentUser: { uid: 'buyer' } }, currentUserProfile: {} },
        _equipeAtual: null,
        fetchRegistrationDocsForDates: async (type, dates) => {
            reads++; assert.equal(type, 'modo-liga'); assert.deepEqual([...dates], ['2026-10-13']);
            return [];
        },
        allocateSlotsFromDB: async (type, counts, dates, promise) => {
            allocationRead = await promise;
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
        { '2026-10-13': ['Terça - 19h', 'Terça - 20h'] }, 'tokens_test');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(reads, 1);
    assert.deepEqual(allocationRead, []);
    assert.equal(writes.length, 2, 'both writes started before either completed');
    assert.ok(writes.every(p => p.status === 'pending' && p.userId === 'buyer' && !p.paymentStatus));
    releases.reverse().forEach(resolve => resolve());
    const result = await pending;
    assert.deepEqual([...result.regIds], ['r1', 'r2']);
    assert.equal(result.assignedSlots[0].regId, 'r1');
    assert.equal(result.assignedSlots[1].regId, 'r2');
});
