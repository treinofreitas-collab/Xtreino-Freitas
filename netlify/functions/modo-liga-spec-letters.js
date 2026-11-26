const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { jsonResponse, parseJsonBody } = require("../shared/token-purchase");
const {
  getAvailableModoLigaSpecOptions,
  isModoLigaType,
  normalizeSpecHour,
} = require("../shared/modo-liga-spec");

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { availableLetters: [], availableAvatars: [], message: "Método não permitido." });
  }
  try {
    await verifyFirebaseUser(event);
    const body = parseJsonBody(event);
    if (!isModoLigaType(body.eventType)) {
      return jsonResponse(400, { availableLetters: [], availableAvatars: [], message: "A escolha de letras e avatares está disponível apenas no Modo Liga." });
    }
    if (!Array.isArray(body.hours) || body.hours.length < 1 || body.hours.length > 6) {
      return jsonResponse(400, { availableLetters: [], availableAvatars: [], message: "Selecione horários válidos para consultar as opções do SPEC." });
    }
    const hours = body.hours.map(normalizeSpecHour);
    if (hours.some(hour => !hour) || new Set(hours).size !== hours.length) {
      return jsonResponse(400, { availableLetters: [], availableAvatars: [], message: "As letras e os avatares do SPEC só estão disponíveis para os horários 19h, 20h, 21h, 22h, 23h e 00h." });
    }
    const admin = getAdmin();
    const options = await getAvailableModoLigaSpecOptions({
      db: admin.firestore(),
      bucket: admin.storage(),
      hours,
    });
    return jsonResponse(200, {
      availableLetters: options.availableLetters,
      availableAvatars: options.availableAvatars,
      hours,
    });
  } catch (error) {
    const status = Number(error.statusCode) || 503;
    if (status >= 500) console.warn("[Modo Liga SPEC] Não foi possível verificar letras:", error.code || "unavailable");
    return jsonResponse(status, {
      availableLetters: [],
      availableAvatars: [],
      message: status === 400 ? error.message : "Não foi possível consultar as opções do SPEC agora. Tente novamente.",
    });
  }
};
