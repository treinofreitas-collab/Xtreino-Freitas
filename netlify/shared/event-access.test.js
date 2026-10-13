const test = require("node:test");
const assert = require("node:assert/strict");
const { createEventAccessHandler, normalizeSchedule, normalizeEventType, bookingExpiry } = require("./event-access");

function setup(overrides = {}, now = () => Date.parse("2026-11-11T20:00:00Z")) {
  const docs = new Map(Object.entries({
    "users/ceo": { role: "Ceo" }, "users/admin": { role: "Admin" },
    "users/gerente": { role: "Gerente" }, "users/socio": { role: "Sócio" },
    "users/buyer": { role: "Usuario" }, "users/staff": { role: "Staff" },
    "adminEvents/modo-liga": { name: "Treino Modo Liga", eventType: "modo-liga" },
    "adminEvents/xtreino-tokens": { name: "Treino Freitas", eventType: "xtreino-tokens" },
    "event_access_links/modo-liga__19h": { eventType: "modo-liga", schedule: "19h", label: "Modo Liga", url: "https://example.test/liga19", active: true },
    "event_access_links/modo-liga__20h": { eventType: "modo-liga", schedule: "20h", label: "Modo Liga", url: "https://example.test/liga20", active: true },
    "registrations/a": { date: "2026-11-11", userId: "buyer", eventType: "modo-liga", schedule: "Quarta - 19h", status: "paid", external_reference: "event_one", membrosUids: ["member"] },
    "registrations/b": { date: "2026-11-11", userId: "buyer", eventType: "modo-liga", schedule: "20:00", status: "paid", external_reference: "event_one" },
    "registrations/c": { date: "2026-11-11", userId: "buyer", eventType: "treino-modo-liga", schedule: "19h", status: "paid", external_reference: "event_one" },
    "purchase_checkouts/event_one": { userId: "buyer", status: "paid", kind: "event", method: "mercadopago", sourcePaths: ["registrations/a", "registrations/b", "registrations/c"] },
    ...overrides,
  }));
  const reads = [], writes = [];
  const snap = path => ({ id: path.split("/")[1], exists: docs.has(path), ref: { path },
    data: () => docs.has(path) ? structuredClone(docs.get(path)) : undefined });
  const ref = path => ({
    path, id: path.split("/")[1],
    get: async () => { reads.push(path); if (docs.get(path)?.throw) throw new Error("quota exhausted"); return snap(path); },
    set: async data => { writes.push(path); docs.set(path, data); },
    delete: async () => { writes.push(path); docs.delete(path); },
  });
  const db = {
    collection: name => ({
      doc: id => ref(`${name}/${id}`),
      get: async () => {
        reads.push(`${name}/*`);
        return { docs: [...docs.keys()].filter(path => path.startsWith(`${name}/`)).map(snap) };
      },
    }),
    getAll: (...refs) => Promise.all(refs.map(ref => ref.get())),
    batch: () => {
      const operations = [];
      return { set: (ref, data) => operations.push(() => ref.set(data)),
        delete: ref => operations.push(() => ref.delete()),
        commit: async () => { for (const operation of operations) await operation(); } };
    },
  };
  const firestore = Object.assign(() => db, { FieldValue: { serverTimestamp: () => "server-time" } });
  const handler = createEventAccessHandler({
    now,
    getAdmin: () => ({ firestore }),
    verifyFirebaseUser: async event => {
      const uid = event.headers?.authorization?.replace(/^Bearer /, "");
      if (!uid) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
      return { uid };
    },
  });
  const call = async (body, uid = "buyer") => {
    const result = await handler({ httpMethod: "POST", body: JSON.stringify(body),
      headers: uid ? { authorization: `Bearer ${uid}` } : {} });
    return { status: result.statusCode, body: JSON.parse(result.body), headers: result.headers };
  };
  return { call, docs, reads, writes, handler };
}

test("anonymous and forbidden roles cannot read or manage the private catalog", async () => {
  const env = setup();
  assert.equal((await env.call({ action: "list" }, null)).status, 401);
  assert.equal(env.reads.length, 0);
  for (const uid of ["buyer", "staff", "member"]) {
    for (const action of ["list", "save", "remove"]) assert.equal((await env.call({ action }, uid)).status, 403);
  }
  assert.equal(env.writes.length, 0);
});

