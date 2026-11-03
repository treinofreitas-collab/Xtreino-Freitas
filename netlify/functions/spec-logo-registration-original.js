const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");

const ALLOWED_MANAGEMENT_ROLES = new Set(["ceo", "gerente"]);
const MAX_ORIGINAL_LOGO_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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

function normalizeIdentifier(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
}

function getRegistrationId(event) {
  const queryId = event.queryStringParameters?.registrationId;
  if (typeof queryId === "string" && queryId) return queryId;
  for (const candidate of [event.rawUrl, event.path]) {
    if (typeof candidate !== "string" || !candidate) continue;
    try {
      const segments = new URL(candidate, "https://netlify.invalid").pathname
        .split("/")
        .filter(Boolean)
        .map(segment => decodeURIComponent(segment));
      const marker = segments.lastIndexOf("registrations");
      if (marker >= 0 && segments[marker + 1] && segments[marker + 2] === "original") {
        return segments[marker + 1];
      }
    } catch {
      // Try the next available request path.
    }
  }
  return "";
}

function getSafeObjectPath(urlValue, bucketName) {
  if (typeof urlValue !== "string" || !urlValue.trim()) return null;
  try {
    const url = new URL(urlValue.trim());
    let objectPath = null;
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
      objectPath.split("/").some(part => !part || part === "." || part === "..")
    ) {
      return null;
    }
    return objectPath;
  } catch {
    return null;
  }
}

function getCreatedAtMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const parsed = value.toMillis();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const seconds = Number(value.seconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000 + (Number(value.nanoseconds) || 0) / 1e6;
    }
  }
  return 0;
}

function getStorageTeamKey(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

function getSafeEventLogoPrefix(eventType) {
  const folder = typeof eventType === "string" ? eventType.trim() : "";
  if (!folder || folder === "." || folder === ".." || /[\\/]/.test(folder)) return "";
  return `teams/${folder}/logos/`;
}

function getSafeUserLogoPrefix(userId, eventType) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const folder = typeof eventType === "string" ? eventType.trim() : "";
  if (!uid || uid.length > 128 || uid === "." || uid === ".." || /[\\/]/.test(uid)) return "";
  if (!folder || folder === "." || folder === ".." || /[\\/]/.test(folder)) return "";
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "evento";
  return `profile-photos/${uid}/team-logos/${safeFolder}/`;
}

