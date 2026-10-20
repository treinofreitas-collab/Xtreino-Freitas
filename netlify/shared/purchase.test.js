const test = require("node:test");
const assert = require("node:assert/strict");
const firebase = require("./firebase-admin");

function fakeDatabase(seed, reads = []) {
  let records = new Map(Object.entries(structuredClone(seed)));
  let queue = Promise.resolve();
  let transactionCount = 0;
  function doc(path) {
    return {
      path, id: path.split("/").pop(),
      get: async () => { reads.push(path); return snapshot(path); },
      update: async patch => { records.set(path, { ...records.get(path), ...patch }); },
    };
  }
  function snapshot(path) {
    const exists = records.has(path);
    const data = structuredClone(records.get(path));
    return { exists, ref: doc(path), id: path.split("/").pop(), data: () => structuredClone(data) };
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
    set: (path, value) => records.set(path, structuredClone(value)),
    remove: path => records.delete(path),
    get transactionCount() { return transactionCount; },
    runTransaction: task => {
      transactionCount++;
      const job = queue.then(async () => {
        const writes = [];
        const transaction = {
          get: async ref => {
            assert.equal(writes.length, 0, "Firestore transaction reads must precede all writes");
            return snapshot(ref.path);
          },
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
const { preparePurchase, completePurchase, payPurchaseWithTokens, eventPrice, safeBackUrl } = require("./purchase");
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

test("automatic event webhook confirms without a customer profile or browser return, keeping all payment checks", async () => {
  const reference = "schedule_auto_no_profile";
  currentDb = fakeDatabase({
    "adminEvents/liga": { name: "Liga", preco: 1, status: "Aberto" },
    ...Object.fromEntries(["a", "b"].map((id, index) => [`registrations/${id}`, {
      userId: "buyer", status: "pending", eventType: "liga", date: `2026-10-${14 + index}`,
      schedule: `Quarta - ${14 + index}h`, external_reference: reference,
    }])),
  });
  await preparePurchase("buyer", { external_reference: reference, unit_price: 2 }, "mercadopago");
  const originalFetch = global.fetch;
  const originalError = console.error;
  const reviews = [];
  let providerPayment = { ...payment(reference), status: "pending", transaction_amount: 2 };
  let fetchCalls = 0;
  process.env.MP_WEBHOOK_SECRET = "test-auto-webhook-key";
  process.env.MP_ACCESS_TOKEN = "test-access";
  global.fetch = async () => {
    fetchCalls++;
    return { ok: true, json: async () => providerPayment };
  };
  console.error = (...args) => reviews.push(args);
  const signature = crypto.createHmac("sha256", "test-auto-webhook-key")
    .update("id:987;request-id:auto-req;ts:123;").digest("hex");
  const event = {
    httpMethod: "POST", body: JSON.stringify({ type: "payment", data: { id: 987 } }),
    headers: { "x-signature": `ts=123,v1=${signature}`, "x-request-id": "auto-req" },
  };
  try {
    assert.equal((await webhook({ ...event, headers: {} })).statusCode, 401);
    assert.equal(fetchCalls, 0);
    assert.equal((await webhook(event)).statusCode, 200);
    assert.equal(currentDb.read("registrations/a").status, "pending");
    providerPayment = { ...providerPayment, status: "approved", transaction_amount: 0.01 };
    assert.equal((await webhook(event)).statusCode, 200);
    assert.equal(currentDb.read("registrations/a").status, "pending");
    assert.equal(currentDb.read("purchase_receipts/mp_987"), undefined);
    assert.deepEqual(reviews, [["Payment requires review", "amount_mismatch"]]);
    providerPayment = { ...providerPayment, transaction_amount: 2 };
    assert.equal((await webhook(event)).statusCode, 200);
    assert.equal(currentDb.read("registrations/a").status, "paid");
    assert.equal(currentDb.read("registrations/b").status, "paid");
    assert.equal(currentDb.read(`purchase_checkouts/${reference}`).status, "paid");
    assert.equal(currentDb.read(`orders/event_${reference}`).total, 2);
    assert.equal(currentDb.read("users/buyer"), undefined);
    const receipt = currentDb.read("purchase_receipts/mp_987");
    assert.equal((await webhook(event)).statusCode, 200);
    assert.deepEqual(currentDb.read("purchase_receipts/mp_987"), receipt);
    assert.equal(reviews.length, 1);
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
    delete process.env.MP_WEBHOOK_SECRET;
    delete process.env.MP_ACCESS_TOKEN;
  }
});

test("pending and amount-mismatched payments never release products", async () => {
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one" }, "mercadopago");
  const pending = await completePurchase("digital_one", { payment: { ...payment("digital_one"), status: "pending" } });
  const mismatch = await completePurchase("digital_one", { payment: { ...payment("digital_one"), transaction_amount: 0.01 } });
  assert.equal(pending.status, "needs_review");
  assert.equal(pending.reason, "pending");
  assert.match(pending.message, /pendente/);
  assert.equal(mismatch.status, "needs_review");
  assert.equal(mismatch.reason, "amount_mismatch");
  assert.match(mismatch.message, /valor aprovado/);
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

test("affiliate commissions are created by the server only after payment and are idempotent", async () => {
  const seed = productSeed();
  seed["orders/one"].affiliateCode = "affiliate";
  seed["users/affiliate"] = {
    role: "Afiliado",
    affiliateStatus: "active",
    email: "affiliate@example.com",
    commissionRateProducts: 12.5,
    managerId: "manager",
    managerCommissionRate: 20,
    managerEmail: "manager@example.com",
  };
  seed["users/manager"] = { role: "Gerente" };
  currentDb = fakeDatabase(seed);

  await preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, "mercadopago");
  assert.equal(currentDb.read("affiliate_sales/purchase_digital_one"), undefined);

  const paid = await completePurchase("digital_one", { payment: payment("digital_one") });
  assert.equal(paid.status, "paid");
  assert.deepEqual(
    currentDb.read("affiliate_sales/purchase_digital_one"),
    {
      affiliateId: "affiliate",
      orderId: "digital_one",
      customerEmail: null,
      customerName: null,
      productName: "Planilhas",
      saleValue: 8,
      commissionRate: 12.5,
      commissionAmount: 1,
      saleType: "product",
      type: "affiliate",
      status: "pending",
      createdAt: 1234,
    },
  );
  assert.equal(currentDb.read("affiliate_sales/manager_purchase_digital_one").commissionAmount, 0.2);

  const retried = await completePurchase("digital_one", { payment: payment("digital_one") });
  assert.equal(retried.status, "already_paid");
  assert.equal(currentDb.read("affiliate_sales/purchase_digital_one").commissionAmount, 1);
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

test("Camp Season 7 uses its exact catalog event and rejects bookings before 15/11/2026", async () => {
  currentDb = fakeDatabase({
    "adminEvents/camp-freitas": { name: "Camp Freitas", eventType: "camp-freitas", preco: 8, status: "Aberto" },
    "adminEvents/Season7Event": {
      name: "CAMPEONATO SEASON 7 - INÍCIO: 15/11",
      eventType: "camp-freitas", preco: 3, status: "Aberto",
    },
  });
  const registration = {
    eventType: "camp-freitas", adminEventId: "Season7Event", eventLinkDateScoped: true,
    title: "CAMPEONATO SEASON 7 - INÍCIO: 15/11 - Slot 1",
    date: "2026-11-14", schedule: "Sábado - 19h",
  };
  await assert.rejects(eventPrice(currentDb, registration), /começam em 15\/11\/2026/);
  registration.date = "2026-11-15";
  assert.equal((await eventPrice(currentDb, registration)).cents, 300);
});

test("a different approved payment for an already-paid purchase is flagged for review", async () => {
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one" }, "mercadopago");
  await completePurchase("digital_one", { payment: payment("digital_one") });
  const result = await completePurchase("digital_one", { payment: { ...payment("digital_one"), id: 988 } });
  assert.equal(result.status, "needs_review");
  assert.equal(result.reason, "checkout_paid_with_other_payment");
  assert.match(result.message, /outra transação/);
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
    "registrations/a": { userId: "buyer", status: "pending", eventType: "xtreino-tokens", date: "2026-10-14", schedule: "Quarta - 21h", phone: "+55 11 90000-0001", external_reference: "schedule_event" },
  });
  await preparePurchase("buyer", { external_reference: "schedule_event", unit_price: 1 }, "mercadopago");
  const result = await completePurchase("schedule_event", { payment: { ...payment("schedule_event"), transaction_amount: 1 } });
  assert.equal(result.status, "paid");
  assert.equal(currentDb.read("registrations/a").status, "paid");
  assert.equal(currentDb.read("orders/event_schedule_event").total, 1);
  assert.equal(currentDb.read("orders/event_schedule_event").phone, "+55 11 90000-0001");
  assert.equal(currentDb.read("users/buyer").tokens, 10);
});

test("event payment review identifies receipt or reservation conflicts without releasing the event", async () => {
  const seed = () => ({
    "users/buyer": { tokens: 0 },
    "adminEvents/xtreino-tokens": { name: "XTreino Tokens", eventType: "xtreino-tokens", preco: 1, status: "Aberto" },
    "registrations/r1": {
      userId: "buyer", status: "pending", eventType: "xtreino-tokens",
      date: "2026-10-14", schedule: "Quarta - 21h", external_reference: "schedule_review",
    },
  });
  const check = async (mutate, expectedReason) => {
    currentDb = fakeDatabase(seed());
    await preparePurchase("buyer", { external_reference: "schedule_review", unit_price: 1 }, "mercadopago");
    mutate?.();
    const result = await completePurchase("schedule_review", { payment: { ...payment("schedule_review"), transaction_amount: 1 } });
    assert.equal(result.status, "needs_review");
    assert.equal(result.reason, expectedReason);
    assert.ok(result.message);
    assert.notEqual(currentDb.read("registrations/r1")?.status, "paid");
  };

  await check(() => currentDb.set("purchase_receipts/mp_987", { reference: "schedule_review" }), "receipt_already_exists");
  await check(() => currentDb.remove("registrations/r1"), "reservation_missing");
  await check(() => currentDb.set("registrations/r1", {
    ...currentDb.read("registrations/r1"), userId: "someone_else",
  }), "reservation_owner_mismatch");
  await check(() => currentDb.set("registrations/r1", {
    ...currentDb.read("registrations/r1"), status: "confirmed",
  }), "reservation_not_pending");

  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, "tokens");
  const wrongMethod = await completePurchase("digital_one", { payment: payment("digital_one") });
  assert.equal(wrongMethod.reason, "checkout_method_mismatch");
  assert.match(wrongMethod.message, /não foi criado para pagamento pelo Mercado Pago/);
});

test("approved MP events confirm without an optional profile, never creating or crediting an account", async () => {
  currentDb = fakeDatabase({
    "adminEvents/liga": { name: "Liga", preco: 1, status: "Aberto" },
    "registrations/r": {
      userId: "buyer", status: "pending", eventType: "liga", date: "2026-10-14",
      schedule: "Quarta - 14h", external_reference: "schedule_no_profile",
    },
  });
  await preparePurchase("buyer", { external_reference: "schedule_no_profile", unit_price: 1 }, "mercadopago");
  const approved = { ...payment("schedule_no_profile"), transaction_amount: 1 };
  const badPayment = await completePurchase("schedule_no_profile", {
    payment: { ...approved, transaction_amount: 0.01 },
  });
  assert.equal(badPayment.reason, "amount_mismatch");
  assert.equal(currentDb.read("registrations/r").status, "pending");
  assert.equal(currentDb.read("purchase_receipts/mp_987"), undefined);
  assert.equal((await completePurchase("schedule_no_profile", { payment: approved })).status, "paid");
  assert.equal(currentDb.read("registrations/r").status, "paid");
  assert.equal(currentDb.read("orders/event_schedule_no_profile").userId, "buyer");
  assert.equal(currentDb.read("users/buyer"), undefined);
  assert.equal((await completePurchase("schedule_no_profile", { payment: approved })).status, "already_paid");
});

test("missing profiles still block token debits and non-event delivery without any writes", async () => {
  for (const kind of ["tokens", "mercadopago"]) {
    currentDb = fakeDatabase(productSeed());
    await preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, kind);
    currentDb.remove("users/buyer");
    const result = kind === "tokens"
      ? await payPurchaseWithTokens("buyer", { external_reference: "digital_one", unit_price: 8 })
      : await completePurchase("digital_one", { payment: payment("digital_one") });
    assert.equal(result.reason, "account_missing");
    assert.equal(currentDb.read("orders/one").status, "pending");
    assert.equal(currentDb.read("purchase_checkouts/digital_one").status, "pending");
    assert.equal(currentDb.read(`purchase_receipts/${kind === "tokens" ? "tokens_digital_one" : "mp_987"}`), undefined);
  }
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

test("new token purchase creates the paid checkout and delivers the product in exactly one transaction", async () => {
  currentDb = fakeDatabase(productSeed());
  const result = await payPurchaseWithTokens("buyer", { external_reference: "digital_one", unit_price: 8 });
  assert.deepEqual(result, { status: "paid", balance: 12 });
  assert.equal(currentDb.transactionCount, 1);
  assert.equal(currentDb.read("purchase_checkouts/digital_one").status, "paid");
  assert.equal(currentDb.read("orders/one").downloadLink, "https://example.com/file");
  assert.equal(currentDb.read("orders/one").verifiedOnServer, true);
  assert.equal(currentDb.read("purchase_receipts/tokens_digital_one").amountCents, 800);
});

test("new token events confirm all dates/hours and allocate the coupon total in one transaction", async () => {
  currentDb = fakeDatabase({
    "users/buyer": { tokens: 10 },
    "adminEvents/modo-liga": { name: "Liga", preco: 3, status: "Aberto" },
    "coupons/half": { code: "METADE", isActive: true, usageType: "events", discountType: "percentage", discountValue: 50 },
    ...Object.fromEntries(["a", "b"].map((id, index) => [`registrations/${id}`, {
      userId: "buyer", status: "pending", eventType: "modo-liga", date: `2026-10-${14 + index}`,
      schedule: `Quarta - ${21 + index}h`, external_reference: "tokens_multi",
    }])),
  });
  assert.deepEqual(await payPurchaseWithTokens("buyer", {
    external_reference: "tokens_multi", unit_price: 3, couponCode: "METADE",
  }), { status: "paid", balance: 7 });
  assert.equal(currentDb.transactionCount, 1);
  assert.equal(currentDb.read("registrations/a").tokensUsed, 1.5);
  assert.equal(currentDb.read("registrations/b").tokensUsed, 1.5);
  assert.equal(currentDb.read("orders/event_tokens_multi").quantity, 2);
  assert.equal(currentDb.read("purchase_checkouts/tokens_multi").couponId, "half");
});

test("optimized token retries, including concurrent requests, debit only once", async () => {
  currentDb = fakeDatabase(productSeed());
  const body = { external_reference: "digital_one", unit_price: 8 };
  const results = await Promise.all([
    payPurchaseWithTokens("buyer", body), payPurchaseWithTokens("buyer", body),
  ]);
  assert.deepEqual(results.map(result => result.status), ["paid", "already_paid"]);
  assert.equal((await payPurchaseWithTokens("buyer", body)).status, "already_paid");
  assert.equal(currentDb.read("users/buyer").tokens, 12);
});

test("free event confirmation still uses the token endpoint without deducting any balance", async () => {
  currentDb = fakeDatabase({
    "users/buyer": { tokens: 0 },
    "adminEvents/free": { name: "Grátis", entrada: "GRÁTIS", status: "Aberto" },
    "registrations/free": {
      userId: "buyer", status: "pending", eventType: "free", date: "2026-10-14",
      schedule: "Quarta - 19h", external_reference: "free_test",
      isFreeEvent: true, freeParticipationStatus: "lisagem_gratis",
    },
  });
  assert.deepEqual(await payPurchaseWithTokens("buyer", {
    external_reference: "free_test", unit_price: 0,
  }), { status: "paid", balance: 0 });
  assert.equal(currentDb.transactionCount, 1);
  assert.equal(currentDb.read("registrations/free").status, "lisagem_gratis");
  assert.equal(currentDb.read("users/buyer").tokens, 0);
});

test("optimized concurrent distinct purchases never overdraw the account", async () => {
  currentDb = fakeDatabase({
    ...productSeed(10), "orders/two": { ...productSeed()["orders/one"] },
  });
  const results = await Promise.allSettled(["one", "two"].map(id =>
    payPurchaseWithTokens("buyer", { external_reference: `digital_${id}`, unit_price: 8 })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(currentDb.read("users/buyer").tokens, 2);
  assert.equal(currentDb.read("purchase_checkouts/digital_two"), undefined);
});

test("optimized insufficient balance and failed commit leave no checkout, debit or receipt", async () => {
  for (const failure of ["balance", "commit"]) {
    currentDb = fakeDatabase(productSeed(failure === "balance" ? 3 : 20));
    if (failure === "commit") {
      const run = currentDb.runTransaction;
      currentDb.runTransaction = task => run(async transaction => {
        await task(transaction);
        throw new Error("commit failed");
      });
    }
    await assert.rejects(payPurchaseWithTokens("buyer", { external_reference: "digital_one" }),
      failure === "balance" ? /insuficiente/ : /commit failed/);
    assert.equal(currentDb.read("orders/one").status, "pending");
    assert.equal(currentDb.read("users/buyer").tokens, failure === "balance" ? 3 : 20);
    assert.equal(currentDb.read("purchase_checkouts/digital_one"), undefined);
    assert.equal(currentDb.read("purchase_receipts/tokens_digital_one"), undefined);
  }
});

test("optimized tokens reject wrong owners, forged prices and invalid coupons before writing", async () => {
  for (const [uid, body, message] of [
    ["attacker", {}, /pertence/], ["buyer", { unit_price: 0.01 }, /preço mudou/],
    ["buyer", { couponCode: "INVALIDO" }, /Cupom/],
  ]) {
    currentDb = fakeDatabase(productSeed());
    await assert.rejects(payPurchaseWithTokens(uid, { external_reference: "digital_one", ...body }), message);
    assert.equal(currentDb.read("orders/one").status, "pending");
    assert.equal(currentDb.read("users/buyer").tokens, 20);
    assert.equal(currentDb.read("purchase_checkouts/digital_one"), undefined);
  }
});

test("optimized tokens resume legacy pending token checkouts but refuse Mercado Pago checkouts", async () => {
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, "tokens");
  const before = currentDb.transactionCount;
  assert.equal((await payPurchaseWithTokens("buyer", { external_reference: "digital_one", unit_price: 8 })).status, "paid");
  assert.equal(currentDb.transactionCount - before, 1);
  currentDb = fakeDatabase(productSeed());
  await preparePurchase("buyer", { external_reference: "digital_one", unit_price: 8 }, "mercadopago");
  await assert.rejects(payPurchaseWithTokens("buyer", { external_reference: "digital_one" }), /outra forma/);
  assert.equal(currentDb.read("users/buyer").tokens, 20);
});

test("a source removed or changed between pricing and the atomic token commit never debits", async () => {
  for (const mutation of ["missing", "owner", "status", "options"]) {
    currentDb = fakeDatabase(productSeed());
    const run = currentDb.runTransaction;
    currentDb.runTransaction = task => {
      if (mutation === "missing") currentDb.remove("orders/one");
      else currentDb.set("orders/one", { ...currentDb.read("orders/one"),
        ...(mutation === "owner" ? { userId: "attacker" }
          : mutation === "status" ? { status: "canceled" }
            : { productOptions: { quantity: 10 } }),
      });
      return run(task);
    };
    const attempt = payPurchaseWithTokens("buyer", { external_reference: "digital_one" });
    if (mutation === "options") await assert.rejects(attempt, /pedido mudou/);
    else assert.equal((await attempt).status, "needs_review");
    assert.equal(currentDb.read("users/buyer").tokens, 20);
    assert.equal(currentDb.read("purchase_checkouts/digital_one"), undefined);
    assert.equal(currentDb.read("purchase_receipts/tokens_digital_one"), undefined);
  }
});

test("a concurrent conflicting checkout is revalidated inside the token transaction", async () => {
  for (const patch of [{ method: "mercadopago" }, { amountCents: 1 }]) {
    currentDb = fakeDatabase(productSeed());
    const run = currentDb.runTransaction;
    currentDb.runTransaction = task => {
      currentDb.set("purchase_checkouts/digital_one", {
        userId: "buyer", method: "tokens", amountCents: 800, status: "pending", ...patch,
      });
      return run(task);
    };
    await assert.rejects(payPurchaseWithTokens("buyer", { external_reference: "digital_one", unit_price: 8 }),
      patch.method ? /Forma de pagamento/ : /preço exibido/);
    assert.equal(currentDb.read("users/buyer").tokens, 20);
  }
});

test("payment endpoints reject unauthenticated requests before any data or payment processing", async () => {
  for (const name of ["create-preference", "create-token-preference", "confirm-purchase", "confirm-token-purchase", "pay-with-tokens", "check-pix-status", "check-payment-status"]) {
    const { handler } = require(`../functions/${name}`);
    const result = await handler({ httpMethod: "POST", headers: {}, body: "{}" });
    assert.equal(result.statusCode, 401, name);
  }
});

test("the token endpoint returns the existing response contract using the single-transaction path", async () => {
  const path = require.resolve("../functions/pay-with-tokens");
  const verify = firebase.verifyFirebaseUser;
  delete require.cache[path];
  firebase.verifyFirebaseUser = async () => ({ uid: "buyer" });
  try {
    const { handler } = require(path);
    currentDb = fakeDatabase(productSeed());
    const response = await handler({
      httpMethod: "POST", body: JSON.stringify({ external_reference: "digital_one", unit_price: 8 }),
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { status: "paid", balance: 12 });
    assert.equal(currentDb.transactionCount, 1);
    const retry = await handler({
      httpMethod: "POST", body: JSON.stringify({ external_reference: "digital_one", unit_price: 8 }),
    });
    assert.equal(retry.statusCode, 200);
    assert.deepEqual(JSON.parse(retry.body), { status: "already_paid", balance: 12 });
  } finally {
    firebase.verifyFirebaseUser = verify;
    delete require.cache[path];
  }
});

test("admin Verificar validates the provider amount before confirming an event with no customer profile", async () => {
  const path = require.resolve("../functions/confirm-purchase");
  const provider = require("./credit-token-order");
  const verify = firebase.verifyFirebaseUser;
  const findPayments = provider.findPaymentsByExternalReference;
  let providerAmount = 0.01;
  let providerCalls = 0;
  delete require.cache[path];
  firebase.verifyFirebaseUser = async () => ({ uid: "admin" });
  provider.findPaymentsByExternalReference = async reference => {
    providerCalls++;
    return [{ ...payment(reference), transaction_amount: providerAmount }];
  };
  try {
    const { handler } = require(path);
    currentDb = fakeDatabase({
      "users/admin": { role: "Admin" },
      "adminEvents/liga": { name: "Liga", preco: 1, status: "Aberto" },
      "registrations/r": {
        userId: "buyer", status: "pending", eventType: "liga", date: "2026-10-14",
        schedule: "Quarta - 14h", external_reference: "schedule_admin_check",
      },
    });
    await preparePurchase("buyer", { external_reference: "schedule_admin_check", unit_price: 1 }, "mercadopago");
    const request = { httpMethod: "POST", body: JSON.stringify({ external_reference: "schedule_admin_check" }) };
    const mismatch = await handler(request);
    assert.equal(mismatch.statusCode, 409);
    assert.equal(JSON.parse(mismatch.body).reason, "amount_mismatch");
    assert.equal(currentDb.read("registrations/r").status, "pending");
    providerAmount = 1;
    const confirmed = await handler(request);
    assert.equal(confirmed.statusCode, 200);
    assert.equal(JSON.parse(confirmed.body).status, "paid");
    assert.equal(currentDb.read("registrations/r").status, "paid");
    assert.equal(currentDb.read("users/buyer"), undefined);
    assert.equal((await handler(request)).statusCode, 200);
    assert.equal(providerCalls, 2);
  } finally {
    firebase.verifyFirebaseUser = verify;
    provider.findPaymentsByExternalReference = findPayments;
    delete require.cache[path];
  }
});
