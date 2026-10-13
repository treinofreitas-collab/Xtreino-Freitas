const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { findPaymentsByExternalReference } = require("../shared/credit-token-order");
const { completePurchase, assertCanConfirm } = require("../shared/purchase");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Método não permitido." });
  try {
    const user = await verifyFirebaseUser(event);
    const { external_reference: reference } = parseJsonBody(event);
    if (typeof reference !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(reference)) return jsonResponse(400, { error: "Referência inválida." });
    const checkout = await getAdmin().firestore().collection("purchase_checkouts").doc(reference).get();
    if (!checkout.exists) return jsonResponse(404, { status: "needs_review", message: "Pedido antigo não vinculado ao checkout seguro. Solicite conferência ao suporte." });
    await assertCanConfirm(user.uid, checkout.data().userId);
    if (checkout.data().status === "paid") return jsonResponse(200, { status: "paid" });
    const payments = await findPaymentsByExternalReference(reference);
    const approved = payments.filter(p => p.status === "approved" && String(p.external_reference) === reference);
    if (approved.length > 1) return jsonResponse(409, { status: "needs_review", message: "Mais de um pagamento encontrado. Solicite conferência." });
    if (!approved.length) return jsonResponse(200, { status: payments.some(p => ["rejected", "cancelled"].includes(p.status)) ? "rejected" : "pending" });
    const result = await completePurchase(reference, { payment: approved[0], uid: checkout.data().userId });
    return jsonResponse(result.status === "needs_review" ? 409 : 200, result);
  } catch (error) {
    const status = Number(error.statusCode) || 503;
    return jsonResponse(status, { error: status >= 500 ? "Confirmação indisponível. Tente novamente." : error.message });
  }
};
