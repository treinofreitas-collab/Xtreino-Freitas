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
    const context = vm.createContext({
        resolveAdminEventName: data => data.eventName || data.eventType || data.title || 'Evento',
        normalizeProductName: value => String(value || 'Produto'),
        formatAdminEventPurchaseLabel: data => {
            const name = data.eventName || data.eventType || data.title || 'Evento';
            const schedule = data.schedule || data.hour || '';
            return `${name}${schedule ? ` — ${schedule}` : ''}`;
        },
        escapePendingHtml: value => String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[character]),
        brl: value => `R$ ${Number(value || 0).toFixed(2)}`,
    });
    vm.runInContext([
        extract('function getMonthSalesPeriod(', 'function shiftMonthSalesDate('),
        extract('function shiftMonthSalesDate(', 'function buildMonthSalesSummary('),
        extract('function collectMonthSalesRows(', 'let selectedMonthSalesDate'),
        extract('function renderMonthSalesDayDetail(', 'async function openMonthSalesDay(')
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
    assert.equal(result.entries[0].saleCount, 2);
});

test('detalhes do dia agrupam reservas por pagamento e dividem eventos de produtos', () => {
    const h = helpers();
    const period = h.getMonthSalesPeriod(new Date(2026, 9, 15));
    const registrations = snapshot([
        { status: 'approved', price: 20, external_reference: 'checkout-a', eventType: 'treino-freitas', schedule: '18h', teamName: 'Time A', createdAt: new Date(2026, 9, 11, 18, 5) },
        { status: 'approved', price: 10, external_reference: 'checkout-a', eventType: 'treino-freitas', schedule: '19h', teamName: 'Time A', createdAt: new Date(2026, 9, 11, 18, 5) },
        { status: 'pending', price: 100, external_reference: 'pending', eventType: 'modo-liga', createdAt: new Date(2026, 9, 11, 19) },
        { status: 'paid', price: 50, paidWithTokens: true, external_reference: 'tokens', eventType: 'treino-freitas', createdAt: new Date(2026, 9, 11, 20) },
        { status: 'paid', price: 0, isFreeEvent: true, external_reference: 'free', eventType: 'treino-freitas', createdAt: new Date(2026, 9, 11, 20) },
    ]);
    const orders = snapshot([
        { status: 'confirmed', amount: 30, external_reference: 'product-a', item: 'Camisa', quantity: 1, createdAt: new Date(2026, 9, 11, 21) },
        { status: 'approved', type: 'event', amount: 45, external_reference: 'duplicate-event', createdAt: new Date(2026, 9, 11, 22) },
        { status: 'refunded', amount: 90, item: 'Produto cancelado', createdAt: new Date(2026, 9, 11, 22) },
    ]);

    const detail = h.buildMonthSalesDayDetail(
        registrations,
        orders,
        period,
        '2026-10-11',
    );

    assert.equal(detail.total, 60);
    assert.equal(detail.transactionsCount, 2);
    assert.equal(detail.averageTicket, 30);
    assert.equal(detail.transactions.length, 2);
    assert.equal(detail.categories.find(entry => entry.kind === 'event').amount, 30);
    assert.equal(detail.categories.find(entry => entry.kind === 'event').saleCount, 1);
    assert.equal(detail.categories.find(entry => entry.kind === 'product').name, 'Camisa');
    assert.equal(detail.hourly[18].amount, 30);
    assert.equal(detail.hourly[21].amount, 30);
    const markup = h.renderMonthSalesDayDetail(detail, '2026-10-11');
    assert.match(markup, /Faturamento confirmado/);
    assert.match(markup, /Quantidade de vendas/);
    assert.match(markup, /Ticket médio/);
    assert.match(markup, /Vendas por horário/);
    assert.match(markup, /Vendas detalhadas/);
    assert.match(markup, /month-sales-hour-svg/);
    assert.match(markup, /month-sales-chart-tick/);
    assert.match(markup, /Pico às/);
    assert.match(markup, /R\$ 50/);
});

