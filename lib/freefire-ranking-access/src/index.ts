const CONFIRMED_REGISTRATION_STATUSES = new Set([
  "paid",
  "confirmed",
  "approved",
  "lisagem_gratis",
]);
const CONFIRMED_PURCHASE_STATUSES = new Set(["paid", "confirmed", "approved"]);
const GENERAL_RANKING_EVENT_TYPES = new Set([
  "treino-freitas",
  "xtreino-tokens",
  "modo-liga",
  "treino-modo-liga",
]);

const ALLOWED_SESSION_EVENT_TYPES = new Set(["treino-freitas", "modo-liga"]);

export type RankingRegistration = Record<string, unknown>;
export type RankingSessionRow = Record<string, unknown>;
export type RankingSession = Record<string, unknown>;

export type OwnedRankingTeam = {
  teamId: string;
  teamName: string;
  teamKey: string;
};

export type PublicRankingSession = {
  sessionId: string;
  eventType: string;
  eventLabel: string;
  date: string;
  hour: string;
  teams: Array<{
    teamName: string;
    rankingTeamId: string;
    points: number;
    wins: number;
    kills: number;
  }>;
};

export function generalRankingTeamKey(teamName: unknown): string {
  const normalized = String(teamName ?? "")
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\uFEFF]/gu, "")
    .replace(/[Ɐɐ]/gu, "a")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " e ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

  if (normalized) return normalized;

  const raw = String(teamName ?? "")
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\uFEFF]/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
  return raw
    ? `special ${[...raw].map((character) => character.codePointAt(0)?.toString(16) || "").join(" ")}`
    : "";
}

