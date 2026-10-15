import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const base = '../../artifacts/xtreino/public/';
const source = readFileSync(new URL(`${base}admin.js`, import.meta.url), 'utf8');
const controls = readFileSync(new URL(`${base}js/admin-read-control.js`, import.meta.url), 'utf8');
const html = readFileSync(new URL(`${base}admin.html`, import.meta.url), 'utf8');
const quiet = { error() {}, warn() {}, log() {} };
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
function helpers() {
    const context = vm.createContext({ console: quiet, setTimeout, clearTimeout });
    vm.runInContext(controls, context);
    return context.AdminReadControl;
}
function snippet(start, end) {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, end);
    return source.slice(from, to).replace(
        /await import\('https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-firestore\.js'\)/g,
        'await firebase()',
    );
}
function snapshot(rows) {
    const docs = rows.map((data, i) => ({ id: `row-${i}`, data: () => data }));
    return { docs, forEach: fn => docs.forEach(fn) };
}

test('concurrent and sequential analytics share one read, and expire after 60 seconds', async () => {
    let clock = 0, reads = 0;
    const cache = helpers().createReadCache({ now: () => clock });
    cache.setScope('admin-a');
    const loader = async () => ++reads;
    assert.deepEqual(await Promise.all([cache.read('orders', loader), cache.read('orders', loader)]), [1, 1]);
    assert.equal(await cache.read('orders', loader), 1);
    clock = 60000;
    assert.equal(await cache.read('orders', loader), 2);
    cache.clear();
    assert.equal(await cache.read('orders', loader), 3);
});

test('analytics failures are not cached and sessions do not share in-flight data', async () => {
    const cache = helpers().createReadCache();
    cache.setScope('admin-a');
    await assert.rejects(cache.read('orders', async () => { throw new Error('offline'); }), /offline/);
    assert.equal(await cache.read('orders', async () => 'fresh'), 'fresh');
    const first = deferred();
    const pending = cache.read('registrations', () => first.promise);
    await flush();
    cache.setScope(null);
    cache.setScope('admin-a');
    first.resolve('old session');
    await assert.rejects(pending, /sessão/);
    assert.equal(await cache.read('registrations', async () => 'new session'), 'new session');
});

function pollerHarness(overrides = {}) {
    let visible = true, reads = 0, timerId = 0;
    const timers = new Map(), applied = [], errors = [];
    const poller = helpers().createVisiblePoller({
        isVisible: () => visible,
        read: async () => ++reads,
        apply: value => applied.push(value),
        onError: error => errors.push(error),
        setTimer(fn, delay) { assert.equal(delay, 60000); timers.set(++timerId, fn); return timerId; },
        clearTimer: id => timers.delete(id),
        ...overrides,
    });
    return {
        poller, timers, applied, errors, reads: () => reads,
        visibility(value) { visible = value; poller.sync(); },
        async tick() {
            assert.equal(timers.size, 1);
            const [id, fn] = timers.entries().next().value;
            timers.delete(id); fn(); await flush();
        },
    };
}

test('visible board continues automatic 60-second updates and sees a new paid booking', async () => {
    let occupied = 1;
    const h = pollerHarness({ read: async () => ({ '17:00': occupied }) });
    h.poller.start();
    await h.tick();
    occupied = 2; // Another customer's payment confirms a registration.
    await h.tick();
    assert.deepEqual(h.applied, [{ '17:00': 1 }, { '17:00': 2 }]);
    h.poller.stop();
    assert.equal(h.timers.size, 0);
});

test('hiding the board cancels queries and returning updates immediately', async () => {
    const h = pollerHarness();
    h.poller.start();
    h.visibility(false);
    assert.equal(h.timers.size, 0);
    assert.equal(h.reads(), 0);
    h.visibility(true);
    await flush();
    assert.equal(h.reads(), 1);
    assert.deepEqual(h.applied, [1]);
    assert.equal(h.timers.size, 1);
});

test('slow refreshes never overlap and stopped/replaced boards ignore stale responses', async () => {
    const response = deferred();
    let reads = 0;
    const h = pollerHarness({ read: () => { reads++; return response.promise; } });
    h.poller.start();
    await h.tick();
    h.poller.sync();
    assert.equal(h.timers.size, 0);
    assert.equal(reads, 1);
    h.poller.stop();
    response.resolve('old event');
    await flush();
    assert.deepEqual(h.applied, []);
    assert.equal(h.timers.size, 0);
});

test('failed automatic refresh preserves previous occupancy and schedules a retry', async () => {
    const h = pollerHarness({ read: async () => { throw new Error('offline'); } });
    h.poller.start();
    await h.tick();
    assert.deepEqual(h.applied, []);
    assert.equal(h.errors.length, 1);
    assert.equal(h.timers.size, 1);
});

