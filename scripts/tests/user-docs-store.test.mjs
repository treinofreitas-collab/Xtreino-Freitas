import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserDocsStore, createUserDocsFirestoreAdapter } from '../../artifacts/xtreino/public/js/user-docs-store.mjs';

const actor = { uid: 'buyer-one', email: 'buyer@example.test' };
const row = (id, date, status = 'paid') => ({ id, data: { createdAt: date, status, userId: actor.uid } });
const pause = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
};

test('concurrent dashboard/orders/reconciliation requests share one read and retain newest/oldest ordering', async () => {
    let reads = 0;
    const request = deferred();
    const store = createUserDocsStore({ read: () => { reads++; return request.promise; } });
    store.setUser(actor);
    const recent = store.fetch('registrations', 1, true);
    const oldest = store.fetch('registrations', 1, false);
    await pause();
    assert.equal(reads, 1);
    request.resolve([row('old', '2025-01-01'), row('new', '2026-10-14')]);
    assert.equal((await recent)[0].id, 'new');
    assert.equal((await oldest)[0].id, 'old');
    assert.equal((await store.fetch('registrations', 200)).length, 2);
    assert.equal(reads, 1);
});

test('inactive data expires; failed reads propagate and never become a cached empty history', async () => {
    let clock = 0, reads = 0, failed = false;
    const store = createUserDocsStore({
        now: () => clock, ttl: 100,
        read: async () => { reads++; if (failed) throw new Error('quota'); return [row('one', '2026-10-14')]; }
    });
    store.setUser(actor);
    await store.fetch('orders');
    clock = 99;
    await store.fetch('orders');
    assert.equal(reads, 1);
    clock = 101;
    failed = true;
    await assert.rejects(store.fetch('orders'), /quota/);
    failed = false;
    assert.equal((await store.fetch('orders'))[0].id, 'one');
    assert.equal(reads, 3);
});

test('live updates serve the cache without repeated history reads and handle paid transitions', async t => {
    const observers = new Map();
    let reads = 0, clock = 0, changes = 0, stopped = 0;
    const store = createUserDocsStore({
        now: () => clock, ttl: 100,
        read: async () => { reads++; return []; },
        watch: (name, user, next) => { observers.set(name, next); return () => { stopped++; }; }
    });
    t.after(() => store.stopLive());
    store.setUser(actor);
    store.startLive(() => changes++);
    const loading = store.fetch('registrations');
    observers.get('orders')([]);
    observers.get('registrations')([row('event', '2026-10-14', 'pending')]);
    assert.equal((await loading)[0].data.status, 'pending');
    clock = 3600000;
    for (let i = 0; i < 80; i++) await store.fetch('registrations');
    assert.equal(reads, 0);
    observers.get('registrations')([row('event', '2026-10-14', 'paid')]);
    assert.equal((await store.fetch('registrations'))[0].data.status, 'paid');
    assert.equal(reads, 0);
    assert.equal(changes, 3);
    store.stopLive();
    assert.equal(stopped, 2);
    clock += 101;
    await store.fetch('registrations');
    assert.equal(reads, 1);
});

test('leaving the tab ignores late snapshots and cancels unresolved initial loads', async () => {
    let next;
    const store = createUserDocsStore({ read: async () => [], watch: (name, user, callback) => {
        if (name === 'orders') next = callback;
        return () => {};
    } });
    store.setUser(actor);
    store.startLive();
    const loading = store.fetch('orders');
    store.stopLive();
    next([row('late', '2026-10-14')]);
    await assert.rejects(loading, /Sessão alterada/);
    assert.deepEqual(await store.fetch('orders'), []);
});

test('logout/account switch clears history, closes subscriptions and rejects old in-flight reads', async () => {
    const request = deferred();
    let oldUser, reads = 0;
    const store = createUserDocsStore({ read: async (name, user) => {
        oldUser ||= user;
        reads++;
        return reads === 1 ? request.promise : [row('new-owner', '2026-10-14')];
    } });
    store.setUser(actor);
    const old = store.fetch('orders');
    await pause();
    store.setUser({ uid: 'buyer-two', email: 'other@example.test' });
    request.resolve([row('private-old-owner', '2026-10-14')]);
    await assert.rejects(old, /Sessão alterada/);
    assert.equal(oldUser.uid, actor.uid);
    assert.equal((await store.fetch('orders'))[0].id, 'new-owner');
    store.setUser(null);
    assert.deepEqual(await store.fetch('orders'), []);
});

