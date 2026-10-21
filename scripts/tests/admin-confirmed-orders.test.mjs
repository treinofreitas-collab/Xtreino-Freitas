import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const publicDir = new URL('../../artifacts/xtreino/public/', import.meta.url);
const adminJs = readFileSync(new URL('admin.js', publicDir), 'utf8');
const adminHtml = readFileSync(new URL('admin.html', publicDir), 'utf8');
const adminCss = readFileSync(new URL('admin-styles.css', publicDir), 'utf8');
const tokenPreference = readFileSync(new URL('../../netlify/functions/create-token-preference.js', import.meta.url), 'utf8');

const normalizeStart = adminJs.indexOf('  function normalizeConfirmedOrder(order, id, eventNameMap = null) {');
const normalizeEnd = adminJs.indexOf('  // Função para mostrar pedidos confirmados', normalizeStart);
assert.notEqual(normalizeStart, -1, 'confirmed-order normalization exists');
assert.notEqual(normalizeEnd, -1, 'confirmed-order normalization end exists');

const eventNameHelpersStart = adminJs.indexOf('  const EVENT_NAMES_MAP = {');
const eventNameHelpersEnd = adminJs.indexOf('  function resolveEventName', eventNameHelpersStart);
const eventRows = [
  { id: 'modo-liga-2026', data: () => ({ name: 'Modo Liga 2026', eventType: 'shared-event-type' }) },
  { id: 'camp-season-7', data: () => ({ name: 'Camp Season 7', eventType: 'shared-event-type' }) },
  { id: 'weekly-special', data: () => ({ name: 'Semanal Especial', eventType: 'weekly-special' }) },
];
const eventContext = vm.createContext({
  cachedAdminEventNameMap: null,
  readAdminReportCollection: async () => ({ forEach: callback => eventRows.forEach(callback) }),
  Map,
  Set,
  String,
  Date,
  console: { warn() {} },
});
const eventHelpers = vm.runInContext(
  `(() => { ${adminJs.slice(eventNameHelpersStart, eventNameHelpersEnd)}; return {
    normalizeAdminEventKey, formatAdminEventDate, resolveAdminEventName, loadAdminEventNameMap,
  }; })()`,
  eventContext,
);

const helpers = vm.runInNewContext(
  `(() => { ${adminJs.slice(normalizeStart, normalizeEnd)}; return { normalizeConfirmedOrder }; })()`,
  vm.createContext({
    Date,
    Number,
    String,
    Boolean,
    resolveAdminEventName: eventHelpers.resolveAdminEventName,
    formatAdminEventDate: eventHelpers.formatAdminEventDate,
  }),
);

test('event orders keep buyer email separate from team name and preserve the purchase date', () => {
  const order = helpers.normalizeConfirmedOrder({
    type: 'event',
    eventType: 'camp',
    customer: 'gamer@example.test',
    customerName: 'Camp Freitas',
    title: 'Campeonato Season 7',
    amount: 3,
    createdAt: { seconds: 1792096800 },
  }, 'event-order-1');

  assert.equal(order.id, 'event-order-1');
  assert.equal(order.customerName, '', 'a team name must not be presented as a person');
  assert.equal(order.email, 'gamer@example.test');
  assert.equal(order.team, 'Camp Freitas');
  assert.equal(order.eventCategory, 'Campeonato Season 7');
  assert.equal(order.item, 'Campeonato Season 7');
  assert.equal(order.amount, 3);
  assert.equal(order.originalDate.getTime(), 1792096800 * 1000);
});

test('registered event names resolve by exact event id and remain distinct when event types are shared', async () => {
  const eventNameMap = await eventHelpers.loadAdminEventNameMap();

  assert.equal(
    eventHelpers.resolveAdminEventName({ adminEventId: 'modo-liga-2026', eventType: 'shared-event-type' }, eventNameMap),
    'Modo Liga 2026',
  );
  assert.equal(
    eventHelpers.resolveAdminEventName({ adminEventId: 'camp-season-7', eventType: 'shared-event-type' }, eventNameMap),
    'Camp Season 7',
  );
  assert.equal(
    eventHelpers.resolveAdminEventName({ eventType: 'weekly-special' }, eventNameMap),
    'Semanal Especial',
  );
  assert.equal(
    eventHelpers.resolveAdminEventName({ eventType: 'shared-event-type', title: 'Evento específico antigo' }, eventNameMap),
    'Evento específico antigo',
    'ambiguous event types should fall back to the saved purchase title',
  );
  assert.equal(
    eventHelpers.resolveAdminEventName({ eventType: 'camp', title: 'Campeonato Season 7' }, eventNameMap),
    'Campeonato Season 7',
    'the specific saved event title should win over a generic event-type label',
  );
});

