const { getAdmin } = require("./firebase-admin");
const { toCents, validateApprovedPayment } = require("./token-purchase");

function fail(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function validReference(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) {
    fail("Referência de compra inválida.", 400);
  }
  return value;
}

function siteBaseUrl() {
  return String(process.env.PUBLIC_SITE_URL || process.env.URL || "https://orgfreitas.com.br")
    .replace(/\/+$/, "");
}

function safeBackUrl(value) {
  const base = new URL(siteBaseUrl());
  try {
    const url = new URL(value);
    if (url.origin === base.origin && url.protocol === "https:") return url.toString();
  } catch (_) {}
  return `${base.origin}/client.html`;
}

// Prices come from the administrator's catalog, never from a browser total.
async function productPrice(db, order) {
  const id = validReference(order.productId);
  const snap = await db.collection("products").doc(id).get();
  if (!snap.exists) fail("Produto não encontrado no catálogo.", 404);
  const product = snap.data();
  if (product.isActive === false || product.active === false) fail("Produto indisponível.");
  const options = order.productOptions || {};
  let price = Number(product.price);
  if (id === "imagens") {
    const quantity = Number(options.quantity || options.maps?.length || 1);
    const prices = { 1: 2, 2: 4, 3: 5, 4: 6, 5: 7 };
    if (!prices[quantity]) fail("Quantidade de mapas inválida.", 400);
    price = prices[quantity];
  } else if (["imagem", "imagens"].includes(String(product.category).toLowerCase())) {
    const quantity = Number(options.maps?.length || options.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) fail("Quantidade inválida.", 400);
    price = Number(product.priceOptions?.[0]?.price ?? product.price) * quantity;
  }
  const cents = toCents(price);
  if (cents == null || cents <= 0) fail("Produto sem preço válido.");
  const key = options.platform === "android" ? options.brand : options.platform;
  return {
    cents,
    title: product.name || id,
    downloadLink: product.downloadLinks?.[key] || product.downloadLinks?.[options.platform] || product.downloadLink || "",
    productCategory: product.category || "",
  };
}

async function eventPrice(db, registration, forcePay = false) {
  const type = validReference(registration.eventType);
  let snap = await db.collection("adminEvents").doc(type).get();
  if (!snap.exists) {
    const found = await db.collection("adminEvents").where("eventType", "==", type).limit(1).get();
    snap = found.empty ? null : found.docs[0];
  }
  const config = snap?.exists ? snap.data() : null;
  const defaults = { "modo-liga": 3, "camp-freitas": 8, "camp-final": 100, "semanal-freitas": 3.5, "xtreino-tokens": 1 };
  if (!config && !(type in defaults)) fail("Evento não encontrado.", 404);
  if (config?.status && !["Aberto", "Em breve"].includes(config.status)) fail("Evento indisponível.");
  const hourMatch = String(registration.hour || registration.schedule || "").match(/(\d{1,2})(?:h|:|$)/);
  const hour = hourMatch ? Number(hourMatch[1]) : null;
  const date = registration.date || registration.eventDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || hour == null || hour > 23) {
    fail("Data ou horário do evento inválido.", 400);
  }
  const overrides = await db.collection("schedule_overrides").where("date", "==", date).get();
  const override = overrides.docs.map(d => d.data()).find(o =>
    (!o.eventType || o.eventType === type) && Number.parseInt(o.hour || o.hh, 10) === hour);
  if (override?.locked === true && !override?.freeUntil) fail("Horário indisponível.");
  const freeUntil = override?.freeUntil?.toMillis?.() || new Date(override?.freeUntil || 0).getTime();
  const free = !forcePay && (freeUntil > Date.now() || override?.free === true || override?.isFree === true);
  let price = config ? (config.entrada === "GRÁTIS" ? 0 : Number(config.preco || 0)) : defaults[type];
  if (!free && price > 0) {
    if (type === "semanal-freitas" && hour === 22) price = 7;
    if (type === "camp-final") price = 100;
    const promos = {
      "2024-11-17": { price: 25, hours: [21, 22] },
      "2025-11-17": { price: 25, hours: [21, 22] },
      "2025-11-13": { price: 20, hours: [21, 22, 23] },
      "2025-11-14": { price: 20, hours: [20] },
    };
    if (type === "camp-freitas" && promos[date]?.hours.includes(hour)) price = promos[date].price;
    if (type === "camp-freitas" && ["2024-11-22", "2024-11-23", "2025-11-22", "2025-11-23"].includes(date) && hour === 17) price = 60;
  }
  const cents = toCents(free ? 0 : price);
  if (cents == null) fail("Evento sem preço válido.");
  return { cents, title: config?.name || registration.title || type };
}

