import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import firebaseConfig from "../../firebase-applet-config.json";

// Lazy-initialized Firebase Admin instance to ensure single instance
function getFirebaseAdminInstance(): any {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      // Fallback for local development or ADC
      return initializeApp();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin app:", err);
    return initializeApp();
  }
}

const appInstance = getFirebaseAdminInstance();

export const adminDb = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);

export default admin;