test('confirmed event sales show the configured event and the purchased date and hour', () => {
  const eventNameMap = new Map([
    [eventHelpers.normalizeAdminEventKey('event-modo-liga'), 'Modo Liga'],
  ]);
  const order = helpers.normalizeConfirmedOrder({
    type: 'event',
    eventType: 'custom-type',
    adminEventId: 'event-modo-liga',
    title: 'Inscrição Modo Liga',
    eventDate: '2026-10-21',
    schedule: '22h',
    amount: 3,
  }, 'event-sale-1', eventNameMap);

  assert.equal(order.eventCategory, 'Modo Liga');
  assert.equal(order.eventSchedule, '21/10/2026 · 22h');
});

test('product orders use a real customer name and never substitute the email for it', () => {
  const order = helpers.normalizeConfirmedOrder({
    type: 'tokens_purchase',
    customer: 'mario@example.test',
    buyerEmail: 'mario@example.test',
    customerName: 'Mário Freitas',
    title: '2 Tokens XTreino',
    total: 7.2,
    timestamp: 1792096800000,
  }, 'token-order-1');

  assert.equal(order.customerName, 'Mário Freitas');
  assert.equal(order.email, 'mario@example.test');
  assert.equal(order.item, '2 Tokens XTreino');
  assert.equal(order.amount, 7.2);
  assert.equal(order.originalDate.getTime(), 1792096800000);
});

test('missing personal name stays missing instead of using an email address', () => {
  const order = helpers.normalizeConfirmedOrder({
    customer: 'only-email@example.test',
    customerName: 'only-email@example.test',
    item: 'Produto de teste',
    amount: 0,
  }, 'legacy-order-1');

  assert.equal(order.customerName, '');
  assert.equal(order.email, 'only-email@example.test');
  assert.equal(order.amount, 0);
  assert.equal(order.originalDate, null);
});

test('phone is the primary contact, with email as fallback when no valid phone exists', () => {
  const withPhone = helpers.normalizeConfirmedOrder({
    customer: 'gamer@example.test',
    customerPhone: '+55 11 90000-0001',
    contact: 'backup@example.test',
    item: 'Produto de teste',
  }, 'phone-order-1');
  assert.equal(withPhone.phone, '+55 11 90000-0001');
  assert.equal(withPhone.email, 'backup@example.test');

  const withoutPhone = helpers.normalizeConfirmedOrder({
    customer: 'only-email@example.test',
    phone: 'not-a-phone@example.test',
    contact: 'also-email@example.test',
    productOptions: { telefone: '' },
  }, 'email-fallback-1');
  assert.equal(withoutPhone.phone, '');
  assert.equal(withoutPhone.email, 'also-email@example.test');
});

test('rendered rows align every value with its matching column label', () => {
  const order = helpers.normalizeConfirmedOrder({
    type: 'event',
    eventType: 'camp',
    customer: 'gamer@example.test',
    customerName: 'Camp Freitas',
    phone: '+55 11 90000-0001',
    title: 'Campeonato Season 7',
    eventDate: '2026-10-15',
    schedule: '22h',
    amount: 3,
    createdAt: { seconds: Date.UTC(2026, 9, 15, 18, 40) / 1000 },
  }, 'render-order-1');
  const tbody = {
    innerHTML: '',
    rows: [],
    appendChild(row) { this.rows.push(row); },
  };
  const elements = {
    confirmedTbody: tbody,
    confirmedCount: { textContent: '' },
    confirmedPageInfo: { textContent: '' },
  };
  const rendererStart = adminJs.indexOf('  function mostrarPedidosConfirmadosPagina(pagina) {');
  const rendererEnd = adminJs.indexOf('  // Submissão manual de equipe', rendererStart);
  const renderer = adminJs.slice(rendererStart, rendererEnd);
  const context = vm.createContext({
    window: {},
    document: {
      getElementById: id => elements[id] || null,
      createElement: () => ({ className: '', innerHTML: '' }),
    },
    confirmedOrdersData: [order],
    confirmedOrdersPage: 1,
    confirmedOrdersPerPage: 10,
    confirmedOrdersSearchTerm: '',
    escapePendingHtml: value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]),
    brl: value => `R$ ${Number(value).toFixed(2)}`,
    gerarBotoesPaginacao() {},
    Date,
    Number,
    String,
  });
  const { mostrarPedidosConfirmadosPagina } = vm.runInContext(
    `(() => { ${renderer}; return { mostrarPedidosConfirmadosPagina }; })()`,
    context,
  );
  mostrarPedidosConfirmadosPagina(1);

  assert.equal(tbody.rows.length, 1);
  const markup = tbody.rows[0].innerHTML;
  assert.equal((markup.match(/<td data-label=/g) || []).length, 5);
  assert.match(markup, /data-label="Cliente"[^>]*>[\s\S]*Nome não informado/);
  assert.match(markup, /data-label="Contato"[^>]*>[\s\S]*confirmed-phone[\s\S]*\+55 11 90000-0001[\s\S]*E-mail: gamer@example\.test/);
  assert.match(markup, /data-label="Produto \/ evento"[^>]*>[\s\S]*Campeonato Season 7[\s\S]*15\/10\/2026 · 22h[\s\S]*Time: Camp Freitas/);
  assert.match(markup, /data-label="Valor"[^>]*>R\$ 3\.00/);
  assert.match(markup, /data-label="Data da compra"[^>]*>[\s\S]*class="confirmed-date-day">15\/10\/2026[\s\S]*class="confirmed-date-time">15:40/);

  const emailFallback = helpers.normalizeConfirmedOrder({
    customer: 'backup@example.test',
    item: 'Pedido sem telefone',
  }, 'email-fallback-render');
  context.confirmedOrdersData = [emailFallback];
  tbody.rows.length = 0;
  mostrarPedidosConfirmadosPagina(1);
  assert.match(tbody.rows[0].innerHTML, /backup@example\.test[\s\S]*E-mail alternativo · sem celular informado/);
});

