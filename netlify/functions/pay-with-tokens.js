const { verifyFirebaseUser } = require("../shared/firebase-admin");
const { payPurchaseWithTokens } = require("../shared/purchase");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Método não permitido." });
  try {
    const user = await verifyFirebaseUser(event);
    const body = parseJsonBody(event);
    const result = await payPurchaseWithTokens(user.uid, body);
    return jsonResponse(["paid", "already_paid"].includes(result.status) ? 200 : 409, result);
  } catch (error) {
    const status = Number(error.statusCode) || 503;
    return jsonResponse(status, { error: status >= 500 ? "Não foi possível concluir a compra. Confira o pedido antes de tentar novamente." : error.message });
  }
};
