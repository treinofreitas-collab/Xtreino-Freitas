const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { fetchPaymentById, findPaymentsByExternalReference } = require("../shared/credit-token-order");
const { completePurchase } = require("../shared/purchase");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");

function paymentMatchesCheckout(payment, checkout, reference) {
  const amount = Number(payment?.transaction_amount);
  const amountCents = Number.isFinite(amount)
    ? Math.round(amount * 100 + Number.EPSILON)
    : null;
  const method = String(payment?.payment_method_id || "").toLowerCase();
  return String(payment?.external_reference || "") === reference
    && String(payment?.currency_id || "").toUpperCase() === "BRL"
    && amountCents === Number(checkout?.amountCents)
    && (method === "pix" || String(payment?.payment_type_id || "").toLowerCase() === "bank_transfer");
}

function getExpirationMs(payment, checkout) {
  const value = payment?.date_of_expiration || checkout?.pixExpiresAt;
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function activePendingPayment(payments, checkout, reference) {
  const eligible = payments.filter(payment => paymentMatchesCheckout(payment, checkout, reference));
  const approved = eligible.filter(payment => payment.status === "approved");
  if (approved.length > 1) return { ambiguous: true };
  if (approved.length === 1) return { payment: approved[0] };

  const now = Date.now();
  const active = eligible.filter(payment =>
    ["pending", "in_process"].includes(payment.status)
    && getExpirationMs(payment, checkout) > now
  );
  if (active.length > 1) return { ambiguous: true };
  if (active.length === 1) return { payment: active[0] };
  return { payment: eligible[0] || null };
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Método não permitido." });

  try {
    const user = await verifyFirebaseUser(event);
    if (!process.env.MP_ACCESS_TOKEN) {
      return jsonResponse(503, { status: "unavailable", message: "A consulta de pagamentos está indisponível." });
    }

    const body = parseJsonBody(event);
    const reference = String(body.external_reference || "").trim();
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(reference)) {
      return jsonResponse(400, { error: "Referência de pagamento inválida." });
    }

    const db = getAdmin().firestore();
    const checkoutRef = db.collection("purchase_checkouts").doc(reference);
    const checkoutSnapshot = await checkoutRef.get();
    if (!checkoutSnapshot.exists) {
      return jsonResponse(404, {
        status: "not_found",
        message: "Não encontramos um checkout Pix ativo ligado a esta inscrição. Nenhuma nova cobrança foi criada.",
      });
    }

    const checkout = checkoutSnapshot.data();
    if (checkout.userId !== user.uid) {
      return jsonResponse(403, { error: "Este pagamento não pertence à sua conta." });
    }
    if (String(checkout.orderId || "") !== reference) {
      return jsonResponse(409, {
        status: "review",
        message: "A referência deste pedido não confere. Não pague este QR e fale com o suporte.",
      });
    }
    if (checkout.method !== "mercadopago" || !["event", "product"].includes(checkout.kind)) {
      return jsonResponse(409, {
        status: "unavailable",
        message: "Este pedido não tem um checkout Pix que possa ser retomado nesta tela.",
      });
    }
    if (checkout.status === "paid") {
      return jsonResponse(200, { status: "paid" });
    }
    if (checkout.status !== "pending") {
      return jsonResponse(409, {
        status: "unavailable",
        message: "Este checkout não está mais pendente. Atualize seus pedidos antes de tentar novamente.",
      });
    }

    let payment = checkout.pixPaymentId
      ? await fetchPaymentById(checkout.pixPaymentId)
      : null;
    if (!payment) {
      const matches = await findPaymentsByExternalReference(reference);
      const selected = activePendingPayment(matches, checkout, reference);
      if (selected.ambiguous) {
        return jsonResponse(409, {
          status: "review",
          message: "Encontramos mais de uma cobrança para este pedido. Não pague outro QR; fale com o suporte para conferirem.",
        });
      }
      payment = selected.payment;
    }

    if (!payment) {
      return jsonResponse(404, {
        status: "not_found",
        message: "Não encontramos um QR Pix ativo para este pedido. Nenhuma cobrança nova foi criada.",
      });
    }
    if (!paymentMatchesCheckout(payment, checkout, reference)) {
      return jsonResponse(409, {
        status: "review",
        message: "Os dados da cobrança não correspondem ao pedido. Não pague este QR e fale com o suporte.",
      });
    }

    if (payment.status === "approved") {
      const result = await completePurchase(reference, { payment, uid: user.uid });
      if (["paid", "already_paid"].includes(result?.status)) {
        return jsonResponse(200, { status: "paid" });
      }
      return jsonResponse(409, {
        status: "review",
        message: result?.message || "O Mercado Pago aprovou a cobrança, mas precisamos conferir o pedido antes de atualizá-lo.",
      });
    }

    if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
      const labels = {
        rejected: "O pagamento foi rejeitado",
        cancelled: "Este Pix foi cancelado",
        refunded: "Este pagamento foi estornado",
        charged_back: "Este pagamento está em contestação",
      };
      return jsonResponse(200, {
        status: payment.status,
        message: `${labels[payment.status]}. O QR não está mais ativo e nenhuma cobrança nova foi criada.`,
      });
    }

    if (!["pending", "in_process"].includes(payment.status)) {
      return jsonResponse(200, {
        status: "unavailable",
        message: "O Mercado Pago não informa um QR Pix que possa ser pago agora. Nenhuma nova cobrança foi criada.",
      });
    }

    const expiresAt = payment.date_of_expiration || checkout.pixExpiresAt || null;
    const expirationMs = getExpirationMs(payment, checkout);
    if (expirationMs == null || expirationMs <= Date.now()) {
      return jsonResponse(200, {
        status: "expired",
        message: "Este QR Pix expirou. Nenhuma nova cobrança foi criada; confirme o pedido antes de tentar uma nova inscrição.",
      });
    }

    const transaction = payment.point_of_interaction?.transaction_data || {};
    const qrCode = String(transaction.qr_code || "");
    const qrCodeBase64 = String(transaction.qr_code_base64 || "");
    if (!qrCode || !qrCodeBase64) {
      return jsonResponse(200, {
        status: "unavailable",
        message: "O Mercado Pago não retornou o QR deste pagamento. Nenhuma cobrança nova foi criada; fale com o suporte.",
      });
    }

    if (!checkout.pixPaymentId) {
      await checkoutRef.update({
        pixPaymentId: String(payment.id),
        pixStatus: payment.status,
        pixExpiresAt: expiresAt,
      });
    }

    return jsonResponse(200, {
      status: "pending",
      title: checkout.title || "Pagamento Pix",
      description: checkout.providerDescription || checkout.title || "Pagamento Pix",
      amountCents: Number(checkout.amountCents),
      expiresAt,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("Unable to resume pending Pix payment", error.code || "server_error");
    }
    return jsonResponse(statusCode, {
      status: "unavailable",
      error: statusCode >= 500 ? "Não foi possível consultar este Pix agora." : error.message,
    });
  }
};
