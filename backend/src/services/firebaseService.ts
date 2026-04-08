import admin from "firebase-admin";
import { env } from "../config/env.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let firebaseApp: admin.app.App | null = null;

function initFirebase(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  // Priority 1: Service account JSON file path
  if (env.firebaseServiceAccountPath) {
    const resolved = path.isAbsolute(env.firebaseServiceAccountPath)
      ? env.firebaseServiceAccountPath
      : path.resolve(__dirname, "../../../", env.firebaseServiceAccountPath);

    if (fs.existsSync(resolved)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf-8"));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("[firebase] Initialized from service account file");
      return firebaseApp;
    }
    console.warn("[firebase] Service account file not found:", resolved);
  }

  // Priority 2: Individual env vars
  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    const pk = env.firebasePrivateKey;
    console.log(`[firebase] Init from env vars — projectId: ${env.firebaseProjectId}, key starts: "${pk.substring(0, 30)}...", key length: ${pk.length}, has newlines: ${pk.includes("\n")}`);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
      }),
    });
    console.log("[firebase] Initialized from env vars");
    return firebaseApp;
  }

  // Priority 3: Default credentials (for Cloud environments)
  try {
    firebaseApp = admin.initializeApp();
    console.log("[firebase] Initialized with default credentials");
    return firebaseApp;
  } catch (err) {
    console.warn("[firebase] No credentials available — phone auth will be unavailable");
    throw new Error("Firebase Admin SDK not configured");
  }
}

export function getFirebaseAuth(): admin.auth.Auth {
  const app = initFirebase();
  return app.auth();
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  const auth = getFirebaseAuth();
  return auth.verifyIdToken(idToken);
}

export function isFirebaseConfigured(): boolean {
  return !!(
    env.firebaseServiceAccountPath ||
    (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey)
  );
}
