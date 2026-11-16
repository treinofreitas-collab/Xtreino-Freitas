const RANKING_COLLECTION = "freefire_general_ranking";
const RANKING_TEAM_LINK_COLLECTION = "freefire_general_ranking_team_links";
const LOGO_CATALOG_COLLECTION = "championship_config";
const LOGO_ASSOCIATION_PREFIX = "freefire_modo_liga_logo_association_";
const LOGO_MANUAL_PREFIX = "freefire_modo_liga_logo_";

function normalizeTeamName(value) {
  return String(value || "")
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
}

function teamDocumentId(key) {
  return `team_${String(key || "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 110)}`;
}

function safeLogoKey(key) {
  return String(key || "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 100);
}

function timestampMs(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 100_000_000_000 ? value * 1000 : value;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function registrationLogoTimestamp(registration) {
  return timestampMs(registration?.teamLogoUpdatedAt)
    || timestampMs(registration?.logoUpdatedAt)
    || timestampMs(registration?.createdAt)
    || timestampMs(registration?.updatedAt)
    || timestampMs(registration?.paidAt);
}

function validLogoUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

function chooseLatestLogo(candidates, current = {}) {
  const priorities = { purchase: 3, custom: 2, association: 1 };
  const latest = candidates
    .filter(candidate => validLogoUrl(candidate?.logoUrl))
    .sort((first, second) =>
      Number(second.updatedAtMs || 0) - Number(first.updatedAtMs || 0)
      || (priorities[second.source] || 0) - (priorities[first.source] || 0))[0];
  if (!latest) return null;

  const currentUrl = String(current.logoUrl || "");
  const currentTimestamp = timestampMs(current.logoUpdatedAt);
  if (currentUrl && currentTimestamp > Number(latest.updatedAtMs || 0)) return null;
  if (
    currentUrl === latest.logoUrl
    && String(current.logoSource || "") === latest.source
    && currentTimestamp >= Number(latest.updatedAtMs || 0)
  ) return null;
  return latest;
}

function latestRegistrationLogos(registrations) {
  const eligibleStatuses = new Set(["paid", "approved", "confirmed"]);
  const byTeam = new Map();

  for (const registration of Array.isArray(registrations) ? registrations : []) {
    if (!eligibleStatuses.has(String(registration?.status || "").trim().toLowerCase())) continue;
    const teamName = String(registration.teamName || registration.team || registration.squadName || "").trim();
    const logoUrl = String(
      registration.teamLogoUrl || registration.logoUrl || registration.teamLogoThumb || "",
    ).trim();
    const teamKey = normalizeTeamName(teamName);
    if (!teamKey || !validLogoUrl(logoUrl)) continue;
    const rankingTeamId = String(registration.rankingTeamId || registration.teamId || "").trim();

    const candidate = {
      teamKey,
      rankingTeamId,
      teamName,
      logoUrl,
      source: "purchase",
      updatedAtMs: registrationLogoTimestamp(registration),
    };
    const aggregationKey = rankingTeamId ? `id:${rankingTeamId}` : `name:${teamKey}`;
    const current = byTeam.get(aggregationKey);
    if (
      !current
      || candidate.updatedAtMs > current.updatedAtMs
      || (candidate.updatedAtMs === current.updatedAtMs
        && Boolean(registration.teamLogoUrl) && !current.hasOriginalLogo)
    ) {
      byTeam.set(aggregationKey, { ...candidate, hasOriginalLogo: Boolean(registration.teamLogoUrl) });
    }
  }

  return [...byTeam.values()];
}

async function syncPaidRegistrationLogos(db, registrations, FieldValue) {
  const purchases = latestRegistrationLogos(registrations);
  let updatedCount = 0;
  let matchedTeamCount = 0;

  for (const purchase of purchases) {
    const teamId = teamDocumentId(purchase.teamKey);
    const logoKey = safeLogoKey(purchase.teamKey);
    const legacyRankingRef = db.collection(RANKING_COLLECTION).doc(teamId);
    const linkRef = purchase.rankingTeamId
      ? db.collection(RANKING_TEAM_LINK_COLLECTION).doc(purchase.rankingTeamId)
      : null;
    const associationRef = db.collection(LOGO_CATALOG_COLLECTION)
      .doc(`${LOGO_ASSOCIATION_PREFIX}${logoKey}`);
    const manualRef = db.collection(LOGO_CATALOG_COLLECTION).doc(`${LOGO_MANUAL_PREFIX}${logoKey}`);

    const changed = await db.runTransaction(async transaction => {
      const [linkSnapshot, associationSnapshot, manualSnapshot] = await Promise.all([
        linkRef ? transaction.get(linkRef) : Promise.resolve(null),
        transaction.get(associationRef),
        transaction.get(manualRef),
      ]);
      const mappedDocumentId = String(linkSnapshot?.exists ? linkSnapshot.data()?.rankingDocumentId || "" : "");
      const rankingRef = mappedDocumentId
        ? db.collection(RANKING_COLLECTION).doc(mappedDocumentId)
        : legacyRankingRef;
      const rankingSnapshot = await transaction.get(rankingRef);
      if (!rankingSnapshot.exists) return false;
      const ranking = rankingSnapshot.data();
      if (
        purchase.rankingTeamId
        && ranking.rankingTeamId
        && ranking.rankingTeamId !== purchase.rankingTeamId
      ) return false;
      if (
        purchase.rankingTeamId
        && !mappedDocumentId
        && ranking.teamId
        && ranking.teamId !== purchase.rankingTeamId
      ) return false;
      matchedTeamCount += 1;

      const candidates = [purchase];
      const association = associationSnapshot.exists ? associationSnapshot.data() : null;
      if (association?.associatedFrom === "spec" && association.logoUrl) {
        candidates.push({
          logoUrl: String(association.logoUrl),
          source: "association",
          updatedAtMs: timestampMs(association.updatedAtMs || association.updatedAt),
        });
      }
      const manual = manualSnapshot.exists ? manualSnapshot.data() : null;
      if (manual?.logoUrl) {
        candidates.push({
          logoUrl: String(manual.logoUrl),
          source: "custom",
          updatedAtMs: timestampMs(manual.updatedAtMs || manual.updatedAt),
        });
      }

      const latest = chooseLatestLogo(candidates, ranking);
      if (!latest) return false;
      transaction.update(rankingRef, {
        logoUrl: latest.logoUrl,
        logoSource: latest.source,
        logoUpdatedAt: Number(latest.updatedAtMs || Date.now()),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (changed) updatedCount += 1;
  }

  return { updatedCount, matchedTeamCount, teamCount: purchases.length };
}

async function syncPaidPurchaseRegistrationLogos(db, checkout, FieldValue) {
  if (checkout?.kind !== "event" || !Array.isArray(checkout.sourcePaths)) {
    return { updatedCount: 0, matchedTeamCount: 0, teamCount: 0 };
  }
  const registrationRefs = checkout.sourcePaths
    .filter(path => typeof path === "string" && /^registrations\/[^/]+$/.test(path))
    .map(path => db.doc(path));
  const snapshots = await Promise.all(registrationRefs.map(reference => reference.get()));
  const registrations = snapshots
    .filter(snapshot => snapshot.exists)
    .map(snapshot => snapshot.data());
  return syncPaidRegistrationLogos(db, registrations, FieldValue);
}

module.exports = {
  latestRegistrationLogos,
  normalizeTeamName,
  syncPaidPurchaseRegistrationLogos,
  syncPaidRegistrationLogos,
};
