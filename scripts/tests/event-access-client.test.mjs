import test from 'node:test';
import assert from 'node:assert/strict';
import { clearEventAccessCache, fetchEventAccess, eventAccessRequest } from '../../artifacts/xtreino/public/js/event-access-client.mjs';

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
const available = id => ({ registrationId: id, status: 'available', eventType: 'modo-liga', schedule: '19h', url: 'https://example.test/19' });

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
