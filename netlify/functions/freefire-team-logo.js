const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const { updateOwnedRankingTeamLogo } = require("@workspace/freefire-ranking-access");

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
    body: JSON.stringify(body),
  };
}

async function loadUserRegistrations(firestore, uid, verifiedEmail) {
  const registrations = firestore.collection("registrations");
  const queries = [
    registrations.where("userId", "==", uid).get(),
    registrations.where("uid", "==", uid).get(),
    registrations.where("membrosUids", "array-contains", uid).get(),
  ];
  if (verifiedEmail) {
    queries.push(
      registrations.where("contact", "==", verifiedEmail).get(),
      registrations.where("email", "==", verifiedEmail).get(),
    );
  }

  const snapshots = await Promise.all(queries);
  const seen = new Set();
  const matches = [];
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      if (seen.has(document.id)) continue;
      seen.add(document.id);
      matches.push(document.data());
    }
  }
  return matches;
}

function parseBody(event) {
  try {
    if (event.isBase64Encoded) {
      return JSON.parse(Buffer.from(event.body || "", "base64").toString("utf8"));
    }
    return JSON.parse(event.body || "");
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  const body = parseBody(event);
  if (
    !body ||
    typeof body.teamId !== "string" ||
    body.teamId.trim().length < 1 ||
    body.teamId.trim().length > 128 ||
    body.teamId.includes("/") ||
    typeof body.storagePath !== "string" ||
    body.storagePath.length > 512 ||
    typeof body.logoUrl !== "string" ||
    body.logoUrl.length > 2048
  ) {
    return jsonResponse(400, { error: "Os dados da logo enviada são inválidos." });
  }

  let decodedToken;
  try {
    decodedToken = await verifyFirebaseUser(event);
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 503;
    const message = statusCode === 401
      ? "Entre novamente na sua conta para alterar a logo."
      : "A atualização da logo está temporariamente indisponível.";
    return jsonResponse(statusCode, { error: message });
  }

  try {
    const admin = getAdmin();
    const firestore = admin.firestore();
    const verifiedEmail = decodedToken.email_verified === true && typeof decodedToken.email === "string"
      ? decodedToken.email.trim().toLowerCase()
      : "";
    const registrations = await loadUserRegistrations(
      firestore,
      decodedToken.uid,
      verifiedEmail,
    );
    const result = await updateOwnedRankingTeamLogo({
      firestore,
      bucket: admin.storage(),
      registrations,
      uid: decodedToken.uid,
      verifiedEmail,
      teamId: body.teamId.trim(),
      storagePath: body.storagePath,
      logoUrl: body.logoUrl,
      serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    });
    return jsonResponse(200, result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 503;
    const message = statusCode < 500 && typeof error?.message === "string"
      ? error.message
      : "Não foi possível atualizar a logo da equipe agora. Tente novamente.";
    return jsonResponse(statusCode, { error: message });
  }
};
