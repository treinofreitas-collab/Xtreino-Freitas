import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../artifacts/xtreino/public/admin.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../../artifacts/xtreino/public/admin.js', import.meta.url), 'utf8');
const start = source.indexOf('let _allPayouts = [];');
const end = source.indexOf('async function approveAffiliatePayout(', start);
const functions = source.slice(start, end).replace(
    "import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js')",
    'loadFirebase()',
);

function setup(rows) {
    const elements = new Map();
    const getElement = id => {
        if (!elements.has(id)) {
            const element = { id, value: '', innerHTML: '' };
            let textContent = '';
            Object.defineProperty(element, 'textContent', {
                get: () => textContent,
                set: value => { textContent = String(value); },
            });
            elements.set(id, element);
        }
        return elements.get(id);
    };
    getElement('payoutsStatusFilter').value = 'pending';
    const records = rows || [
        { id: 'p1', data: { status: 'pending', affiliateId: 'a1', affiliateName: 'Ana Lima', affiliateEmail: 'ana@example.test', amount: 25, pixKey: 'ana-pix', pixAccountName: 'Ana Lima', createdAt: new Date('2026-10-14T17:30:00Z') } },
        { id: 'p2', data: { status: 'approved', affiliateId: 'a2', affiliateName: 'Bruno Silva', affiliateEmail: 'bruno@example.test', amount: 12.5, createdAt: new Date('2026-10-13T13:00:00Z'), processedAt: new Date('2026-10-14T10:00:00Z') } },
        { id: 'p3', data: { status: 'rejected', affiliateId: 'a3', affiliateName: 'Carla Dias', amount: 7, rejectionReason: 'Dados do PIX incorretos', createdAt: new Date('2026-10-12T12:00:00Z') } },
    ];
    const calls = [];
    const context = vm.createContext({
        console: { error() {} },
        Number,
        Date,
        window: { firebaseDb: {} },
        document: { getElementById: getElement },
        escapeAdminHtml: value => String(value).replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[character]),
        loadFirebase: async () => ({
            collection: (_, name) => name,
            where: (field, operator, value) => ({ field, operator, value }),
            query: (name, ...constraints) => ({ name, constraints }),
            getDocs: async query => {
                calls.push(query);
                const selected = records.filter(record => (query.constraints || []).every(constraint =>
                    record.data[constraint.field] === constraint.value
                ));
                return { forEach: callback => selected.forEach(record => callback({
                    id: record.id, data: () => record.data,
                })) };
            },
        }),
    });
    vm.runInContext(`
        ${functions}
        globalThis.load = loadAffiliatePayouts;
        globalThis.filter = filterAffiliatePayouts;
    `, context);
    return { context, elements, getElement, calls };
}

test('abertura destaca pedidos pendentes e calcula totais sem misturar histórico', async () => {
    assert.match(html, /<option value="pending" selected>Pendentes primeiro<\/option>/);
    const { context, elements, calls } = setup();
    await context.load();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].constraints[0].field, 'status');
    assert.equal(calls[0].constraints[0].value, 'pending');
    assert.equal(elements.get('payoutsPendingCount').textContent, '1');
    assert.equal(elements.get('payoutsPendingTotal').textContent, 'R$ 25,00');
    assert.equal(elements.get('payoutsApprovedTotal').textContent, '—');
    assert.equal(elements.get('payoutsRejectedCount').textContent, '—');
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /ana@example\.test/);
    assert.doesNotMatch(elements.get('affiliatePayoutsTableBody').innerHTML, /bruno@example\.test|Carla Dias/);
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /Solicitado em|14\/10\/2026/);

    elements.get('payoutsStatusFilter').value = 'all';
    await context.load();
    assert.equal(calls.length, 2);
    assert.equal(elements.get('payoutsApprovedTotal').textContent, 'R$ 12,50');
    assert.equal(elements.get('payoutsRejectedCount').textContent, '1');
});

test('saques só carregam quando a seção é aberta, não junto ao login do painel', () => {
    const authStart = source.indexOf('onAuthStateChanged(window.firebaseAuth, async (user) => {');
    const authEnd = source.indexOf('// ---- Relatórios ----', authStart);
    assert.ok(authStart >= 0 && authEnd > authStart);
    assert.doesNotMatch(source.slice(authStart, authEnd), /loadAffiliatePayouts\s*\(/);

    const lazyStart = source.indexOf('// ========== ADMIN PAGE LAZY LOADING ==========');
    const lazyEnd = source.indexOf('// ===== LIMPEZA: remover inscrições', lazyStart);
    assert.ok(lazyStart >= 0 && lazyEnd > lazyStart);
    assert.match(source.slice(lazyStart, lazyEnd), /case 'sectionAffiliatePayouts':\s*await loadAffiliatePayouts\(\);/);
    assert.match(html, /data-page="financeiro" onclick="adminNav\('financeiro','sectionAffiliatePayouts'/);
});

test('busca local filtra por afiliado ou PIX e alterna o histórico sem nova consulta', async () => {
    const { context, elements, getElement, calls } = setup();
    await context.load();

    getElement('payoutsSearch').value = 'ana-pix';
    context.filter();
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /ana@example\.test/);
    assert.doesNotMatch(elements.get('affiliatePayoutsTableBody').innerHTML, /bruno@example\.test/);
    assert.equal(elements.get('payoutsResultsSummary').textContent, '1 pendente exibida');

    getElement('payoutsSearch').value = '';
    getElement('payoutsStatusFilter').value = 'all';
    await context.load();
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /ana@example\.test/);
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /bruno@example\.test/);
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /Carla Dias/);
    assert.equal(calls.length, 2);
    await context.load();
    assert.equal(calls.length, 2, 'o resultado histórico em cache não deve fazer nova consulta');
});

test('lista vazia de pendências informa que nenhum pedido aguarda aprovação', async () => {
    const { context, elements } = setup([]);
    await context.load();
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /Nenhuma solicitação pendente/);
});

test('selecionar um afiliado consulta somente o histórico daquele afiliado', async () => {
    const { context, elements, getElement, calls } = setup();
    await context.load();

    getElement('payoutsStatusFilter').value = 'all';
    await context.load();
    getElement('payoutsAffiliateFilter').value = 'a2';
    await context.load();

    assert.equal(calls.length, 3);
    assert.equal(calls[2].constraints.length, 1);
    assert.equal(calls[2].constraints[0].field, 'affiliateId');
    assert.equal(calls[2].constraints[0].value, 'a2');
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /bruno@example\.test/);
    assert.doesNotMatch(elements.get('affiliatePayoutsTableBody').innerHTML, /ana@example\.test|Carla Dias/);
    assert.match(elements.get('payoutsStatsScope').textContent, /afiliado selecionado/);
});

test('selecionar apenas aprovados no resumo global não busca a coleção inteira', async () => {
    const { context, elements, getElement, calls } = setup();
    await context.load();
    getElement('payoutsStatusFilter').value = 'approved';
    await context.load();

    assert.equal(calls.length, 2);
    assert.equal(calls[1].constraints[0].field, 'status');
    assert.equal(calls[1].constraints[0].value, 'approved');
    assert.match(elements.get('affiliatePayoutsTableBody').innerHTML, /bruno@example\.test/);
    assert.doesNotMatch(elements.get('affiliatePayoutsTableBody').innerHTML, /ana@example\.test|Carla Dias/);
});
