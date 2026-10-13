const test = require("node:test");
const assert = require("node:assert/strict");
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
