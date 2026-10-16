import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const adminSource = readFileSync(new URL('../../artifacts/xtreino/public/admin.js', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker, fromEnd = false) {
    const start = fromEnd ? adminSource.lastIndexOf(startMarker) : adminSource.indexOf(startMarker);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    const end = adminSource.indexOf(endMarker, start);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return adminSource.slice(start, end);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}

const topProductsSource = sourceBetween(
    'async function renderTopProducts(){',
    '// Renderizar gráfico de formas de pagamento',
);

const popularHoursSource = sourceBetween(
    'async function renderPopularHours() {',
    '// Função para configurar event listeners dos filtros',
    true,
);

const popularHoursFiltersSource = sourceBetween(
    'function setupPopularHoursFilters() {',
    '// ===== FIM DO SISTEMA DE FILTROS =====',
);

test('top products counts paid token bookings, excludes free slots, and uses reconciled sale values', async () => {
    let fetchCount = 0, fetchOptions;
    const container = { innerHTML: '' };
    const rows = [
        { source: 'orders', status: 'paid', externalRef: 'product-1', item: 'Produto <Especial>', amount: 8, quantity: 2, paymentMethod: 'mercado_pago', verifiedOnServer: true },
        { source: 'orders', status: 'pending', externalRef: 'pending-1', item: 'Não incluir', amount: 100 },
        { source: 'registrations', status: 'paid', externalRef: 'cash-1', docId: 'r1', item: 'XTreino Freitas', amount: 1, paymentMethod: 'mercado_pago' },
        { source: 'registrations', status: 'paid', externalRef: 'cash-1', docId: 'r2', item: 'XTreino Freitas', amount: 1, paymentMethod: 'mercado_pago' },
        { source: 'registrations', status: 'paid', externalRef: 'token-1', docId: 'r3', item: 'XTreino Freitas', amount: 1, paymentMethod: 'tokens' },
        { source: 'registrations', status: 'confirmed', externalRef: 'free-1', docId: 'r4', item: 'XTreino Freitas', amount: 0, paymentMethod: 'mercado_pago', isFreeEvent: true },
        { source: 'registrations', status: 'confirmed', externalRef: 'old-cash-1', docId: 'r5', item: 'XTreino Freitas', amount: 1, paymentMethod: 'mercado_pago' },
        { source: 'event-orders', status: 'paid', externalRef: 'cash-1', item: 'XTreino Freitas', amount: 1.5, paymentMethod: 'mercado_pago', verifiedOnServer: true },
        { source: 'event-orders', status: 'paid', externalRef: 'token-1', item: 'XTreino Freitas', amount: 1, paymentMethod: 'tokens', verifiedOnServer: true },
    ];
    const context = vm.createContext({
        document: { getElementById: id => id === 'topProductsChart' ? container : null },
        fetchUnifiedOrders: async options => { fetchCount += 1; fetchOptions = options; return rows; },
        normalizeProductName: value => value,
        charts: { top: null },
        currencyBRL: value => `R$ ${Number(value).toFixed(2).replace('.', ',')}`,
        escapePendingHtml: escapeHtml,
    });

    vm.runInContext(`${topProductsSource}; globalThis.renderTopProducts = renderTopProducts;`, context);
    await context.renderTopProducts();

    assert.equal(fetchCount, 1, 'the renderer should continue using its existing shared order loader once');
    assert.equal(fetchOptions.includeEventOrders, true);
    assert.match(container.innerHTML, /Produto &lt;Especial&gt;/);
    assert.match(container.innerHTML, /R\$ 2,50/);
    assert.match(container.innerHTML, /4 reservas/);
    assert.match(container.innerHTML, /1 sem pagamento conciliado/);
    assert.doesNotMatch(container.innerHTML, /Não incluir/);
    assert.doesNotMatch(topProductsSource, /getDocs|readAdminReportCollection|collection\(/);
});

test('top products shows an explicit empty state when no paid sales exist', async () => {
    const container = { innerHTML: '' };
    const context = vm.createContext({
        document: { getElementById: id => id === 'topProductsChart' ? container : null },
        fetchUnifiedOrders: async () => [],
        normalizeProductName: value => value,
        charts: { top: null },
        currencyBRL: value => `R$ ${Number(value).toFixed(2)}`,
        escapePendingHtml: escapeHtml,
    });

    vm.runInContext(`${topProductsSource}; globalThis.renderTopProducts = renderTopProducts;`, context);
    await context.renderTopProducts();

    assert.match(container.innerHTML, /Nenhuma reserva ou venda confirmada encontrada/);
});

test('popular hours preserves the selected filters and highlights the peak from the existing data loader', async () => {
    const state = { loaderCalls: [], chartCount: 0, config: null };
    const elements = {
        dayFilter: { value: 'friday' },
        eventFilter: { value: 'modo-liga' },
        popularHoursChart: {},
        popularHoursCanvasWrap: { style: {} },
        popularHoursEmpty: { style: {} },
        popularHoursError: { style: {} },
        popularHoursInsight: { style: {} },
        popularHoursPeak: { textContent: '' },
    };
    function FakeChart(canvas, config) {
        state.chartCount += 1;
        state.config = config;
        this.destroy = () => {};
    }
    const context = vm.createContext({
        document: { getElementById: id => elements[id] ?? null },
        loadPopularHoursData: async (...filters) => {
            state.loaderCalls.push(filters);
            return { labels: ['19h', '20h'], data: [2, 3] };
        },
        Chart: FakeChart,
        console: { error() {} },
    });

    vm.runInContext(`let popularHoursChart = null; ${popularHoursSource}; globalThis.renderPopularHours = renderPopularHours;`, context);
    await context.renderPopularHours();

    assert.deepEqual(state.loaderCalls, [['friday', 'modo-liga']]);
    assert.equal(state.chartCount, 1);
    assert.equal(elements.popularHoursPeak.textContent, '20h · 3 reservas');
    assert.equal(elements.popularHoursInsight.style.display, 'flex');
    assert.equal(elements.popularHoursCanvasWrap.style.display, '');
    assert.equal(elements.popularHoursError.style.display, 'none');
    assert.equal(state.config.data.datasets[0].data.length, 2);
    assert.equal(state.config.plugins[0].id, 'popularHoursValueLabels');
});

test('popular hours shows an empty state without creating a blank chart', async () => {
    const state = { chartCount: 0 };
    const elements = {
        dayFilter: { value: '' },
        eventFilter: { value: '' },
        popularHoursChart: {},
        popularHoursCanvasWrap: { style: {} },
        popularHoursEmpty: { style: {} },
        popularHoursError: { style: {} },
        popularHoursInsight: { style: {} },
        popularHoursPeak: { textContent: '' },
    };
    function FakeChart() { state.chartCount += 1; }
    const context = vm.createContext({
        document: { getElementById: id => elements[id] ?? null },
        loadPopularHoursData: async () => ({ labels: [], data: [] }),
        Chart: FakeChart,
        console: { error() {} },
    });

    vm.runInContext(`let popularHoursChart = null; ${popularHoursSource}; globalThis.renderPopularHours = renderPopularHours;`, context);
    await context.renderPopularHours();

    assert.equal(state.chartCount, 0);
    assert.equal(elements.popularHoursCanvasWrap.style.display, 'none');
    assert.equal(elements.popularHoursEmpty.style.display, 'flex');
    assert.equal(elements.popularHoursError.style.display, 'none');
    assert.equal(elements.popularHoursInsight.style.display, 'none');
});

test('popular hours distinguishes a failed read from a valid empty result', async () => {
    const state = { chartCount: 0 };
    const elements = {
        dayFilter: { value: '' },
        eventFilter: { value: '' },
        popularHoursChart: {},
        popularHoursCanvasWrap: { style: {} },
        popularHoursEmpty: { style: {} },
        popularHoursError: { style: {} },
        popularHoursInsight: { style: {} },
        popularHoursPeak: { textContent: '' },
    };
    function FakeChart() { state.chartCount += 1; }
    const context = vm.createContext({
        document: { getElementById: id => elements[id] ?? null },
        loadPopularHoursData: async () => ({ labels: [], data: [], error: true }),
        Chart: FakeChart,
        console: { error() {} },
    });

    vm.runInContext(`let popularHoursChart = null; ${popularHoursSource}; globalThis.renderPopularHours = renderPopularHours;`, context);
    await context.renderPopularHours();

    assert.equal(state.chartCount, 0);
    assert.equal(elements.popularHoursCanvasWrap.style.display, 'none');
    assert.equal(elements.popularHoursEmpty.style.display, 'none');
    assert.equal(elements.popularHoursError.style.display, 'flex');
});

test('popular hours shows a retry state if Chart.js cannot render', async () => {
    const elements = {
        dayFilter: { value: '' },
        eventFilter: { value: '' },
        popularHoursChart: {},
        popularHoursCanvasWrap: { style: {} },
        popularHoursEmpty: { style: {} },
        popularHoursError: { style: {} },
        popularHoursInsight: { style: {} },
        popularHoursPeak: { textContent: '' },
    };
    function BrokenChart() { throw new Error('Chart library unavailable'); }
    const context = vm.createContext({
        document: { getElementById: id => elements[id] ?? null },
        loadPopularHoursData: async () => ({ labels: ['20h'], data: [1] }),
        Chart: BrokenChart,
        console: { error() {} },
    });

    vm.runInContext(`let popularHoursChart = null; ${popularHoursSource}; globalThis.renderPopularHours = renderPopularHours;`, context);
    await context.renderPopularHours();

    assert.equal(elements.popularHoursCanvasWrap.style.display, 'none');
    assert.equal(elements.popularHoursEmpty.style.display, 'none');
    assert.equal(elements.popularHoursError.style.display, 'flex');
    assert.equal(elements.popularHoursInsight.style.display, 'none');
});

test('retry waits for a manual click and does not trigger extra automatic renders', () => {
    const handlers = {};
    const controls = {
        dayFilter: { value: 'friday', addEventListener(type, callback) { handlers.day = callback; } },
        eventFilter: { value: 'modo-liga', addEventListener(type, callback) { handlers.event = callback; } },
        resetFiltersBtn: { addEventListener(type, callback) { handlers.reset = callback; } },
        retryPopularHoursBtn: { addEventListener(type, callback) { handlers.retry = callback; } },
    };
    let renderCount = 0;
    const context = vm.createContext({
        document: { getElementById: id => controls[id] ?? null },
        renderPopularHours: () => { renderCount += 1; },
    });

    vm.runInContext(`${popularHoursFiltersSource}; globalThis.setupPopularHoursFilters = setupPopularHoursFilters;`, context);
    context.setupPopularHoursFilters();
    assert.equal(renderCount, 0);

    handlers.retry();
    assert.equal(renderCount, 1);
    handlers.reset();
    assert.equal(renderCount, 2);
    assert.equal(controls.dayFilter.value, '');
    assert.equal(controls.eventFilter.value, '');
});