async function discountedPrice(db, originalCents, code, kind) {
  if (!code) return { amountCents: originalCents };
  if (typeof code !== "string" || code.length > 80) fail("Cupom inválido.", 400);
  const found = await db.collection("coupons").where("code", "==", code.trim().toUpperCase()).limit(1).get();
  if (found.empty) fail("Cupom não encontrado.");
  const coupon = found.docs[0].data();
  const expiry = coupon.expirationDate?.toDate?.() || (coupon.expirationDate ? new Date(coupon.expirationDate) : null);
  if (coupon.isActive !== true || (expiry && !(expiry.getTime() > Date.now()))) fail("Cupom inativo ou expirado.");
  if (!["both", kind === "event" ? "events" : "store"].includes(coupon.usageType || "both")) fail("Cupom não válido para esta compra.");
  const value = Number(coupon.discountValue);
  if (!Number.isFinite(value) || value <= 0 || (coupon.discountType === "percentage" && value > 100)) fail("Desconto inválido.");
  const discount = coupon.discountType === "percentage" ? Math.round(originalCents * value / 100)
    : coupon.discountType === "fixed" ? toCents(value) : null;
  if (discount == null) fail("Desconto inválido.");
  return {
    amountCents: Math.max(0, originalCents - discount),
    couponId: found.docs[0].id,
    couponCode: coupon.code,
  };
}

