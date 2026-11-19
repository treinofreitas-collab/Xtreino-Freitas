const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");
const {
  filterRankingSessionsForTeam,
  resolveOwnedRankingTeam,
} = require("@workspace/freefire-ranking-access");

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

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Método não permitido." });
  }

  const teamId = String(event.queryStringParameters?.teamId || "").trim();
  if (!teamId || teamId.length > 128 || teamId.includes("/")) {
    return jsonResponse(400, { error: "A equipe selecionada é inválida." });
  }

  let decodedToken;
  try {
    decodedToken = await verifyFirebaseUser(event);
  } catch (error) {
    const statusCode = error?.statusCode === 401 ? 401 : 503;
    const message = statusCode === 401
      ? "Entre novamente na sua conta para ver o histórico."
      : "O histórico das equipes está temporariamente indisponível.";
    return jsonResponse(statusCode, { error: message });
  }

  try {
    const firestore = getAdmin().firestore();
    const verifiedEmail = decodedToken.email_verified === true && typeof decodedToken.email === "string"
      ? decodedToken.email.trim().toLowerCase()
      : "";
    const registrations = await loadUserRegistrations(
      firestore,
      decodedToken.uid,
      verifiedEmail,
    );
    const ownedTeam = resolveOwnedRankingTeam(
      registrations,
      decodedToken.uid,
      teamId,
      verifiedEmail,
    );
    if (!ownedTeam) {
      return jsonResponse(403, {
        error: "Não encontramos uma compra confirmada desta equipe nesta conta.",
      });
    }

    const snapshot = await firestore.collection("freefire_general_ranking_sessions").get();
    const sessions = filterRankingSessionsForTeam(
      snapshot.docs.map((document) => ({
        ...document.data(),
        sessionId: document.data().sessionId || document.id,
      })),
      ownedTeam,
    );
    return jsonResponse(200, { sessions });
  } catch {
    return jsonResponse(503, {
      error: "Não foi possível consultar o histórico agora. Tente novamente.",
    });
  }
};