export function accountRankingTeamId(userId: unknown, teamName: unknown): string {
  const uid = String(userId || "").trim();
  const nameKey = generalRankingTeamKey(teamName);
  if (!uid || !nameKey) return "";
  const input = `${uid}\u0000${nameKey}`;
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `account_${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function isDisplayableRegistration(registration: RankingRegistration): boolean {
  if (registration.paidWithTokens === true) return true;
  return CONFIRMED_REGISTRATION_STATUSES.has(
    String(registration.status || "").trim().toLowerCase(),
  );
}

function registrationTeamName(registration: RankingRegistration): string {
  return String(
    registration.teamName || registration.team || registration.squadName || "",
  ).trim();
}

function registrationIsSolo(registration: RankingRegistration): boolean {
  return String(registration.eventType || "").toLowerCase().includes("solo") ||
    String(registration.title || "").toLowerCase().includes("solo");
}

function registrationBelongsToUser(
  registration: RankingRegistration,
  userId: string,
  verifiedEmail: string,
): boolean {
  const memberIds = Array.isArray(registration.membrosUids)
    ? registration.membrosUids.map((value) => String(value || "").trim())
    : [];
  const registrationEmail = String(registration.contact || registration.email || "")
    .trim()
    .toLowerCase();
  return String(registration.userId || "").trim() === userId ||
    String(registration.uid || "").trim() === userId ||
    memberIds.includes(userId) ||
    Boolean(verifiedEmail && registrationEmail === verifiedEmail.toLowerCase());
}

function registrationRankingTeamId(
  registration: RankingRegistration,
  userId: string,
  teamName: string,
): string {
  const ownerId = String(registration.userId || userId).trim();
  return String(
    registration.rankingTeamId ||
      registration.teamId ||
      accountRankingTeamId(ownerId, teamName),
  ).trim();
}

function isGeneralRankingRegistration(registration: RankingRegistration): boolean {
  const rawEventType = String(registration.eventType || "").trim();
  if (!rawEventType) return true;
  const normalized = rawEventType
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return GENERAL_RANKING_EVENT_TYPES.has(normalized);
}

export function resolveOwnedRankingTeam(
  registrations: RankingRegistration[],
  userId: string,
  requestedTeamId: string,
  verifiedEmail = "",
): OwnedRankingTeam | null {
  const wantedId = String(requestedTeamId || "").trim();
  if (!wantedId || !userId) return null;

  const matches = new Map<string, OwnedRankingTeam>();
  for (const registration of Array.isArray(registrations) ? registrations : []) {
    if (!isDisplayableRegistration(registration) || registrationIsSolo(registration)) continue;
    if (!registrationBelongsToUser(registration, userId, verifiedEmail)) continue;

    const teamName = registrationTeamName(registration);
    const teamKey = generalRankingTeamKey(teamName);
    if (!teamKey) continue;

    const teamId = registrationRankingTeamId(registration, userId, teamName);
    if (teamId !== wantedId) continue;
    matches.set(teamKey, { teamId, teamName, teamKey });
  }

  return matches.size === 1 ? [...matches.values()][0] : null;
}

export function hasConfirmedRankingTeamPurchase(
  registrations: RankingRegistration[],
  userId: string,
  requestedTeamId: string,
  verifiedEmail = "",
): boolean {
  const ownedTeam = resolveOwnedRankingTeam(
    registrations,
    userId,
    requestedTeamId,
    verifiedEmail,
  );
  if (!ownedTeam) return false;

  return (Array.isArray(registrations) ? registrations : []).some((registration) => {
    if (
      registrationIsSolo(registration) ||
      !isGeneralRankingRegistration(registration) ||
      !registrationBelongsToUser(registration, userId, verifiedEmail)
    ) {
      return false;
    }
    const status = String(registration.status || "").trim().toLowerCase();
    if (
      registration.paidWithTokens !== true &&
      !CONFIRMED_PURCHASE_STATUSES.has(status)
    ) {
      return false;
    }
    const teamName = registrationTeamName(registration);
    return generalRankingTeamKey(teamName) === ownedTeam.teamKey &&
      registrationRankingTeamId(registration, userId, teamName) === ownedTeam.teamId;
  });
}

export class RankingTeamLogoUpdateError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

type LogoDocumentSnapshot = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
};

type LogoDocumentReference = {
  get(): Promise<LogoDocumentSnapshot>;
  update(data: Record<string, unknown>): Promise<unknown>;
};

type LogoFirestore = {
  collection(name: string): {
    doc(id: string): LogoDocumentReference;
  };
};

type LogoStorageFile = {
  getMetadata(): Promise<[unknown, unknown?]>;
  download(): Promise<[Uint8Array, unknown?]>;
};

type LogoStorageBucket = {
  name: string;
  file(path: string): LogoStorageFile;
};

type StorageDownloadUrl = {
  protocol: string;
  hostname: string;
  pathname: string;
  searchParams: { get(name: string): string | null };
};

function teamRankingDocumentId(teamKey: string): string {
  const safeKey = teamKey
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 110);
  return `team_${safeKey}`;
}

function isSupportedLogoImage(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

async function validateStoredTeamLogo(
  bucket: LogoStorageBucket,
  uid: string,
  teamId: string,
  storagePath: string,
  logoUrl: string,
): Promise<void> {
  const expectedPrefix = `profile-photos/${uid}/team-logos/${teamId}/`;
  const pathSegments = storagePath.split("/");
  if (
    !storagePath.startsWith(expectedPrefix) ||
    pathSegments.length !== 5 ||
    pathSegments.some((part) => !part || part === "." || part === ".." || part.includes("\\"))
  ) {
    throw new RankingTeamLogoUpdateError(400, "O arquivo enviado não pertence a esta conta e equipe.");
  }

  let parsedUrl: StorageDownloadUrl;
  try {
    const UrlConstructor = (globalThis as unknown as {
      URL?: new (value: string) => StorageDownloadUrl;
    }).URL;
    if (!UrlConstructor) throw new Error("URL parser unavailable");
    parsedUrl = new UrlConstructor(logoUrl);
  } catch {
    throw new RankingTeamLogoUpdateError(400, "O endereço da logo enviada é inválido.");
  }
  const encodedObjectPath = `/v0/b/${bucket.name}/o/`;
  let urlObjectPath = "";
  try {
    const markerIndex = parsedUrl.pathname.indexOf(encodedObjectPath);
    if (markerIndex >= 0) {
      urlObjectPath = decodeURIComponent(parsedUrl.pathname.slice(markerIndex + encodedObjectPath.length));
    }
  } catch {
    urlObjectPath = "";
  }
  const fileToken = parsedUrl.searchParams.get("token") || "";
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "firebasestorage.googleapis.com" ||
    parsedUrl.searchParams.get("alt") !== "media" ||
    urlObjectPath !== storagePath ||
    !fileToken
  ) {
    throw new RankingTeamLogoUpdateError(400, "A logo precisa ser enviada para o armazenamento oficial da conta.");
  }

  const file = bucket.file(storagePath);
  let metadata: Record<string, unknown>;
  let bytes: Uint8Array;
  try {
    const [rawMetadata] = await file.getMetadata();
    if (typeof rawMetadata !== "object" || rawMetadata === null || Array.isArray(rawMetadata)) {
      throw new RankingTeamLogoUpdateError(400, "Não foi possível validar a imagem enviada.");
    }
    metadata = rawMetadata as Record<string, unknown>;
    const size = Number(metadata.size || 0);
    const contentType = String(metadata.contentType || "").toLowerCase();
    const downloadTokens = String(
      (metadata.metadata as Record<string, unknown> | undefined)?.firebaseStorageDownloadTokens || "",
    ).split(",").map((token) => token.trim());
    if (
      size < 1 ||
      size > 5 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(contentType) ||
      !downloadTokens.includes(fileToken)
    ) {
      throw new RankingTeamLogoUpdateError(400, "A imagem deve ser PNG, JPG ou WebP e ter até 5 MB.");
    }
    [bytes] = await file.download();
    if (!isSupportedLogoImage(bytes, contentType)) {
      throw new RankingTeamLogoUpdateError(400, "O arquivo enviado não é uma imagem PNG, JPG ou WebP válida.");
    }
  } catch (error) {
    if (error instanceof RankingTeamLogoUpdateError) throw error;
    throw new RankingTeamLogoUpdateError(400, "Não foi possível validar a imagem enviada.");
  }
}

export async function updateOwnedRankingTeamLogo({
  firestore,
  bucket,
  registrations,
  uid,
  verifiedEmail = "",
  teamId,
  storagePath,
  logoUrl,
  serverTimestamp,
}: {
  firestore: LogoFirestore;
  bucket: LogoStorageBucket;
  registrations: RankingRegistration[];
  uid: string;
  verifiedEmail?: string;
  teamId: string;
  storagePath: string;
  logoUrl: string;
  serverTimestamp: () => unknown;
}): Promise<{ teamId: string; teamName: string; logoUrl: string; updatedAt: number }> {
  const requestedTeamId = String(teamId || "").trim();
  if (!requestedTeamId || requestedTeamId.length > 128 || requestedTeamId.includes("/")) {
    throw new RankingTeamLogoUpdateError(400, "A equipe selecionada é inválida.");
  }
  if (!uid || uid.includes("/")) {
    throw new RankingTeamLogoUpdateError(401, "Entre novamente na sua conta para alterar a logo.");
  }

  const ownedTeam = resolveOwnedRankingTeam(
    registrations,
    uid,
    requestedTeamId,
    verifiedEmail,
  );
  if (!ownedTeam || !hasConfirmedRankingTeamPurchase(registrations, uid, requestedTeamId, verifiedEmail)) {
    throw new RankingTeamLogoUpdateError(
      403,
      "É necessário ter uma compra confirmada desta equipe nesta conta para trocar a logo.",
    );
  }

  await validateStoredTeamLogo(bucket, uid, requestedTeamId, storagePath, logoUrl);

  const linkSnapshot = await firestore
    .collection("freefire_general_ranking_team_links")
    .doc(ownedTeam.teamId)
    .get();
  const linkedDocumentId = String(linkSnapshot.data()?.rankingDocumentId || "").trim();
  if (linkSnapshot.exists && (!linkedDocumentId || linkedDocumentId.includes("/"))) {
    throw new RankingTeamLogoUpdateError(409, "Não foi possível confirmar o vínculo desta equipe no ranking.");
  }

  const rankingDocumentId = linkedDocumentId || teamRankingDocumentId(ownedTeam.teamKey);
  const rankingReference = firestore
    .collection("freefire_general_ranking")
    .doc(rankingDocumentId);
  const rankingSnapshot = await rankingReference.get();
  if (!rankingSnapshot.exists) {
    throw new RankingTeamLogoUpdateError(
      404,
      "Esta equipe ainda não está na base do Ranking Geral. A logo não foi alterada.",
    );
  }

  const rankingData = rankingSnapshot.data() || {};
  const savedTeamId = String(rankingData.rankingTeamId || rankingData.teamId || "").trim();
  const savedTeamName = String(rankingData.teamName || rankingData.name || "").trim();
  if (
    (savedTeamId && savedTeamId !== ownedTeam.teamId) ||
    (savedTeamName && generalRankingTeamKey(savedTeamName) !== ownedTeam.teamKey)
  ) {
    throw new RankingTeamLogoUpdateError(
      409,
      "O vínculo desta equipe não corresponde ao Ranking Geral. A logo não foi alterada.",
    );
  }

  const updatedAt = Date.now();
  await rankingReference.update({
    logoUrl,
    logoSource: "custom",
    logoUpdatedAt: updatedAt,
    updatedAt: serverTimestamp(),
  });
  return {
    teamId: ownedTeam.teamId,
    teamName: ownedTeam.teamName,
    logoUrl,
    updatedAt,
  };
}

function safeNonNegativeInteger(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function sessionRowTeamId(row: RankingSessionRow): string {
  return String(row.rankingTeamId || row.teamId || "").trim();
}

export function filterRankingSessionsForTeam(
  sessions: RankingSession[],
  team: OwnedRankingTeam,
): PublicRankingSession[] {
  const filtered: PublicRankingSession[] = [];
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const sessionId = String(session.sessionId || "").trim();
    const eventType = String(session.eventType || "").trim();
    const date = String(session.date || "").trim();
    const rawHour = String(session.hour || "").trim().replace(/[^\d]/g, "");
    if (
      !sessionId ||
      !ALLOWED_SESSION_EVENT_TYPES.has(eventType) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{1,2}$/.test(rawHour) ||
      Number(rawHour) > 23
    ) {
      continue;
    }
    const hour = String(Number(rawHour)).padStart(2, "0");

    const rows = Array.isArray(session.teams)
      ? session.teams.filter(
          (row): row is RankingSessionRow =>
            typeof row === "object" && row !== null && !Array.isArray(row),
        )
      : [];
    const sameNameRows = rows.filter(
      (row) => generalRankingTeamKey(row.teamName) === team.teamKey,
    );
    let matchingRows = rows.filter((row) => sessionRowTeamId(row) === team.teamId);
    if (!matchingRows.length) {
      const hasConflictingId = sameNameRows.some((row) => {
        const rowTeamId = sessionRowTeamId(row);
        return rowTeamId && rowTeamId !== team.teamId;
      });
      const legacyRows = sameNameRows.filter((row) => !sessionRowTeamId(row));
      if (!hasConflictingId && legacyRows.length === 1) matchingRows = legacyRows;
    }
    if (!matchingRows.length) continue;

    filtered.push({
      sessionId,
      eventType,
      eventLabel: String(session.eventLabel || ""),
      date,
      hour,
      teams: matchingRows.map((row) => ({
        teamName: String(row.teamName || team.teamName),
        rankingTeamId: sessionRowTeamId(row),
        points: safeNonNegativeInteger(row.points),
        wins: safeNonNegativeInteger(row.wins),
        kills: safeNonNegativeInteger(row.kills),
      })),
    });
  }
  return filtered;
}
