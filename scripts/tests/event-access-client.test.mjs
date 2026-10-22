import test from 'node:test';
import assert from 'node:assert/strict';
import { clearEventAccessCache, fetchEventAccess, eventAccessRequest, mountReferenceAccess } from '../../artifacts/xtreino/public/js/event-access-client.mjs';

function setup(t, reply) {
    const oldWindow = globalThis.window;
    const oldFetch = globalThis.fetch;
    globalThis.window = { firebaseAuth: { currentUser: { uid: 'buyer', getIdToken: async () => 'fixture-id-token' } } };
    const calls = [];
    globalThis.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        calls.push({ url, body, headers: options.headers });
        const result = await reply(body);
        return { ok: result.ok !== false, json: async () => result.body || result };
    };
    clearEventAccessCache();
    t.after(() => { globalThis.window = oldWindow; globalThis.fetch = oldFetch; clearEventAccessCache(); });
    return calls;
}
const available = id => ({ registrationId: id, status: 'available', eventType: 'modo-liga', schedule: '19h',
    expiresAt: new Date(Date.now() + 86400000).toISOString(), url: 'https://example.test/19' });

test('client batches and deduplicates concurrent requests, reuses cache, and explicit refresh gets edits', async t => {
    const calls = setup(t, async body => ({ access: body.registrationIds.map(available) }));
    const [first, second] = await Promise.all([fetchEventAccess(['a', 'b']), fetchEventAccess(['a'])]);
    assert.equal(first.length, 2);
    assert.equal(second[0].registrationId, 'a');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].headers.Authorization, 'Bearer fixture-id-token');
    await fetchEventAccess(['a', 'b']);
    assert.equal(calls.length, 1);
    await fetchEventAccess(['a'], { force: true });
    assert.equal(calls.length, 2);
});

test('logout or an account change cannot render the previous account response', async t => {
    let complete;
    setup(t, () => new Promise(resolve => { complete = resolve; }));
    const request = fetchEventAccess(['a']);
    await new Promise(resolve => setImmediate(resolve));
    window.firebaseAuth.currentUser = { uid: 'other', getIdToken: async () => 'other-fixture-token' };
    complete({ access: [available('a')] });
    await assert.rejects(request, /sessão mudou/);
});

test('missing rows, unexpected statuses and unsafe URLs reject rather than silently hiding missing links', async t => {
    let result = { access: [] };
    setup(t, async () => result);
    await assert.rejects(fetchEventAccess(['a']), /não retornaram/);
    result = { access: [{ registrationId: 'a', status: 'unknown' }] };
    await assert.rejects(fetchEventAccess(['a']), /Resposta inválida/);
    result = { access: [{ ...available('a'), url: 'javascript:alert(1)' }] };
    await assert.rejects(fetchEventAccess(['a']), /Link inválido/);
});

test('backend failure is not cached as an empty list; retry returns the confirmed link', async t => {
    let failed = true;
    const calls = setup(t, async () => failed ? { ok: false, body: { error: 'Indisponível agora' } } : { access: [available('a')] });
    await assert.rejects(fetchEventAccess(['a']), /Indisponível/);
    failed = false;
    assert.equal((await fetchEventAccess(['a']))[0].url, 'https://example.test/19');
    assert.equal(calls.length, 2);
});

test('clearing after a confirmed payment invalidates stale eligibility; admin actions use authenticated requests', async t => {
    const calls = setup(t, async body => body.action === 'resolve'
        ? { access: [{ registrationId: 'a', status: 'not_confirmed' }] } : { removed: true });
    await fetchEventAccess(['a']);
    clearEventAccessCache();
    await fetchEventAccess(['a']);
    assert.equal(calls.length, 2);
    assert.equal((await eventAccessRequest('remove', { id: 'modo-liga__19h' })).removed, true);
    assert.equal(calls[2].body.action, 'remove');
});

test('an in-flight response from before payment/cache invalidation cannot replace fresh eligibility', async t => {
    let complete;
    let count = 0;
    setup(t, () => ++count === 1 ? new Promise(resolve => { complete = resolve; }) : { access: [available('a')] });
    const stale = fetchEventAccess(['a']);
    await new Promise(resolve => setImmediate(resolve));
    clearEventAccessCache();
    assert.equal((await fetchEventAccess(['a']))[0].status, 'available');
    complete({ access: [{ registrationId: 'a', status: 'not_confirmed' }] });
    await assert.rejects(stale, /links foram atualizados/);
    assert.equal((await fetchEventAccess(['a']))[0].status, 'available');
});

test('large booking histories are batched without arbitrarily losing any access links', async t => {
    const calls = setup(t, async body => ({ access: body.registrationIds.map(available) }));
    const ids = Array.from({ length: 205 }, (_, i) => `reg_${i}`);
    assert.equal((await fetchEventAccess(ids)).length, 205);
    assert.deepEqual(calls.map(call => call.body.registrationIds.length), [200, 5]);
    await fetchEventAccess(ids);
    assert.equal(calls.length, 2);
});

test('responses arriving after expiry never expose a URL and missing expiry is rejected', async t => {
    let now = Date.parse('2026-11-12T03:00:59Z');
    t.mock.method(Date, 'now', () => now);
    const row = { ...available('a'), expiresAt: '2026-11-12T03:01:00Z' };
    let missingExpiry = false;
    setup(t, async () => {
        now += 1000;
        return { access: [missingExpiry ? { ...available('a'), expiresAt: undefined } : row] };
    });
    const expired = (await fetchEventAccess(['a']))[0];
    assert.equal(expired.status, 'expired');
    assert.equal(expired.url, undefined);
    missingExpiry = true;
    clearEventAccessCache();
    await assert.rejects(fetchEventAccess(['a']), /Validade/);
});

