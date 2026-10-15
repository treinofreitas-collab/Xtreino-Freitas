(function (root) {
    'use strict';

    // Analytics only. Never use this cache to authorize a payment or reserve a slot.
    function createReadCache({ now = Date.now, ttl = 60000 } = {}) {
        let scope = null;
        let session = 0;
        const entries = new Map();
        function clear() { entries.clear(); }
        function setScope(next) {
            if (scope !== next) { scope = next; session++; clear(); }
        }
        async function read(key, loader) {
            const saved = entries.get(key);
            if (saved && (saved.pending || saved.expires > now())) return saved.pending || saved.value;
            const entry = { pending: null, expires: 0 };
            const requestSession = session;
            entry.pending = Promise.resolve().then(loader).then(value => {
                if (session !== requestSession) throw new Error('A sessão administrativa mudou.');
                if (entries.get(key) === entry) {
                    entry.value = value;
                    entry.expires = now() + ttl;
                    entry.pending = null;
                }
                return value;
            }).catch(error => {
                if (entries.get(key) === entry) entries.delete(key);
                throw error;
            });
            entries.set(key, entry);
            return entry.pending;
        }
        return { read, clear, setScope };
    }

    // One request at a time; hidden pages do not poll, returning refreshes immediately.
    function createVisiblePoller({
        read, apply, isVisible, onError = console.error, interval = 60000,
        setTimer = setTimeout, clearTimer = clearTimeout,
    }) {
        let enabled = false, visible = false, timer = null, pending = false, generation = 0;
        function cancelTimer() {
            if (timer !== null) clearTimer(timer);
            timer = null;
        }
        function schedule() {
            if (enabled && isVisible() && !pending && timer === null) {
                timer = setTimer(() => { timer = null; void tick(); }, interval);
            }
        }
        async function tick() {
            if (!enabled || !isVisible() || pending) { sync(); return; }
            pending = true;
            const current = generation;
            try {
                const value = await read();
                if (enabled && current === generation && isVisible()) apply(value);
            } catch (error) {
                if (enabled && current === generation) onError(error);
            } finally {
                pending = false;
                if (current === generation) schedule();
            }
        }
        function sync() {
            if (!enabled) return;
            if (!isVisible()) {
                visible = false;
                cancelTimer();
            } else if (!visible) {
                visible = true;
                cancelTimer();
                void tick();
            } else schedule();
        }
        function start() {
            enabled = true;
            visible = isVisible();
            schedule();
        }
        function stop() {
            enabled = false;
            visible = false;
            generation++;
            cancelTimer();
        }
        return { start, stop, sync };
    }

    root.AdminReadControl = { createReadCache, createVisiblePoller };
})(typeof window === 'undefined' ? globalThis : window);