test('actual report callers share full historical data without truncating legacy purchases', async () => {
    const reads = [];
    const cache = helpers().createReadCache();
    cache.setScope('admin-a');
    const data = {
        registrations: snapshot([{ eventType: 'modo-liga', price: 1, email: 'team', status: 'paid', external_reference: 'one' }]),
        orders: snapshot([
            { type: 'event', external_reference: 'one', amount: 1 },
            { title: 'Legacy product', amount: 2, timestamp: 1, status: 'paid' },
        ]),
    };
    const context = vm.createContext({
        window: {}, console: quiet, Date, activeFilterType: 'all',
        firebase: async () => ({}),
        readAdminReportCollection: name => cache.read(name, async () => { reads.push(name); return data[name]; }),
        resolveEventName: (type, fallback) => type || fallback,
        loadKpis: async () => {},
        renderActiveUsers: async () => {},
    });
    vm.runInContext(snippet('  async function fetchUnifiedOrders()', '  async function loadReports()'), context);
    vm.runInContext(snippet('  async function loadReports()', '  // ===== Paginação de salto'), context);
    const all = [];
    for (const name of ['renderSalesChart', 'renderTopProducts', 'renderPaymentMethodsChart']) {
        context[name] = async () => all.push(await context.fetchUnifiedOrders());
    }
    context.window.renderPopularHours = async () => cache.read('registrations', async () => {
        reads.push('registrations'); return data.registrations;
    });
    await context.loadReports();
    assert.deepEqual(reads.sort(), ['orders', 'registrations']);
    assert.equal(all.length, 3);
    assert.ok(all.every(rows => rows.length === 2 && rows.some(row => row.item === 'Legacy product')));
});

function pageHarness() {
    const calls = [];
    const pages = Object.fromEntries(['principal', 'usuarios', 'financeiro', 'conteudo', 'operacoes']
        .map(name => [name, { hidden: name !== 'principal', classList: { contains() { return pages[name].hidden; } } }]));
    const users = snapshot([{ email: 'member', tokens: 5 }]);
    const window = {
        firebaseDb: {}, firebaseAuth: { currentUser: { uid: 'admin-a' } },
        adminDataReady: true, adminRoleLower: 'ceo',
        loadPrincipalAdminData: async () => calls.push(['principal']),
        loadDynamicEventsIntoBoard: async () => calls.push(['events']),
    };
    const context = vm.createContext({
        window, console: quiet, Date,
        document: { getElementById: id => pages[id.slice(5)] },
        _couponUsageUnsubscribe: null,
        stopCouponUsage() {},
        firebase: async () => ({
            collection: (db, name) => name,
            getDocs: async name => { calls.push(['read', name]); return users; },
        }),
        showToast: (...args) => calls.push(['error', ...args]),
    });
    for (const name of [
        'loadUsersForTables', 'loadPermissionsUsers', 'loadTokensUsers', 'loadAdminHistory',
        'setupRoleGuards', 'loadCoupons', 'loadCouponUsage', 'loadAffiliates', 'loadAffiliateSales',
        'loadAffiliatePayouts', 'loadPasseBooyahControls', 'setupCouponUsageFilters',
        'loadHighlights', 'loadNews', 'loadProducts', 'loadEventsPreview', 'loadShirtOrders',
    ]) context[name] = async (...args) => calls.push([name, ...args]);
    vm.runInContext(snippet('// Coalesce navigation requests', '// ===== LIMPEZA: remover inscrições'), context);
    return {
        context, window, calls, users,
        show(name) { Object.entries(pages).forEach(([key, page]) => { page.hidden = key !== name; }); },
    };
}

test('actual navigation loads only the active page after authorization, with no hidden-user/finance reads', async () => {
    const h = pageHarness();
    h.window.adminDataReady = false;
    await h.window.loadPageData('principal');
    assert.equal(h.calls.length, 0);
    h.window.adminDataReady = true;
    await h.window.loadPageData('usuarios'); // Hidden page is not queried.
    assert.equal(h.calls.length, 0);
    await h.window.loadPageData('principal');
    assert.deepEqual(h.calls, [['principal']]);
    await h.window.loadPageData('principal');
    assert.equal(h.calls.length, 1);
    h.show('usuarios');
    await h.window.loadPageData('usuarios');
    assert.equal(h.calls.filter(call => call[0] === 'read').length, 1);
    for (const name of ['loadUsersForTables', 'loadPermissionsUsers', 'loadTokensUsers']) {
        assert.equal(h.calls.find(call => call[0] === name)[1], h.users);
    }
    assert.ok(!h.calls.some(call => ['loadCoupons', 'loadAffiliates'].includes(call[0])));
});

test('concurrent navigation coalesces and failed pages can be retried', async () => {
    const h = pageHarness(), response = deferred();
    let reads = 0;
    h.window.loadPrincipalAdminData = async () => { reads++; return response.promise; };
    const first = h.window.loadPageData('principal');
    const second = h.window.loadPageData('principal');
    assert.equal(reads, 1);
    response.resolve();
    await Promise.all([first, second]);
    h.window._adminPages.initialized.clear();
    h.window.loadPrincipalAdminData = async () => { throw new Error('offline'); };
    await h.window.loadPageData('principal');
    assert.equal(h.window._adminPages.initialized.has('principal'), false);
    h.window.loadPrincipalAdminData = async () => reads++;
    await h.window.loadPageData('principal');
    assert.equal(h.window._adminPages.initialized.has('principal'), true);
});

