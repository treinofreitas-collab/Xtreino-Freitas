import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const adminDir = new URL('../../artifacts/xtreino/public/', import.meta.url);
const source = readFileSync(new URL('admin.js', adminDir), 'utf8');
const html = readFileSync(new URL('admin.html', adminDir), 'utf8');
const styles = readFileSync(new URL('admin-styles.css', adminDir), 'utf8');

function extract(start, end) {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `missing source marker: ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `missing source marker: ${end}`);
    return source.slice(from, to);
}

function helpers() {
    const context = vm.createContext({});
    vm.runInContext([
        extract('function getMonthSalesPeriod(', 'function shiftMonthSalesDate('),
        extract('function shiftMonthSalesDate(', 'function buildMonthSalesSummary('),
        extract('function buildMonthSalesSummary(', 'let selectedMonthSalesDate')
    ].join('\n'), context);
    return context;
}

function snapshot(rows) {
    const docs = rows.map((data, index) => ({
        id: `row-${index}`,
        data: () => data
    }));
    return { docs, forEach: callback => docs.forEach(callback) };
}

test('faturamento mensal soma vendas confirmadas sem duplicar pagamentos com tokens ou eventos', () => {
    const h = helpers();
    const period = h.getMonthSalesPeriod(new Date(2026, 9, 15));
    const registrations = snapshot([
        { status: 'approved', price: 20, createdAt: new Date(2026, 9, 2, 12) },
        { status: 'pending', price: 90, createdAt: new Date(2026, 9, 3, 12) },
        { status: 'confirmed', price: 10, paidWithTokens: true, createdAt: new Date(2026, 9, 3, 12) },
        { status: 'paid', price: 30, createdAt: new Date(2026, 8, 30, 12) },
    ]);
    const orders = snapshot([
        { status: 'paid', amount: 5, createdAt: new Date(2026, 9, 2, 18) },
        { status: 'approved', type: 'event', amount: 40, createdAt: new Date(2026, 9, 3, 12) },
        { status: 'confirmed', amount: 8, paidWithTokens: true, createdAt: new Date(2026, 9, 3, 12) },
        { status: 'refunded', amount: 50, createdAt: new Date(2026, 9, 4, 12) },
    ]);

    const result = h.buildMonthSalesSummary(registrations, orders, period);
    assert.equal(result.total, 25);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].label, '02/10');
    assert.equal(result.entries[0].amount, 25);
});

test('navegação permite meses anteriores e não avança além do mês atual', () => {
    const h = helpers();
    const now = new Date(2026, 9, 15);
    const current = new Date(2026, 9, 1);
    const previous = h.shiftMonthSalesDate(current, -1, now);
    const attemptedFuture = h.shiftMonthSalesDate(current, 1, now);

    assert.equal(h.getMonthSalesPeriod(previous).key, '2026-09');
    assert.equal(h.getMonthSalesPeriod(attemptedFuture).key, '2026-10');
});

test('cada mês selecionado consulta só o intervalo escolhido e reutiliza o cache do KPI', async () => {
    const collectionLoader = extract('async function loadMonthSalesCollection(', 'async function loadKpis(')
        .replace(
            /await import\('https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-firestore\.js'\)/,
            'await firebase()',
        );
    const monthLoader = extract('async function loadMonthSalesData(', 'function updateMonthSalesNavigation(');
    const whereCalls = [];
    let cacheKey = '';
    let queryValue;
    const context = vm.createContext({
        window: {
            firebaseAuth: { currentUser: { uid: 'admin-a' } },
            firebaseDb: { id: 'db' },
        },
        adminReportCache: {
            setScope(uid) { assert.equal(uid, 'admin-a'); },
            read(key, loader) { cacheKey = key; return loader(); },
        },
        firebase: async () => ({
            collection: (db, name) => ({ db, name }),
            where: (...args) => { whereCalls.push(args); return { where: args }; },
            query: (collection, ...constraints) => ({ collection, constraints }),
            getDocsFromServer: async value => { queryValue = value; return { docs: [] }; },
        }),
    });
    vm.runInContext(collectionLoader, context);

    const period = { key: '2026-10', start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) };
    await context.loadMonthSalesCollection(period, 'orders');

    assert.equal(cacheKey, 'month-sales:2026-10:orders');
    assert.equal(queryValue.collection.name, 'orders');
    assert.deepEqual(whereCalls, [
        ['createdAt', '>=', period.start],
        ['createdAt', '<', period.end],
    ]);
    assert.match(monthLoader, /loadMonthSalesCollection\(period, 'registrations'\)/);
    assert.match(monthLoader, /loadMonthSalesCollection\(period, 'orders'\)/);
    assert.match(source.slice(source.indexOf('async function loadKpis()'), source.indexOf('function getMonthSalesPeriod(')), /loadMonthSalesCollection\(monthPeriod, 'orders'\)/);
    assert.match(source.slice(source.indexOf('async function loadKpis()'), source.indexOf('function getMonthSalesPeriod(')), /loadMonthSalesCollection\(monthPeriod, 'registrations'\)/);
});

test('modal mensal fica fora do grid dos indicadores e tem overlay responsivo', () => {
    const modalIndex = html.indexOf('<div id="monthSalesModal"');
    const slotsModalIndex = html.indexOf('<div id="eventSlotsModal"');
    assert.ok(modalIndex > slotsModalIndex, 'modal fica fora do grid do dashboard');
    assert.match(html, /id="monthSalesPreviousBtn"/);
    assert.match(html, /id="monthSalesNextBtn"/);
    assert.match(html, /id="monthSalesCurrentBtn"/);
    assert.match(styles, /#monthSalesModal\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
    assert.match(styles, /#monthSalesModal:not\(\[hidden\]\)\s*\{[^}]*position:\s*fixed\s*!important/s);
});
