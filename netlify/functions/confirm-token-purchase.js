const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { creditApprovedTokenOrder, findPaymentsByExternalReference } = require("../shared/credit-token-order");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");
const { assertCanConfirm } = require("../shared/purchase");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  try {
    const decoded = await verifyFirebaseUser(event);
    const { external_reference: externalReference } = parseJsonBody(event);
    if (
      typeof externalReference !== "string"
      || !externalReference
      || externalReference.length > 128
      || externalReference.includes("/")
    ) {
      return jsonResponse(400, { error: "Referência de compra inválida." });
    }

    const admin = getAdmin();
    const db = admin.firestore();
    const checkoutRef = db.collection("token_checkouts").doc(externalReference);
    const checkoutSnap = await checkoutRef.get();
    if (!checkoutSnap.exists) {
      return jsonResponse(404, { status: "not_found" });
    }
    await assertCanConfirm(decoded.uid, checkoutSnap.data().userId);
    const ownerUid = checkoutSnap.data().userId;

    const creditRef = db.collection("token_credits").doc(externalReference);
    const creditSnap = await creditRef.get();
    if (creditSnap.exists) {
      const [userSnap] = await Promise.all([
        db.collection("users").doc(ownerUid).get(),
      ]);
      return jsonResponse(200, {
        status: "already_credited",
        quantity: creditSnap.data().quantity,
        balance: Number(userSnap.data()?.tokens || 0),
      });
    }
    if (checkoutSnap.data().status === "credited") {
      return jsonResponse(409, {
        status: "needs_review",
        message: "O pedido consta como creditado, mas falta o registro de conferência.",
      });
    }

    const payments = await findPaymentsByExternalReference(externalReference);
    const approved = payments.filter((payment) =>
      payment.status === "approved"
      && String(payment.external_reference || "") === externalReference,
    );

    if (approved.length > 1) {
      return jsonResponse(409, {
        status: "needs_review",
        message: "Encontramos mais de um pagamento aprovado para esta compra. O saldo não foi alterado.",
      });
    }

    if (!approved.length) {
      const rejected = payments.some((payment) =>
        ["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status),
      );
      return jsonResponse(200, { status: rejected ? "rejected" : "pending" });
    }

    const result = await creditApprovedTokenOrder(approved[0], ownerUid);
    if (result.status === "credited" || result.status === "already_credited") {
      return jsonResponse(200, result);
    }
    if (result.status === "pending") {
      return jsonResponse(200, { status: "pending" });
    }
    return jsonResponse(409, {
      status: "needs_review",
      message: "O pagamento precisa de conferência antes de alterar o saldo.",
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("Unable to confirm token purchase", error.code || "server_error");
      return jsonResponse(503, { error: "Não foi possível confirmar o pagamento agora." });
    }
    return jsonResponse(statusCode, { error: error.message || "Não foi possível confirmar a compra." });
  }
};
