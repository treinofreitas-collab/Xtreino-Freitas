const crypto = require("node:crypto");
const { verifyFirebaseUser } = require("../shared/firebase-admin");
const { preparePurchase, siteBaseUrl } = require("../shared/purchase");
const { fetchPaymentById } = require("../shared/credit-token-order");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");

const PIX_EXPIRATION_MINUTES = 30;

function pixResponse(payment, externalReference) {
  if (payment?.id == null) return null;
  const transaction = payment?.point_of_interaction?.transaction_data || {};
  const qrCode = transaction.qr_code;
  const qrCodeBase64 = transaction.qr_code_base64;
  if (payment?.status !== "approved" && (!qrCode || !qrCodeBase64)) {
    return null;
  }
  return {
    payment_id: String(payment.id),
    payment_status: payment.status,
    external_reference: externalReference,
    qr_code: qrCode || "",
    qr_code_base64: qrCodeBase64 || "",
    expiration_date: payment.date_of_expiration || null,
  };
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Método não permitido." });

  try {
    const user = await verifyFirebaseUser(event);
    if (!process.env.MP_ACCESS_TOKEN) return jsonResponse(503, { error: "Pagamento ainda não configurado." });
    if (!process.env.MP_WEBHOOK_SECRET) return jsonResponse(503, { error: "Confirmação automática do Pix ainda não configurada." });

    const body = parseJsonBody(event);
    const { checkoutRef, checkout } = await preparePurchase(user.uid, body, "mercadopago");
    if (checkout.status === "paid") return jsonResponse(409, { error: "Este pedido já foi pago." });
    if (checkout.kind !== "event" && checkout.kind !== "product") {
      return jsonResponse(400, { error: "Pix disponível somente para eventos e produtos." });
    }
    if (checkout.paymentUrl) {
      return jsonResponse(409, { error: "Este pedido já iniciou outro checkout. Refaça a reserva para gerar um novo Pix." });
    }

    if (checkout.pixPaymentId) {
      const existingPayment = await fetchPaymentById(checkout.pixPaymentId);
      const existingPix = pixResponse(existingPayment, checkout.externalReference);
      if (existingPix && existingPayment.status === "pending") {
        const existingExpiry = new Date(existingPayment.date_of_expiration || checkout.pixExpiresAt || 0).getTime();
        if (Number.isFinite(existingExpiry) && existingExpiry <= Date.now()) {
          return jsonResponse(409, { error: "Este Pix expirou. Refaça a reserva para gerar outro código." });
        }
        return jsonResponse(200, existingPix);
      }
      if (existingPayment.status === "approved") {
        return jsonResponse(200, existingPix);
      }
      return jsonResponse(409, { error: "Este Pix expirou ou foi encerrado. Refaça a reserva para gerar outro código." });
    }

    const payerEmail = String(user.email || checkout.customerEmail || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      return jsonResponse(400, { error: "Não foi possível identificar um e-mail válido para gerar o Pix. Atualize seu cadastro e tente novamente." });
    }

    const expirationDate = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000).toISOString();
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `pix_${crypto.createHash("sha256").update(checkout.externalReference).digest("hex").slice(0, 60)}`,
      },
      body: JSON.stringify({
        transaction_amount: checkout.amountCents / 100,
        description: checkout.title,
        payment_method_id: "pix",
        external_reference: checkout.externalReference,
        notification_url: `${siteBaseUrl()}/.netlify/functions/mp-webhook`,
        date_of_expiration: expirationDate,
        payer: { email: payerEmail },
      }),
    });
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Mercado Pago Pix creation failed", response.status, payment?.cause?.[0]?.code || "provider_error");
      return jsonResponse(502, { error: "Não foi possível gerar o Pix agora. Nenhuma confirmação foi registrada." });
    }

    if (payment?.id != null) {
      await checkoutRef.update({
        pixPaymentId: String(payment.id),
        pixStatus: payment.status || "pending",
        pixExpiresAt: payment.date_of_expiration || expirationDate,
      });
    }
    const result = pixResponse(payment, checkout.externalReference);
    if (!result) {
      console.error("Mercado Pago returned no Pix payload", payment?.id || "missing_payment_id");
      return jsonResponse(502, { error: "O Mercado Pago não retornou o QR Code Pix. Tente novamente." });
    }

    return jsonResponse(200, result);
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error("Unable to create Pix payment", error.code || "server_error");
    return jsonResponse(status, { error: status >= 500 ? "Pagamento Pix indisponível. Tente novamente." : error.message });
  }
};
