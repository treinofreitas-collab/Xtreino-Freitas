import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../artifacts/xtreino/public/admin.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../artifacts/xtreino/public/admin.html', import.meta.url), 'utf8');

function extract(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function createHarness() {
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, {
                    value: '',
                    innerHTML: '',
                    textContent: '',
                    style: {},
                    options: [],
                    appendChild(option) { this.options.push(option); },
                    set innerHTML(value) {
                        this._innerHTML = value;
                        if (this.options) this.options = [];
                    },
                    get innerHTML() { return this._innerHTML || ''; },
                });
            }
            return elements.get(id);
        },
        createElement() { return { value: '', textContent: '' }; },
    };
    const context = vm.createContext({
        document,
        affiliateSalesCache: new Map(),
        affiliateSalesPending: new Map(),
        affiliatesData: [
            { id: 'a1', name: 'Zeta', email: 'zeta@example.com' },
            { id: 'a2', name: 'Ana', email: 'ana@example.com' },
        ],
        affiliateSalesData: [
            {
                id: 'sale-a-pending',
                affiliateId: 'a1',
                customerName: 'Cliente Alfa',
                productName: 'TREINO FREITAS',
                saleValue: 90,
                commissionRate: 10,
                commissionAmount: 9,
                saleType: 'event',
                status: 'pending',
                createdAt: new Date('2026-10-14T12:00:00Z'),
            },
            {
                id: 'sale-a-paid',
                affiliateId: 'a1',
                customerName: 'Cliente Beta',
                productName: 'Passe',
                saleValue: 100,
                commissionRate: 10,
                commissionAmount: 10,
                saleType: 'product',
                status: 'paid',
                createdAt: new Date('2026-10-13T12:00:00Z'),
            },
            {
                id: 'sale-b-pending',
                affiliateId: 'a2',
                customerName: 'Outro cliente',
                productName: 'Outro produto',
                saleValue: 50,
                commissionRate: 10,
                commissionAmount: 5,
                saleType: 'product',
                status: 'pending',
                createdAt: new Date('2026-10-15T12:00:00Z'),
            },
        ],
    });
    for (const affiliate of context.affiliatesData) {
        context.affiliateSalesCache.set(affiliate.id, context.affiliateSalesData.filter(sale => sale.affiliateId === affiliate.id));
    }
    vm.runInContext(
        extract('function populateAffiliateFilter()', '// Filtrar tabela de afiliados') +
        extract('// Renderizar vendas do afiliado selecionado', '// Atualizar estatísticas de afiliados'),
        context,
    );
    return { context, document };
}

test('a lista começa vazia até o administrador escolher um afiliado', () => {
    const { context, document } = createHarness();
    context.renderAffiliateSalesTable();

    assert.match(document.getElementById('affiliateSalesResults').innerHTML, /Escolha um afiliado/);
    assert.equal(document.getElementById('affiliateSalesSummary').style.display, 'none');
    assert.match(html, /<option value="">Selecione um afiliado<\/option>/);
    assert.doesNotMatch(html, /<option value="all">Todos os afiliados<\/option>/);
});

test('a seleção mostra somente as vendas do afiliado e respeita status e busca', () => {
    const { context, document } = createHarness();
    const affiliateSelect = document.getElementById('affiliateSalesFilter');
    context.populateAffiliateFilter();

    assert.deepEqual(affiliateSelect.options.map(option => option.value), ['a2', 'a1']);
    affiliateSelect.value = 'a1';
    document.getElementById('affiliateSalesStatusFilter').value = 'pending';
    document.getElementById('affiliateSalesSearch').value = 'treino';
    context.renderAffiliateSalesTable();

    const results = document.getElementById('affiliateSalesResults').innerHTML;
    assert.match(results, /Cliente Alfa/);
    assert.match(results, /TREINO FREITAS/);
    assert.doesNotMatch(results, /Cliente Beta|Outro cliente|Outro produto/);
    assert.equal(document.getElementById('affiliateSalesSummaryCount').textContent, '1');
    assert.equal(document.getElementById('affiliateSalesSummaryValue').textContent, 'R$ 90,00');
    assert.equal(document.getElementById('affiliateSalesSummaryCommission').textContent, 'R$ 9,00');
});

test('a lista do afiliado selecionado é ordenada pela compra mais recente', () => {
    const { context, document } = createHarness();
    context.populateAffiliateFilter();
    document.getElementById('affiliateSalesFilter').value = 'a1';
    context.renderAffiliateSalesTable();

    const results = document.getElementById('affiliateSalesResults').innerHTML;
    assert.ok(results.indexOf('Cliente Alfa') < results.indexOf('Cliente Beta'));
});

