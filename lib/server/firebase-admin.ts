import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;
const firestoreDatabaseId =
  process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID;

export const getFirebaseAdminApp = (): App => {
  if (cachedApp) return cachedApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0]!;
    return cachedApp;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "";

  if (!projectId) {
    throw new Error(
      "Missing required environment variable: FIREBASE_PROJECT_ID",
    );
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  // Prefer explicit service-account credentials, but allow project-id-only
  // initialization so token verification can work in local setups.
  cachedApp =
    clientEmail && privateKey
      ? initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        })
      : initializeApp({ projectId });

  return cachedApp;
};

export const getFirebaseAdminAuth = () => getAuth(getFirebaseAdminApp());

export const getFirebaseAdminDb = () => {
  const app = getFirebaseAdminApp();

  if (firestoreDatabaseId && firestoreDatabaseId !== "(default)") {
    return getFirestore(app, firestoreDatabaseId);
  }

  return getFirestore(app);
};
