import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const publicDir = new URL('../../artifacts/xtreino/public/', import.meta.url);
const adminJs = readFileSync(new URL('admin.js', publicDir), 'utf8');
const adminHtml = readFileSync(new URL('admin.html', publicDir), 'utf8');
const adminCss = readFileSync(new URL('admin-styles.css', publicDir), 'utf8');
const startMarker = '  // Pedidos pendentes carregados em páginas';
const endMarker = '  async function loadRecentSchedules';
const start = adminJs.indexOf(startMarker);
const end = adminJs.indexOf(endMarker, start);
assert.notEqual(start, -1, 'pending-orders implementation exists');
assert.notEqual(end, -1, 'pending-orders implementation end exists');

function createHarness({ orders = 13, registrations = 7 } = {}) {
    const reads = [];
    const counts = [];
    const data = {
        orders: Array.from({ length: orders }, (_, index) => ({
            id: `order-${String(index + 1).padStart(3, '0')}`,
            customer: `buyer-${index + 1}@example.test`,
            item: 'Produto de teste',
            amount: 1,
            createdAt: new Date(2026, 9, 15, 12, index),
        })),
        registrations: Array.from({ length: registrations }, (_, index) => ({
            id: `registration-${String(index + 1).padStart(3, '0')}`,
            email: `team-${index + 1}@example.test`,
            title: 'Reserva de teste',
            price: 3,
            createdAt: new Date(2026, 9, 15, 13, index),
        })),
    };

    const firestore = {
        collection(_db, name) { return { name }; },
        where(field, op, value) { return { type: 'where', field, op, value }; },
        orderBy(field, direction) { return { type: 'orderBy', field, direction }; },
        limit(value) { return { type: 'limit', value }; },
        startAfter(snapshot) { return { type: 'cursor', snapshot }; },
        query(ref, ...constraints) { return { collection: ref.name, constraints }; },
        async getCountFromServer(query) {
            counts.push(query.collection);
            return { data: () => ({ count: data[query.collection].length }) };
        },
        async getDocs(query) {
            const cursor = query.constraints.find(constraint => constraint.type === 'cursor')?.snapshot;
            const pageLimit = query.constraints.find(constraint => constraint.type === 'limit')?.value;
            const ordering = query.constraints.find(constraint => constraint.type === 'orderBy');
            reads.push({
                collection: query.collection,
                limit: pageLimit,
                cursor: cursor?.index ?? null,
                orderBy: ordering ? [ordering.field, ordering.direction] : null,
            });
            const sortedRows = data[query.collection]
                .map((record, index) => ({ record, index }))
                .sort((left, right) => right.record.createdAt - left.record.createdAt);
            const startAt = cursor ? cursor.index + 1 : 0;
            const rows = sortedRows.slice(startAt, startAt + pageLimit);
            return {
                docs: rows.map(({ record }, offset) => ({
                    id: record.id,
                    index: startAt + offset,
                    data: () => record,
                })),
            };
        },
    };

    const elements = {
        pendingTbody: {
            dataset: {},
            innerHTML: '',
            addEventListener() {},
            contains() { return true; },
        },
        pendingCount: { textContent: '' },
        pendingPageInfo: { textContent: '' },
        pendingPrevious: { disabled: false },
        pendingNext: { disabled: false },
    };
    const window = {
        firebaseAuth: { currentUser: { uid: 'admin-1' } },
        firebaseDb: {},
        adminRoleLower: 'ceo',
        confirm: () => true,
        alert() {},
    };
    const context = vm.createContext({
        window,
        document: { getElementById: id => elements[id] || null },
        firebase: async () => firestore,
        brl: amount => `R$ ${Number(amount).toFixed(2)}`,
        refreshDashboard: async () => {},
        console: { warn() {}, error() {} },
        Date,
        Number,
        String,
        Map,
        Promise,
    });
    const implementation = adminJs
        .slice(start, end)
        .replace(/await import\('https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-firestore\.js'\)/g, 'await firebase()');
    const result = vm.runInContext(
        `(async () => { ${implementation}; return { loadPending, getPendingTotalPages, window }; })()`,
        context,
    );

    return { result, reads, counts, elements, data };
}

