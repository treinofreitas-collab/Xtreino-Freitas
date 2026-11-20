import assert from "node:assert/strict";
import test from "node:test";
import {
  RankingTeamLogoUpdateError,
  updateOwnedRankingTeamLogo,
} from "@workspace/freefire-ranking-access";

const teamId = "team-a-id";
const uid = "buyer-1";
const storagePath = `profile-photos/${uid}/team-logos/${teamId}/logo.png`;
const bucketName = "xtreino.firebasestorage.app";
const token = "download-token";
const logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const registrations = [{
  userId: uid,
  teamName: "TEAM A",
  eventType: "treino-freitas",
  status: "paid",
  rankingTeamId: teamId,
}];

function createFirestore({
  link = { rankingDocumentId: "rank-team-a" },
  ranking = {
    teamName: "TEAM A",
    rankingTeamId: teamId,
    totalPoints: 231,
    wins: 4,
    kills: 80,
    logoUrl: "https://old.example/logo.png",
    logoSource: "purchase",
  },
} = {}) {
  const documents = new Map([
    [`freefire_general_ranking_team_links/${teamId}`, link],
    ["freefire_general_ranking/rank-team-a", ranking],
  ]);
  const updates = [];
  return {
    updates,
    documents,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const data = documents.get(key);
              return { exists: Boolean(data), data: () => data };
            },
            async update(data) {
              const current = documents.get(key);
              if (!current) throw new Error("missing document");
              const updated = { ...current, ...data };
              documents.set(key, updated);
              updates.push({ key, data });
            },
          };
        },
      };
    },
  };
}

function createBucket({
  size = pngBytes.length,
  contentType = "image/png",
  bytes = pngBytes,
  storedToken = token,
  objectPath = storagePath,
} = {}) {
  const file = {
    async getMetadata() {
      return [{
        size,
        contentType,
        metadata: { firebaseStorageDownloadTokens: storedToken },
      }];
    },
    async download() {
      return [bytes];
    },
  };
  return {
    name: bucketName,
    file(path) {
      assert.equal(path, objectPath);
      return file;
    },
  };
}

test("updates only the matching ranking team's logo and preserves its score", async () => {
  const firestore = createFirestore();
  const result = await updateOwnedRankingTeamLogo({
    firestore,
    bucket: createBucket(),
    registrations,
    uid,
    teamId,
    storagePath,
    logoUrl,
    serverTimestamp: () => "server-time",
  });

  assert.deepEqual(result, {
    teamId,
    teamName: "TEAM A",
    logoUrl,
    updatedAt: result.updatedAt,
  });
  const saved = firestore.documents.get("freefire_general_ranking/rank-team-a");
  assert.equal(saved.logoUrl, logoUrl);
  assert.equal(saved.logoSource, "custom");
  assert.equal(saved.updatedAt, "server-time");
  assert.equal(saved.totalPoints, 231);
  assert.equal(saved.wins, 4);
  assert.equal(saved.kills, 80);
  assert.equal(firestore.updates.length, 1);
});

test("rejects a logo path owned by another account", async () => {
  const firestore = createFirestore();
  await assert.rejects(
    updateOwnedRankingTeamLogo({
      firestore,
      bucket: createBucket(),
      registrations,
      uid,
      teamId,
      storagePath: storagePath.replace(uid, "another-user"),
      logoUrl,
      serverTimestamp: () => "server-time",
    }),
    (error) => error instanceof RankingTeamLogoUpdateError && error.statusCode === 400,
  );
  assert.equal(firestore.updates.length, 0);
});

test("rejects a ranking document linked to a different team", async () => {
  const firestore = createFirestore({
    ranking: {
      teamName: "OTHER TEAM",
      rankingTeamId: "other-team-id",
      totalPoints: 12,
    },
  });
  await assert.rejects(
    updateOwnedRankingTeamLogo({
      firestore,
      bucket: createBucket(),
      registrations,
      uid,
      teamId,
      storagePath,
      logoUrl,
      serverTimestamp: () => "server-time",
    }),
    (error) => error instanceof RankingTeamLogoUpdateError && error.statusCode === 409,
  );
  assert.equal(firestore.updates.length, 0);
});

test("rejects invalid image bytes even when the storage metadata says PNG", async () => {
  const firestore = createFirestore();
  await assert.rejects(
    updateOwnedRankingTeamLogo({
      firestore,
      bucket: createBucket({ bytes: new Uint8Array([1, 2, 3]) }),
      registrations,
      uid,
      teamId,
      storagePath,
      logoUrl,
      serverTimestamp: () => "server-time",
    }),
    (error) => error instanceof RankingTeamLogoUpdateError && error.statusCode === 400,
  );
  assert.equal(firestore.updates.length, 0);
});
