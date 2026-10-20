const { getAdmin } = require("./firebase-admin");
const { toCents, validateApprovedPayment } = require("./token-purchase");
const { findAffiliateRef } = require("./credit-token-order");
const { isDeepStrictEqual } = require("node:util");
const CAMP_SEASON_7_START_DATE = "2026-11-15";

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

function normalizeEventType(value) {
  if (typeof value !== "string") fail("Evento inválido.", 400);
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/[\s_]+/g, "-");
  const aliases = { camp: "camp-freitas", "treino-modo-liga": "modo-liga", semanal: "semanal-freitas" };
  return validReference(aliases[normalized] || normalized);
}

function isCampSeason7(value) {
  const normalized = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.includes("camp") && /\bseason\s*7\b/.test(normalized);
}

function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
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

async function eventPrice(db, registration, forcePay = false, reads = new Map()) {
  const type = normalizeEventType(registration.eventType);
  const hourMatch = String(registration.hour || registration.schedule || "").match(/(\d{1,2})(?:h|:|$)/);
  const hour = hourMatch ? Number(hourMatch[1]) : null;
  const date = registration.date || registration.eventDate;
  if (!validIsoDate(date) || hour == null || hour > 23) {
    fail("Data ou horário do evento inválido.", 400);
  }
  // Share only reads from this purchase, never a cross-request/stale price cache.
  const readOnce = (key, read) => {
    if (!reads.has(key)) reads.set(key, read());
    return reads.get(key);
  };
  const adminEventId = registration.adminEventId ? validReference(registration.adminEventId) : null;
  const [snap, overrides] = await Promise.all([
    readOnce(adminEventId ? `event:${type}:${adminEventId}` : `event:${type}`, async () => {
      if (adminEventId) {
        const exactEvent = await db.collection("adminEvents").doc(adminEventId).get();
        if (!exactEvent.exists) fail("Evento não encontrado no catálogo.", 404);
        return exactEvent;
      }
      const direct = await db.collection("adminEvents").doc(type).get();
      if (direct.exists) return direct;
      const found = await db.collection("adminEvents").where("eventType", "==", type).limit(1).get();
      return found.empty ? null : found.docs[0];
    }),
    readOnce(`overrides:${date}`, () => db.collection("schedule_overrides").where("date", "==", date).get()),
  ]);
  const config = snap?.exists ? snap.data() : null;
  if (adminEventId && config?.eventType && normalizeEventType(config.eventType) !== type) {
    fail("O evento selecionado não corresponde a esta reserva.", 400);
  }
  const isSeason7 = isCampSeason7(config?.name || registration.title);
  if (isSeason7 && date < CAMP_SEASON_7_START_DATE) {
    fail("As inscrições para o Camp Season 7 começam em 15/11/2026.", 400);
  }
  if (registration.eventLinkDateScoped === true && (!adminEventId || !isSeason7)) {
    fail("Não foi possível validar o evento do Camp Season 7.", 400);
  }
  const defaults = { "modo-liga": 3, "camp-freitas": 8, "camp-final": 100, "semanal-freitas": 3.5, "xtreino-tokens": 1 };
  if (!config && !(type in defaults)) fail("Evento não encontrado.", 404);
  if (config?.status && !["Aberto", "Em breve"].includes(config.status)) fail("Evento indisponível.");
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

// Resolve trusted pricing without writing a checkout yet.
async function buildPurchase(uid, body, method) {
  const reference = validReference(body.external_reference);
  const admin = getAdmin();
  const db = admin.firestore();
  const checkoutRef = db.collection("purchase_checkouts").doc(reference);
  const existing = await checkoutRef.get();
  if (existing.exists) {
    const checkout = existing.data();
    if (checkout.userId !== uid) fail("Esta compra não pertence à sua conta.", 403);
    if (checkout.method !== method) fail("Esta compra já usa outra forma de pagamento.");
    if (checkout.status === "cancelled") fail("Este checkout foi cancelado. Inicie uma nova compra.");
    if (body.unit_price != null && toCents(body.unit_price) !== checkout.amountCents) {
      fail("O preço exibido não corresponde a este pedido. Confira a compra antes de continuar.");
    }
    return { db, checkoutRef, checkout, existing: true };
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
  const reads = new Map();
  const prices = kind === "product" ? [product] : await Promise.all(sources.map(s => eventPrice(db, s.data(), body.forcePay === true, reads)));
  const originalCents = prices.reduce((sum, p) => sum + p.cents, 0);
  const discount = await discountedPrice(db, originalCents, body.couponCode || body.coupon_info?.code || sources[0].data().couponCode, kind);
  if (method === "mercadopago" && discount.amountCents <= 0) fail("Para uma reserva gratuita, use a confirmação sem cobrança.");
  if (body.unit_price != null && toCents(body.unit_price) !== discount.amountCents) {
    fail("O preço mudou. Reabra o produto ou evento antes de pagar.");
  }
  const affiliateCodes = [...new Set(sources
    .map(source => source.data().affiliateCode)
    .filter(code => typeof code === "string" && code.trim())
    .map(code => code.trim()))];
  const affiliateRef = affiliateCodes.length === 1
    ? await findAffiliateRef(db, affiliateCodes[0])
    : null;
  const firstSource = sources[0].data();
  const checkout = {
    userId: uid, kind, method, externalReference: reference, orderId: reference,
    sourcePaths: sources.map(s => s.ref.path), sourceAmountCents: prices.map(p => p.cents),
    title: kind === "product" ? product.title : `${prices[0].title} (${sources.length} reserva(s))`,
    originalCents, ...discount, status: "pending", currency: "BRL",
    ...(affiliateRef ? { affiliateId: affiliateRef.id } : {}),
    customerEmail: firstSource.email || firstSource.buyerEmail || firstSource.customer || null,
    customerName: firstSource.teamName || firstSource.customerName || null,
    ...(product ? { downloadLink: product.downloadLink, productCategory: product.productCategory } : {}),
  };
  return { db, checkoutRef, checkout, sources, existing: false };
}

async function preparePurchase(uid, body, method) {
  const prepared = await buildPurchase(uid, body, method);
  const { db, checkoutRef, checkout, sources } = prepared;
  if (prepared.existing) return { db, checkoutRef, checkout };
  const admin = getAdmin();
  // Serialize concurrent attempts for the same reference.
  const saved = await db.runTransaction(async transaction => {
    const [current, freshSources] = await Promise.all([
      transaction.get(checkoutRef),
      Promise.all(sources.map(s => transaction.get(s.ref))),
    ]);
    if (current.exists) {
      if (current.data().userId !== uid || current.data().method !== method) fail("Referência já utilizada.");
      return current.data();
    }
    if (freshSources.some(s => !s.exists || s.data().userId !== uid || s.data().status !== "pending")) {
      fail("O pedido mudou. Tente novamente.");
    }
    transaction.create(checkoutRef, { ...checkout, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return checkout;
  });
  return { db, checkoutRef, checkout: saved };
}

async function completePurchase(reference, { payment = null, uid = null } = {}) {
  validReference(reference);
  const admin = getAdmin();
  const db = admin.firestore();
  const checkoutRef = db.collection("purchase_checkouts").doc(reference);
  const existingCheckout = await checkoutRef.get();
  const affiliateRef = existingCheckout.exists && existingCheckout.data().affiliateId
    ? db.collection("users").doc(existingCheckout.data().affiliateId)
    : null;
  return db.runTransaction(transaction => settlePurchase(transaction, reference, {
    payment, uid, admin, db, checkoutRef, affiliateRef,
  }));
}

// Tokens create the checkout, debit, receipt and delivery in one atomic commit.
async function payPurchaseWithTokens(uid, body) {
  const prepared = await buildPurchase(uid, body, "tokens");
  const { db, checkoutRef, checkout, sources } = prepared;
  const admin = getAdmin();
  const affiliateRef = checkout.affiliateId ? db.collection("users").doc(checkout.affiliateId) : null;
  return db.runTransaction(transaction => settlePurchase(transaction, checkout.externalReference, {
    uid, admin, db, checkoutRef, preparedCheckout: checkout,
    preparedSources: sources, expectedTotal: body.unit_price, affiliateRef,
  }));
}

function sourcePricingFields(source) {
  const fields = ["userId", "type", "productId", "productOptions", "eventType",
    "adminEventId", "eventLinkDateScoped", "date", "eventDate", "hour", "schedule",
    "couponCode", "isFreeEvent", "freeParticipationStatus"];
  return Object.fromEntries(fields.map(field => [field, source[field]]));
}

async function settlePurchase(transaction, reference, {
  payment = null, uid = null, admin, db, checkoutRef,
  preparedCheckout = null, preparedSources = null, expectedTotal = null, affiliateRef = null,
}) {
  const review = (reason, message) => ({ status: "needs_review", reason, message });
    const snapshot = await transaction.get(checkoutRef);
    if (!snapshot.exists && !preparedCheckout) return { status: "not_found" };
    const checkout = snapshot.exists ? snapshot.data() : preparedCheckout;
    if (uid && checkout.userId !== uid) fail("Esta compra não pertence à sua conta.", 403);
    if (expectedTotal != null && toCents(expectedTotal) !== checkout.amountCents) {
      fail("O preço exibido não corresponde a este pedido. Confira a compra antes de continuar.");
    }
    if (payment) {
      if (checkout.method !== "mercadopago") {
        return review("checkout_method_mismatch", "Este checkout não foi criado para pagamento pelo Mercado Pago.");
      }
      const paymentCheck = validateApprovedPayment(payment, checkout);
      if (!paymentCheck.valid) {
        const paymentMessages = {
          not_found: "Não foi possível localizar o pagamento no Mercado Pago.",
          pending: "O Mercado Pago ainda informa que este pagamento está pendente.",
          rejected: "O Mercado Pago informa que este pagamento foi rejeitado.",
          cancelled: "O Mercado Pago informa que este pagamento foi cancelado.",
          external_reference_mismatch: "A referência do pagamento não corresponde à referência do checkout.",
          currency_mismatch: "A moeda do pagamento não corresponde a BRL.",
          amount_mismatch: "O valor aprovado não corresponde ao valor salvo no checkout.",
        };
        return review(paymentCheck.status, paymentMessages[paymentCheck.status] || "Os dados do pagamento não passaram na validação.");
      }
    } else if (!uid || checkout.method !== "tokens") fail("Forma de pagamento inválida.", 403);
    const refs = checkout.sourcePaths.map(path => db.doc(path));
    const userRef = db.collection("users").doc(checkout.userId);
    const receiptRef = db.collection("purchase_receipts").doc(payment ? `mp_${payment.id}` : `tokens_${reference}`);
    const [sources, user, receipt] = await Promise.all([
      Promise.all(refs.map(ref => transaction.get(ref))),
      transaction.get(userRef),
      transaction.get(receiptRef),
    ]);
    const affiliateSaleRef = db.collection("affiliate_sales").doc(`purchase_${reference}`);
    const managerSaleRef = db.collection("affiliate_sales").doc(`manager_purchase_${reference}`);
    const [affiliateSnap, affiliateSaleSnap, managerSaleSnap] = await Promise.all([
      affiliateRef ? transaction.get(affiliateRef) : Promise.resolve(null),
      transaction.get(affiliateSaleRef),
      transaction.get(managerSaleRef),
    ]);
    const balance = Number(user.data()?.tokens || 0);
    if (checkout.status === "paid") {
      if (payment && String(checkout.paymentId) !== String(payment.id)) {
        return review("checkout_paid_with_other_payment", "Este checkout já está marcado como pago com outra transação.");
      }
      return { status: "already_paid", balance };
    }
    if (receipt.exists) {
      return review("receipt_already_exists", "Já existe um comprovante desta transação, mas o checkout ainda não está conciliado.");
    }
    // A users document is a profile, not proof of an approved event payment.
    // Token debits still require that document; MP events use the trusted
    // checkout, exact provider payment and reservation ownership instead.
    if (!user.exists && (!payment || checkout.kind !== "event")) {
      return review("account_missing", "O cadastro da conta responsável pelo checkout não foi encontrado.");
    }
    const invalidSource = sources.find(source => !source.exists
      || source.data()?.userId !== checkout.userId
      || source.data()?.status !== "pending");
    if (invalidSource) {
      if (!invalidSource.exists) {
        return review("reservation_missing", "Uma das inscrições vinculadas ao checkout não foi encontrada.");
      }
      if (invalidSource.data()?.userId !== checkout.userId) {
        return review("reservation_owner_mismatch", "Uma das inscrições vinculadas não pertence à conta deste checkout.");
      }
      return review("reservation_not_pending", "Uma das inscrições vinculadas já não está pendente; é necessária uma conferência.");
    }
    if (!snapshot.exists && preparedSources && sources.some((source, index) =>
      !isDeepStrictEqual(sourcePricingFields(source.data()), sourcePricingFields(preparedSources[index].data())))) {
      fail("O pedido mudou. Tente novamente.");
    }
    const debit = checkout.amountCents / 100;
    if (!payment && (!Number.isFinite(balance) || balance < debit)) fail("Saldo de tokens insuficiente.");
    let affiliateCommission = null;
    let managerCommission = null;
    const affiliate = affiliateSnap?.exists ? affiliateSnap.data() : null;
    const buyerEmail = String(checkout.customerEmail || sources[0]?.data()?.email || "").toLowerCase();
    const saleTitle = String(checkout.title || "");
    const isShirt = checkout.kind === "product" && /camisa|manto/i.test(saleTitle);
    if (
      affiliate
      && affiliate.role === "Afiliado"
      && affiliate.affiliateStatus !== "inactive"
      && affiliateRef.id !== checkout.userId
      && String(affiliate.email || "").toLowerCase() !== buyerEmail
      && !isShirt
      && !affiliateSaleSnap?.exists
    ) {
      const commissionRate = Number(
        checkout.kind === "event"
          ? (affiliate.commissionRateEvents || affiliate.commissionRate || 10)
          : (affiliate.commissionRateProducts || affiliate.commissionRate || 10),
      );
      const saleValue = Number(checkout.amountCents) / 100;
      const commissionAmount = saleValue * commissionRate / 100;
      if (
        Number.isFinite(commissionRate)
        && commissionRate >= 0
        && commissionRate <= 100
        && saleValue > 0
        && commissionAmount > 0
      ) {
        affiliateCommission = {
          affiliateId: affiliateRef.id,
          saleValue,
          commissionRate,
          commissionAmount,
        };
        const managerId = affiliate.managerId;
        const managerCommissionRate = Number(affiliate.managerCommissionRate);
        if (
          managerId
          && managerId !== checkout.userId
          && managerId !== affiliateRef.id
          && !managerSaleSnap?.exists
          && Number.isFinite(managerCommissionRate)
          && managerCommissionRate > 0
          && managerCommissionRate <= 100
        ) {
          const managerRef = db.collection("users").doc(managerId);
          const managerSnap = await transaction.get(managerRef);
          const managerCommissionAmount = commissionAmount * managerCommissionRate / 100;
          if (managerSnap.exists && managerCommissionAmount > 0) {
            managerCommission = {
              affiliateId: managerId,
              managerEmail: affiliate.managerEmail || null,
              sourceAffiliateId: affiliateRef.id,
              saleValue,
              affiliateCommissionAmount: commissionAmount,
              commissionRate: managerCommissionRate,
              commissionAmount: managerCommissionAmount,
            };
          }
        }
      }
    }
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
    });
    if (checkout.kind === "event") {
      const first = sources[0].data();
      transaction.set(db.collection("orders").doc(`event_${reference}`), {
        ...patch, type: "event", title: checkout.title, item: checkout.title,
        userId: checkout.userId, uid: checkout.userId,
        customer: first.email || "", customerName: first.teamName || "",
        phone: first.phone || first.teamPhone || first.contact || "",
        eventType: first.eventType || "", eventDate: first.date || "", schedule: first.schedule || "",
        amount: debit, total: debit, quantity: sources.length, createdAt: timestamp,
      });
    }
    if (!payment) transaction.update(userRef, { tokens: Number((balance - debit).toFixed(2)), updatedAt: timestamp });
    transaction.create(receiptRef, { reference, userId: checkout.userId, amountCents: checkout.amountCents, createdAt: timestamp });
    if (affiliateCommission) {
      transaction.create(affiliateSaleRef, {
        affiliateId: affiliateCommission.affiliateId,
        orderId: reference,
        customerEmail: checkout.customerEmail || null,
        customerName: checkout.customerName || null,
        productName: checkout.title || "",
        saleValue: affiliateCommission.saleValue,
        commissionRate: affiliateCommission.commissionRate,
        commissionAmount: affiliateCommission.commissionAmount,
        saleType: checkout.kind,
        type: "affiliate",
        status: "pending",
        createdAt: timestamp,
      });
    }
    if (managerCommission) {
      transaction.create(managerSaleRef, {
        affiliateId: managerCommission.affiliateId,
        managerEmail: managerCommission.managerEmail,
        sourceAffiliateId: managerCommission.sourceAffiliateId,
        sourceAffiliateEmail: checkout.customerEmail || null,
        orderId: reference,
        customerEmail: checkout.customerEmail || null,
        customerName: checkout.customerName || null,
        productName: checkout.title || "",
        saleValue: managerCommission.saleValue,
        affiliateCommissionAmount: managerCommission.affiliateCommissionAmount,
        commissionRate: managerCommission.commissionRate,
        commissionAmount: managerCommission.commissionAmount,
        saleType: checkout.kind,
        type: "manager_commission",
        status: "pending",
        createdAt: timestamp,
      });
    }
    const paidCheckout = { status: "paid", paidAt: timestamp, ...(payment ? { paymentId: String(payment.id) } : {}) };
    if (snapshot.exists) transaction.update(checkoutRef, paidCheckout);
    else transaction.create(checkoutRef, { ...checkout, ...paidCheckout, createdAt: timestamp });
    return { status: "paid", balance: payment ? balance : Number((balance - debit).toFixed(2)) };
}

module.exports = { preparePurchase, completePurchase, payPurchaseWithTokens, safeBackUrl, siteBaseUrl, productPrice, eventPrice, discountedPrice };

module.exports.assertCanConfirm = async (uid, ownerUid) => {
  if (uid === ownerUid) return;
  const profile = await getAdmin().firestore().collection("users").doc(uid).get();
  const role = String(profile.data()?.role || "").toLowerCase();
  if (!["admin", "ceo", "gerente", "staff", "moderador", "vendedor", "operador"].includes(role)) {
    fail("Esta compra não pertence à sua conta.", 403);
  }
};
