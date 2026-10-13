const test = require("node:test");
const assert = require("node:assert/strict");
const firebase = require("./firebase-admin");

function fakeDatabase(seed, reads = []) {
  let records = new Map(Object.entries(structuredClone(seed)));
  let queue = Promise.resolve();
  function doc(path) {
    return {
      path, id: path.split("/").pop(),
      get: async () => { reads.push(path); return snapshot(path); },
      update: async patch => { records.set(path, { ...records.get(path), ...patch }); },
    };
  }
  function snapshot(path) {
    return { exists: records.has(path), ref: doc(path), id: path.split("/").pop(), data: () => structuredClone(records.get(path)) };
  }
  function collection(name, filters = [], limit = Infinity) {
    return {
      doc: id => doc(`${name}/${id}`),
      where: (key, op, value) => {
        assert.equal(op, "==");
        return collection(name, [...filters, [key, value]], limit);
      },
      limit: value => collection(name, filters, value),
      get: async () => {
        reads.push({ collection: name, filters });
        const docs = [...records.keys()].filter(path =>
          path.startsWith(`${name}/`) && filters.every(([key, value]) => records.get(path)[key] === value)
        ).slice(0, limit).map(snapshot);
        return { docs, empty: !docs.length, size: docs.length };
      },
    };
  }
  return {
    collection, doc, read: path => structuredClone(records.get(path)),
    runTransaction: task => {
      const job = queue.then(async () => {
        const writes = [];
        const transaction = {
          get: async ref => snapshot(ref.path),
          create: (ref, data) => writes.push(["create", ref.path, data]),
          update: (ref, data) => writes.push(["update", ref.path, data]),
          set: (ref, data) => writes.push(["set", ref.path, data]),
        };
        const result = await task(transaction);
        const next = new Map(records);
        for (const [kind, path, data] of writes) {
          if (kind === "create" && next.has(path)) throw new Error("duplicate");
          if (kind === "update" && !next.has(path)) throw new Error("missing");
          next.set(path, kind === "update" ? { ...next.get(path), ...data } : structuredClone(data));
        }
        records = next;
        return result;
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}

let currentDb;
const firestore = () => currentDb;
firestore.FieldValue = { serverTimestamp: () => 1234 };
firebase.getAdmin = () => ({ firestore });
const { preparePurchase, completePurchase, eventPrice, safeBackUrl } = require("./purchase");
const { handler: webhook } = require("../functions/mp-webhook");
const crypto = require("node:crypto");

function productSeed(balance = 20) {
  return {
    "users/buyer": { tokens: balance, role: "Usuario" },
    "products/planilhas": { name: "Planilhas", price: 8, category: "digital", downloadLink: "https://example.com/file" },
    "orders/one": { userId: "buyer", status: "pending", productId: "planilhas", type: "digital_product" },
  };
}
const payment = reference => ({ id: 987, status: "approved", currency_id: "BRL", transaction_amount: 8, external_reference: reference });

test("product checkout rejects forged prices and wrong owners", async () => {
  currentDb = fakeDatabase(productSeed());
  await assert.rejects(preparePurchase("attacker", { external_reference: "digital_one" }, "tokens"), /pertence/);
  await assert.rejects(preparePurchase("buyer", { external_reference: "digital_one", unit_price: 0.01 }, "mercadopago"), /preço mudou/);
  assert.equal(currentDb.read("purchase_checkouts/digital_one"), undefined);
  assert.equal(currentDb.read("users/buyer").tokens, 20);
});

test("one purchase shares catalog/date reads but the next purchase reloads current prices", async () => {
  const reads = [];
  const seed = {
    "adminEvents/modo-liga": { name: "Modo Liga", preco: 3, status: "Aberto" },
  };
  for (let i = 1; i <= 3; i++) seed[`registrations/r${i}`] = {
    userId: "buyer", status: "pending", external_reference: "schedule_read_test",
    eventType: "modo-liga", date: "2026-10-13", schedule: `${18 + i}h`,
  };
  currentDb = fakeDatabase(seed, reads);
  const result = await preparePurchase("buyer", { external_reference: "schedule_read_test", unit_price: 9 }, "mercadopago");
  assert.equal(result.checkout.amountCents, 900);
  assert.equal(reads.filter(r => r === "adminEvents/modo-liga").length, 1);
  assert.equal(reads.filter(r => r?.collection === "schedule_overrides").length, 1);
  assert.equal(reads.filter(r => r === "purchase_checkouts/schedule_read_test").length, 1);
  const secondSeed = {
    "adminEvents/modo-liga": { name: "Modo Liga", preco: 5, status: "Aberto" },
    "registrations/new": { ...seed["registrations/r1"], external_reference: "schedule_new" },
  };
  currentDb = fakeDatabase(secondSeed, reads);
  await assert.rejects(preparePurchase("buyer", { external_reference: "schedule_new", unit_price: 3 }, "mercadopago"), /preço mudou/);
  assert.equal(currentDb.read("purchase_checkouts/schedule_new"), undefined);
  assert.equal(reads.filter(r => r === "adminEvents/modo-liga").length, 2);
});

test("approved product is delivered by webhook without any browser return; repeated webhook is safe", async () => {
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, "mercadopago");
  const originalFetch = global.fetch;
  process.env.MP_WEBHOOK_SECRET = "test-signature-key";
  process.env.MP_ACCESS_TOKEN = "test-access";
  global.fetch = async () => ({ ok: true, json: async () => payment("digital_one") });
  const hash = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET).update("id:987;request-id:req;ts:123;").digest("hex");
  const event = {
    httpMethod: "POST", body: JSON.stringify({ type: "payment", data: { id: 987 } }),
    headers: { "x-signature": `ts=123,v1=${hash}`, "x-request-id": "req" },
  };
  try {
    assert.equal((await webhook(event)).statusCode, 200);
    assert.equal((await webhook(event)).statusCode, 200);
    assert.equal(currentDb.read("orders/one").status, "paid");
    assert.equal(currentDb.read("orders/one").downloadLink, "https://example.com/file");
    assert.equal(currentDb.read("users/buyer").tokens, 20);
    assert.equal((await webhook({ ...event, headers: {} })).statusCode, 401);
  } finally {
    global.fetch = originalFetch;
    delete process.env.MP_WEBHOOK_SECRET;
    delete process.env.MP_ACCESS_TOKEN;
  }
});

test("pending and amount-mismatched payments never release products", async () => {
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one" }, "mercadopago");
  for (const p of [{ ...payment("digital_one"), status: "pending" }, { ...payment("digital_one"), transaction_amount: 0.01 }]) {
    assert.equal((await completePurchase("digital_one", { payment: p })).status, "needs_review");
  }
  assert.equal(currentDb.read("orders/one").status, "pending");
});

test("token debit and paid order are atomic and idempotent, including concurrent retries", async () => {
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, "tokens");
  const results = await Promise.all([
    completePurchase("digital_one", { uid: "buyer" }),
    completePurchase("digital_one", { uid: "buyer" }),
  ]);
  assert.deepEqual(results.map(r => r.status), ["paid", "already_paid"]);
  assert.equal(currentDb.read("users/buyer").tokens, 12);
  assert.equal(currentDb.read("orders/one").tokensUsed, 8);
  assert.equal(currentDb.read("orders/one").status, "paid");
});

test("insufficient balance or a missing source rolls back everything", async () => {
  currentDb = fakeDatabase(productSeed(3));
  await preparePurchase("buyer", { external_reference: "digital_one" }, "tokens");
  await assert.rejects(completePurchase("digital_one", { uid: "buyer" }), /insuficiente/);
  assert.equal(currentDb.read("users/buyer").tokens, 3);
  assert.equal(currentDb.read("orders/one").status, "pending");
  assert.equal(currentDb.read("purchase_receipts/tokens_digital_one"), undefined);
});

test("events are all confirmed together, with one debit and one order", async () => {
  currentDb = fakeDatabase({
    "users/buyer": { tokens: 10 },
    "adminEvents/event": { name: "Modo Liga", eventType: "modo-liga", preco: 3, status: "Aberto" },
    "registrations/a": { userId: "buyer", status: "pending", eventType: "modo-liga", date: "2026-10-14", schedule: "Quarta - 21h", external_reference: "tokens_event" },
    "registrations/b": { userId: "buyer", status: "pending", eventType: "modo-liga", date: "2026-10-14", schedule: "Quarta - 21h", external_reference: "tokens_event" },
  });
  await preparePurchase("buyer", { external_reference: "tokens_event", unit_price: 6 }, "tokens");
  assert.equal((await completePurchase("tokens_event", { uid: "buyer" })).status, "paid");
  assert.equal(currentDb.read("users/buyer").tokens, 4);
  assert.equal(currentDb.read("registrations/a").status, "paid");
  assert.equal(currentDb.read("registrations/b").tokensUsed, 3);
  assert.equal(currentDb.read("orders/event_tokens_event").total, 6);
});

test("free override ISO timestamps are honored; optional paid participation uses catalog price", async () => {
  currentDb = fakeDatabase({
    "adminEvents/event": { name: "Modo Liga", eventType: "modo-liga", preco: 3, status: "Aberto" },
    "schedule_overrides/free": { date: "2099-10-14", hour: "21h", eventType: "modo-liga", freeUntil: "2099-10-14T23:00:00Z" },
  });
  const registration = { eventType: "modo-liga", date: "2099-10-14", schedule: "Quarta - 21h" };
  assert.equal((await eventPrice(currentDb, registration)).cents, 0);
  assert.equal((await eventPrice(currentDb, registration, true)).cents, 300);
});

test("a different approved payment for an already-paid purchase is flagged for review", async () => {
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one" }, "mercadopago");
  await completePurchase("digital_one", { payment: payment("digital_one") });
  assert.equal((await completePurchase("digital_one", { payment: { ...payment("digital_one"), id: 988 } })).status, "needs_review");
});

test("return URLs cannot redirect the customer to an attacker", () => {
  process.env.PUBLIC_SITE_URL = "https://www.orgfreitas.com.br";
  assert.equal(safeBackUrl("https://attacker.test/"), "https://www.orgfreitas.com.br/client.html");
  assert.equal(safeBackUrl("https://www.orgfreitas.com.br/?ref=code"), "https://www.orgfreitas.com.br/?ref=code");
  delete process.env.PUBLIC_SITE_URL;
});

test("approved event confirms every reservation and creates the paid order automatically", async () => {
  currentDb = fakeDatabase({
    "users/buyer": { tokens: 10 },
    "adminEvents/event": { name: "XTreino Tokens", eventType: "xtreino-tokens", preco: 1, status: "Aberto" },
    "registrations/a": { userId: "buyer", status: "pending", eventType: "xtreino-tokens", date: "2026-10-14", schedule: "Quarta - 21h", external_reference: "schedule_event" },
  });
  await preparePurchase("buyer", { external_reference: "schedule_event", unit_price: 1 }, "mercadopago");
  const result = await completePurchase("schedule_event", { payment: { ...payment("schedule_event"), transaction_amount: 1 } });
  assert.equal(result.status, "paid");
  assert.equal(currentDb.read("registrations/a").status, "paid");
  assert.equal(currentDb.read("orders/event_schedule_event").total, 1);
  assert.equal(currentDb.read("users/buyer").tokens, 10);
});

test("simultaneous different token purchases cannot overdraw the balance", async () => {
  currentDb = fakeDatabase({ ...productSeed(10),
    "orders/two": { userId: "buyer", status: "pending", productId: "planilhas", type: "digital_product" },
  });
  await preparePurchase("buyer", { external_reference: "digital_one" }, "tokens");
  await preparePurchase("buyer", { external_reference: "digital_two" }, "tokens");
  const results = await Promise.allSettled([
    completePurchase("digital_one", { uid: "buyer" }),
    completePurchase("digital_two", { uid: "buyer" }),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(currentDb.read("users/buyer").tokens, 2);
  assert.equal(currentDb.read("orders/two").status, "pending");
});

test("coupon is validated on server and an old checkout cannot silently change the displayed price", async () => {
  currentDb = fakeDatabase({ ...productSeed(),
    "coupons/half": { code: "METADE", isActive: true, usageType: "store", discountType: "percentage", discountValue: 50 },
  });
  await preparePurchase("buyer", { external_reference: "digital_one", couponCode: "METADE", unit_price: 4 }, "tokens");
  await assert.rejects(preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, "tokens"), /preço exibido/);
  await completePurchase("digital_one", { uid: "buyer" });
  assert.equal(currentDb.read("users/buyer").tokens, 16);
});

test("payment endpoints reject unauthenticated requests before any data or payment processing", async () => {
  for (const name of ["create-preference", "create-token-preference", "confirm-purchase", "confirm-token-purchase", "pay-with-tokens", "check-pix-status", "check-payment-status"]) {
    const { handler } = require(`../functions/${name}`);
    const result = await handler({ httpMethod: "POST", headers: {}, body: "{}" });
    assert.equal(result.statusCode, 401, name);
  }
});
