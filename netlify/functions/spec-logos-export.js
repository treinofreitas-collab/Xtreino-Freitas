const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");

const ALLOWED_HOURS = new Set(["19", "20", "21", "22", "23", "00"]);
const ALLOWED_ROLES = new Set(["ceo", "gerente", "socio", "operador", "streamer"]);
const MAX_EXPORT_CHUNK_BYTES = 3 * 1024 * 1024;
const STORAGE_ROOT = "teams/modo-liga/logos/spec";
const SPEC_CODE_PATTERN = /^9020000(?:3[4-9]|[45][0-9])\.png$/;

function normalizeHour(value) {
  const normalizedHour = String(value || "").trim().toUpperCase().replace(/H$/, "");
  return ALLOWED_HOURS.has(normalizedHour) ? normalizedHour : null;
}

function getSpecLogoPathHour(event) {
  for (const candidate of [event.rawUrl, event.path]) {
    if (typeof candidate !== "string" || !candidate) continue;
    try {
      const segments = new URL(candidate, "https://netlify.invalid").pathname
        .split("/")
        .filter(Boolean)
        .map(segment => decodeURIComponent(segment));
      const marker = segments.lastIndexOf("spec-logos");
      if (marker >= 0) return segments[marker + 1] || "";
    } catch {
      // Try the next available request path.
    }
  }
  return "";
}

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

function parseNonNegativeInteger(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function isAllowedDownloadRole(rawRole) {
  const role = typeof rawRole === "string"
    ? rawRole.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
    : "";
  return ALLOWED_ROLES.has(role);
}

async function requireViewer(event, getAdminFn, verifyFirebaseUserFn) {
  const user = await verifyFirebaseUserFn(event);
  const profile = await getAdminFn()
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

function createHandler({
  getAdminFn = getAdmin,
  verifyFirebaseUserFn = verifyFirebaseUser,
} = {}) {
  return async event => {
    if (event.httpMethod !== "GET") {
      return jsonResponse(405, { error: "Método não permitido." });
    }

    const hour = normalizeHour(event.queryStringParameters?.hour)
      || normalizeHour(getSpecLogoPathHour(event));
    if (!hour) {
      return jsonResponse(400, { error: "Horário inválido para exportar logos." });
    }
    const fileIndex = parseNonNegativeInteger(event.queryStringParameters?.fileIndex, 0);
    const offset = parseNonNegativeInteger(event.queryStringParameters?.offset, 0);
    if (fileIndex === null || offset === null) {
      return jsonResponse(400, { error: "Posição inválida para continuar o download." });
    }

    try {
      await requireViewer(event, getAdminFn, verifyFirebaseUserFn);
      const prefix = `${STORAGE_ROOT}/${hour}H/`;
      const [files] = await getAdminFn().storage().getFiles({ prefix });
      const eligibleFiles = files
        .filter(file => {
          const relativeName = file.name.slice(prefix.length);
          return !relativeName.includes("/") && SPEC_CODE_PATTERN.test(relativeName);
        })
        .sort((first, second) => first.name.localeCompare(second.name));
      if (event.queryStringParameters?.manifest === "1") {
        const manifestFiles = await Promise.all(eligibleFiles.map(async file => {
          let size = Number(file.metadata?.size);
          if (!Number.isSafeInteger(size) || size < 0) {
            if (typeof file.getMetadata === "function") {
              const [metadata] = await file.getMetadata();
              size = Number(metadata?.size);
            }
          }
          return {
            code: file.name.slice(prefix.length, -".png".length),
            totalBytes: Number.isSafeInteger(size) && size >= 0 ? size : null,
          };
        }));
        return jsonResponse(200, { files: manifestFiles, totalFiles: manifestFiles.length });
      }

      const endFileIndex = parseNonNegativeInteger(
        event.queryStringParameters?.endFileIndex,
        eligibleFiles.length,
      );
      if (endFileIndex === null || endFileIndex > eligibleFiles.length
        || fileIndex > endFileIndex || endFileIndex < fileIndex
        || fileIndex > eligibleFiles.length
        || (fileIndex === eligibleFiles.length && offset > 0)) {
        return jsonResponse(400, { error: "Posição inválida para continuar o download." });
      }

      const logos = [];
      let nextFileIndex = fileIndex;
      let nextOffset = offset;
      let chunkBytes = 0;
      while (nextFileIndex < endFileIndex && chunkBytes < MAX_EXPORT_CHUNK_BYTES) {
        const file = eligibleFiles[nextFileIndex];
        const [contents] = await file.download();
        if (nextOffset > contents.byteLength) {
          return jsonResponse(400, { error: "Posição inválida para continuar o download." });
        }
        if (nextOffset === contents.byteLength) {
          nextFileIndex += 1;
          nextOffset = 0;
          continue;
        }

        const byteCount = Math.min(
          MAX_EXPORT_CHUNK_BYTES - chunkBytes,
          contents.byteLength - nextOffset
        );
        const code = file.name.slice(prefix.length, -".png".length);
        logos.push({
          code,
          offset: nextOffset,
          totalBytes: contents.byteLength,
          base64: contents.subarray(nextOffset, nextOffset + byteCount).toString("base64"),
        });
        chunkBytes += byteCount;
        nextOffset += byteCount;
        if (nextOffset === contents.byteLength) {
          nextFileIndex += 1;
          nextOffset = 0;
        }
      }

      return jsonResponse(200, {
        logos,
        totalFiles: eligibleFiles.length,
        next: { fileIndex: nextFileIndex, offset: nextOffset },
        complete: nextFileIndex >= endFileIndex,
      });
    } catch (error) {
      const statusCode = Number(error?.statusCode);
      if ([401, 403].includes(statusCode)) {
        return jsonResponse(statusCode, { error: error.message });
      }
      return jsonResponse(503, { error: "Não foi possível ler as logos do Firebase Storage." });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
exports.isAllowedDownloadRole = isAllowedDownloadRole;