test("CEO, admin and gerente manage; socio only views; catalog reads never leak to normal users", async () => {
  for (const uid of ["ceo", "admin", "gerente", "socio"]) {
    const env = setup();
    const result = await env.call({ action: "list" }, uid);
    assert.equal(result.status, 200);
    assert.equal(result.body.canManage, uid !== "socio");
    assert.equal(result.body.links.length, 2);
    assert.ok(result.headers["Cache-Control"].includes("no-store"));
    assert.equal(result.body.events[0].id, "modo-liga");
  }
  const env = setup();
  assert.equal((await env.call({ action: "save", eventType: "modo-liga", schedule: "19h", url: "https://example.test", active: true }, "socio")).status, 403);
  assert.equal((await env.call({ action: "remove", id: "modo-liga__19h" }, "socio")).status, 403);
});

test("the selector lists actual adminEvents without needing any legacy schedules", async () => {
  const env = setup({
    "adminEvents/EventDocumentAa": { name: "TREINO FREITAS", eventType: "xtreino-tokens", status: "Aberto" },
  });
  const result = await env.call({ action: "list" }, "ceo");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.events.find(event => event.id === "EventDocumentAa"), {
    id: "EventDocumentAa", eventType: "xtreino-tokens", label: "TREINO FREITAS",
  });
  assert.ok(env.reads.includes("adminEvents/*"));
  assert.ok(!env.reads.some(path => path.startsWith("schedules/")));
});

test("a random event document ID saves under its booking eventType and resolves after confirmation", async () => {
  const env = setup({
    "adminEvents/EventDocumentAa": { name: "TREINO MODO LIGA", eventType: "modo-liga", status: "Aberto" },
    "adminEvents/CustomDocumentBb": { name: "Evento próprio", status: "Aberto" },
  });
  const saved = await env.call({ action: "save", eventType: "EventDocumentAa", schedule: "19h",
    url: "https://example.test/correct", active: true }, "ceo");
  assert.equal(saved.status, 200);
  assert.equal(saved.body.link.id, "modo-liga__19h");
  assert.equal(saved.body.link.label, "TREINO MODO LIGA");
  assert.equal((await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0].url, "https://example.test/correct");
  const custom = await env.call({ action: "save", eventType: "CustomDocumentBb", schedule: "20h",
    url: "https://example.test/custom", active: true }, "admin");
  assert.equal(custom.body.link.eventType, "customdocumentbb");
});

test("create/edit is one recurring document per event/hour; deactivate and delete revoke subsequent resolves", async () => {
  const env = setup();
  const save = active => env.call({ action: "save", eventType: "modo-liga", schedule: "19:00", url: "https://example.test/new", active }, "admin");
  assert.equal((await save(true)).body.link.id, "modo-liga__19h");
  assert.equal((await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0].url, "https://example.test/new");
  await save(false);
  assert.equal((await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0].status, "inactive");
  assert.equal((await env.call({ action: "remove", id: "modo-liga__19h" }, "admin")).status, 200);
  assert.equal((await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0].status, "not_configured");
});

test("moving an edited event/hour removes the previous key atomically", async () => {
  const env = setup();
  const result = await env.call({ action: "save", previousId: "modo-liga__19h", eventType: "modo-liga", schedule: "21h", url: "https://example.test/21", active: true }, "admin");
  assert.equal(result.status, 200);
  assert.equal(env.docs.has("event_access_links/modo-liga__19h"), false);
  assert.equal(env.docs.has("event_access_links/modo-liga__21h"), true);
});

test("invalid URLs, hours, IDs, activation flags and nonexistent events are rejected before saving", async () => {
  const env = setup();
  const valid = { action: "save", eventType: "modo-liga", schedule: "19h", url: "https://example.test", active: true };
  for (const invalid of [{ url: "javascript:alert(1)" }, { url: "data:text/html,x" }, { url: "https://user:password@example.test" },
    { url: "bad-url" }, { schedule: "24h" }, { schedule: "19:75" }, { active: "true" }, { eventType: "../users" }]) {
    assert.equal((await env.call({ ...valid, ...invalid }, "ceo")).status, 400);
  }
  assert.equal((await env.call({ ...valid, eventType: "unknown" }, "ceo")).status, 404);
  assert.equal(env.writes.length, 0);
  assert.equal(normalizeSchedule("Sexta - 19h30"), "19h30");
  assert.equal(normalizeEventType("Treino Modo Liga"), "modo-liga");
});

