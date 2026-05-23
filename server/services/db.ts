import { initializeApp, getApps } from "firebase/app";
import { initializeFirestore, Firestore } from "firebase/firestore";
import fs from "fs";
import path from "path";

let dbInstance: Firestore | null = null;

export function getServerDb(): Firestore | null {
  if (dbInstance) return dbInstance;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      console.warn("[getServerDb] No firebase-applet-config.json found.");
      return null;
    }
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    const appName = "stockflow-server-core";
    const app = getApps().find(a => a.name === appName) || initializeApp(firebaseConfig, appName);
    
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, (firebaseConfig as any).firestoreDatabaseId);

    return dbInstance;
  } catch (err) {
    console.error("[getServerDb] Failed to initialize backend Firestore instance:", err);
    return null;
  }
}
