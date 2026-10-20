const crypto = require("node:crypto");
const { verifyFirebaseUser } = require("../shared/firebase-admin");
const { preparePurchase, completePurchase, siteBaseUrl } = require("../shared/purchase");
const { fetchPaymentById } = require("../shared/credit-token-order");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");

function fail(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function validCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const checkDigit = length => {
    let sum = 0;
    for (let index = 0; index < length; index++) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

function idempotencyKey(reference) {
  const bytes = crypto.createHash("sha256").update(`xtreino-pix:${reference}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validatePaymentForCheckout(payment, checkout) {
  return Boolean(
    payment
    && String(payment.external_reference || "") === checkout.externalReference
    && String(payment.payment_method_id || "").toLowerCase() === "pix"
    && String(payment.currency_id || "").toUpperCase() === "BRL"
    && Math.round(Number(payment.transaction_amount) * 100) === Number(checkout.amountCents)
  );
}

function pixResponse(payment, reference) {
  const transaction = payment?.point_of_interaction?.transaction_data || {};
  if (!payment?.id || !transaction.qr_code || !transaction.qr_code_base64) {
    fail("O Mercado Pago não retornou os dados do QR Code Pix.", 502);
  }
  return {
    status: "pending",
    payment_id: String(payment.id),
    external_reference: reference,
    qr_code: transaction.qr_code,
    qr_code_base64: transaction.qr_code_base64,
    date_of_expiration: payment.date_of_expiration || null,
  };
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Método não permitido." });
  try {
    const user = await verifyFirebaseUser(event);
    if (!process.env.MP_ACCESS_TOKEN) return jsonResponse(503, { error: "Pagamento ainda não configurado." });
    const body = parseJsonBody(event);
    const cpf = String(body.payer_cpf || "").replace(/\D/g, "");
    if (!validCpf(cpf)) return jsonResponse(400, { error: "Informe um CPF válido para gerar o Pix." });

    const { db, checkoutRef, checkout } = await preparePurchase(user.uid, body, "mercadopago");
    if (checkout.status === "paid") return jsonResponse(200, { status: "paid", external_reference: checkout.externalReference });
    if (checkout.paymentUrl || checkout.preferenceId) {
      return jsonResponse(409, { error: "Este pedido já tem um checkout iniciado. Continue o pagamento já aberto." });
    }

    if (checkout.pixPaymentId) {
      const existingPayment = await fetchPaymentById(checkout.pixPaymentId);
      if (!validatePaymentForCheckout(existingPayment, checkout)) {
        return jsonResponse(409, { error: "Não foi possível validar o Pix deste pedido. A compra não foi confirmada." });
      }
      if (existingPayment.status === "approved") {
        const result = await completePurchase(checkout.externalReference, { payment: existingPayment, uid: user.uid });
        return jsonResponse(result.status === "needs_review" ? 409 : 200, {
          status: result.status,
          external_reference: checkout.externalReference,
        });
      }
      if (["pending", "in_process"].includes(existingPayment.status)) {
        return jsonResponse(200, pixResponse(existingPayment, checkout.externalReference));
      }
      return jsonResponse(409, { error: "Este Pix expirou ou foi cancelado. Cancele a reserva e inicie uma nova compra." });
    }

    const claim = await db.runTransaction(async transaction => {
      const current = await transaction.get(checkoutRef);
      if (!current.exists) fail("Checkout não encontrado.", 404);
      const fresh = current.data();
      if (fresh.userId !== user.uid) fail("Esta compra não pertence à sua conta.", 403);
      if (fresh.status === "paid") return { paid: true };
      if (fresh.status === "cancelled") fail("Este checkout foi cancelado. Inicie uma nova compra.");
      if (fresh.paymentUrl || fresh.preferenceId) {
        fail("Este pedido já tem um checkout iniciado. Continue o pagamento já aberto.");
      }
      if (fresh.pixPaymentId) return { paymentId: fresh.pixPaymentId };
      if (fresh.pixPaymentStatus !== "creating") {
        transaction.update(checkoutRef, {
          pixPaymentStatus: "creating",
          pixCreatedAt: require("../shared/firebase-admin").getAdmin().firestore.FieldValue.serverTimestamp(),
        });
      }
      return { create: true };
    });

    if (claim.paid) return jsonResponse(200, { status: "paid", external_reference: checkout.externalReference });
    if (claim.paymentId) {
      const payment = await fetchPaymentById(claim.paymentId);
      if (!validatePaymentForCheckout(payment, checkout)) {
        return jsonResponse(409, { error: "Não foi possível validar o Pix deste pedido. A compra não foi confirmada." });
      }
      if (payment.status === "approved") {
        const result = await completePurchase(checkout.externalReference, { payment, uid: user.uid });
        return jsonResponse(result.status === "needs_review" ? 409 : 200, {
          status: result.status, external_reference: checkout.externalReference,
        });
      }
      if (["pending", "in_process"].includes(payment.status)) {
        return jsonResponse(200, pixResponse(payment, checkout.externalReference));
      }
      return jsonResponse(409, { error: "Este Pix expirou ou foi cancelado. Cancele a reserva e inicie uma nova compra." });
    }

    const email = String(user.email || checkout.customerEmail || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(400, { error: "Adicione um e-mail válido à sua conta para gerar o Pix." });
    }
    const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey(checkout.externalReference),
      },
      body: JSON.stringify({
        transaction_amount: checkout.amountCents / 100,
        description: String(checkout.title || "Compra X-Treino").slice(0, 250),
        payment_method_id: "pix",
        payer: {
          email,
          identification: { type: "CPF", number: cpf },
        },
        external_reference: checkout.externalReference,
        notification_url: `${siteBaseUrl()}/.netlify/functions/mp-webhook`,
        date_of_expiration: expiration,
      }),
    });
    const payment = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok || !validatePaymentForCheckout(payment, checkout)) {
      if (!paymentResponse.ok) console.error("Pix payment creation rejected", paymentResponse.status, payment.error || "provider_error");
      return jsonResponse(502, { error: "Não foi possível gerar o Pix. Nenhuma confirmação foi feita; tente novamente." });
    }
    if (payment.status === "approved") {
      const result = await completePurchase(checkout.externalReference, { payment, uid: user.uid });
      return jsonResponse(result.status === "needs_review" ? 409 : 200, {
        status: result.status,
        external_reference: checkout.externalReference,
      });
    }
    if (!["pending", "in_process"].includes(payment.status)) {
      return jsonResponse(502, { error: "Não foi possível gerar o Pix. Nenhuma confirmação foi feita; tente novamente." });
    }
    const publicData = pixResponse(payment, checkout.externalReference);

    await db.runTransaction(async transaction => {
      const current = await transaction.get(checkoutRef);
      if (!current.exists) fail("Checkout não encontrado.", 404);
      const fresh = current.data();
      if (fresh.userId !== user.uid) fail("Esta compra não pertence à sua conta.", 403);
      if (fresh.status === "cancelled") fail("Este checkout foi cancelado. Inicie uma nova compra.");
      if (fresh.pixPaymentId && String(fresh.pixPaymentId) !== String(payment.id)) {
        fail("Já existe outro Pix associado a este pedido.");
      }
      if (fresh.status !== "paid") {
        transaction.update(checkoutRef, {
          pixPaymentId: String(payment.id),
          pixPaymentStatus: payment.status,
          pixExpiresAt: payment.date_of_expiration || expiration,
        });
      }
    });
    return jsonResponse(200, publicData);
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error("Unable to create Pix payment", error.code || "server_error");
    return jsonResponse(status, { error: status >= 500 ? "Não foi possível iniciar o Pix. Tente novamente." : error.message });
  }
};

exports.validCpf = validCpf;
