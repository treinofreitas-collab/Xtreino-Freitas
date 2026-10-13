const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAdmin, verifyFirebaseUser } = require("./firebase-admin");

test("payment adapter uses the real Firebase Admin modular SDK without legacy namespaces", async () => {
  // Initialization and client construction are local; no database query,
  // authentication request, production credential, or payment is used.
  const app = initializeApp({ projectId: "demo-payment-sdk-test" });
  try {
    const admin = getAdmin();
    assert.equal(typeof admin.auth().verifyIdToken, "function");
    assert.equal(typeof admin.firestore().collection, "function");
    assert.equal(typeof admin.firestore().runTransaction, "function");
    assert.equal(typeof admin.firestore.FieldValue.serverTimestamp, "function");
    assert.equal(typeof admin.firestore.FieldValue.increment, "function");
    assert.ok(admin.firestore.FieldValue.serverTimestamp());
    assert.ok(admin.firestore.FieldValue.increment(1));
  } finally {
    await deleteApp(app);
  }
});

test("missing authentication is rejected before initializing Firebase", async () => {
  await assert.rejects(verifyFirebaseUser({ headers: {} }), error => error.statusCode === 401);
});

test("all Netlify payment handlers load with Lambda's ESM require restriction", () => {
  const functionsDir = path.resolve(__dirname, "../functions");
  const script = `
    const assert = require("node:assert/strict");
    const path = require("node:path");
    for (const name of [
      "create-preference", "create-token-preference", "confirm-purchase",
      "confirm-token-purchase", "pay-with-tokens", "mp-webhook",
      "check-payment-status", "check-pix-status"
    ]) {
      assert.equal(typeof require(path.join(process.argv[1], name + ".js")).handler, "function");
    }
  `;
  // No credentials or inherited NODE_OPTIONS; exercise Lambda's default restriction.
  execFileSync(process.execPath, [
    "--no-experimental-require-module", "-e", script, functionsDir
  ], { env: { PATH: process.env.PATH }, timeout: 15000 });
});
