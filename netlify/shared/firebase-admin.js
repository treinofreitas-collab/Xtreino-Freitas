const { getApp, getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

// Keep the shared payment interface while using the modular Admin SDK.
// Firebase Admin 14 no longer exports apps, auth, or firestore namespaces.
const firestore = Object.assign(() => getFirestore(), { FieldValue });
const storage = () => {
  const app = getApps().find(candidate => candidate.name === "[DEFAULT]") || getApp();
  const projectId = app.options.projectId;
  if (!projectId) {
    const error = new Error("Firebase Storage project is not configured");
    error.statusCode = 503;
    throw error;
  }
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim()
    || `${projectId}.firebasestorage.app`;
  return getStorage(app).bucket(bucketName);
};
const admin = { firestore, auth: () => getAuth(), storage };

function getAdmin() {
  if (getApps().some(app => app.name === "[DEFAULT]")) return admin;

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let credentials;
  if (rawCredentials) {
    // An explicitly configured JSON takes precedence; never hide invalid JSON
    // by silently switching to a different service account.
    try {
      credentials = JSON.parse(rawCredentials);
      if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
        throw new Error("Invalid service account object");
      }
    } catch {
      const error = new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON");
      error.code = "invalid_firebase_service_account";
      error.statusCode = 503;
      throw error;
    }
  } else {
    // Preserve existing Netlify configuration without moving private keys.
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId?.trim() || !clientEmail?.trim() || !privateKey?.trim()) {
      const error = new Error("Missing Firebase service account credentials");
      error.code = "missing_firebase_service_account";
      error.statusCode = 503;
      throw error;
    }
    credentials = {
      project_id: projectId.trim(),
      client_email: clientEmail.trim(),
      private_key: privateKey,
    };
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
