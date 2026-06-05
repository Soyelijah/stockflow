import { onDocumentWritten, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import * as crypto from "crypto";
import * as firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 1. HTTP Callable para definir roles (Custom Claims y DB Sync).
// C-CF-1 fix: caller must be admin or owner. Previously this was unauthenticated-equivalent
// (any signed-in user could call it and promote themselves to admin — privilege escalation).
// C-CF-2 fix: writes audit log entry for every role assignment.
// Tier 1.0 multi-branch: accepts optional `branchId`. Admin/owner/logistics default to "*"
// (cross-branch). Others default to "default" sentinel. Always validates against /branches
// collection (except for the "*" cross-branch sentinel).
const CROSS_BRANCH_SENTINEL = "*";
const DEFAULT_BRANCH_ID = "default";

function defaultBranchForRole(role: string): string {
  if (role === "admin" || role === "owner" || role === "logistics") return CROSS_BRANCH_SENTINEL;
  return DEFAULT_BRANCH_ID;
}

export const setUserRole = onCall(async (request: any) => {
  // 1. Caller must be authenticated.
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe iniciar sesión.");
  }

  // 2. Caller must hold the admin or owner custom claim (NOT a Firestore doc field — claim is authoritative per CLAUDE.md §6.1).
  const callerRole = request.auth.token.role;
  if (callerRole !== "admin" && callerRole !== "owner") {
    throw new HttpsError("permission-denied", "Solo admin/owner pueden asignar roles.");
  }

  const { userId, role, branchId: rawBranchId } = request.data || {};
  if (!userId || !role) {
    throw new HttpsError("invalid-argument", "userId y role son requeridos.");
  }
  if (typeof userId !== "string" || userId.length === 0 || userId.length > 128) {
    throw new HttpsError("invalid-argument", "userId con formato inválido.");
  }

  // 3. Whitelist (NOTE: 'owner' intentionally excluded — owner must be bootstrapped via
  // scripts/bootstrap-admin.ts using Admin SDK directly, to prevent escalation chains).
  const validRoles = ["admin", "manager", "seller", "logistics", "driver"];
  if (!validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Rol inválido.");
  }

  // 4. Caller cannot demote/reassign themselves (basic defense against accidental lockout).
  if (request.auth.uid === userId && role !== callerRole) {
    throw new HttpsError("permission-denied", "No puede reasignar su propio rol.");
  }

  // 5. Resolve branchId: use the value provided, or fall back to role default.
  //    Validate format and (if not the cross-branch sentinel) verify the branch exists.
  const branchId: string = typeof rawBranchId === "string" && rawBranchId.length > 0
    ? rawBranchId
    : defaultBranchForRole(role);

  if (typeof branchId !== "string" || branchId.length > 128) {
    throw new HttpsError("invalid-argument", "branchId con formato inválido.");
  }
  if (branchId !== CROSS_BRANCH_SENTINEL) {
    const branchSnap = await db.collection("branches").doc(branchId).get();
    if (!branchSnap.exists) {
      throw new HttpsError("invalid-argument", `Sucursal '${branchId}' no existe.`);
    }
    const branchData = branchSnap.data();
    if (branchData && branchData.active === false) {
      throw new HttpsError("invalid-argument", `Sucursal '${branchId}' está inactiva.`);
    }
  }

  try {
    // Custom claims are the authoritative source for rules; profile is a UI mirror.
    await getAuth().setCustomUserClaims(userId, { role, branchId });

    await db.collection("users").doc(userId).set({
      role: role,
      branchId: branchId,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // 6. Audit log for every role assignment (matches CLAUDE.md §9 contract).
    await db.collection("role_audit").add({
      action: "ROLE_ASSIGNED",
      targetUserId: userId,
      newRole: role,
      newBranchId: branchId,
      operatorUid: request.auth.uid,
      operatorEmail: request.auth.token.email || "unknown",
      operatorRole: callerRole,
      timestamp: FieldValue.serverTimestamp()
    });

    return { success: true, message: `Rol ${role} (sucursal ${branchId}) asignado al usuario ${userId}.` };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error("Error en setUserRole:", error);
    throw new HttpsError("internal", error.message || "Error al asignar rol.");
  }
});

// 1.b HTTP Callable to generate the customer's short-lived identity PIN.
// Tier 5.C — APK PIN path. The Express route POST /api/customer/secure-pin is
// unreachable from the Capacitor APK: its backend (ais-*) is fronted by an AI
// Studio cookie gate, so the cross-origin fetch is bounced (302 /__cookie_check)
// and never reaches Express. The Firebase SDK, by contrast, already reaches
// Google directly from inside the APK (Firestore works there), so routing PIN
// generation through a callable removes the dependency on a public Express URL
// entirely — no CORS, no VITE_API_BASE, no cookie gate. Web uses the same
// callable, making this the single source of truth for the member PIN.
//
// Mirrors the Express endpoint's security properties exactly:
//   - Requires an authenticated caller.
//   - Refuses STAFF callers (staff have no member QR sheet).
//   - Only ever writes the caller's OWN /customers/{uid} doc (keyed by the
//     verified token uid) — a customer cannot mint a PIN for anyone else.
//   - not-found if no /customers/{uid} profile exists (== Express 404).
//   - PIN via crypto.randomInt (CSPRNG), 30s validity (POS allows +60s grace).
//   - NEVER logs the PIN.
const SECURE_PIN_STAFF_ROLES = new Set(["owner", "admin", "manager", "seller", "logistics", "driver"]);

export const generateSecurePin = onCall(async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debe iniciar sesión.");
  }
  const uid: string = request.auth.uid;
  const role = request.auth.token.role;
  // Defense-in-depth: refuse STAFF callers. We do NOT hard-require role ===
  // "customer" (a freshly-activated customer's claim may not have propagated yet);
  // the real guarantee is that we only ever write the caller's own
  // /customers/{uid} doc (existence-checked below), which only exists for actual
  // customers.
  if (role && SECURE_PIN_STAFF_ROLES.has(role)) {
    throw new HttpsError("permission-denied", "Las cuentas de personal no generan un PIN de socio.");
  }
  try {
    const docRef = db.collection("customers").doc(uid);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Perfil de cliente no encontrado.");
    }
    // CSPRNG 6-digit PIN (100000–999999). 30s validity; POS allows +60s grace.
    const pin = String(crypto.randomInt(100000, 1000000));
    const expiresAt = Date.now() + 30000;
    await docRef.set({ securePin: pin, securePinExpiresAt: expiresAt }, { merge: true });
    return { success: true, pin, expiresAt };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    // Never include the PIN in logs.
    console.error("Error en generateSecurePin:", error?.message || error);
    throw new HttpsError("internal", "No se pudo generar el PIN seguro.");
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

