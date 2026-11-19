const CONFIRMED_REGISTRATION_STATUSES = new Set([
  "paid",
  "confirmed",
  "approved",
  "lisagem_gratis",
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
    const memberIds = Array.isArray(registration.membrosUids)
      ? registration.membrosUids.map((value) => String(value || "").trim())
      : [];
    const registrationEmail = String(registration.contact || registration.email || "")
      .trim()
      .toLowerCase();
    const belongsToUser =
      String(registration.userId || "").trim() === userId ||
      String(registration.uid || "").trim() === userId ||
      memberIds.includes(userId) ||
      Boolean(verifiedEmail && registrationEmail === verifiedEmail.toLowerCase());
    if (!belongsToUser) continue;

    const teamName = registrationTeamName(registration);
    const teamKey = generalRankingTeamKey(teamName);
    if (!teamKey) continue;

    const ownerId = String(registration.userId || userId).trim();
    const teamId = String(
      registration.rankingTeamId ||
        registration.teamId ||
        accountRankingTeamId(ownerId, teamName),
    ).trim();
    if (teamId !== wantedId) continue;
    matches.set(teamKey, { teamId, teamName, teamKey });
  }

  return matches.size === 1 ? [...matches.values()][0] : null;
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