function loaderHarness(getSnapshot) {
    const queries = [];
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, { value: '', style: {}, innerHTML: '', textContent: '', disabled: false });
            return elements.get(id);
        },
    };
    const context = vm.createContext({
        document, window: { firebaseDb: {} }, console: { error() {} },
        affiliatesData: [], affiliateSalesData: [],
        affiliateSalesCache: new Map(), affiliateSalesPending: new Map(), affiliateSalesGeneration: 0,
        renderAffiliateSalesTable() {}, updateAffiliateStats() {}, filterAffiliatesTable() {},
        firebase: async () => ({
            collection: (_, name) => name,
            where: (field, operator, value) => ({ field, operator, value }),
            query: (collection, clause) => ({ collection, ...clause }),
            getDocs: async query => {
                queries.push(query);
                return getSnapshot ? getSnapshot(query) : {
                    forEach(fn) {
                        fn({ id: `${query.value}-sale`, data: () => ({
                            affiliateId: query.value, commissionAmount: 10, status: 'pending',
                        }) });
                    },
                };
            },
        }),
    });
    vm.runInContext(
        extract('// Nunca consultar a coleção inteira:', '// Popular filtro de afiliados')
            .replace("import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')", 'firebase()'),
        context,
    );
    vm.runInContext(extract('function resetAffiliateSalesCache()', '// Carregar afiliados'), context);
    return { context, document, queries };
}

test('nenhuma consulta sem seleção; consulta filtrada, cache e atualização por afiliado', async () => {
    const { context, document, queries } = loaderHarness();
    await context.loadAffiliateSales('');
    assert.equal(queries.length, 0);
    document.getElementById('affiliateSalesFilter').value = 'a1';
    await context.loadAffiliateSales('a1');
    assert.deepEqual(queries, [{ collection: 'affiliate_sales', field: 'affiliateId', operator: '==', value: 'a1' }]);
    await context.loadAffiliateSales('a1');
    assert.equal(queries.length, 1, 'seleção repetida reutiliza o cache');
    await context.loadAffiliateSales('a1', { force: true });
    assert.equal(queries.length, 2);
    document.getElementById('affiliateSalesFilter').value = 'a2';
    await context.loadAffiliateSales('a2');
    assert.equal(queries[2].value, 'a2');
});

test('consultas concorrentes do mesmo afiliado compartilham uma única leitura', async () => {
    let resolve;
    const response = new Promise(done => { resolve = done; });
    const { context, queries } = loaderHarness(() => response);
    const first = context.loadAffiliateSales('a1');
    const second = context.loadAffiliateSales('a1');
    await new Promise(setImmediate);
    assert.equal(queries.length, 1);
    resolve({ forEach() {} });
    await Promise.all([first, second]);
});

test('falha não faz varredura global e permite tentar novamente', async () => {
    const { context, queries } = loaderHarness(() => { throw new Error('permission-denied'); });
    assert.equal(await context.loadAffiliateSales('a1'), null);
    assert.equal(context.affiliateSalesCache.size, 0);
    assert.equal(await context.loadAffiliateSales('a1'), null);
    assert.equal(queries.length, 2);
    assert.ok(queries.every(query => query.field === 'affiliateId' && query.value === 'a1'));
});

test('troca de conta descarta cache e resultados em andamento', async () => {
    let resolve;
    const response = new Promise(done => { resolve = done; });
    const { context } = loaderHarness(() => response);
    const request = context.loadAffiliateSales('a1');
    await new Promise(setImmediate);
    context.resetAffiliateSalesCache();
    resolve({ forEach(fn) { fn({ id: 'old', data: () => ({ affiliateId: 'a1' }) }); } });
    assert.equal(await request, null);
    assert.equal(context.affiliateSalesCache.size, 0);
    assert.equal(context.affiliateSalesData.length, 0);
});

test('abrir o diretório ou o Financeiro não dispara carga de históricos', () => {
    const affiliatesLoader = extract('async function loadAffiliates()', '// Nunca consultar a coleção inteira:');
    const lazyLoader = extract('// ========== ADMIN PAGE LAZY LOADING ==========', '// ===== LIMPEZA: remover inscrições');
    assert.doesNotMatch(affiliatesLoader, /loadAffiliateSales\s*\(/);
    assert.match(lazyLoader, /case 'sectionAffiliates':\s*case 'sectionAffiliateSales':\s*await loadAffiliates\(\);/);
    assert.doesNotMatch(lazyLoader, /loadAffiliateSales\s*\(/);
    assert.match(source, /affiliateFilter\.addEventListener\('change',[\s\S]*?loadAffiliateSales\(affiliateFilter\.value\)/);
});

test('aprovação atualiza o cache da comissão sem reler o histórico', async () => {
    const { context } = createHarness();
    const writes = [], alerts = [];
    context.window = { firebaseDb: {}, adminRoleLower: 'ceo' };
    context.confirm = () => true;
    context.alert = message => alerts.push(message);
    context.logAdminAction = async () => {};
    context.filterAffiliatesTable = () => {};
    context.updateAffiliateStats = () => {};
    context.loadAffiliateSales = async () => { throw new Error('não deve reler'); };
    context.loadAffiliates = async () => { throw new Error('não deve reler'); };
    context.firebase = async () => ({
        doc: (_, collection, id) => ({ collection, id }),
        collection: (_, name) => name,
        updateDoc: async (ref, values) => writes.push({ ref, values }),
        addDoc: async (collection, values) => writes.push({ collection, values }),
    });
    vm.runInContext(
        extract('// Aprovar comissão de afiliado', '// Expor funções globalmente')
            .replace("import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')", 'firebase()'),
        context,
    );
    await context.approveAffiliateCommission('sale-a-pending');
    assert.equal(writes.length, 2);
    assert.equal(context.affiliateSalesCache.get('a1').find(sale => sale.id === 'sale-a-pending').status, 'paid');
    assert.deepEqual(alerts, ['Comissão aprovada e marcada como paga!']);
});