test('detalhes do mês agregam o gráfico por dia e cobrem todos os dias do mês', () => {
    const h = helpers();
    const period = h.getMonthSalesPeriod(new Date(2026, 9, 15));
    const registrations = snapshot([
        { status: 'paid', price: 25, external_reference: 'event-1', eventType: 'treino-freitas', createdAt: new Date(2026, 9, 11, 17, 30) },
        { status: 'approved', price: 15, external_reference: 'event-2', eventType: 'modo-liga', createdAt: new Date(2026, 9, 18, 20, 10) },
    ]);
    const orders = snapshot([
        { status: 'confirmed', amount: 30, external_reference: 'product-1', item: 'Camisa', createdAt: new Date(2026, 9, 11, 19, 0) },
    ]);

    const detail = h.buildMonthSalesPeriodDetail(registrations, orders, period);
    const summary = h.buildMonthSalesSummary(registrations, orders, period);
    const markup = h.renderMonthSalesDayDetail(detail, '2026-10-01');

    assert.equal(detail.scope, 'month');
    assert.equal(detail.total, 70);
    assert.equal(detail.total, summary.total);
    assert.equal(detail.transactionsCount, 3);
    assert.equal(detail.averageTicket, 70 / 3);
    assert.equal(detail.daily.length, 31);
    assert.equal(detail.daily[10].amount, 55);
    assert.equal(detail.daily[17].amount, 15);
    assert.equal(detail.daily[30].amount, 0);
    assert.match(markup, /Faturamento ao longo do mês/);
    assert.match(markup, /Faturamento por dia/);
    assert.match(markup, /VENDAS PIX E TOKENS/);
    assert.match(markup, /MP \/ PIX/);
    assert.match(markup, /Tokens usados/);
    assert.match(markup, /TOP PRODUTOS/);
    assert.match(markup, /month-sales-top-product-track/);
    assert.match(markup, /Maior faturamento em 11\/10/);
    assert.match(markup, /11\/10 · 17:30/);
    assert.match(html, /id="monthSalesTotalCard"[^>]*onclick="openMonthSalesPeriodDetail\(\)"/s);
});

test('gráficos diários e mensais separam PIX de tokens sem duplicar recibos de eventos', () => {
    const h = helpers();
    const period = h.getMonthSalesPeriod(new Date(2026, 9, 15));
    const registrations = snapshot([
        { status: 'paid', price: 20, external_reference: 'cash-event', eventType: 'Treino Freitas', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 18, 5) },
        { status: 'confirmed', price: 1, paidWithTokens: true, tokensUsed: 3, external_reference: 'token-event', eventType: 'Modo Liga', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 19, 10) },
        { status: 'confirmed', price: 0, isFreeEvent: true, eventType: 'Treino Freitas', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 20) },
    ]);
    const orders = snapshot([
        { status: 'approved', type: 'event', amount: 20, external_reference: 'cash-event', eventType: 'Treino Freitas', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 18, 5) },
        { status: 'paid', type: 'event', amount: 1, paidWithTokens: true, tokensUsed: 4, external_reference: 'token-event-receipt', eventType: 'Campeonato Freitas', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 19, 20) },
        { status: 'confirmed', amount: 12, item: 'Camisa', quantity: 1, external_reference: 'product-pix', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 21) },
        { status: 'confirmed', amount: 1, tokensUsed: 2, paidWithTokens: true, item: 'Produto Tokens', quantity: 2, external_reference: 'product-token', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 22) },
        { status: 'pending', amount: 90, item: 'Pendente', verifiedOnServer: true, createdAt: new Date(2026, 9, 11, 23) },
    ]);

    const day = h.buildMonthSalesDayDetail(registrations, orders, period, '2026-10-11');
    const month = h.buildMonthSalesPeriodDetail(registrations, orders, period);
    const markup = h.renderMonthSalesDayDetail(day, '2026-10-11');
    const monthlyMarkup = h.renderMonthSalesDayDetail(month, '2026-10-01');

    assert.equal(day.paymentRows.filter(row => row.method === 'pix').reduce((sum, row) => sum + row.value, 0), 32);
    assert.equal(day.paymentRows.filter(row => row.method === 'tokens').reduce((sum, row) => sum + row.value, 0), 9);
    assert.equal(day.paymentRows.filter(row => row.method === 'pix').length, 2);
    assert.equal(day.paymentRows.filter(row => row.method === 'tokens').length, 3);
    assert.equal(h.buildMonthSalesTopProducts(day.productRows, '2026-10-11')[0].name, 'Produto Tokens');
    assert.match(markup, /18h: R\$ 20/);
    assert.match(markup, /19h: 7 tokens/);
    assert.match(markup, /Produto Tokens/);
    assert.match(markup, /month-sales-payment-tick/);
    assert.match(markup, /month-sales-payment-peak-label/);
    assert.doesNotMatch(markup, /FORMAS DE PAGAMENTO/);
    assert.match(monthlyMarkup, /VENDAS PIX E TOKENS/);
    assert.match(monthlyMarkup, /FORMAS DE PAGAMENTO/);
    assert.match(monthlyMarkup, /month-sales-method-donut/);
    assert.match(monthlyMarkup, /style="--pix-share:\d+\.\d+%"/);
    assert.match(monthlyMarkup, /MP \/ PIX/);
    assert.match(monthlyMarkup, /Tokens<\/strong>/);
    assert.match(monthlyMarkup, /TOP PRODUTOS/);
    assert.doesNotMatch(monthlyMarkup, /Pendente/);

    const emptyDetail = h.buildMonthSalesDayDetail(snapshot([]), snapshot([]), period, '2026-10-12');
    const emptyMarkup = h.renderMonthSalesDayDetail(emptyDetail, '2026-10-12');
    assert.match(emptyMarkup, /Sem recebimentos MP \/ PIX neste período/);
    assert.match(emptyMarkup, /Nenhum token debitado neste período/);
});

