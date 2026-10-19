const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../artifacts/xtreino/public/script.js"), "utf8");
const start = source.indexOf("async function checkMultipleSlotAvailability(");
const end = source.indexOf("async function updateOccupiedAndRefreshButtons(", start);
assert.ok(start >= 0 && end > start);
function checkWith(fetch) {
  const context = vm.createContext({
    authenticatedPaymentFetch: fetch, AbortController, setTimeout, clearTimeout, logError: () => {},
  });
  vm.runInContext(source.slice(start, end), context);
  return context.checkMultipleSlotAvailability;
}
function permanentLockMatcher() {
  const from = source.indexOf("function normalizeEventType(t) {");
  const to = source.indexOf("\nfunction parseHourFromText(", from);
  assert.ok(from >= 0 && to > from);
  const context = vm.createContext({});
  vm.runInContext(source.slice(from, to), context);
  return context.matchesPermanentHourLock;
}
const args = ["2026-10-14", ["Quarta - 17h"], "custom-event", 2];

test("client never approves failed HTTP, network, timeout, JSON or invalid contracts", async () => {
  for (const fetch of [
    async () => ({ ok: false, status: 404 }),
    async () => ({ ok: false, status: 503 }),
    async () => { throw new Error("network failed"); },
    async () => { throw Object.assign(new Error("timeout"), { name: "AbortError" }); },
    async () => ({ ok: true, json: async () => { throw new Error("invalid JSON"); } }),
    async () => ({ ok: true, json: async () => null }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ available: "true" }) }),
  ]) {
    const result = await checkWith(fetch)(...args);
    assert.equal(result.available, false);
    assert.match(result.message, /Nenhuma cobrança/);
  }
});

test("client accepts only explicit server approval and preserves an insufficient-slot message", async () => {
  const check = checkWith(async (url, options) => {
    assert.equal(url, "/.netlify/functions/check-availability");
    assert.equal(JSON.parse(options.body).eventType, "custom-event");
    return { ok: true, json: async () => ({ available: true }) };
  });
  assert.equal((await check(...args)).available, true);
  const closed = checkWith(async () => ({ ok: true, json: async () => ({ available: false, message: "Lotado" }) }));
  assert.equal((await closed(...args)).message, "Lotado");
});

test("invalid client input never starts the request", async () => {
  const check = checkWith(async () => { throw new Error("must not request"); });
  assert.equal((await check("", [], null, 0)).available, false);
});

test("customer calendar matches permanent locks by canonical type and Firestore event ID", () => {
  const matches = permanentLockMatcher();
  const config = { eventType: "event-document-id", label: "TREINO MODO LIGA" };
  assert.equal(matches({ locked: true, eventType: "modo-liga" }, "event-document-id", config), true);
  assert.equal(matches({ locked: true, eventType: "event-document-id" }, "event-document-id", config), true);
  assert.equal(matches({ locked: true, eventType: "treino-freitas" }, "event-document-id", config), false);
  assert.equal(matches({ locked: true }, "event-document-id", config), true);
  assert.equal(matches({ locked: false, eventType: "modo-liga" }, "event-document-id", config), false);
});
