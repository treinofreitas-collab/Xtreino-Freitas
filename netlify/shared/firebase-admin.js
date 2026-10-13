const admin = require("firebase-admin");

function getAdmin() {
  if (admin.apps.length) return admin;

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
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
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
