const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");

const ALLOWED_HOURS = new Set(["19", "20", "21", "22", "23", "00"]);
const ALLOWED_ROLES = new Set(["admin", "ceo", "gerente", "socio", "operador", "streamer"]);
const MAX_EXPORT_BYTES = 4 * 1024 * 1024;
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

async function requireViewer(event) {
  const user = await verifyFirebaseUser(event);
  const profile = await getAdmin()
    .firestore()
    .collection("users")
    .doc(user.uid)
    .get();
  const rawRole = profile.data()?.role;
  if (!isAllowedDownloadRole(rawRole)) {
    const error = new Error("Este download está disponível apenas para administradores e operadores.");
    error.statusCode = 403;
    throw error;
  }
}

function isAllowedDownloadRole(rawRole) {
  const role = typeof rawRole === "string"
    ? rawRole.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
    : "";
  return ALLOWED_ROLES.has(role);
}

exports.handler = async event => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  const hour = event.queryStringParameters?.hour;
  if (!ALLOWED_HOURS.has(String(hour || ""))) {
    return jsonResponse(400, { error: "Horário inválido para exportar logos." });
  }

  try {
    await requireViewer(event);
    const bucket = getAdmin().storage();
    const prefix = `${STORAGE_ROOT}/${hour}H/`;
    const [files] = await bucket.getFiles({ prefix });
    const eligibleFiles = files
      .filter(file => {
        const relativeName = file.name.slice(prefix.length);
        return !relativeName.includes("/") && SPEC_CODE_PATTERN.test(relativeName);
      })
      .sort((first, second) => first.name.localeCompare(second.name));

    const estimatedBytes = eligibleFiles.reduce((total, file) => {
      const size = Number(file.metadata?.size);
      return total + (Number.isFinite(size) && size > 0 ? size : 0);
    }, 0);
    if (estimatedBytes > MAX_EXPORT_BYTES) {
      return jsonResponse(413, {
        error: "O ZIP ultrapassou o limite de download. Baixe as logos individualmente.",
      });
    }

    const logos = [];
    let totalBytes = 0;
    for (const file of eligibleFiles) {
      const [contents] = await file.download();
      totalBytes += contents.byteLength;
      if (totalBytes > MAX_EXPORT_BYTES) {
        return jsonResponse(413, {
          error: "O ZIP ultrapassou o limite de download. Baixe as logos individualmente.",
        });
      }
      logos.push({
        code: file.name.slice(prefix.length, -".png".length),
        base64: contents.toString("base64"),
      });
    }

    return jsonResponse(200, { logos });
  } catch (error) {
    const statusCode = Number(error?.statusCode);
    if ([401, 403].includes(statusCode)) {
      return jsonResponse(statusCode, { error: error.message });
    }
    return jsonResponse(503, { error: "Não foi possível ler as logos do Firebase Storage." });
  }
};

exports.isAllowedDownloadRole = isAllowedDownloadRole;
