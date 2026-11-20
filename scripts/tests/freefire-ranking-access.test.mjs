import assert from "node:assert/strict";
import test from "node:test";
import {
  accountRankingTeamId,
  filterRankingSessionsForTeam,
  generalRankingTeamKey,
  hasConfirmedRankingTeamPurchase,
  resolveOwnedRankingTeam,
} from "@workspace/freefire-ranking-access";

test("ownership IDs match the client account ranking identity", async () => {
  const { accountRankingTeamId: clientAccountRankingTeamId } = await import(
    "../../artifacts/xtreino/public/js/freefire-general-ranking.mjs"
  );
  assert.equal(accountRankingTeamId("member-1", "Fóltést Pro"), clientAccountRankingTeamId("member-1", "Fóltést Pro"));
  assert.equal(generalRankingTeamKey("FÓLTEST-PRO"), generalRankingTeamKey("Fóltest Pro"));
});

test("only a confirmed non-solo purchase grants access to its team history", () => {
  const registrations = [
    { userId: "buyer-1", teamName: "FOLTEST PRO", status: "paid", rankingTeamId: "foltest-id" },
    { userId: "buyer-1", teamName: "PENDING TEAM", status: "pending", rankingTeamId: "pending-id" },
    { userId: "buyer-1", teamName: "SOLO TEAM", status: "paid", eventType: "diario-solo", rankingTeamId: "solo-id" },
  ];

  assert.deepEqual(
    resolveOwnedRankingTeam(registrations, "buyer-1", "foltest-id"),
    {
      teamId: "foltest-id",
      teamName: "FOLTEST PRO",
      teamKey: "foltest pro",
    },
  );
  assert.equal(resolveOwnedRankingTeam(registrations, "buyer-1", "pending-id"), null);
  assert.equal(resolveOwnedRankingTeam(registrations, "buyer-1", "solo-id"), null);
  assert.equal(resolveOwnedRankingTeam(registrations, "someone-else", "foltest-id"), null);
  assert.equal(resolveOwnedRankingTeam([
    { contact: "verified@example.com", teamName: "EMAIL TEAM", status: "approved", teamId: "email-id" },
  ], "email-user", "email-id"), null);
  assert.deepEqual(
    resolveOwnedRankingTeam([
      { contact: "verified@example.com", teamName: "EMAIL TEAM", status: "approved", teamId: "email-id" },
    ], "email-user", "email-id", "verified@example.com"),
    { teamId: "email-id", teamName: "EMAIL TEAM", teamKey: "email team" },
  );
});

test("logo changes require a paid general-ranking purchase for the exact team", () => {
  const teamId = accountRankingTeamId("buyer-1", "FOLTEST PRO");
  const registrations = [
    {
      userId: "buyer-1",
      teamName: "FOLTEST PRO",
      eventType: "treino-freitas",
      status: "paid",
    },
    {
      userId: "buyer-1",
      teamName: "FREE TEAM",
      eventType: "treino-freitas",
      status: "lisagem_gratis",
      rankingTeamId: "free-id",
    },
    {
      userId: "buyer-1",
      teamName: "PENDING TEAM",
      eventType: "treino-freitas",
      status: "pending",
      rankingTeamId: "pending-id",
    },
    {
      userId: "buyer-1",
      teamName: "SOLO TEAM",
      eventType: "diario-solo",
      status: "paid",
      rankingTeamId: "solo-id",
    },
    {
      userId: "buyer-1",
      teamName: "OTHER EVENT",
      eventType: "marketplace",
      status: "paid",
      rankingTeamId: "other-event-id",
    },
  ];

  assert.equal(hasConfirmedRankingTeamPurchase(registrations, "buyer-1", teamId), true);
  assert.equal(hasConfirmedRankingTeamPurchase(registrations, "buyer-1", "free-id"), false);
  assert.equal(hasConfirmedRankingTeamPurchase(registrations, "buyer-1", "pending-id"), false);
  assert.equal(hasConfirmedRankingTeamPurchase(registrations, "buyer-1", "solo-id"), false);
  assert.equal(hasConfirmedRankingTeamPurchase(registrations, "buyer-1", "other-event-id"), false);
  assert.equal(hasConfirmedRankingTeamPurchase(registrations, "another-user", teamId), false);
});

test("a confirmed member can update the team linked to the purchaser's ranking ID", () => {
  const teamId = accountRankingTeamId("captain-1", "NEXLV FFWS");
  assert.equal(hasConfirmedRankingTeamPurchase([
    {
      userId: "captain-1",
      membrosUids: ["member-1"],
      teamName: "NEXLV FFWS",
      eventType: "modo-liga",
      status: "confirmed",
      rankingTeamId: teamId,
    },
  ], "member-1", teamId), true);
});

test("team history includes exact and safe legacy matches without exposing other teams", () => {
  const team = {
    teamId: "foltest-id",
    teamName: "FOLTEST PRO",
    teamKey: "foltest pro",
  };
  const sessions = filterRankingSessionsForTeam([
    {
      sessionId: "exact-match",
      eventType: "treino-freitas",
      eventLabel: "TREINO FREITAS",
      date: "2026-11-18",
      hour: "18h",
      updatedBy: "admin-private-data",
      teams: [
        { teamName: "FOLTEST PRO", rankingTeamId: "foltest-id", points: 15, wins: 1, kills: 4 },
        { teamName: "OTHER TEAM", rankingTeamId: "other-id", points: 90, wins: 4, kills: 30 },
      ],
    },
    {
      sessionId: "safe-legacy",
      eventType: "modo-liga",
      eventLabel: "MODO LIGA",
      date: "2026-11-19",
      hour: "20",
      teams: [{ teamName: "Fóltest Pró", points: 8, wins: 0, kills: 8 }],
    },
    {
      sessionId: "different-team-id",
      eventType: "treino-freitas",
      date: "2026-11-20",
      hour: "18",
      teams: [{ teamName: "FOLTEST PRO", rankingTeamId: "somebody-elses-id", points: 99 }],
    },
    {
      sessionId: "invalid-hour",
      eventType: "treino-freitas",
      date: "2026-11-21",
      hour: "24",
      teams: [{ teamName: "FOLTEST PRO", rankingTeamId: "foltest-id", points: 99 }],
    },
  ], team);

  assert.deepEqual(sessions.map((session) => session.sessionId), ["exact-match", "safe-legacy"]);
  assert.deepEqual(sessions[0].teams, [{
    teamName: "FOLTEST PRO",
    rankingTeamId: "foltest-id",
    points: 15,
    wins: 1,
    kills: 4,
  }]);
  assert.equal("updatedBy" in sessions[0], false);
  assert.equal(sessions[1].hour, "20");
});

test("same-name conflicting IDs and duplicate legacy rows are excluded", () => {
  const team = {
    teamId: "foltest-id",
    teamName: "FOLTEST PRO",
    teamKey: "foltest pro",
  };
  const sessions = filterRankingSessionsForTeam([
    {
      sessionId: "conflict",
      eventType: "treino-freitas",
      date: "2026-11-18",
      hour: "18",
      teams: [
        { teamName: "FOLTEST PRO", rankingTeamId: "someone-else", points: 50 },
        { teamName: "FOLTEST PRO", points: 50 },
      ],
    },
    {
      sessionId: "duplicate-legacy",
      eventType: "treino-freitas",
      date: "2026-11-19",
      hour: "18",
      teams: [
        { teamName: "FOLTEST PRO", points: 10 },
        { teamName: "Fóltest Pró", points: 10 },
      ],
    },
  ], team);

  assert.deepEqual(sessions, []);
});
