import { adminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";

export async function startLowStockMonitor() {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.warn("[Low Stock Monitor] FIREBASE_SERVICE_ACCOUNT environment variable is not defined. Skipping server-side stock monitoring task to prevent continuous PERMISSION_DENIED check warns (expected in development/local setups). Client-side warning indicators will continue to work normally.");
      return;
    }

    console.log("[Low Stock Monitor] Starting periodic pulling monitor for low stock thresholds (every 30s) using Admin SDK...");

    const checkLowStock = async () => {
      try {
        const productsSnap = await adminDb.collection("products").get();
        const existingNotificationsSnap = await adminDb.collection("client_notifications")
          .where("type", "==", "alert")
          .get();

        const activeNotificationIds = new Set(existingNotificationsSnap.docs.map(doc => doc.id));
        const batch = adminDb.batch();
        let batchCount = 0;

        productsSnap.docs.forEach((doc) => {
          const docId = doc.id;
          const data = doc.data();
          const stock = Number(data.stock) || 0;
          const minThreshold = Number(data.minThreshold) || 1; // Default to 1 if not defined to avoid false alarms
          const thresholdToUse = Number(data.minThreshold) !== undefined ? minThreshold : 0;
          const notificationId = `low-stock-${docId}`;

          if (stock <= thresholdToUse && data.name) {
            const notifRef = adminDb.collection("client_notifications").doc(notificationId);
            batch.set(notifRef, {
              title: "Stock Bajo",
              message: `El producto "${data.name}" tiene stock bajo (${stock} unidades).`,
              type: "alert",
              link: "inventory",
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            activeNotificationIds.delete(notificationId);
            batchCount++;
          }
        });

        // Delete notifications for products that are no longer low-stock or were deleted
        activeNotificationIds.forEach((notifId) => {
          if (notifId.startsWith("low-stock-")) {
            const notifRef = adminDb.collection("client_notifications").doc(notifId);
            batch.delete(notifRef);
            batchCount++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
        }
      } catch (error) {
        console.error("[Low Stock Monitor] Error during periodic check:", error);
      }
    };

    // Run once immediately on start
    await checkLowStock().catch(err => {
      console.error("[Low Stock Monitor] Initial startup check failed:", err);
    });

    // Query periodic check every 30 seconds
    setInterval(() => {
      checkLowStock().catch(err => {
        console.error("[Low Stock Monitor] Periodic background check failed:", err);
      });
    }, 30000);

  } catch (err) {
    console.error("[Low Stock Monitor] Failed to initialize:", err);
  }
}
