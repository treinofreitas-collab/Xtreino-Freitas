import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const ALLOWED_HOURS = new Set(["19", "20", "21", "22", "23", "00"]);
const ALLOWED_ROLES = new Set(["admin", "ceo", "gerente", "socio", "operador", "streamer"]);
const ALLOWED_MANAGEMENT_ROLES = new Set(["admin", "ceo", "gerente"]);
const MAX_EXPORT_BYTES = 4 * 1024 * 1024;
const MAX_ORIGINAL_LOGO_BYTES = 10 * 1024 * 1024;
const MAX_LOGO_BATCH_BYTES = 10 * 1024 * 1024;
const MAX_LOGO_BATCH_COUNT = 15;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const STORAGE_ROOT = "teams/modo-liga/logos/spec";
const SPEC_CODE_PATTERN = /^9020000(?:3[4-9]|[45][0-9])\.png$/;
const SPEC_CODE_VALUE_PATTERN = /^9020000(?:3[4-9]|[45][0-9])$/;

function firstString(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate : undefined;
}

function normalizeHour(value: unknown): string | null {
  const normalizedHour = (firstString(value) || "").trim().toUpperCase().replace(/H$/, "");
  return ALLOWED_HOURS.has(normalizedHour) ? normalizedHour : null;
}

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFirebaseApp() {
  if (getApps().some((app) => app.name === "[DEFAULT]")) return getApp();

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    throw new ApiError(503, "A autenticação do download está indisponível.");
  }

  let credentials: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawCredentials);
    if (!isRecord(parsed)) throw new Error("Invalid Firebase credentials");
    credentials = parsed;
  } catch {
    throw new ApiError(503, "A autenticação do download está indisponível.");
  }

  if (
    typeof credentials.project_id !== "string" ||
    typeof credentials.client_email !== "string" ||
    typeof credentials.private_key !== "string"
  ) {
    throw new ApiError(503, "A autenticação do download está indisponível.");
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
    throw new ApiError(503, "A autenticação do download está indisponível.");
  }
}

async function requireSpecLogoRole(
  req: Request,
  allowedRoles: Set<string>,
  forbiddenMessage: string,
) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError(401, "Entre novamente no painel para baixar as logos.");
  }

  const app = getFirebaseApp();
  let uid: string;
  try {
    ({ uid } = await getAuth(app).verifyIdToken(match[1]));
  } catch {
    throw new ApiError(401, "Sua sessão expirou. Entre novamente no painel.");
  }

  const profile = await getFirestore(app).collection("users").doc(uid).get();
  const rawRole = profile.data()?.role;
  const role = typeof rawRole === "string"
    ? rawRole.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
    : "";
  if (!allowedRoles.has(role)) {
    throw new ApiError(403, forbiddenMessage);
  }

  return app;
}

function getStorageBucket(app: ReturnType<typeof getFirebaseApp>) {
  const projectId = app.options.projectId;
  if (typeof projectId !== "string" || !projectId) {
    throw new ApiError(503, "O projeto Firebase não está configurado para logos.");
  }
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim()
    || `${projectId}.firebasestorage.app`;
  return getStorage(app).bucket(bucketName);
}

function getSafeObjectPath(urlValue: unknown, bucketName: string): string | null {
  if (typeof urlValue !== "string" || !urlValue.trim()) return null;
  try {
    const url = new URL(urlValue.trim());
    let objectPath: string | null = null;
    if (url.protocol === "gs:") {
      if (url.hostname !== bucketName) return null;
      objectPath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } else if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match || decodeURIComponent(match[1]) !== bucketName) return null;
      objectPath = decodeURIComponent(match[2]);
    } else if (url.hostname === "storage.googleapis.com") {
      const path = url.pathname.replace(/^\/+/, "");
      const separator = path.indexOf("/");
      if (separator < 1 || decodeURIComponent(path.slice(0, separator)) !== bucketName) return null;
      objectPath = decodeURIComponent(path.slice(separator + 1));
    }

    if (
      !objectPath ||
      objectPath.startsWith("/") ||
      objectPath.includes("\\") ||
      objectPath.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      return null;
    }
    return objectPath;
  } catch {
    return null;
  }
}

function getAllowedImageType(contentType: unknown, objectName: string): string | null {
  const type = typeof contentType === "string"
    ? contentType.split(";")[0].trim().toLowerCase()
    : "";
  if (ALLOWED_IMAGE_TYPES.has(type)) return type;
  const extension = objectName.toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1];
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return null;
}

function isAllowedLeaderboardLogoPath(objectPath: string): boolean {
  if (objectPath.startsWith("teams/modo-liga/logos/")) return true;
  return /^profile-photos\/[A-Za-z0-9_-]{1,128}\/team-logos\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(objectPath);
}