test("multiple teams and hours get their exact links, with one read per checkout and unique event/hour", async () => {
  const env = setup();
  const result = await env.call({ action: "resolve", registrationIds: ["a", "b", "c", "a"] });
  assert.equal(result.status, 200);
  assert.equal(result.body.access.length, 3);
  assert.deepEqual(result.body.access.map(row => row.url), ["https://example.test/liga19", "https://example.test/liga20", "https://example.test/liga19"]);
  assert.equal(env.reads.filter(path => path === "purchase_checkouts/event_one").length, 1);
  assert.equal(env.reads.filter(path => path === "event_access_links/modo-liga__19h").length, 1);
  assert.ok(!env.reads.some(path => path.endsWith("/*")));
});

test("confirmation modal resolves all checkout reservations, not just the first selected time", async () => {
  const env = setup();
  const result = await env.call({ action: "resolve", externalReference: "event_one" });
  assert.equal(result.body.access.length, 3);
  assert.equal(env.reads.filter(path => path === "purchase_checkouts/event_one").length, 1);
  assert.equal((await env.call({ action: "resolve", externalReference: "event_one" }, "intruder")).status, 403);
});

test("an owned verified large checkout is not arbitrarily truncated at the client request-size limit", async () => {
  const paths = Array.from({ length: 205 }, (_, i) => `registrations/reg_${i}`);
  const env = setup(Object.fromEntries([
    ...paths.map(path => [path, { date: "2026-11-11", userId: "buyer", eventType: "modo-liga", schedule: "19h", status: "paid", external_reference: "event_one" }]),
    ["purchase_checkouts/event_one", { userId: "buyer", kind: "event", status: "paid", sourcePaths: paths }],
  ]));
  assert.equal((await env.call({ action: "resolve", externalReference: "event_one" })).body.access.length, 205);
  assert.equal(env.reads.filter(path => path === "event_access_links/modo-liga__19h").length, 1);
});

test("pending, rejected, cancelled and unpaid token-flagged registrations never expose links", async () => {
  for (const status of ["pending", "rejected", "cancelled"]) {
    const env = setup({ "registrations/a": { userId: "buyer", status, paidWithTokens: true, eventType: "modo-liga", schedule: "19h", external_reference: "event_one" } });
    const result = await env.call({ action: "resolve", registrationIds: ["a"] });
    assert.equal(result.body.access[0].status, "not_confirmed");
    assert.equal(result.body.access[0].url, undefined);
    assert.equal(env.reads.some(path => path.startsWith("event_access_links/")), false);
  }
});

test("another user's purchase stays private; a registered team member can access the confirmed slot", async () => {
  const env = setup();
  const forbidden = (await env.call({ action: "resolve", registrationIds: ["a"] }, "other")).body.access[0];
  assert.deepEqual(forbidden, { registrationId: "a", status: "not_authorized" });
  assert.equal((await env.call({ action: "resolve", registrationIds: ["a"] }, "member")).body.access[0].status, "available");
});

test("a forged paid document or an old unverified payment cannot borrow a paid checkout's links", async () => {
  const env = setup({
    "registrations/forged": { userId: "buyer", status: "paid", eventType: "modo-liga", schedule: "19h", external_reference: "event_one" },
    "registrations/legacy": { userId: "buyer", status: "paid", eventType: "modo-liga", schedule: "19h", external_reference: "old_payment" },
  });
  for (const id of ["forged", "legacy"]) {
    const row = (await env.call({ action: "resolve", registrationIds: [id] })).body.access[0];
    assert.equal(row.status, "needs_review");
    assert.equal(row.url, undefined);
  }
});

test("server-confirmed token and free checkouts release links, including free-participation status", async () => {
  for (const method of ["tokens", "free"]) {
    const env = setup({ "registrations/a": { date: "2026-11-11", userId: "buyer", eventType: "modo-liga", schedule: "19h", status: "lisagem_gratis", external_reference: "event_one" },
      "purchase_checkouts/event_one": { userId: "buyer", status: "paid", kind: "event", method, sourcePaths: ["registrations/a"] } });
    assert.equal((await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0].status, "available");
  }
});

