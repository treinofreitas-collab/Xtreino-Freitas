import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const adminPath = new URL('../../artifacts/xtreino/public/admin.js', import.meta.url);
const htmlPath = new URL('../../artifacts/xtreino/public/admin.html', import.meta.url);
const adminSource = readFileSync(adminPath, 'utf8');
const htmlSource = readFileSync(htmlPath, 'utf8');

function element() {
    const attributes = {};
    const classes = new Set(['hidden']);
    return {
        innerHTML: '',
        textContent: '',
        value: '',
        className: '',
        dataset: {},
        oninput: null,
        onclick: null,
        setAttribute(name, value) { attributes[name] = value; },
        getAttribute(name) { return attributes[name]; },
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); },
        },
    };
}

function harness(rows) {
    const ids = [
        'booyahResults', 'booyahCount', 'booyahPendingCount', 'booyahSentCount',
        'booyahPendingTab', 'booyahSentTab', 'booyahSearch', 'booyahNotice',
    ];
    const elements = Object.fromEntries(ids.map(id => [id, element()]));
    const writes = [];
    const docs = rows.map(({ id, ...data }) => ({ id, data: () => data }));
    const firestore = {
        collection: (_db, name) => ({ name }),
        where: (...args) => ({ where: args }),
        query: (collection, ...constraints) => ({ collection, constraints }),
        getDocs: async () => ({ forEach: callback => docs.forEach(callback) }),
        updateDoc: async (...args) => writes.push(['update', ...args]),
        deleteDoc: async (...args) => writes.push(['delete', ...args]),
        doc: (...args) => args,
    };
    const context = vm.createContext({
        console: { error() {} },
        document: { getElementById: id => elements[id] || null },
        window: { firebaseDb: {} },
        confirm: () => true,
        alert() {},
        firebase: async () => firestore,
    });
    const start = adminSource.indexOf('// ==================== PASSE BOOYAH CONTROLS ====================');
    const end = adminSource.indexOf('// ==================== TOKEN TOTALS RECOMPUTE ====================', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    const code = adminSource.slice(start, end).replace(
        /await import\('https:\/\/www\.gstatic\.com\/firebasejs\/10\.13\.0\/firebase-firestore\.js'\)/g,
        'await firebase()',
    );
    vm.runInContext(code, context);
    return { context, elements, writes };
}

const paidRows = [
    {
        id: 'older-paid',
        status: 'paid',
        productId: 'passe-booyah',
        customerName: 'Cliente Antigo',
        buyerEmail: 'antigo@example.com',
        productOptions: { playerId: '111' },
        createdAt: new Date('2026-10-14T14:00:00-03:00'),
    },
    {
        id: 'unpaid',
        status: 'pending',
        productId: 'passe-booyah',
        customerName: 'Compra Pendente',
        productOptions: { playerId: '222' },
        createdAt: new Date('2026-10-15T09:00:00-03:00'),
    },
    {
        id: 'newer-paid',
        status: 'approved',
        productId: 'passe-booyah',
        customerName: 'Cliente Recente',
        customer: 'recente@example.com',
        productOptions: { playerId: '333' },
        createdAt: new Date('2026-10-15T11:30:00-03:00'),
    },
    {
        id: 'sent-paid',
        status: 'confirmed',
        productId: 'passe-booyah',
        customerName: 'Cliente Enviado',
        customer: 'enviado@example.com',
        playerId: '444',
        booyahConfirmed: true,
        booyahConfirmedAt: new Date('2026-10-15T12:00:00-03:00'),
        createdAt: new Date('2026-10-15T10:00:00-03:00'),
    },
];

test('lista apenas compras pagas, mostra data e hora e ordena da mais recente', async () => {
    const h = harness(paidRows);
    await h.context.loadPasseBooyahControls();

    assert.equal(h.elements.booyahCount.textContent, '3 compras pagas');
    assert.match(h.elements.booyahResults.innerHTML, /Cliente Recente/);
    assert.match(h.elements.booyahResults.innerHTML, /15\/10\/2026, 11:30/);
    assert.ok(!h.elements.booyahResults.innerHTML.includes('Compra Pendente'));
    assert.ok(!h.elements.booyahResults.innerHTML.includes('Cliente Enviado'));
    assert.ok(h.elements.booyahResults.innerHTML.indexOf('Cliente Recente') < h.elements.booyahResults.innerHTML.indexOf('Cliente Antigo'));
    assert.equal(h.elements.booyahPendingCount.textContent, 2);
    assert.equal(h.elements.booyahSentCount.textContent, 1);
});

test('busca filtra por cliente, e-mail ou Player ID', async () => {
    const h = harness(paidRows);
    await h.context.loadPasseBooyahControls();
    h.elements.booyahSearch.value = '333';
    h.elements.booyahSearch.oninput();

    assert.match(h.elements.booyahResults.innerHTML, /Cliente Recente/);
    assert.ok(!h.elements.booyahResults.innerHTML.includes('Cliente Antigo'));
    assert.ok(!h.elements.booyahResults.innerHTML.includes('Compra Pendente'));
});

test('marcar como enviado atualiza a tela local e mantém a compra na aba Enviados', async () => {
    const h = harness(paidRows);
    await h.context.loadPasseBooyahControls();
    const button = { dataset: { booyahAction: 'confirm', orderId: 'newer-paid' } };
    await h.elements.booyahResults.onclick({ target: { closest: () => button } });

    assert.equal(h.writes.filter(write => write[0] === 'update').length, 1);
    assert.equal(h.elements.booyahPendingCount.textContent, 1);
    assert.match(h.elements.booyahNotice.textContent, /marcado como enviado/i);
    h.context.window.setBooyahView('sent');
    assert.match(h.elements.booyahResults.innerHTML, /Cliente Recente/);
    assert.match(h.elements.booyahResults.innerHTML, /Enviado em/);
});

test('a tela identifica que exibe apenas compras pagas e tem controles acessíveis', () => {
    assert.match(htmlSource, /Passes Booyah pagos/);
    assert.match(htmlSource, /Buscar cliente, e-mail ou Player ID/);
    assert.match(htmlSource, /Aguardando envio/);
    assert.match(htmlSource, /Enviados/);
    assert.ok(!htmlSource.includes('id="booyahTbody"'));
});
