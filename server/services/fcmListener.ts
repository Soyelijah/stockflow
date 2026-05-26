import { adminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";

export function startFCMStatusListener() {
  console.log("🔔 [FCM Listener] Starting background real-time listener on 'shipments' collection...");

  const lastStatuses = new Map<string, string>();
  const lastAssignedDrivers = new Map<string, string>();

  // Subscribe to real-time changes of the shipments collection
  const unsubscribe = adminDb.collection("shipments").onSnapshot(async (snapshot) => {
    await Promise.all(snapshot.docChanges().map(async (change) => {
      const docId = change.doc.id;
      const data = change.doc.data();
      if (!data) return;

      const status = data.status || "";
      const assignedDriverId = data.assignedDriverId || "";
      const orderId = data.orderId || "";
      const customerName = data.customerName || "";
      const customerId = data.customerId || "";
      const address = data.address || "";
      const driverName = data.driverName || "";

      if (change.type === "added") {
        // Record current status to avoid duplicate spam on server startup
        lastStatuses.set(docId, status);
        lastAssignedDrivers.set(docId, assignedDriverId);
        return;
      }

      if (change.type === "modified") {
        const prevStatus = lastStatuses.get(docId);
        const prevDriverId = lastAssignedDrivers.get(docId);

        // Update tracking state
        lastStatuses.set(docId, status);
        lastAssignedDrivers.set(docId, assignedDriverId);

        // 1. If shipment status has transitioned
        if (prevStatus !== undefined && prevStatus !== status) {
          console.log(`🚚 [FCM Listener] Shipment ${docId} changed status from '${prevStatus}' to '${status}'`);

          // Notify Customer
          if (customerId) {
            let title = "";
            let body = "";

            if (status === "prepared") {
              title = "📦 Pedido Preparado";
              body = `Hola ${customerName}, tu pedido #${orderId} ha sido embalado y está listo para ser despachado.`;
            } else if (status === "in_route") {
              title = "🚚 Pedido en Camino";
              body = `¡Buenas noticias! Tu pedido #${orderId} va en camino a ${address} con ${driverName || "nuestro despachador"}.`;
            } else if (status === "delivered") {
              title = "✅ Pedido Entregado";
              body = `¡Tu pedido #${orderId} ha sido entregado exitosamente en ${address}! Muchas gracias por tu compra.`;
            }

            if (title && body) {
              await sendPushNotification(customerId, "customer", title, body, {
                shipmentId: docId,
                orderId,
                status
              });
            }
          }

          // Notify Assigned Driver (if applicable)
          if (assignedDriverId) {
            let title = "";
            let body = "";

            if (status === "prepared") {
              title = "🎒 Nuevo Despacho Disponible";
              body = `El pedido #${orderId} para ${customerName} está listo para ser retirado en bodega.`;
            } else if (status === "in_route") {
              title = "🚚 Ruta Iniciada";
              body = `Has iniciado el tránsito para la entrega en ${address}.`;
            } else if (status === "delivered") {
              title = "✓ Entrega Completada";
              body = `Has confirmado la entrega del pedido #${orderId} con éxito.`;
            }

            if (title && body) {
              await sendPushNotification(assignedDriverId, "driver", title, body, {
                shipmentId: docId,
                orderId,
                status
              });
            }
          }
        }

        // 2. If shipment was newly assigned to a driver
        if (assignedDriverId && prevDriverId !== assignedDriverId) {
          console.log(`👤 [FCM Listener] Shipment ${docId} newly assigned to driver ${assignedDriverId}`);
          
          const title = "📦 Carga Asignada";
          const body = `Se te ha asignado la entrega de despacho para ${customerName} (Pedido #${orderId}) en ${address}.`;

          await sendPushNotification(assignedDriverId, "driver", title, body, {
            shipmentId: docId,
            orderId,
            status
          });
        }
      }
    }));
  }, (error) => {
    console.error("❌ [FCM Listener] Error listening to shipments:", error);
  });

  return unsubscribe;
}

/**
 * Resolves registered tokens from the write-only 'fcm_tokens' collection and delivers multicast FCM push alerts.
 */
async function sendPushNotification(userId: string, role: string, title: string, body: string, dataPayload: Record<string, string>) {
  try {
    const tokensSnap = await adminDb.collection("fcm_tokens")
      .where("userId", "==", userId)
      .get();

    if (tokensSnap.empty) {
      console.log(`ℹ️ [FCM] No tokens registered for user: ${userId} (${role}). Fallback: App will display notifications on layout updates.`);
      return;
    }

    const tokens = tokensSnap.docs
      .map(doc => doc.data().token)
      .filter((t): t is string => typeof t === "string" && t.length > 0);

    if (tokens.length === 0) {
      console.log(`⚠️ [FCM] Registered token values are empty for user: ${userId}.`);
      return;
    }

    console.log(`📨 [FCM] Preparing push to ${tokens.length} devices for ${role} (ID: ${userId})...`);

    const message = {
      notification: {
        title,
        body
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        ...dataPayload
      },
      tokens
    };

    try {
      const messaging = admin.messaging();
      const response = await messaging.sendEachForMulticast(message);
      console.log(`✅ [FCM] Sent pushes. Successes: ${response.successCount}, Failures: ${response.failureCount}`);

      // Auto-clean unvalidated / stale registration tokens
      if (response.failureCount > 0) {
        const batch = adminDb.batch();
        let shouldCommit = false;

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const badToken = tokens[idx];
            const errorCode = resp.error?.code;
            if (badToken && (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered"
            )) {
              console.log(`🗑️ [FCM Housekeeping] Removing invalid/expired token: ${badToken.slice(0, 15)}...`);
              const tokenDocRef = adminDb.collection("fcm_tokens").doc(badToken);
              batch.delete(tokenDocRef);
              shouldCommit = true;
            }
          }
        });

        if (shouldCommit) {
          await batch.commit().catch(e => console.error("Error committing housekeeping batch:", e));
        }
      }
    } catch (messagingErr) {
      console.warn("⚠️ [FCM Notification Warn] FCM Messaging service unavailable or credentials restricted. Output payload:", JSON.stringify(message));
    }
  } catch (err) {
    console.error("❌ [FCM Dispatch Error] Failed to resolve or send messages:", err);
  }
}
