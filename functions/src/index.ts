import { onDocumentWritten, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";

initializeApp();

const db = getFirestore();

// 1. HTTP Callable para definir roles (Custom Claims y DB Sync)
export const setUserRole = onCall(async (request) => {
  const { userId, role } = request.data || {};
  
  if (!userId || !role) {
    throw new HttpsError("invalid-argument", "userId y role son requeridos.");
  }

  const validRoles = ["admin", "manager", "seller", "logistics"];
  if (!validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Rol inválido.");
  }

  try {
    // 1. Establecer Custom Claims
    await getAuth().setCustomUserClaims(userId, { role });
    
    // 2. Actualizar documento de usuario en Firestore
    await db.collection("users").doc(userId).set({
      role: role,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, message: `Rol ${role} asignado al usuario ${userId}.` };
  } catch (error: any) {
    console.error("Error en setUserRole:", error);
    throw new HttpsError("internal", error.message || "Error al asignar rol.");
  }
});

// 2. Firestore Trigger para cambios de stock
export const onProductStockChange = onDocumentWritten("products/{productId}", async (event) => {
  const productId = event.params.productId;
  const snapshot = event.data;
  
  if (!snapshot) {
    // Documento borrado
    try {
      await db.collection("notifications").doc(productId).delete();
    } catch (err) {
      console.error("Error al borrar notificación por eliminación de producto:", err);
    }
    return;
  }

  const data = snapshot.after.data();
  if (!data) {
    // Documento borrado o sin datos
    try {
      await db.collection("notifications").doc(productId).delete();
    } catch (err) {
      console.error("Error al borrar notificación:", err);
    }
    return;
  }

  const stock = Number(data.stock) || 0;
  const minThreshold = Number(data.minThreshold) || 0;
  const name = data.name || "Producto";

  if (stock <= minThreshold) {
    try {
      await db.collection("notifications").doc(productId).set({
        type: "low_stock",
        title: "Stock Bajo",
        message: `El producto "${name}" tiene stock bajo (${stock} unidades).`,
        productId: productId,
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Error escribiendo notificación de stock bajo:", err);
    }
  } else {
    try {
      await db.collection("notifications").doc(productId).delete();
    } catch (err) {
      console.error("Error borrando notificación de stock alto:", err);
    }
  }
});

// 3. Firestore Trigger for claims resolution
export const onClaimResolved = onDocumentUpdated("claims/{claimId}", async (event) => {
  const claimId = event.params.claimId;
  const snapshot = event.data;
  if (!snapshot) return;

  const beforeData = snapshot.before.data();
  const afterData = snapshot.after.data();

  if (!beforeData || !afterData) return;

  // Si el campo status cambia a "resolved"
  if (beforeData.status !== "resolved" && afterData.status === "resolved") {
    const customerId = afterData.customerId;
    if (!customerId) {
      console.warn("No customerId found on resolved claim", claimId);
      return;
    }

    try {
      await db.collection("notifications").doc(`${customerId}_claim_${claimId}`).set({
        type: "claim_resolved",
        title: "Reclamo Resuelto",
        message: `Tu reclamo con código #${claimId} ha sido resuelto por soporte.`,
        claimId: claimId,
        customerId: customerId,
        resolvedAt: FieldValue.serverTimestamp(),
        read: false
      });
      console.log(`Notification created for resolved claim: ${claimId} and customer: ${customerId}`);
    } catch (err) {
      console.error("Error creating claim resolution notification:", err);
    }
  }
});
