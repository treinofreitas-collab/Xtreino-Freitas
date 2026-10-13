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

function runCredentialTest(script) {
  // Fresh processes isolate the default app and environment for each scenario.
  // The RSA key is generated locally for a nonexistent demo service account.
  const setup = `
    const assert = require("node:assert/strict");
    const { generateKeyPairSync } = require("node:crypto");
    const { getApps } = require("firebase-admin/app");
    const { getAdmin, verifyFirebaseUser } = require(process.argv[1]);
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const credentials = {
      project_id: "demo-payment-env-test",
      client_email: "firebase-adminsdk@demo-payment-env-test.iam.gserviceaccount.com",
      private_key: privateKey,
    };
    const split = {
      FIREBASE_PROJECT_ID: credentials.project_id,
      FIREBASE_CLIENT_EMAIL: credentials.client_email,
      FIREBASE_PRIVATE_KEY: credentials.private_key,
    };
  `;
  execFileSync(process.execPath, [
    "--no-experimental-require-module", "-e", setup + script,
    path.resolve(__dirname, "firebase-admin.js"),
  ], { env: { PATH: process.env.PATH }, timeout: 15000 });
}

test("split service account variables initialize the real SDK and retain authentication checks", () => {
  runCredentialTest(`
    Object.assign(process.env, split);
    const admin = getAdmin();
    assert.equal(getApps()[0].options.projectId, credentials.project_id);
    assert.equal(typeof admin.firestore().runTransaction, "function");
    assert.equal(typeof admin.auth().verifyIdToken, "function");
    assert.rejects(
      verifyFirebaseUser({ headers: { authorization: "Bearer invalid-diagnostic-token" } }),
      error => error.statusCode === 401 && error.message === "Invalid authentication token"
    ).catch(error => { console.error(error); process.exitCode = 1; });
  `);
});

test("split service account private keys support escaped newlines", () => {
  runCredentialTest(`
    Object.assign(process.env, split);
    process.env.FIREBASE_PRIVATE_KEY = privateKey.replace(/\\n/g, "\\\\n");
    getAdmin();
    assert.equal(getApps()[0].options.projectId, credentials.project_id);
  `);
});

test("service account JSON remains supported and takes precedence over split variables", () => {
  runCredentialTest(`
    Object.assign(process.env, split, {
      FIREBASE_PROJECT_ID: "demo-other-project",
      FIREBASE_PRIVATE_KEY: "invalid-private-key",
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(credentials),
    });
    getAdmin();
    assert.equal(getApps()[0].options.projectId, credentials.project_id);
  `);
});

test("malformed or non-object JSON cannot fall back to split credentials", () => {
  runCredentialTest(`
    Object.assign(process.env, split);
    for (const raw of ["invalid-json", "null", "[]", '"not-an-object"']) {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = raw;
      assert.throws(getAdmin, error =>
        error.code === "invalid_firebase_service_account" && error.statusCode === 503
      );
      assert.equal(getApps().length, 0);
    }
  `);
});

test("each missing split credential and completely absent configuration fail explicitly", () => {
  runCredentialTest(`
    for (const missing of Object.keys(split)) {
      Object.assign(process.env, split);
      delete process.env[missing];
      assert.throws(getAdmin, error =>
        error.code === "missing_firebase_service_account" && error.statusCode === 503
      );
      assert.equal(getApps().length, 0);
    }
    for (const key of Object.keys(split)) delete process.env[key];
    assert.throws(getAdmin, error => error.code === "missing_firebase_service_account");
  `);
});

test("invalid split private key fails without exposing credentials", () => {
  runCredentialTest(`
    Object.assign(process.env, split, { FIREBASE_PRIVATE_KEY: "invalid-private-key" });
    assert.throws(getAdmin, error =>
      error.code === "firebase_admin_initialization_failed" &&
      error.statusCode === 503 &&
      error.message === "Unable to initialize Firebase Admin"
    );
    assert.equal(getApps().length, 0);
  `);
});

test("all Netlify payment handlers load with Lambda's ESM require restriction", () => {
  const functionsDir = path.resolve(__dirname, "../functions");
  const script = `
    const assert = require("node:assert/strict");
    const path = require("node:path");
    for (const name of [
      "create-preference", "create-token-preference", "confirm-purchase",
      "confirm-token-purchase", "pay-with-tokens", "mp-webhook",
      "check-payment-status", "check-pix-status", "check-availability"
    ]) {
      assert.equal(typeof require(path.join(process.argv[1], name + ".js")).handler, "function");
    }
  `;
  // No credentials or inherited NODE_OPTIONS; exercise Lambda's default restriction.
  execFileSync(process.execPath, [
    "--no-experimental-require-module", "-e", script, functionsDir
  ], { env: { PATH: process.env.PATH }, timeout: 15000 });
});