test("expiry is precisely 00:01 the next day in Brasilia, including month/year/leap boundaries", () => {
  assert.equal(bookingExpiry("2026-11-11"), "2026-11-12T03:01:00.000Z");
  assert.equal(bookingExpiry("2026-12-31"), "2027-01-01T03:01:00.000Z");
  assert.equal(bookingExpiry("2028-02-29"), "2028-03-01T03:01:00.000Z");
  for (const date of [null, "", "11/11/2026", "2026-02-29", "2026-11-31"]) assert.equal(bookingExpiry(date), null);
});

test("server denies expired links exactly at the deadline, including reference and member access", async () => {
  let now = Date.parse("2026-11-12T03:00:59.999Z");
  const env = setup({}, () => now);
  const before = (await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0];
  assert.equal(before.status, "available");
  assert.equal(before.expiresAt, "2026-11-12T03:01:00.000Z");
  now++;
  env.reads.length = 0;
  for (const uid of ["buyer", "member"]) {
    const expired = (await env.call({ action: "resolve", registrationIds: ["a"],
      date: "2099-11-11", expiresAt: "2099-11-12T03:01:00Z" }, uid)).body.access[0];
    assert.equal(expired.status, "expired");
    assert.equal(expired.url, undefined);
  }
  assert.ok(!env.reads.some(path => path.startsWith("event_access_links/")));
  const rows = (await env.call({ action: "resolve", externalReference: "event_one" })).body.access;
  assert.ok(rows.every(row => row.status === "expired" && !row.url));
});

test("expiry revokes only yesterday's reservation, not the fixed URL or tomorrow's paid booking", async () => {
  const env = setup({}, () => Date.parse("2026-11-12T03:01:00Z"));
  env.docs.set("registrations/b", { ...env.docs.get("registrations/b"), date: "2026-11-12", schedule: "19h" });
  const rows = (await env.call({ action: "resolve", registrationIds: ["a", "b"] })).body.access;
  assert.equal(rows[0].status, "expired");
  assert.equal(rows[1].status, "available");
  assert.equal(rows[1].url, "https://example.test/liga19");
  assert.equal(rows[1].expiresAt, "2026-11-13T03:01:00.000Z");
  assert.equal(env.docs.get("event_access_links/modo-liga__19h").active, true);
  assert.equal(env.writes.length, 0);
});

test("missing or invalid booking dates fail closed, while eventDate is supported", async () => {
  for (const date of [null, "2026-02-30", "Quarta"]) {
    const env = setup();
    env.docs.set("registrations/a", { ...env.docs.get("registrations/a"), date });
    const row = (await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0];
    assert.equal(row.status, "needs_review");
    assert.equal(row.url, undefined);
  }
  const env = setup();
  env.docs.set("registrations/a", { ...env.docs.get("registrations/a"), date: null, eventDate: "2026-11-11" });
  assert.equal((await env.call({ action: "resolve", registrationIds: ["a"] })).body.access[0].status, "available");
});

test("quota failures fail closed without leaking private links or internal details", async () => {
  const env = setup({ "event_access_links/modo-liga__20h": { throw: true } });
  const result = await env.call({ action: "resolve", registrationIds: ["a", "b"] });
  assert.equal(result.status, 503);
  assert.equal(result.body.access, undefined);
  assert.ok(!JSON.stringify(result.body).includes("example.test"));
  assert.ok(!result.body.error.includes("quota"));
});

test("malformed requests and oversized batches are rejected; method guards do not authenticate or read", async () => {
  const env = setup();
  for (const body of [null, [], { action: "bad" }, { action: "resolve", registrationIds: [] },
    { action: "resolve", registrationIds: ["../a"] }, { action: "resolve", registrationIds: Array(201).fill("a") }]) {
    assert.equal((await env.call(body)).status, 400);
  }
  assert.equal((await env.handler({ httpMethod: "GET" })).statusCode, 405);
  assert.equal((await env.handler({ httpMethod: "OPTIONS" })).statusCode, 200);
});
