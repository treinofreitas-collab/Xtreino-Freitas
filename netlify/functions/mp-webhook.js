const { creditApprovedTokenOrder, fetchPaymentById } = require("../shared/credit-token-order");
const { completePurchase } = require("../shared/purchase");
const {
  getHeader,
  jsonResponse,
  parseJsonBody,
  verifyMercadoPagoSignature,
} = require("../shared/token-purchase");

function paymentIdFromEvent(event, body) {
  const query = event.queryStringParameters || {};
  const id = body?.data?.id || query["data.id"] || query.id;
  return id == null ? "" : String(id);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  let body;
  try {
    body = parseJsonBody(event);
  } catch {
    return jsonResponse(400, { error: "Notificação inválida." });
  }

  const query = event.queryStringParameters || {};
  const type = body.type || body.topic || query.type || query.topic;
  if (type !== "payment") return jsonResponse(200, { received: true });

  const paymentId = paymentIdFromEvent(event, body);
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("MP_WEBHOOK_SECRET is not configured");
    return jsonResponse(503, { error: "Webhook ainda não configurado." });
  }
  if (!/^\d{1,24}$/.test(paymentId)) {
    return jsonResponse(400, { error: "Identificador de pagamento inválido." });
  }

  const validSignature = verifyMercadoPagoSignature({
    signature: getHeader(event, "x-signature"),
    requestId: getHeader(event, "x-request-id"),
    dataId: paymentId,
    secret: webhookSecret,
  });
  if (!validSignature) {
    return jsonResponse(401, { error: "Assinatura inválida." });
  }

  try {
    const payment = await fetchPaymentById(paymentId);
    if (
      String(payment.id) !== paymentId
      || payment.status !== "approved"
      || !payment.external_reference
    ) {
      return jsonResponse(200, { received: true });
    }

    let result = await creditApprovedTokenOrder(payment);
    if (result.status === "not_found") {
      result = await completePurchase(String(payment.external_reference), { payment });
    }
    if (!["not_found", "credited", "already_credited", "paid", "already_paid"].includes(result.status)) {
      console.error("Payment requires review", result.status);
    }
    return jsonResponse(200, { received: true });
  } catch (error) {
    console.error("Unable to process Mercado Pago webhook", error.code || "server_error");
    return jsonResponse(500, { error: "Notificação não processada." });
  }
};