router.get("/spec-logos/image", async (req, res): Promise<void> => {
  try {
    const app = await requireSpecLogoRole(
      req,
      ALLOWED_ROLES,
      "Este download está disponível apenas para administradores e operadores.",
    );
    const bucket = getStorageBucket(app);
    const objectPath = getSafeObjectPath(firstString(req.query.url), bucket.name);
    if (!objectPath || !isAllowedLeaderboardLogoPath(objectPath)) {
      throw new ApiError(400, "O endereço da logo não é permitido.");
    }

    const file = bucket.file(objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (Number.isFinite(size) && size > MAX_ORIGINAL_LOGO_BYTES) {
      throw new ApiError(413, "A logo ultrapassa o limite de 10 MB.");
    }
    const contentType = getAllowedImageType(metadata.contentType, objectPath);
    if (!contentType) throw new ApiError(415, "A logo precisa estar em PNG, JPG ou WebP.");

    const [contents] = await file.download();
    if (contents.byteLength > MAX_ORIGINAL_LOGO_BYTES) {
      throw new ApiError(413, "A logo ultrapassa o limite de 10 MB.");
    }
    res
      .status(200)
      .set({
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .type(contentType)
      .send(contents);
  } catch (error) {
    const apiError = error instanceof ApiError
      ? error
      : new ApiError(503, "Não foi possível carregar a logo para a exportação.");
    if (apiError.statusCode >= 500) {
      req.log.error({ statusCode: apiError.statusCode }, "Leaderboard logo proxy failed");
    }
    res.status(apiError.statusCode).json({ error: apiError.message });
  }
});

router.post("/spec-logos/images", async (req, res): Promise<void> => {
  try {
    const requestedUrls: unknown = req.body?.urls;
    if (
      !Array.isArray(requestedUrls) ||
      requestedUrls.length < 1 ||
      requestedUrls.length > MAX_LOGO_BATCH_COUNT ||
      requestedUrls.some((url) => typeof url !== "string" || !url.trim())
    ) {
      throw new ApiError(400, "A lista de logos para exportar é inválida.");
    }

    const app = await requireSpecLogoRole(
      req,
      ALLOWED_ROLES,
      "Este download está disponível apenas para administradores e operadores.",
    );
    const bucket = getStorageBucket(app);
    const urls = [...new Set(requestedUrls as string[])];
    const files = urls.map((url) => {
      const objectPath = getSafeObjectPath(url, bucket.name);
      if (!objectPath || !isAllowedLeaderboardLogoPath(objectPath)) {
        throw new ApiError(400, "Um endereço de logo não é permitido.");
      }
      return { file: bucket.file(objectPath), objectPath };
    });

    const metadata = await Promise.all(files.map(({ file }) => file.getMetadata()));
    const contentTypes = metadata.map(([item], index) => {
      const size = Number(item.size);
      if (Number.isFinite(size) && size > MAX_ORIGINAL_LOGO_BYTES) {
        throw new ApiError(413, "Uma logo ultrapassa o limite de 10 MB.");
      }
      const contentType = getAllowedImageType(item.contentType, files[index].objectPath);
      if (!contentType) throw new ApiError(415, "As logos precisam estar em PNG, JPG ou WebP.");
      return contentType;
    });
    const estimatedBytes = metadata.reduce((total, [item]) => total + (Number(item.size) || 0), 0);
    if (estimatedBytes > MAX_LOGO_BATCH_BYTES) {
      throw new ApiError(413, "O total das logos ultrapassa o limite de 10 MB.");
    }

    const contents = await Promise.all(files.map(({ file }) => file.download()));
    const actualBytes = contents.reduce((total, [buffer]) => total + buffer.byteLength, 0);
    if (actualBytes > MAX_LOGO_BATCH_BYTES) {
      throw new ApiError(413, "O total das logos ultrapassa o limite de 10 MB.");
    }

    res.set("Cache-Control", "private, no-store").json({
      images: contents.map(([buffer], index) => ({
        contentType: contentTypes[index],
        base64: buffer.toString("base64"),
      })),
    });
  } catch (error) {
    const apiError = error instanceof ApiError
      ? error
      : new ApiError(503, "Não foi possível carregar as logos para a exportação.");
    if (apiError.statusCode >= 500) {
      req.log.error({ statusCode: apiError.statusCode }, "Leaderboard logo batch proxy failed");
    }
    res.status(apiError.statusCode).json({ error: apiError.message });
  }
});

router.get("/spec-logos/:hour/export", async (req, res) => {
  try {
    const hour = normalizeHour(req.params.hour);
    if (!hour) {
      throw new ApiError(400, "Horário inválido para exportar logos.");
    }

    const app = await requireSpecLogoRole(
      req,
      ALLOWED_ROLES,
      "Este download está disponível apenas para administradores e operadores.",
    );
    const bucket = getStorageBucket(app);
    const prefix = `${STORAGE_ROOT}/${hour}H/`;
    const [files] = await bucket.getFiles({ prefix });
    const eligibleFiles = files
      .filter((file) => {
        const relativeName = file.name.slice(prefix.length);
        return !relativeName.includes("/") && SPEC_CODE_PATTERN.test(relativeName);
      })
      .sort((first, second) => first.name.localeCompare(second.name));

    const estimatedBytes = eligibleFiles.reduce((total, file) => {
      const size = Number(file.metadata?.size);
      return total + (Number.isFinite(size) && size > 0 ? size : 0);
    }, 0);
    if (estimatedBytes > MAX_EXPORT_BYTES) {
      throw new ApiError(413, "O ZIP ultrapassou o limite de download. Baixe as logos individualmente.");
    }

    const logos: { code: string; base64: string }[] = [];
    let totalBytes = 0;
    for (const file of eligibleFiles) {
      const [contents] = await file.download();
      totalBytes += contents.byteLength;
      if (totalBytes > MAX_EXPORT_BYTES) {
        throw new ApiError(413, "O ZIP ultrapassou o limite de download. Baixe as logos individualmente.");
      }
      logos.push({
        code: file.name.slice(prefix.length, -".png".length),
        base64: contents.toString("base64"),
      });
    }

    res.set("Cache-Control", "no-store").json({ logos });
  } catch (error) {
    const apiError = error instanceof ApiError
      ? error
      : new ApiError(503, "Não foi possível ler as logos do Firebase Storage.");
    if (apiError.statusCode >= 500) {
      req.log.error({ statusCode: apiError.statusCode }, "SPEC logo export failed");
    }
    res.status(apiError.statusCode).json({ error: apiError.message });
  }
});

router.delete("/spec-logos/:hour/:code", async (req, res): Promise<void> => {
  try {
    const hour = normalizeHour(req.params.hour) ?? normalizeHour(req.query.hour);
    const pathCode = firstString(req.params.code);
    const queryCode = firstString(req.query.code);
    const code = pathCode && SPEC_CODE_VALUE_PATTERN.test(pathCode)
      ? pathCode
      : queryCode ?? "";
    if (!hour || !code || !SPEC_CODE_VALUE_PATTERN.test(code)) {
      throw new ApiError(400, "Horário ou código de logo inválido.");
    }

    const app = await requireSpecLogoRole(
      req,
      ALLOWED_MANAGEMENT_ROLES,
      "A remoção de logos está disponível apenas para administradores.",
    );
    const file = getStorageBucket(app).file(`${STORAGE_ROOT}/${hour}H/${code}.png`);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Esta logo não está cadastrada." });
      return;
    }

    await file.delete();
    res.sendStatus(204);
  } catch (error) {
    const apiError = error instanceof ApiError
      ? error
      : new ApiError(503, "Não foi possível remover a logo do Firebase Storage.");
    if (apiError.statusCode >= 500) {
      req.log.error({ statusCode: apiError.statusCode }, "SPEC logo delete failed");
    }
    res.status(apiError.statusCode).json({ error: apiError.message });
  }
});

router.delete("/spec-logos/:hour", async (req, res): Promise<void> => {
  let deletedCount = 0;
  try {
    const hour = normalizeHour(req.params.hour) ?? normalizeHour(req.query.hour);
    if (!hour) {
      throw new ApiError(400, "Horário inválido para limpar as logos.");
    }

    const app = await requireSpecLogoRole(
      req,
      ALLOWED_MANAGEMENT_ROLES,
      "A limpeza de logos está disponível apenas para administradores.",
    );
    const prefix = `${STORAGE_ROOT}/${hour}H/`;
    const [files] = await getStorageBucket(app).getFiles({ prefix });
    const eligibleFiles = files.filter((file) => {
      const relativeName = file.name.slice(prefix.length);
      return !relativeName.includes("/") && SPEC_CODE_PATTERN.test(relativeName);
    });

    for (const file of eligibleFiles) {
      try {
        await file.delete();
        deletedCount += 1;
      } catch {
        const message = deletedCount
          ? `Limpeza parcial: ${deletedCount} logo(s) removida(s). Atualize a lista e tente novamente.`
          : "Não foi possível remover as logos deste horário.";
        throw new ApiError(503, message);
      }
    }

    res.json({ deletedCount });
  } catch (error) {
    const apiError = error instanceof ApiError
      ? error
      : new ApiError(503, "Não foi possível limpar as logos do Firebase Storage.");
    if (apiError.statusCode >= 500) {
      req.log.error({ statusCode: apiError.statusCode, deletedCount }, "SPEC logo hour clear failed");
    }
    res.status(apiError.statusCode).json({
      error: apiError.message,
      ...(deletedCount ? { deletedCount } : {}),
    });
  }
});

export default router;