test('a fresh live snapshot wins over an older pending getDocs response', async t => {
    const request = deferred();
    const observers = {};
    const store = createUserDocsStore({
        read: () => request.promise,
        watch: (name, user, next) => { observers[name] = next; return () => {}; }
    });
    t.after(() => store.stopLive());
    store.setUser(actor);
    const loading = store.fetch('orders');
    await pause();
    store.startLive();
    observers.orders([row('new', '2026-10-14')]);
    observers.registrations([]);
    request.resolve([row('old', '2025-01-01')]);
    assert.equal((await loading)[0].id, 'new');
    assert.equal((await store.fetch('orders'))[0].id, 'new');
});

test('payment invalidation forces a fresh read and an earlier read cannot overwrite it', async () => {
    const old = deferred();
    let reads = 0;
    const store = createUserDocsStore({ read: async () => ++reads === 1 ? old.promise : [row('approved', '2026-10-14')] });
    store.setUser(actor);
    const pending = store.fetch('orders');
    await pause();
    store.invalidate();
    assert.equal((await store.fetch('orders'))[0].id, 'approved');
    old.resolve([row('obsolete', '2025-01-01')]);
    await pending;
    assert.equal((await store.fetch('orders'))[0].id, 'approved');
    assert.equal(reads, 2);
});

function adapterWith({ read, subscribe } = {}) {
    const calls = [];
    const adapter = createUserDocsFirestoreAdapter({
        collection: (db, name) => name,
        where: (field, op, value) => ({ field, op, value }),
        or: (...conditions) => ({ or: conditions }),
        query: (name, filter) => ({ name, filter }),
        getDb: () => ({}),
        getDocs: async query => { calls.push(query); return read ? read(query) : { docs: [] }; },
        onSnapshot: (query, options, next, error) => subscribe(query, next, error, options),
    });
    return { adapter, calls };
}

test('one OR query unifies every compatible identity field, including team membership', async () => {
    const { adapter, calls } = adapterWith();
    await adapter.read('orders', actor);
    await adapter.read('registrations', actor);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].filter.or.length, 4);
    assert.equal(calls[1].filter.or.length, 5);
    assert.ok(calls[1].filter.or.some(condition => condition.field === 'membrosUids' && condition.op === 'array-contains'));
    assert.ok(calls.every(query => query.filter.or.every(condition =>
        condition.value === actor.uid || condition.value === actor.email)));
});

test('regular-customer order permissions fall back only to owned userId; remember the plan', async () => {
    const { adapter, calls } = adapterWith({ read: async query => {
        if (query.filter.or) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
        return { docs: [{ id: 'owned', data: () => ({ userId: actor.uid }) }] };
    } });
    assert.equal((await adapter.read('orders', actor))[0].id, 'owned');
    await adapter.read('orders', actor);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[1].filter, { field: 'userId', op: '==', value: actor.uid });
    assert.deepEqual(calls[2].filter, calls[1].filter);
    adapter.reset();
    await adapter.read('orders', actor);
    assert.equal(calls.length, 5);
});

test('quota/index errors are not converted to empty results or an unfiltered query', async () => {
    for (const code of ['resource-exhausted', 'failed-precondition']) {
        const { adapter, calls } = adapterWith({ read: async () => { throw Object.assign(new Error(code), { code }); } });
        await assert.rejects(adapter.read('orders', actor), new RegExp(code));
        assert.equal(calls.length, 1);
    }
});

test('live order permission fallback reconnects once and both streams are disposed', () => {
    const streams = [];
    let stopped = 0, received;
    const { adapter } = adapterWith({ subscribe: (query, next, error) => {
        streams.push({ query, next, error });
        return () => stopped++;
    } });
    const stop = adapter.watch('orders', actor, data => { received = data; }, error => { throw error; });
    streams[0].error({ code: 'permission-denied' });
    assert.equal(streams.length, 2);
    assert.equal(streams[1].query.filter.field, 'userId');
    streams[1].next({ docs: [{ id: 'one', data: () => ({ status: 'paid' }) }], metadata: { fromCache: false } });
    assert.equal(received[0].data.status, 'paid');
    stop();
    streams[1].next({ docs: [], metadata: { fromCache: false } });
    assert.equal(received.length, 1);
    assert.equal(stopped, 2);
});

test('an empty offline cache is not displayed as an empty purchase history', () => {
    let next, received = null;
    const { adapter } = adapterWith({ subscribe: (query, onData) => { next = onData; return () => {}; } });
    const stop = adapter.watch('registrations', actor, data => { received = data; }, assert.fail);
    next({ docs: [], metadata: { fromCache: true } });
    assert.equal(received, null);
    next({ docs: [], metadata: { fromCache: false } });
    assert.deepEqual(received, []);
    stop();
});
