import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();

const db = getFirestore();

// ─── Cloud Function 1: setUserRole ───────────────────────────────────────────
// Assigns Firebase Auth Custom Claims (role) to a user.
// Called from the admin UI to grant role-based permissions server-side.
// Uses Firebase Functions v2 (onCall) for modern SDK compatibility.
export const setUserRole = onCall(async (request) => {
  // 1. Verify caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can set roles.");
  }

  const callerRole = request.auth.token.role || "customer";
  const callerEmail = request.auth.token.email || "";
  const isSuperAdmin = callerEmail === "solier.elijah@gmail.com";

  if (!["admin", "owner"].includes(callerRole) && !isSuperAdmin) {
    throw new HttpsError("permission-denied", "Only admins and owners can modify roles.");
  }

  const { uid, userId, role } = request.data || {};
  const targetUid = uid || userId; // Support both param names

  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid 'uid' parameter.");
  }

  if (!role || typeof role !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid 'role' parameter.");
  }

  // Full role whitelist — all roles used in the app
  const allowedRoles = ["admin", "manager", "seller", "logistics", "owner", "inventory_manager", "cashier", "driver", "customer"];
  if (!allowedRoles.includes(role)) {
    throw new HttpsError("invalid-argument", `Role must be one of: ${allowedRoles.join(", ")}`);
  }

  // Only an owner or super admin can assign owner role
  if (role === "owner" && callerRole !== "owner" && !isSuperAdmin) {
    throw new HttpsError("permission-denied", "Only an owner can assign the owner role.");
  }

  try {
    // Set Custom Claim on Firebase Auth (this is what secures server-side checks)
    await getAuth().setCustomUserClaims(targetUid, { role });

    // Mirror role to Firestore for UI reads and display
    await db.collection("users").doc(targetUid).set({
      role,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Audit log — track every role change for compliance
    await db.collection("role_audit").doc().set({
      targetUid,
      assignedRole: role,
      assignedBy: request.auth.uid,
      assignedByEmail: callerEmail,
      timestamp: FieldValue.serverTimestamp()
    });

    return { success: true, message: `Role '${role}' assigned to user '${targetUid}'.` };
  } catch (error: any) {
    console.error("Error in setUserRole:", error);
    throw new HttpsError("internal", error.message || "An error occurred while setting the role.");
  }
});

// ─── Cloud Function 2: onProductStockChange ──────────────────────────────────
// Firestore trigger: keeps /notifications/{productId} in sync with stock levels.
// When stock <= minThreshold → write low_stock notification.
// When stock recovers above threshold → delete notification.
// This allows Layout.tsx to listen to a small /notifications collection
// instead of reading the entire /products collection (eliminates O(N) reads).
export const onProductStockChange = onDocumentWritten("products/{productId}", async (event) => {
  const productId = event.params.productId;
  const snapshot = event.data;
  const notifRef = db.collection("notifications").doc(productId);

  // Product was deleted — clean up its notification
  if (!snapshot || !snapshot.after.exists) {
    try {
      await notifRef.delete();
    } catch (err) {
      console.error("Error deleting notification for removed product:", err);
    }
    return;
  }

  const data = snapshot.after.data();
  if (!data) return;

  const stock = Number(data.stock) || 0;
  const minThreshold = Number(data.minThreshold) || 0;
  const name = data.name || "Producto";

  if (stock <= minThreshold) {
    try {
      await notifRef.set({
        type: "low_stock",  // Must match Layout.tsx filter: where("type", "==", "low_stock")
        title: "Stock Bajo",
        message: `El producto "${name}" tiene stock bajo (${stock} unidades).`,
        productId,
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Error writing low-stock notification:", err);
    }
  } else {
    // Stock recovered — remove the notification
    try {
      await notifRef.delete();
    } catch (err) {
      // Safe to ignore if notification doesn't exist
    }
  }
});
