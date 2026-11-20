import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  RankingTeamLogoUpdateError,
  updateOwnedRankingTeamLogo,
} from "@workspace/freefire-ranking-access";
import {
  UpdateOwnedFreeFireTeamLogoBody,
  UpdateOwnedFreeFireTeamLogoResponse,
} from "@workspace/api-zod";
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
    throw new ApiError(503, "A atualização da logo está temporariamente indisponível.");
  }

  let credentials: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawCredentials);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Invalid Firebase service account");
    }
    credentials = parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(503, "A atualização da logo está temporariamente indisponível.");
  }

  if (
    typeof credentials.project_id !== "string" ||
    typeof credentials.client_email !== "string" ||
    typeof credentials.private_key !== "string"
  ) {
    throw new ApiError(503, "A atualização da logo está temporariamente indisponível.");
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
    throw new ApiError(503, "A atualização da logo está temporariamente indisponível.");
  }
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

  const snapshots = await Promise.all(queries);
  const seen = new Set<string>();
  const matches: Record<string, unknown>[] = [];
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      if (seen.has(document.id)) continue;
      seen.add(document.id);
      matches.push(document.data() as Record<string, unknown>);
    }
  }
  return matches;
}

async function requireUser(req: Request) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError(401, "Entre novamente na sua conta para alterar a logo.");
  }

  const app = getFirebaseApp();
  try {
    return {
      app,
      decodedToken: await getAuth(app).verifyIdToken(match[1]),
    };
  } catch {
    throw new ApiError(401, "Sua sessão expirou. Entre novamente na sua conta.");
  }
}

router.post("/freefire/team-logo", async (req: Request, res): Promise<void> => {
  try {
    const parsedBody = UpdateOwnedFreeFireTeamLogoBody.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "Os dados da logo enviada são inválidos." });
      return;
    }

    const { app, decodedToken } = await requireUser(req);
    const firestore = getFirestore(app);
    const verifiedEmail = decodedToken.email_verified === true && typeof decodedToken.email === "string"
      ? decodedToken.email.trim().toLowerCase()
      : "";
    const registrations = await loadUserRegistrations(
      firestore,
      decodedToken.uid,
      verifiedEmail,
    );
    const projectId = String(app.options.projectId || "").trim();
    if (!projectId) {
      throw new ApiError(503, "O armazenamento das logos está temporariamente indisponível.");
    }
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim()
      || `${projectId}.firebasestorage.app`;
    const result = await updateOwnedRankingTeamLogo({
      firestore,
      bucket: getStorage(app).bucket(bucketName),
      registrations,
      uid: decodedToken.uid,
      verifiedEmail,
      ...parsedBody.data,
      serverTimestamp: () => FieldValue.serverTimestamp(),
    });
    const validatedResponse = UpdateOwnedFreeFireTeamLogoResponse.safeParse(result);
    if (!validatedResponse.success) {
      throw new ApiError(503, "O servidor não confirmou a atualização da logo.");
    }

    res.setHeader("Cache-Control", "private, no-store");
    res.json(validatedResponse.data);
  } catch (error) {
    const statusCode = error instanceof ApiError || error instanceof RankingTeamLogoUpdateError
      ? error.statusCode
      : 503;
    const message = statusCode < 500 && error instanceof Error
      ? error.message
      : error instanceof ApiError
        ? error.message
        : "Não foi possível atualizar a logo da equipe agora. Tente novamente.";
    if (statusCode >= 500) {
      req.log.error({ err: error }, "Falha ao atualizar a logo da equipe no Ranking Geral");
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.status(statusCode).json({ error: message });
  }
});

export default router;
