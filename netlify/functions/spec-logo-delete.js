const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");

const ALLOWED_HOURS = new Set(["19", "20", "21", "22", "23", "00"]);
const ALLOWED_ROLES = new Set(["admin", "ceo", "gerente"]);
const STORAGE_ROOT = "teams/modo-liga/logos/spec";
const SPEC_CODE_PATTERN = /^9020000(?:3[4-9]|[45][0-9])$/;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

async function requireAdmin(event) {
  const user = await verifyFirebaseUser(event);
  const profile = await getAdmin()
    .firestore()
    .collection("users")
    .doc(user.uid)
    .get();
  const rawRole = profile.data()?.role;
  const role = typeof rawRole === "string"
    ? rawRole.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
    : "";
  if (!ALLOWED_ROLES.has(role)) {
    const error = new Error("A remoção de logos está disponível apenas para administradores.");
    error.statusCode = 403;
    throw error;
  }
}

exports.handler = async event => {
  if (event.httpMethod !== "DELETE") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  const hour = String(event.queryStringParameters?.hour || "");
  const code = String(event.queryStringParameters?.code || "");
  if (!ALLOWED_HOURS.has(hour) || !SPEC_CODE_PATTERN.test(code)) {
    return jsonResponse(400, { error: "Horário ou código de logo inválido." });
  }

  try {
    await requireAdmin(event);
    const bucket = getAdmin().storage();
    const file = bucket.file(`${STORAGE_ROOT}/${hour}H/${code}.png`);
    const [exists] = await file.exists();
    if (!exists) {
      return jsonResponse(404, { error: "Esta logo não está cadastrada." });
    }

    await file.delete();
    return {
      statusCode: 204,
      headers: { "Cache-Control": "no-store" },
      body: "",
    };
  } catch (error) {
    const statusCode = Number(error?.statusCode);
    if ([401, 403].includes(statusCode)) {
      return jsonResponse(statusCode, { error: error.message });
    }
    return jsonResponse(503, { error: "Não foi possível remover a logo do Firebase Storage." });
  }
};
