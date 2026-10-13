const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");
const { checkAvailability, validateRequest, UNAVAILABLE_MESSAGE } = require("../shared/availability");

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { available: false, message: "Método não permitido." });
  try {
    const body = parseJsonBody(event);
    validateRequest(body);
    await verifyFirebaseUser(event);
    return jsonResponse(200, await checkAvailability(getAdmin().firestore(), body));
  } catch (error) {
    console.warn("[Availability] Verification failed:", error.code || error.statusCode || "unavailable");
    const status = Number(error.statusCode) || 503;
    return jsonResponse(status, {
      available: false,
      message: status === 400 ? error.message : UNAVAILABLE_MESSAGE,
    });
  }
};