async function findLegacyOriginalLogo(bucket, prefixes, registration, teamNames) {
  const createdAtMs = getCreatedAtMs(registration.createdAt);
  if (!createdAtMs) return null;
  const rawName = typeof registration.teamName === "string" ? registration.teamName.trim() : "";
  const candidateNames = [rawName, rawName.replace(/\s+[B-Z]$/i, ""), ...teamNames].filter(Boolean);
  const teamKeys = new Set(candidateNames.map(getStorageTeamKey));
  if (!teamKeys.size) return null;

  const matches = [];
  for (const prefix of [...new Set(prefixes.filter(Boolean))]) {
    const [files] = await bucket.getFiles({ prefix, maxResults: 1000 });
    for (const file of files) {
      const relativeName = file.name.slice(prefix.length);
      if (relativeName.includes("/")) continue;
      const timestampMatch = relativeName.match(/_(\d{13})$/);
      if (!timestampMatch || !teamKeys.has(relativeName.slice(0, timestampMatch.index))) continue;
      const uploadedAtMs = Number(timestampMatch[1]);
      if (Math.abs(uploadedAtMs - createdAtMs) <= 15 * 60 * 1000) matches.push(file);
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

function getAllowedImageType(contentType, objectName) {
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

async function requireManagementRole(event, getAdminFn, verifyFirebaseUserFn) {
  const user = await verifyFirebaseUserFn(event);
  const profile = await getAdminFn()
    .firestore()
    .collection("users")
    .doc(user.uid)
    .get();
  const rawRole = profile.data()?.role;
  const role = typeof rawRole === "string"
    ? rawRole.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
    : "";
  if (!ALLOWED_MANAGEMENT_ROLES.has(role)) {
    const error = new Error("A logo original está disponível apenas para administradores.");
    error.statusCode = 403;
    throw error;
  }
}

function createHandler({
  getAdminFn = getAdmin,
  verifyFirebaseUserFn = verifyFirebaseUser,
} = {}) {
  return async event => {
    if (event.httpMethod !== "GET") {
      return jsonResponse(405, { error: "Método não permitido." });
    }

    const registrationId = getRegistrationId(event);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(registrationId)) {
      return jsonResponse(400, { error: "Inscrição inválida." });
    }

    try {
      await requireManagementRole(event, getAdminFn, verifyFirebaseUserFn);
      const admin = getAdminFn();
      const firestore = admin.firestore();
      const registrationSnapshot = await firestore.collection("registrations").doc(registrationId).get();
      if (!registrationSnapshot.exists) {
        return jsonResponse(404, { error: "Inscrição não encontrada." });
      }
      const registration = registrationSnapshot.data() || {};
      const modeIdentity = [
        registration.eventType,
        registration.eventName,
        registration.eventTitle,
        registration.event,
      ].map(normalizeIdentifier).join("");
      if (!modeIdentity.includes("modoliga")) {
        return jsonResponse(403, { error: "Esta inscrição não pertence ao Modo Liga." });
      }
      const status = normalizeIdentifier(registration.status);
      if (status.includes("pending") || status.includes("aguardandopagamento")) {
        return jsonResponse(409, { error: "Confirme o pagamento antes de usar a logo." });
      }

      const bucket = admin.storage();
      const teamId = typeof registration.teamId === "string" ? registration.teamId.trim() : "";
      const teamName = typeof registration.teamName === "string" ? registration.teamName.trim() : "";
      let teamProfile = null;
      if (teamId && /^[A-Za-z0-9_-]{1,128}$/.test(teamId)) {
        const teamSnapshot = await firestore.collection("teams").doc(teamId).get();
        if (teamSnapshot.exists) teamProfile = teamSnapshot.data() || null;
      }
      if (!teamProfile && teamName) {
        const teamMatches = await firestore.collection("teams").where("nome", "==", teamName).limit(2).get();
        if (teamMatches.size === 1) teamProfile = teamMatches.docs[0].data() || null;
      }

      const bucketName = bucket.name;
      const candidateUrls = [
        registration.teamLogoUrl,
        registration.logoOriginalUrl,
        teamProfile?.logoOriginalUrl,
      ];
      let originalFile = null;
      let originalMetadata = null;
      for (const candidateUrl of candidateUrls) {
        const objectPath = getSafeObjectPath(candidateUrl, bucketName);
        if (!objectPath) continue;
        const candidateFile = bucket.file(objectPath);
        try {
          const [metadata] = await candidateFile.getMetadata();
          originalFile = candidateFile;
          originalMetadata = metadata;
          break;
        } catch (error) {
          if (Number(error?.code) !== 404) throw error;
        }
      }

      if (!originalFile) {
        const eventType = typeof registration.eventType === "string" ? registration.eventType : "";
        const teamNames = [
          typeof teamProfile?.nome === "string" ? teamProfile.nome : "",
          typeof teamProfile?.name === "string" ? teamProfile.name : "",
        ];
        const userIds = [registration.userId, teamProfile?.capitaoId]
          .filter(value => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value));
        const prefixes = [
          getSafeEventLogoPrefix(eventType),
          ...userIds.map(userId => getSafeUserLogoPrefix(userId, eventType)),
        ];
        originalFile = await findLegacyOriginalLogo(bucket, prefixes, registration, teamNames);
        if (originalFile) {
          const [metadata] = await originalFile.getMetadata();
          originalMetadata = metadata;
        }
      }

      if (!originalFile || !originalMetadata) {
        return jsonResponse(404, {
          error: "Não encontrei o arquivo original desta inscrição. Peça ao cliente para reenviar a logo.",
        });
      }
      const size = Number(originalMetadata.size);
      if (Number.isFinite(size) && size > MAX_ORIGINAL_LOGO_BYTES) {
        return jsonResponse(413, { error: "A logo original ultrapassa o limite de 10 MB." });
      }
      const contentType = getAllowedImageType(originalMetadata.contentType, originalFile.name);
      if (!contentType) {
        return jsonResponse(415, { error: "A logo original precisa estar em PNG, JPG ou WebP." });
      }

      const [contents] = await originalFile.download();
      if (contents.byteLength > MAX_ORIGINAL_LOGO_BYTES) {
        return jsonResponse(413, { error: "A logo original ultrapassa o limite de 10 MB." });
      }
      return {
        statusCode: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
        isBase64Encoded: true,
        body: contents.toString("base64"),
      };
    } catch (error) {
      const statusCode = Number(error?.statusCode);
      if ([401, 403].includes(statusCode)) {
        return jsonResponse(statusCode, { error: error.message });
      }
      return jsonResponse(503, { error: "Não foi possível carregar a logo original do Firebase Storage." });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
