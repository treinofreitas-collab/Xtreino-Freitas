const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");

const ALLOWED_HOURS = new Set(["19", "20", "21", "22", "23", "00"]);
const ALLOWED_ROLES = new Set(["admin", "ceo", "gerente"]);
const STORAGE_ROOT = "teams/modo-liga/logos/spec";
const SPEC_CODE_PATTERN = /^9020000(?:3[4-9]|[45][0-9])\.png$/;

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
    const error = new Error("A limpeza de logos está disponível apenas para administradores.");
    error.statusCode = 403;
    throw error;
  }
}

exports.handler = async event => {
  if (event.httpMethod !== "DELETE") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  const hour = String(event.queryStringParameters?.hour || "");
  if (!ALLOWED_HOURS.has(hour)) {
    return jsonResponse(400, { error: "Horário inválido para limpar as logos." });
  }

  let deletedCount = 0;
  try {
    await requireAdmin(event);
    const bucket = getAdmin().storage();
    const prefix = `${STORAGE_ROOT}/${hour}H/`;
    const [files] = await bucket.getFiles({ prefix });
    const eligibleFiles = files.filter(file => {
      const relativeName = file.name.slice(prefix.length);
      return !relativeName.includes("/") && SPEC_CODE_PATTERN.test(relativeName);
    });

    for (const file of eligibleFiles) {
      try {
        await file.delete();
        deletedCount += 1;
      } catch {
        const error = new Error(deletedCount
          ? `Limpeza parcial: ${deletedCount} logo(s) removida(s). Atualize a lista e tente novamente.`
          : "Não foi possível remover as logos deste horário.");
        error.statusCode = 503;
        throw error;
      }
    }

    return jsonResponse(200, { deletedCount });
  } catch (error) {
    const statusCode = Number(error?.statusCode);
    if ([401, 403].includes(statusCode)) {
      return jsonResponse(statusCode, { error: error.message });
    }
    return jsonResponse(503, {
      error: error?.message || "Não foi possível limpar as logos do Firebase Storage.",
      ...(deletedCount ? { deletedCount } : {}),
    });
  }
};