test('remove filtros, ações rápidas e gráfico antigo de pagamentos do painel', () => {
    assert.doesNotMatch(html, /data-period=|id="customDateRange"|id="dateFrom"|id="dateTo"/);
    assert.doesNotMatch(html, /id="salesChart"|id="topProductsChart"/);
    assert.doesNotMatch(html, /id="sectionFilters"|class="type-btn"|id="btnExportOrdersCsv"|id="btnExportSchedulesCsv"|id="btnReconcile"/);
    assert.doesNotMatch(html, /id="paymentMethodsChart"|Formas de Pagamento/);
    assert.match(html, /onclick="openMonthSalesModal\(\)"/);
    assert.match(source, /parsePeriodFromValue\('today'\)/);
});

test('cartão Vendas Hoje abre o detalhamento da data de Brasília', () => {
    const modal = { hidden: true };
    const calls = [];
    const context = vm.createContext({
        document: { getElementById: id => id === 'monthSalesModal' ? modal : null },
        window: {
            firebaseDb: {},
            BrasiliaTime: { dateKey: () => '2026-11-12' },
        },
        calls,
    });
    vm.runInContext(`
        let selectedMonthSalesDate = null;
        ${extract('function openTodaySalesDetail(', 'async function openMonthSalesPeriodDetail(')}
        async function openMonthSalesDay(dateKey) { calls.push(dateKey); }
        openTodaySalesDetail();
    `, context);

    assert.equal(modal.hidden, false);
    assert.equal(calls[0], '2026-11-12');
    assert.equal(vm.runInContext('selectedMonthSalesDate.getFullYear()', context), 2026);
    assert.equal(vm.runInContext('selectedMonthSalesDate.getMonth()', context), 10);
    assert.equal(vm.runInContext('selectedMonthSalesDate.getDate()', context), 1);
    assert.match(html, /onclick="openTodaySalesDetail\(\)"/);
    assert.match(html, /aria-label="Ver detalhes das vendas de hoje"/);
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
    assert.match(source, /onclick="openMonthSalesDay\('\$\{entry\.dateKey\}'\)"/);
    assert.match(source, /Quantidade de vendas/);
    assert.match(source, /Ticket médio/);
    assert.match(styles, /#monthSalesModal\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
    assert.match(styles, /#monthSalesModal:not\(\[hidden\]\)\s*\{[^}]*position:\s*fixed\s*!important/s);
});
