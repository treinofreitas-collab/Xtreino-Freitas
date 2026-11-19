import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { filterRankingSessionsForTeam, resolveOwnedRankingTeam } from "@workspace/freefire-ranking-access";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function getFirebaseApp() {
  if (getApps().some((app) => app.name === "[DEFAULT]")) return getApp();

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    throw new ApiError(503, "O histórico das equipes está temporariamente indisponível.");
  }

  let credentials: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawCredentials);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Invalid Firebase service account");
    }
    credentials = parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(503, "O histórico das equipes está temporariamente indisponível.");
  }

  if (
    typeof credentials.project_id !== "string" ||
    typeof credentials.client_email !== "string" ||
    typeof credentials.private_key !== "string"
  ) {
    throw new ApiError(503, "O histórico das equipes está temporariamente indisponível.");
  }

  try {
    return initializeApp({
      credential: cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key.replace(/\\n/g, "\n"),
      }),
      projectId: credentials.project_id,
    });
  } catch {
    throw new ApiError(503, "O histórico das equipes está temporariamente indisponível.");
  }
}

function parseTeamId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length < 1 ||
    value.trim().length > 128 ||
    value.includes("/")
  ) {
    throw new ApiError(400, "A equipe selecionada é inválida.");
  }
  return value.trim();
}

async function loadUserRegistrations(
  firestore: FirebaseFirestore.Firestore,
  uid: string,
  verifiedEmail: string,
) {
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
  return uniqueRegistrationSnapshots(await Promise.all(queries));
}

function uniqueRegistrationSnapshots(
  snapshots: Array<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>,
) {
  const seen = new Set<string>();
  const registrations: Record<string, unknown>[] = [];
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      if (seen.has(document.id)) continue;
      seen.add(document.id);
      registrations.push(document.data() as Record<string, unknown>);
    }
  }
  return registrations;
}

router.get("/freefire/team-sessions", async (req: Request, res): Promise<void> => {
  try {
    const teamId = parseTeamId(req.query.teamId);
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new ApiError(401, "Entre novamente na sua conta para ver o histórico.");
    }

    const app = getFirebaseApp();
    let decodedToken;
    try {
      decodedToken = await getAuth(app).verifyIdToken(match[1]);
    } catch {
      throw new ApiError(401, "Sua sessão expirou. Entre novamente na sua conta.");
    }

    const firestore = getFirestore(app);
    const email = decodedToken.email_verified === true && typeof decodedToken.email === "string"
      ? decodedToken.email.trim().toLowerCase()
      : "";
    const registrations = await loadUserRegistrations(firestore, decodedToken.uid, email);
    const ownedTeam = resolveOwnedRankingTeam(
      registrations,
      decodedToken.uid,
      teamId,
      email,
    );
    if (!ownedTeam) {
      throw new ApiError(403, "Não encontramos uma compra confirmada desta equipe nesta conta.");
    }

    const snapshot = await firestore.collection("freefire_general_ranking_sessions").get();
    const sessions = filterRankingSessionsForTeam(
      snapshot.docs.map((document) => ({
        ...(document.data() as Record<string, unknown>),
        sessionId: document.data().sessionId || document.id,
      })),
      ownedTeam,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ sessions });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 503;
    const message = error instanceof ApiError
      ? error.message
      : "Não foi possível consultar o histórico agora. Tente novamente.";
    if (statusCode >= 500) {
      req.log.error({ err: error }, "Falha ao carregar sessões da equipe do cliente");
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.status(statusCode).json({ error: message });
  }
});

export default router;
