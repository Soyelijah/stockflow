import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function startLowStockMonitor() {
  try {
    console.log("[Low Stock Monitor] Listening to products collection for low stock thresholds using adminDb...");

    adminDb.collection("products").onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const docId = change.doc.id;
        const data = change.doc.data();

        if (change.type === "removed") {
          try {
            await adminDb.collection("client_notifications").doc(`low-stock-${docId}`).delete();
          } catch (err) {
            console.error(`[Low Stock Monitor] Error deleting low stock notification for deleted product ${docId}:`, err);
          }
          return;
        }

        const stock = Number(data.stock) || 0;
        const minThreshold = Number(data.minThreshold) || 0;

        if (stock <= minThreshold && data.name) {
          try {
            await adminDb.collection("client_notifications").doc(`low-stock-${docId}`).set({
              title: "Stock Bajo",
              message: `El producto "${data.name}" tiene stock bajo (${stock} unidades).`,
              type: "alert",
              link: "inventory",
              timestamp: FieldValue.serverTimestamp()
            });
          } catch (err) {
            console.error(`[Low Stock Monitor] Error writing low stock notification for ${docId}:`, err);
          }
        } else {
          try {
            await adminDb.collection("client_notifications").doc(`low-stock-${docId}`).delete();
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