test('pending pages merge both collections by newest date without loading the full history', async () => {
    const harness = createHarness({ orders: 13, registrations: 7 });
    const { loadPending, getPendingTotalPages, window } = await harness.result;

    assert.equal(getPendingTotalPages(577, 10), 58);
    await loadPending(true);

    assert.deepEqual(harness.counts.sort(), ['orders', 'registrations']);
    assert.deepEqual(harness.reads.map(({ collection, limit, orderBy }) => [collection, limit, orderBy]), [
        ['orders', 10, ['createdAt', 'desc']],
        ['registrations', 7, ['createdAt', 'desc']],
    ]);
    assert.equal((harness.elements.pendingTbody.innerHTML.match(/<tr>/g) || []).length, 10);
    assert.equal(harness.elements.pendingCount.textContent, '20 pendentes');
    assert.equal(harness.elements.pendingPageInfo.textContent, 'Página 1 de 2');
    assert.equal(harness.elements.pendingNext.disabled, false);
    assert.deepEqual(
        [...harness.elements.pendingTbody.innerHTML.matchAll(/<strong>([^<]+)<\/strong>/g)].map(([, name]) => name),
        [
            'team-7@example.test', 'team-6@example.test', 'team-5@example.test',
            'team-4@example.test', 'team-3@example.test', 'team-2@example.test',
            'team-1@example.test', 'buyer-13@example.test', 'buyer-12@example.test',
            'buyer-11@example.test',
        ],
        'the first page is globally sorted across orders and registrations',
    );

    window.changePendingPage(1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.elements.pendingPageInfo.textContent, 'Página 2 de 2');
    assert.equal(harness.reads.length, 3);
    assert.deepEqual(harness.reads[2], {
        collection: 'orders',
        limit: 3,
        cursor: 9,
        orderBy: ['createdAt', 'desc'],
    });
    assert.deepEqual(
        [...harness.elements.pendingTbody.innerHTML.matchAll(/<strong>([^<]+)<\/strong>/g)].map(([, name]) => name),
        [
            'buyer-10@example.test', 'buyer-9@example.test', 'buyer-8@example.test',
            'buyer-7@example.test', 'buyer-6@example.test', 'buyer-5@example.test',
            'buyer-4@example.test', 'buyer-3@example.test', 'buyer-2@example.test',
            'buyer-1@example.test',
        ],
    );

    window.changePendingPage(-1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.elements.pendingPageInfo.textContent, 'Página 1 de 2');
    assert.equal(harness.reads.length, 3, 'returning to a visited page uses the in-memory page cache');
});

test('pending list has matching columns, refresh and working pagination controls', () => {
    assert.match(adminHtml, /Mais recentes primeiro · até 10 por página/);
    assert.match(adminHtml, /id="pendingPrevious" onclick="changePendingPage\(-1\)"/);
    assert.match(adminHtml, /id="pendingNext" onclick="changePendingPage\(1\)"/);
    const tableStart = adminHtml.indexOf('<table class="pending-table');
    const headerEnd = adminHtml.indexOf('</thead>', tableStart);
    assert.notEqual(tableStart, -1);
    assert.notEqual(headerEnd, -1);
    assert.equal((adminHtml.slice(tableStart, headerEnd).match(/<th>/g) || []).length, 5);
    assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*?\.pending-table tbody tr/);
    assert.match(adminCss, /\.pending-panel-header/);
});

test('pending data stays scoped, actions use one delegated listener, and the legacy loader reuses pagination', () => {
    const implementation = adminJs.slice(start, end);
    assert.match(implementation, /getCountFromServer\(query\(collection\(window\.firebaseDb, 'orders'\)/);
    assert.match(implementation, /constraints\.push\(orderBy\('createdAt', 'desc'\)\)/);
    assert.match(implementation, /constraints\.push\(limit\(batchLimit\)\)/);
    assert.match(implementation, /constraints\.push\(startAfter\(stream\.cursor\)\)/);
    assert.match(implementation, /tbody\.dataset\.pendingActionsBound = 'true'/);
    assert.match(adminJs, /async function loadPendingOrders\(\)\s*\{\s*if \(typeof window\.refreshPendingOrders === 'function'\)/);
});
