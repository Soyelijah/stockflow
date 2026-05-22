import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import path from "path";

export async function startLowStockMonitor() {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      console.warn("[Low Stock Monitor] No firebase-applet-config.json found.");
      return;
    }
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    const app = initializeApp(firebaseConfig, "low-stock-monitor");
    const db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, (firebaseConfig as any).firestoreDatabaseId);

    console.log("[Low Stock Monitor] Listening to products collection for low stock thresholds...");

    onSnapshot(collection(db, "products"), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const docId = change.doc.id;
        const data = change.doc.data();

        if (change.type === "removed") {
          try {
            await deleteDoc(doc(db, "client_notifications", `low-stock-${docId}`));
          } catch (err) {
            console.error(`[Low Stock Monitor] Error deleting low stock notification for deleted product ${docId}:`, err);
          }
          return;
        }

        const stock = Number(data.stock) || 0;
        const minThreshold = Number(data.minThreshold) || 0;

        if (stock <= minThreshold && data.name) {
          try {
            await setDoc(doc(db, "client_notifications", `low-stock-${docId}`), {
              title: "Stock Bajo",
              message: `El producto "${data.name}" tiene stock bajo (${stock} unidades).`,
              type: "alert",
              link: "inventory",
              timestamp: serverTimestamp()
            });
          } catch (err) {
            console.error(`[Low Stock Monitor] Error writing low stock notification for ${docId}:`, err);
          }
        } else {
          try {
            await deleteDoc(doc(db, "client_notifications", `low-stock-${docId}`));
          } catch (err) {
            // Safe to ignore if not existing
          }
        }
      });
    }, (error) => {
      console.error("[Low Stock Monitor] Snapshot listener error:", error);
    });

  } catch (err) {
    console.error("[Low Stock Monitor] Failed to initialize:", err);
  }
}