function fakeContainer() {
    const element = { children: [], isConnected: true, append(child) { this.children.push(child); },
        replaceChildren() { this.children = []; this._text = ''; } };
    Object.defineProperty(element, 'textContent', {
        get() { return this._text || ''; },
        set(text) { this._text = text; this.children = []; },
    });
    return element;
}

test('confirmation can use a group-oriented label while the default remains event-specific', async t => {
    const oldDocument = globalThis.document;
    globalThis.document = { createElement: tag => ({ tag }) };
    t.after(() => { globalThis.document = oldDocument; });
    setup(t, async () => ({ access: [available('a')] }));

    const confirmation = fakeContainer();
    await mountReferenceAccess(confirmation, 'confirmation', { linkLabel: 'ACESSAR GRUPO DE ID E SENHA' });
    assert.equal(confirmation.children.find(child => child.tag === 'a').textContent, 'ACESSAR GRUPO DE ID E SENHA');

    const account = fakeContainer();
    await mountReferenceAccess(account, 'account');
    assert.equal(account.children.find(child => child.tag === 'a').textContent, 'Acessar evento — 19h');
});

test('an open modal loses expired links locally without polling; future bookings stay available', async t => {
    let now = Date.parse('2026-11-12T03:00:59Z');
    t.mock.method(Date, 'now', () => now);
    const timers = [];
    t.mock.method(globalThis, 'setTimeout', (callback, delay) => { const timer = { callback, delay, unref() {} }; timers.push(timer); return timer; });
    t.mock.method(globalThis, 'clearTimeout', () => {});
    const oldDocument = globalThis.document;
    globalThis.document = { createElement: tag => ({ tag }) };
    t.after(() => { globalThis.document = oldDocument; });
    const calls = setup(t, async () => ({ access: [
        { ...available('a'), eventDate: '2026-11-11', expiresAt: '2026-11-12T03:01:00Z' },
        { ...available('b'), eventDate: '2026-11-12', expiresAt: '2026-11-13T03:01:00Z' },
    ] }));
    const container = fakeContainer();
    await mountReferenceAccess(container, 'event_one', { linkLabel: 'ACESSAR GRUPO DE ID E SENHA' });
    assert.equal(container.children.filter(child => child.tag === 'a').length, 2);
    assert.ok(container.children.filter(child => child.tag === 'a').every(link => link.textContent === 'ACESSAR GRUPO DE ID E SENHA'));
    now += 1000;
    timers.find(timer => timer.delay === 1000).callback();
    assert.equal(container.children.filter(child => child.tag === 'a').length, 1);
    assert.equal(container.children.find(child => child.tag === 'a').textContent, 'ACESSAR GRUPO DE ID E SENHA');
    assert.ok(container.children.some(child => child.textContent?.includes('Link expirado')));
    assert.equal(calls.length, 1);
});

test('a stale visible link cannot navigate after expiry even if a background timer has not fired', async t => {
    let now = Date.parse('2026-11-12T03:00:59Z');
    t.mock.method(Date, 'now', () => now);
    t.mock.method(globalThis, 'setTimeout', () => ({ unref() {} }));
    t.mock.method(globalThis, 'clearTimeout', () => {});
    const oldDocument = globalThis.document;
    globalThis.document = { createElement: tag => ({ tag }) };
    t.after(() => { globalThis.document = oldDocument; });
    const calls = setup(t, async () => ({ access: [{ ...available('a'), expiresAt: '2026-11-12T03:01:00Z' }] }));
    const container = fakeContainer();
    await mountReferenceAccess(container, 'event_one');
    const link = container.children.find(child => child.tag === 'a');
    now += 1000;
    let prevented = false;
    link.onclick({ preventDefault() { prevented = true; } });
    assert.ok(prevented);
    assert.ok(!container.children.some(child => child.tag === 'a'));
    await mountReferenceAccess(container, 'event_one');
    assert.ok(!container.children.some(child => child.tag === 'a'));
    assert.equal(calls.length, 1);
});

test('expired reservations hide link refresh while pending review can still be retried', async t => {
    const oldDocument = globalThis.document;
    globalThis.document = { createElement: tag => ({ tag }) };
    t.after(() => { globalThis.document = oldDocument; });
    setup(t, async body => ({
        access: [{
            registrationId: body.externalReference,
            status: body.externalReference === 'expired' ? 'expired' : 'needs_review',
            eventDate: '2026-06-23',
            schedule: '21h',
        }],
    }));

    const expired = fakeContainer();
    await mountReferenceAccess(expired, 'expired');
    assert.ok(expired.children.some(child => child.textContent?.includes('Link expirado')));
    assert.ok(!expired.children.some(child => child.tag === 'button' && child.textContent === 'Atualizar link'));

    const pendingReview = fakeContainer();
    await mountReferenceAccess(pendingReview, 'pending-review');
    assert.ok(pendingReview.children.some(child => child.textContent?.includes('conferência da organização')));
    assert.ok(pendingReview.children.some(child => child.tag === 'button' && child.textContent === 'Atualizar link'));
});
