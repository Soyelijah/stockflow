import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import firebaseConfig from "../../firebase-applet-config.json";

// Lazy-initialized Firebase Admin instance to ensure single instance
function getFirebaseAdminInstance(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return admin.initializeApp();
    } else {
      // Fallback for local development
      return admin.initializeApp();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin app:", err);
    return admin.initializeApp();
  }
}

const appInstance = getFirebaseAdminInstance();

export const adminDb = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);

export default admin;
