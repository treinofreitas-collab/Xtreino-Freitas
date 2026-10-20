const crypto = require("node:crypto");
const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { completePurchase } = require("../shared/purchase");
const { fetchPaymentById } = require("../shared/credit-token-order");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");

function fail(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function validReference(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
}

function paymentMatches(payment, checkout) {
  return Boolean(
    payment
    && String(payment.external_reference || "") === checkout.externalReference
    && String(payment.payment_method_id || "").toLowerCase() === "pix"
    && String(payment.currency_id || "").toUpperCase() === "BRL"
    && Math.round(Number(payment.transaction_amount) * 100) === Number(checkout.amountCents)
  );
}

function idempotencyKey(paymentId) {
  const bytes = crypto.createHash("sha256").update(`xtreino-pix-cancel:${paymentId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Método não permitido." });
  try {
    const user = await verifyFirebaseUser(event);
    const { external_reference: reference } = parseJsonBody(event);
    if (!validReference(reference)) return jsonResponse(400, { error: "Referência inválida." });
    const admin = getAdmin();
    const db = admin.firestore();
    const checkoutRef = db.collection("purchase_checkouts").doc(reference);
    const checkoutSnap = await checkoutRef.get();
    if (!checkoutSnap.exists) return jsonResponse(404, { error: "Checkout não encontrado." });
    const checkout = checkoutSnap.data();
    if (checkout.userId !== user.uid) return jsonResponse(403, { error: "Esta compra não pertence à sua conta." });
    if (checkout.status === "paid") return jsonResponse(200, { status: "paid" });
    if (checkout.method !== "mercadopago" || !checkout.pixPaymentId) {
      return jsonResponse(409, { error: "Não há um Pix pendente para cancelar." });
    }
    if (!process.env.MP_ACCESS_TOKEN) return jsonResponse(503, { error: "Pagamento ainda não configurado." });

    let payment = await fetchPaymentById(checkout.pixPaymentId);
    if (!paymentMatches(payment, checkout)) {
      return jsonResponse(409, { error: "Os dados do pagamento não correspondem a esta compra. A reserva foi mantida." });
    }
    if (payment.status === "approved") {
      const result = await completePurchase(reference, { payment, uid: user.uid });
      return jsonResponse(result.status === "needs_review" ? 409 : 200, result);
    }
    if (["pending", "in_process", "authorized"].includes(payment.status)) {
      const cancelResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(checkout.pixPaymentId)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey(checkout.pixPaymentId),
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (cancelResponse.ok) payment = await cancelResponse.json().catch(() => payment);
      else payment = await fetchPaymentById(checkout.pixPaymentId);
      if (payment.status === "approved") {
        const result = await completePurchase(reference, { payment, uid: user.uid });
        return jsonResponse(result.status === "needs_review" ? 409 : 200, result);
      }
    }
    if (!["cancelled", "rejected", "expired"].includes(payment.status)) {
      return jsonResponse(409, { error: "O Mercado Pago ainda não confirmou o cancelamento. A reserva foi mantida." });
    }

    const paths = Array.isArray(checkout.sourcePaths) ? checkout.sourcePaths : [];
    const expectedCollection = checkout.kind === "event" ? "registrations"
      : checkout.kind === "product" ? "orders" : null;
    if (!expectedCollection || paths.length < 1 || paths.length > 100
      || paths.some(path => !new RegExp(`^${expectedCollection}/[^/]+$`).test(String(path)))) {
      return jsonResponse(409, { error: "Não foi possível validar as reservas vinculadas. A compra precisa de conferência." });
    }
    const sourceRefs = paths.map(path => db.doc(path));
    const result = await db.runTransaction(async transaction => {
      const [freshCheckoutSnap, ...sourceSnaps] = await Promise.all([
        transaction.get(checkoutRef),
        ...sourceRefs.map(ref => transaction.get(ref)),
      ]);
      if (!freshCheckoutSnap.exists) return { status: "not_found" };
      const freshCheckout = freshCheckoutSnap.data();
      if (freshCheckout.userId !== user.uid) fail("Esta compra não pertence à sua conta.", 403);
      if (freshCheckout.status === "paid") return { status: "paid" };
      if (freshCheckout.status !== "pending"
        || String(freshCheckout.pixPaymentId) !== String(checkout.pixPaymentId)) {
        return { status: "needs_review", reason: "checkout_changed" };
      }
      const invalidSource = sourceSnaps.some(source => !source.exists
        || source.data()?.userId !== user.uid
        || source.data()?.status !== "pending");
      if (invalidSource) return { status: "needs_review", reason: "source_changed" };

      sourceRefs.forEach((ref, index) => {
        if (checkout.kind === "event") transaction.delete(ref);
        else transaction.update(ref, {
          status: "cancelled",
          paymentCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      transaction.update(checkoutRef, {
        status: "cancelled",
        pixPaymentStatus: payment.status,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: "cancelled" };
    });
    return jsonResponse(result.status === "needs_review" ? 409 : 200, result);
  } catch (error) {
    const status = Number(error.statusCode) || 503;
    if (status >= 500) console.error("Unable to cancel Pix payment", error.code || "server_error");
    return jsonResponse(status, { error: status >= 500 ? "Não foi possível cancelar o Pix agora. A reserva foi mantida." : error.message });
  }
};
