// User-scoped, memory-only data. History is not truncated arbitrarily:
// ordering/limiting without the appropriate indexes could hide purchases.
export function createUserDocsStore({ read, watch, now = Date.now, ttl = 120000 }) {
    let user = null;
    let epoch = 0;
    const entries = new Map();
    const subscriptions = new Map();
    const canceled = () => Object.assign(new Error('Sessão alterada. Tente novamente.'), { code: 'session-changed' });

    function stopLive() {
        for (const subscription of subscriptions.values()) subscription.stop();
        subscriptions.clear();
    }

    function setUser(nextUser) {
        const next = nextUser?.uid ? { uid: nextUser.uid, email: nextUser.email || null } : null;
        if (next?.uid === user?.uid && next?.email === user?.email) return false;
        epoch++;
        stopLive();
        entries.clear();
        user = next;
        return true;
    }

    function entryFor(name) {
        if (!entries.has(name)) entries.set(name, { data: null, expires: 0, revision: 0, pending: null, initial: null });
        return entries.get(name);
    }

    async function fetch(name, max = 50, descending = false) {
        if (!user) return [];
        const session = epoch;
        const requestUser = { ...user };
        const entry = entryFor(name);
        if (entry.initial) await entry.initial;
        if (session !== epoch) throw canceled();
        if (!entry.data || entry.expires <= now()) {
            if (!entry.pending) {
                const revision = entry.revision;
                const request = Promise.resolve().then(() => read(name, requestUser)).then(data => {
                    if (session !== epoch) throw canceled();
                    // A live update received while the read was pending wins.
                    if (revision === entry.revision) {
                        entry.data = data;
                        entry.expires = now() + ttl;
                        entry.revision++;
                    }
                    return entry.data;
                });
                entry.pending = request;
                request.finally(() => {
                    if (entry.pending === request) entry.pending = null;
                }).catch(() => {});
            }
            await entry.pending;
        }
        if (session !== epoch) throw canceled();
        const time = record => {
            const value = record.data.createdAt;
            return value?.toMillis?.() || (value ? new Date(value).getTime() : 0) || 0;
        };
        return [...(entry.data || [])]
            .sort((a, b) => descending ? time(b) - time(a) : time(a) - time(b))
            .slice(0, max);
    }

    function startLive(onChange, onError) {
        if (!user || subscriptions.size) return;
        const session = epoch;
        for (const name of ['orders', 'registrations']) {
            const entry = entryFor(name);
            let active = true;
            let resolveInitial, rejectInitial;
            const initial = new Promise((resolve, reject) => {
                resolveInitial = resolve;
                rejectInitial = reject;
            });
            initial.catch(() => {});
            entry.initial = initial;
            const settle = (error) => {
                clearTimeout(timeout);
                if (entry.initial === initial) entry.initial = null;
                if (error) rejectInitial(error);
                else resolveInitial();
            };
            const timeout = setTimeout(() => {
                const error = new Error('Não foi possível atualizar os pedidos agora. Tente novamente.');
                entry.expires = 0;
                settle(error);
                if (active && session === epoch) onError?.(error);
            }, 15000);
            let unsubscribe = () => {};
            const stop = () => {
                active = false;
                unsubscribe();
                settle(canceled());
                // After leaving this screen, cached history has a finite lifetime.
                entry.expires = Math.min(entry.expires, now() + ttl);
            };
            subscriptions.set(name, { stop });
            try {
                unsubscribe = watch(name, { ...user }, data => {
                    if (!active || session !== epoch) return;
                    entry.data = data;
                    entry.revision++;
                    entry.expires = Infinity;
                    settle();
                    onChange?.();
                }, error => {
                    if (!active || session !== epoch) return;
                    entry.expires = 0;
                    settle(error);
                    onError?.(error);
                });
            } catch (error) {
                entry.expires = 0;
                settle(error);
                onError?.(error);
            }
        }
    }

    function invalidate() {
        for (const entry of entries.values()) {
            entry.expires = 0;
            entry.revision++;
            entry.pending = null;
        }
    }

    return { setUser, fetch, startLive, stopLive, invalidate };
}

export function createUserDocsFirestoreAdapter({ collection, query, where, or, getDocs, onSnapshot, getDb }) {
    const primaryOnly = new Set();
    const keyFor = user => `${user.uid}\0${user.email || ''}`;
    const permissionDenied = error => String(error?.code || '').replace(/^firestore\//, '') === 'permission-denied';
    const records = snapshot => snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));

    function scopedQuery(name, user) {
        const conditions = [where('userId', '==', user.uid)];
        if (!(name === 'orders' && primaryOnly.has(keyFor(user)))) {
            conditions.push(where('uid', '==', user.uid));
            if (name === 'registrations') conditions.push(where('membrosUids', 'array-contains', user.uid));
            if (user.email) {
                const fields = name === 'orders' ? ['customer', 'buyerEmail'] : ['contact', 'email'];
                fields.forEach(field => conditions.push(where(field, '==', user.email)));
            }
        }
        return query(collection(getDb(), name), conditions.length === 1 ? conditions[0] : or(...conditions));
    }

    function fallback(name, user, error) {
        // Existing order rules authorize ordinary customers by userId only.
        // Staff may also see legacy purchases matched by email/uid.
        if (name !== 'orders' || !permissionDenied(error) || primaryOnly.has(keyFor(user))) return false;
        primaryOnly.add(keyFor(user));
        return true;
    }

    async function read(name, user) {
        try {
            return records(await getDocs(scopedQuery(name, user)));
        } catch (error) {
            if (!fallback(name, user, error)) throw error;
            return records(await getDocs(scopedQuery(name, user)));
        }
    }

    function watch(name, user, onData, onError) {
        let disposed = false;
        let unsubscribe = () => {};
        function connect() {
            if (disposed) return;
            unsubscribe = onSnapshot(scopedQuery(name, user), { includeMetadataChanges: true }, snapshot => {
                if (disposed) return;
                // Do not mistake an empty offline cache for an empty purchase history.
                if (snapshot.metadata?.fromCache && snapshot.docs.length === 0) return;
                onData(records(snapshot));
            }, error => {
                if (disposed) return;
                if (fallback(name, user, error)) {
                    unsubscribe();
                    connect();
                } else onError(error);
            });
        }
        connect();
        return () => {
            disposed = true;
            unsubscribe();
        };
    }

    return { read, watch, reset: () => primaryOnly.clear() };
}
