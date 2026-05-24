import { onDocumentWritten, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import * as firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 1. HTTP Callable para definir roles (Custom Claims y DB Sync)
export const setUserRole = onCall(async (request: any) => {
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

// 2. Firestore Trigger para cambios de stock (Throttled/Batched to prevent excessive writes)
export const onProductStockChange = onDocumentWritten("products/{productId}", async (event: any) => {
  const productId = event.params.productId;
  const snapshot = event.data;

  // We group updates under a central buffer document to avoid excessive individual document writes.
  const batchRef = db.collection("notifications_buffer").doc("low_stock_batch");

  if (!snapshot) {
    // Product deleted: remove from low stock batch Map in transaction
    try {
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(batchRef);
        if (docSnap.exists) {
          const items = docSnap.data()?.items || {};
          if (items[productId]) {
            delete items[productId];
            transaction.set(batchRef, { items, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
        }
      });
    } catch (err) {
      console.error("Error setting deleted product in batch queue:", err);
    }
    return;
  }

  const data = snapshot.after.data();
  if (!data) {
    // Product cleared: remove from low stock batch
    try {
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(batchRef);
        if (docSnap.exists) {
          const items = docSnap.data()?.items || {};
          if (items[productId]) {
            delete items[productId];
            transaction.set(batchRef, { items, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
        }
      });
    } catch (err) {
      console.error("Error setting cleared product in batch:", err);
    }
    return;
  }

  const stock = Number(data.stock) || 0;
  const minThreshold = Number(data.minThreshold) || 0;
  const name = data.name || "Producto";

  if (stock <= minThreshold) {
    // Add product to consolidated low stock Map inside the single buffer document via transaction
    try {
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(batchRef);
        const currentItems = docSnap.exists ? (docSnap.data()?.items || {}) : {};
        currentItems[productId] = {
          name,
          stock,
          minThreshold,
          updatedAt: new Date().toISOString()
        };
        
        transaction.set(batchRef, {
          items: currentItems,
          lastUpdatedProductId: productId,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      });

      // Throttle client notification: check if a consolidated alert was written in client_notifications recently
      const lastNotifRef = db.collection("client_notifications").doc("low-stock-consolidated-alerts");
      await db.runTransaction(async (transaction) => {
        const notifSnap = await transaction.get(lastNotifRef);
        let lastWriteTime = 0;
        if (notifSnap.exists) {
          const ts = notifSnap.data()?.timestamp;
          if (ts) {
            lastWriteTime = ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
          }
        }

        const now = Date.now();
        // If an alert was updated within the last 10 seconds, skip writing to avoid excessive writes
        if (now - lastWriteTime > 10000) {
          transaction.set(lastNotifRef, {
            title: "Alerta de Stock Crítico",
            message: `Se han detectado productos con stock crítico en bodega (Último: "${name}" con ${stock} un.). Por favor revise el panel de Stock Crítico.`,
            type: "alert",
            link: "inventory",
            timestamp: FieldValue.serverTimestamp(),
            isConsolidated: true
          });
        }
      });
    } catch (err) {
      console.error("Error bundling low stock notification:", err);
    }
  } else {
    // Stock is healthy: remove from batch map if present
    try {
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(batchRef);
        if (docSnap.exists) {
          const currentItems = docSnap.data()?.items || {};
          if (currentItems[productId]) {
            delete currentItems[productId];
            transaction.set(batchRef, {
              items: currentItems,
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          }
        }
      });
    } catch (err) {
      console.error("Error removing healthy product from batch:", err);
    }
  }
});

// 3. Firestore Trigger for claims resolution
export const onClaimResolved = onDocumentUpdated("claims/{claimId}", async (event: any) => {
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

// 4. Firestore Trigger for User Role or status changes (Audit real-time Auth block)
export const onUserRoleChanged = onDocumentUpdated("users/{userId}", async (event: any) => {
  const userId = event.params.userId;
  const snapshot = event.data;
  if (!snapshot) return;

  const beforeData = snapshot.before.data();
  const afterData = snapshot.after.data();

  if (!beforeData || !afterData) return;

  const oldRole = beforeData.role;
  const newRole = afterData.role;
  const oldDisabled = beforeData.disabled || false;
  const newDisabled = afterData.disabled || false;

  // Trigger if role is demoted to customer OR disabled becomes true
  const roleDemotedToCustomer = (oldRole && oldRole !== "customer" && newRole === "customer");
  const accountJustDisabled = (!oldDisabled && newDisabled);

  if (roleDemotedToCustomer || accountJustDisabled) {
    try {
      // 1. Disable the user account in Firebase Authentication in real-time
      await getAuth().updateUser(userId, {
        disabled: true
      });
      console.log(`User ${userId} disabled in Firebase Auth due to role demotion or account deactivation.`);

      // 2. Revoke active refresh tokens immediately to force logout
      await getAuth().revokeRefreshTokens(userId);
      console.log(`Revoked active refresh tokens for user ${userId}.`);

      // 3. Document in audit logs immutably
      await db.collection("role_audit").add({
        action: "REALTIME_AUTH_BLOCK",
        operatorEmail: "SYSTEM_TRIGGER",
        timestamp: FieldValue.serverTimestamp(),
        details: `Usuario ${userId} bloqueado en Firebase Auth en tiempo real. Razón: ${roleDemotedToCustomer ? "Rol descendido a customer" : "Cuenta desactivada por administador"}.`
      });
    } catch (err: any) {
      console.error(`Error deactivating Firebase Auth user ${userId}:`, err.message);
    }
  }
});

