/**
 * Firebase Admin SDK — SERVER ONLY.
 *
 * This module must only ever be loaded from inside TanStack Start server
 * function handlers (via dynamic `await import("./firebase-admin")`), never
 * from client components. It uses the service-account key from
 * FIREBASE_SERVICE_ACCOUNT_JSON to bypass Firestore security rules for
 * trusted operations (e.g. crediting a wallet after a verified payment).
 */

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

export { FieldPath, FieldValue };

let app: App | undefined;
let db: Firestore | undefined;

function readServiceAccount(): { projectId: string; clientEmail: string; privateKey: string } {
  const rawJson = (process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] || "").trim();
  if (rawJson) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. Paste the full service-account file contents on a single line.",
      );
    }
    const projectId = String(parsed["project_id"] ?? parsed["projectId"] ?? "").trim();
    const clientEmail = String(parsed["client_email"] ?? parsed["clientEmail"] ?? "").trim();
    const privateKey = String(parsed["private_key"] ?? parsed["privateKey"] ?? "").replace(
      /\\n/g,
      "\n",
    );
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key.",
      );
    }
    return { projectId, clientEmail, privateKey };
  }

  // Field-by-field fallback (useful on hosts where multiline secrets are awkward).
  const projectId = (process.env["FIREBASE_ADMIN_PROJECT_ID"] || "").trim();
  const clientEmail = (process.env["FIREBASE_ADMIN_CLIENT_EMAIL"] || "").trim();
  const privateKey = (process.env["FIREBASE_ADMIN_PRIVATE_KEY"] || "").trim().replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  throw new Error(
    "Firebase Admin credentials are not set. Add FIREBASE_SERVICE_ACCOUNT_JSON to .env " +
      "(Firebase Console → Project Settings → Service Accounts → Generate new private key).",
  );
}

export function getAdminApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0]!;
    return app;
  }
  const sa = readServiceAccount();
  app = initializeApp({
    credential: cert({
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      privateKey: sa.privateKey,
    }),
  });
  return app;
}

export function getAdminDb(): Firestore {
  if (!db) db = getFirestore(getAdminApp());
  return db;
}

let cachedProjectId: string | null | undefined;

/** Project id from the service-account credential. Never throws — null when unset. */
export function getAdminProjectId(): string | null {
  if (cachedProjectId !== undefined) return cachedProjectId;
  try {
    cachedProjectId = readServiceAccount().projectId;
  } catch {
    cachedProjectId = null;
  }
  return cachedProjectId;
}
