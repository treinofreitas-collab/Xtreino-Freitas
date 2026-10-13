const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Keep the shared payment interface while using the modular Admin SDK.
// Firebase Admin 14 no longer exports apps, auth, or firestore namespaces.
const firestore = Object.assign(() => getFirestore(), { FieldValue });
const admin = { firestore, auth: () => getAuth() };

function getAdmin() {
  if (getApps().some(app => app.name === "[DEFAULT]")) return admin;

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    const error = new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    error.code = "missing_firebase_service_account";
    error.statusCode = 503;
    throw error;
  }

  let credentials;
  try {
    credentials = JSON.parse(rawCredentials);
  } catch {
    const error = new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
    error.code = "invalid_firebase_service_account";
    error.statusCode = 503;
    throw error;
  }

  if (typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  try {
    initializeApp({
      credential: cert(credentials),
      projectId: credentials.project_id,
    });
  } catch {
    const error = new Error("Unable to initialize Firebase Admin");
    error.code = "firebase_admin_initialization_failed";
    error.statusCode = 503;
    throw error;
  }

  return admin;
}

async function verifyFirebaseUser(event) {
  const headers = event.headers || {};
  const authorization = headers.authorization || headers.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const adminInstance = getAdmin();
  try {
    return await adminInstance.auth().verifyIdToken(match[1]);
  } catch {
    const error = new Error("Invalid authentication token");
    error.statusCode = 401;
    throw error;
  }
}

module.exports = { getAdmin, verifyFirebaseUser };
