const RANKING_COLLECTION = "freefire_general_ranking";
const LINK_COLLECTION = "freefire_general_ranking_team_links";

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

function accountRankingTeamId(userId, teamName) {
  const uid = String(userId || "").trim();
  const nameKey = normalizeTeamName(teamName);
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

function teamDocumentId(teamKey) {
  return `team_${String(teamKey || "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 110)}`;
}

function isGeneralRankingEvent(eventType) {
  const normalized = String(eventType || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return ["treino-freitas", "xtreino-tokens", "modo-liga", "treino-modo-liga"].includes(normalized);
}

module.exports = {
  LINK_COLLECTION,
  RANKING_COLLECTION,
  accountRankingTeamId,
  isGeneralRankingEvent,
  normalizeTeamName,
  teamDocumentId,
};
