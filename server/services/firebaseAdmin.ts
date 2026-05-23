import admin from "firebase-admin";
import fs from "fs";
import path from "path";

if (!admin.apps.length) {
  const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath)
      });
      console.log("[FirebaseAdmin] Initialized with local serviceAccountKey.json");
    } catch (err) {
      console.warn("[FirebaseAdmin] Failed to initialize with serviceAccountKey.json, trying applicationDefault:", err);
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log("[FirebaseAdmin] Initialized with applicationDefault credentials");
  }
}

export { admin };