async function preparePurchase(uid, body, method) {
  const reference = validReference(body.external_reference);
  const admin = getAdmin();
  const db = admin.firestore();
  const checkoutRef = db.collection("purchase_checkouts").doc(reference);
  const existing = await checkoutRef.get();
  if (existing.exists) {
    const checkout = existing.data();
    if (checkout.userId !== uid) fail("Esta compra não pertence à sua conta.", 403);
    if (checkout.method !== method) fail("Esta compra já usa outra forma de pagamento.");
    if (body.unit_price != null && toCents(body.unit_price) !== checkout.amountCents) {
      fail("O preço exibido não corresponde a este pedido. Confira a compra antes de continuar.");
    }
    return { db, checkoutRef, checkout };
  }
  let sources, kind, product;
  if (reference.startsWith("digital_")) {
    const doc = await db.collection("orders").doc(reference.slice(8)).get();
    if (!doc.exists) fail("Pedido não encontrado. Nenhuma cobrança foi iniciada.", 404);
    sources = [doc];
    kind = "product";
    product = await productPrice(db, doc.data());
  } else {
    const found = await db.collection("registrations").where("external_reference", "==", reference).limit(101).get();
    if (found.empty || found.size > 100) fail("Reservas não encontradas ou quantidade inválida.", 404);
    sources = found.docs;
    kind = "event";
  }
  for (const source of sources) {
    if (source.data().userId !== uid) fail("Esta compra não pertence à sua conta.", 403);
    if (source.data().status !== "pending") fail("Esta compra não está pendente.");
    if (source.data().type === "tokens_purchase") fail("Use o checkout de compra de tokens.");
  }
  const prices = kind === "product" ? [product] : await Promise.all(sources.map(s => eventPrice(db, s.data(), body.forcePay === true)));
  const originalCents = prices.reduce((sum, p) => sum + p.cents, 0);
  const discount = await discountedPrice(db, originalCents, body.couponCode || body.coupon_info?.code || sources[0].data().couponCode, kind);
  if (method === "mercadopago" && discount.amountCents <= 0) fail("Para uma reserva gratuita, use a confirmação sem cobrança.");
  if (body.unit_price != null && toCents(body.unit_price) !== discount.amountCents) {
    fail("O preço mudou. Reabra o produto ou evento antes de pagar.");
  }
  const checkout = {
    userId: uid, kind, method, externalReference: reference, orderId: reference,
    sourcePaths: sources.map(s => s.ref.path), sourceAmountCents: prices.map(p => p.cents),
    title: kind === "product" ? product.title : `${prices[0].title} (${sources.length} reserva(s))`,
    originalCents, ...discount, status: "pending", currency: "BRL",
    ...(product ? { downloadLink: product.downloadLink, productCategory: product.productCategory } : {}),
  };
  // Serialize concurrent attempts for the same reference.
  await db.runTransaction(async transaction => {
    const current = await transaction.get(checkoutRef);
    const freshSources = await Promise.all(sources.map(s => transaction.get(s.ref)));
    if (current.exists) {
      if (current.data().userId !== uid || current.data().method !== method) fail("Referência já utilizada.");
      return;
    }
    if (freshSources.some(s => !s.exists || s.data().userId !== uid || s.data().status !== "pending")) {
      fail("O pedido mudou. Tente novamente.");
    }
    transaction.create(checkoutRef, { ...checkout, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  const saved = await checkoutRef.get();
  return { db, checkoutRef, checkout: saved.data() };
}

async function completePurchase(reference, { payment = null, uid = null } = {}) {
  validReference(reference);
  const admin = getAdmin();
  const db = admin.firestore();
  const checkoutRef = db.collection("purchase_checkouts").doc(reference);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(checkoutRef);
    if (!snapshot.exists) return { status: "not_found" };
    const checkout = snapshot.data();
    if (uid && checkout.userId !== uid) fail("Esta compra não pertence à sua conta.", 403);
    if (payment) {
      if (checkout.method !== "mercadopago") return { status: "needs_review" };
      if (!validateApprovedPayment(payment, checkout).valid) return { status: "needs_review" };
    } else if (!uid || checkout.method !== "tokens") fail("Forma de pagamento inválida.", 403);
    const refs = checkout.sourcePaths.map(path => db.doc(path));
    const sources = await Promise.all(refs.map(ref => transaction.get(ref)));
    const userRef = db.collection("users").doc(checkout.userId);
    const user = await transaction.get(userRef);
    const receiptRef = db.collection("purchase_receipts").doc(payment ? `mp_${payment.id}` : `tokens_${reference}`);
    const receipt = await transaction.get(receiptRef);
    const balance = Number(user.data()?.tokens || 0);
    if (checkout.status === "paid") {
      if (payment && String(checkout.paymentId) !== String(payment.id)) return { status: "needs_review" };
      return { status: "already_paid", balance };
    }
    if (receipt.exists || !user.exists || sources.some(s => !s.exists || s.data().userId !== checkout.userId || s.data().status !== "pending")) {
      return { status: "needs_review" };
    }
    const debit = checkout.amountCents / 100;
    if (!payment && (!Number.isFinite(balance) || balance < debit)) fail("Saldo de tokens insuficiente.");
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const patch = {
      status: "paid", paidAt: timestamp,
      external_reference: reference, verifiedOnServer: true,
      ...(payment ? { paymentId: String(payment.id) } : { paidWithTokens: true, tokensUsed: debit }),
    };
    let allocatedCents = 0;
    sources.forEach((source, index) => {
      const cents = index === sources.length - 1 ? checkout.amountCents - allocatedCents
        : Math.floor(checkout.amountCents * checkout.sourceAmountCents[index] / (checkout.originalCents || 1));
      allocatedCents += cents;
      transaction.update(refs[index], {
      ...patch,
      ...(checkout.kind === "event" && checkout.originalCents === 0 && source.data().isFreeEvent === true
        ? { status: source.data().freeParticipationStatus === "lisagem_gratis" ? "lisagem_gratis" : "confirmed" } : {}),
      ...(!payment ? { tokensUsed: cents / 100 } : {}),
      ...(checkout.kind === "product" ? {
        downloadLink: checkout.downloadLink || "", productCategory: checkout.productCategory || "",
        amount: debit, total: debit,
      } : {}),
      });
      if (checkout.kind === "product" && source.data().productId === "passe-booyah") {
        transaction.set(db.collection("notifications").doc(`purchase_${reference}`), {
          title: "Novo pedido — Passe Booyah", type: "admin_booyah",
          message: `Pedido ${source.id} confirmado. Player ID: ${source.data().productOptions?.playerId || "Não informado"}`,
          createdAt: timestamp,
        });
      }
    });
    if (checkout.kind === "event") {
      const first = sources[0].data();
      transaction.set(db.collection("orders").doc(`event_${reference}`), {
        ...patch, type: "event", title: checkout.title, item: checkout.title,
        userId: checkout.userId, uid: checkout.userId,
        customer: first.email || "", customerName: first.teamName || "",
        eventType: first.eventType || "", eventDate: first.date || "", schedule: first.schedule || "",
        amount: debit, total: debit, quantity: sources.length, createdAt: timestamp,
      });
    }
    if (!payment) transaction.update(userRef, { tokens: Number((balance - debit).toFixed(2)), updatedAt: timestamp });
    transaction.create(receiptRef, { reference, userId: checkout.userId, amountCents: checkout.amountCents, createdAt: timestamp });
    transaction.update(checkoutRef, { status: "paid", paidAt: timestamp, ...(payment ? { paymentId: String(payment.id) } : {}) });
    return { status: "paid", balance: payment ? balance : Number((balance - debit).toFixed(2)) };
  });
}

module.exports = { preparePurchase, completePurchase, safeBackUrl, siteBaseUrl, productPrice, eventPrice, discountedPrice };

module.exports.assertCanConfirm = async (uid, ownerUid) => {
  if (uid === ownerUid) return;
  const profile = await getAdmin().firestore().collection("users").doc(uid).get();
  const role = String(profile.data()?.role || "").toLowerCase();
  if (!["admin", "ceo", "gerente", "staff", "moderador", "vendedor", "operador"].includes(role)) {
    fail("Esta compra não pertence à sua conta.", 403);
  }
};