test('confirmed orders have aligned fields, local search, and a mobile card layout', () => {
  const tableStart = adminHtml.indexOf('<table class="confirmed-orders-table">');
  const headerEnd = adminHtml.indexOf('</thead>', tableStart);
  assert.notEqual(tableStart, -1);
  assert.equal((adminHtml.slice(tableStart, headerEnd).match(/<th\b/g) || []).length, 5);
  assert.match(adminHtml, /id="confirmedSearch"[^>]*type="search"/);
  assert.match(adminHtml, /<th scope="col">Contato<\/th>/);
  assert.match(adminJs, /data-label="Contato"/);
  assert.match(adminJs, /const confirmedOrdersPerPage = 10/);
  assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*?\.confirmed-orders-table tbody tr/);
  assert.match(adminCss, /\.confirmed-orders-table-wrap\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(adminCss, /\.confirmed-orders-table\s*{[^}]*min-width:\s*760px/s);
  assert.match(adminCss, /\.confirmed-date-day,\s*\.confirmed-date-time\s*{\s*display:\s*block;/);
  assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*?\.confirmed-orders-table\s*{\s*min-width:\s*0;/);
});

test('typing in search filters the cached data without running another Firestore query', () => {
  const loaderStart = adminJs.indexOf('  async function carregarPedidosConfirmados() {');
  const loaderEnd = adminJs.indexOf('  function normalizeConfirmedOrder', loaderStart);
  const loader = adminJs.slice(loaderStart, loaderEnd);

  assert.match(loader, /readAdminReportCollection\('orders'\)/);
  assert.doesNotMatch(loader, /\bgetDocs\s*\(/);
  assert.match(loader, /searchInput\.addEventListener\('input'/);

  const rendererStart = adminJs.indexOf('  function mostrarPedidosConfirmadosPagina(pagina) {');
  const rendererEnd = adminJs.indexOf('  // Submissão manual de equipe', rendererStart);
  const renderer = adminJs.slice(rendererStart, rendererEnd);
  assert.match(renderer, /confirmedOrdersData\.filter/);
  assert.doesNotMatch(renderer, /\bgetDocs\s*\(/);
});

test('legacy refresh and approval paths cannot overwrite the new table with a second Firestore read', () => {
  const legacyStart = adminJs.indexOf('async function loadConfirmedOrders() {');
  const legacyEnd = adminJs.indexOf('// Função para carregar pedidos pendentes', legacyStart);
  const legacyLoader = adminJs.slice(legacyStart, legacyEnd);
  assert.match(legacyLoader, /window\.reloadConfirmedOrders/);
  assert.doesNotMatch(legacyLoader, /\bgetDocs\s*\(/);
  assert.doesNotMatch(legacyLoader, /confirmedTbody\.innerHTML/);

  const approvalStart = adminJs.indexOf('async function approveOrder(orderId) {');
  const approvalEnd = adminJs.indexOf('// Função para dar tokens a um usuário', approvalStart);
  const approval = adminJs.slice(approvalStart, approvalEnd);
  assert.match(approval, /window\.upsertConfirmedOrder\(orderId, updatedOrder\)/);
  assert.match(adminJs, /window\.upsertConfirmedOrder = \(id, order\) =>/);
});

test('new token orders carry a profile phone without an extra profile lookup', () => {
  assert.match(tokenPreference, /const userData = userSnap\.data\(\)/);
  assert.match(tokenPreference, /const customerPhone = userData\.phone \|\| userData\.phoneNumber \|\| null/);
  assert.match(tokenPreference, /customerPhone,/);
});
