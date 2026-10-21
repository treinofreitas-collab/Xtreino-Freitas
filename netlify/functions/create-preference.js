const { verifyFirebaseUser } = require("../shared/firebase-admin");
const { preparePurchase, safeBackUrl, siteBaseUrl } = require("../shared/purchase");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Método não permitido." });
  try {
    const user = await verifyFirebaseUser(event);
    if (!process.env.MP_ACCESS_TOKEN) return jsonResponse(503, { error: "Pagamento ainda não configurado." });
    const body = parseJsonBody(event);
    const { checkoutRef, checkout } = await preparePurchase(user.uid, body, "mercadopago");
    if (checkout.status === "paid") return jsonResponse(409, { error: "Pedido já pago." });
    if (checkout.pixPaymentId) return jsonResponse(409, { error: "Este pedido já tem um Pix ativo. Não inicie outro checkout." });
    if (checkout.paymentUrl) return jsonResponse(200, { init_point: checkout.paymentUrl, external_reference: checkout.externalReference });
    const backUrl = safeBackUrl(body.back_url);
    const itemDescription = checkout.providerDescription || checkout.title;
    const item = {
      title: itemDescription,
      quantity: 1,
      unit_price: checkout.amountCents / 100,
      currency_id: "BRL",
      description: itemDescription,
    };
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": checkout.externalReference,
      },
      body: JSON.stringify({
        items: [item],
        external_reference: checkout.externalReference,
        notification_url: `${siteBaseUrl()}/.netlify/functions/mp-webhook`,
        back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
        auto_return: "approved",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.init_point) return jsonResponse(502, { error: "Não foi possível iniciar o pagamento." });
    await checkoutRef.update({ preferenceId: data.id, paymentUrl: data.init_point });
    return jsonResponse(200, { id: data.id, init_point: data.init_point, external_reference: checkout.externalReference });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error("Unable to create purchase", error.code || "server_error");
    return jsonResponse(status, { error: status >= 500 ? "Pagamento indisponível. Nenhuma cobrança foi iniciada." : error.message });
  }
};