test('actual coupon listener runs only on the visible financial page and cancels pending subscriptions', async () => {
    let financial = false, hidden = false, subscriptions = 0, stopped = 0;
    let sdk = null;
    const firebase = {
        collection: (db, name) => name, query: value => value,
        onSnapshot() { subscriptions++; return () => stopped++; },
    };
    const context = vm.createContext({
        window: {
            firebaseDb: {}, firebaseAuth: { currentUser: { uid: 'admin-a' } }, adminDataReady: true,
            _adminPages: { initialized: new Set(['financeiro']) }, addEventListener() {},
        },
        document: {
            get visibilityState() { return hidden ? 'hidden' : 'visible'; },
            addEventListener() {},
            getElementById: id => ({ classList: { contains: () => id === 'page-financeiro' ? !financial : false } }),
        },
        console: quiet,
        firebase: async () => sdk ? sdk.promise : firebase,
    });
    vm.runInContext(snippet('let _couponUsageUnsubscribe =', '// Carregar cupons'), context);
    vm.runInContext(snippet('async function loadCouponUsage()', '// Popular select de cupons'), context);
    await context.loadCouponUsage();
    assert.equal(subscriptions, 0);
    financial = true;
    context.syncCouponUsageVisibility();
    await flush();
    assert.equal(subscriptions, 1);
    hidden = true;
    context.syncCouponUsageVisibility();
    assert.equal(stopped, 1);
    hidden = false;
    context.syncCouponUsageVisibility();
    await flush();
    assert.equal(subscriptions, 2);
    financial = false;
    context.syncCouponUsageVisibility();
    assert.equal(stopped, 2);
    financial = true;
    sdk = deferred();
    const pending = context.loadCouponUsage();
    await flush();
    financial = false;
    context.syncCouponUsageVisibility();
    sdk.resolve(firebase);
    await pending;
    assert.equal(subscriptions, 2);
});

test('actual board query narrows to date and event aliases and does not invent free slots on failure', async () => {
    const queries = [];
    let fail = null;
    const context = vm.createContext({
        window: { firebaseDb: {} }, console: quiet,
        firebase: async () => ({
            collection: (db, name) => name,
            where: (...args) => args,
            query: (...args) => args,
            getDocs: async query => {
                queries.push(query);
                if (fail) { const error = fail; fail = null; throw error; }
                return snapshot([
                    { eventType: 'modo-liga', status: 'paid', schedule: 'Quinta - 17h' },
                    { eventType: 'legacy-liga', status: 'confirmed', schedule: 'Quinta - 17h' },
                    { eventType: 'treino', status: 'paid', schedule: 'Quinta - 17h' },
                    { eventType: 'modo-liga', status: 'pending', schedule: 'Quinta - 17h' },
                ]);
            },
        }),
    });
    vm.runInContext(snippet('  let boardIndexUnavailable =', '  // Busca e normaliza horário'), context);
    const fetch = () => context.fetchRegistrationsByDate('2026-10-15', 'modo-liga', 'legacy-liga', 'modo-liga');
    assert.equal((await fetch())['17:00'], 2);
    assert.equal(queries[0][1][0], 'date');
    assert.equal(queries[0][2][0], 'eventType');
    assert.equal(queries[0][2][2].length, 2); // Deduplicated aliases.
    fail = Object.assign(new Error('missing index'), { code: 'failed-precondition' });
    await fetch();
    assert.equal(queries.at(-1).length, 2); // Compatible daily-query fallback.
    fail = Object.assign(new Error('offline'), { code: 'unavailable' });
    await assert.rejects(fetch(), /offline/);
});

test('automatic startup scans are removed and board keeps manual overrides on live refresh', () => {
    assert.ok(!source.includes('testFirestorePermissions'));
    assert.ok(!source.includes('cleanupTestRegistrations'));
    assert.ok(!source.includes('_boardRefreshInterval'));
    const init = snippet('  async function initAdmin()', '  // Start admin panel');
    assert.ok(!init.includes('setTimeout'));
    assert.ok(html.indexOf('js/admin-read-control.js') < html.indexOf('src="admin.js"'));
    assert.ok(html.includes("new Event('admin:pagechange')"));
    const applied = [];
    const context = vm.createContext({
        overridesMap: { '17:00': { extraOccupied: 2 }, '18:00': { lockedAny: true } },
        document: {
            querySelectorAll: () => ['17:00', '18:00'].map(hour => ({
                dataset: { boardCount: hour, boardCap: '12' }, style: {},
                set textContent(value) { applied.push([hour, value]); },
            })),
        },
        setTimeout() {},
    });
    const apply = snippet('        apply: freshOcc => {', '        onError: error =>')
        .trim().replace(/^apply: /, '').replace(/,$/, '');
    vm.runInContext(`globalThis.apply = ${apply};`, context);
    context.apply({ '17:00': 3, '18:00': 1 });
    assert.deepEqual(applied, [['17:00', 'Restam 7'], ['18:00', 'Lotado']]);
});
