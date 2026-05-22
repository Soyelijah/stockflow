import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

admin.initializeApp();

const db = getFirestore();

// ─── Cloud Function 1: setUserRole ───────────────────────────────────────────
// Assigns a Firebase Auth Custom Claim (role) to a user.
// Called from the admin UI to grant permissions server-side.
export const setUserRole = functions.https.onCall(async (data, context) => {
  // 1. Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can set roles."
    );
  }

  const callerRole = context.auth.token.role || "customer";
  const isSuperAdminFallback = context.auth.token.email === "solier.elijah@gmail.com";

  if (callerRole !== "admin" && callerRole !== "owner" && !isSuperAdminFallback) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins and owners can modify roles."
    );
  }

  const { uid, role } = data;

  if (!uid || typeof uid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing or invalid 'uid' parameter.");
  }

  if (!role || typeof role !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing or invalid 'role' parameter.");
  }

  const allowedRoles = ["admin", "manager", "seller", "logistics", "owner", "inventory_manager", "cashier", "driver", "customer"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", `Role must be one of: ${allowedRoles.join(", ")}`);
  }

  if (role === "owner" && callerRole !== "owner" && !isSuperAdminFallback) {
    throw new functions.https.HttpsError("permission-denied", "Only an owner can assign the owner role.");
  }

  try {
    // Set Custom Claim on Firebase Auth token
    await admin.auth().setCustomUserClaims(uid, { role });

    // Mirror role to Firestore for UI reads
    await db.collection("users").doc(uid).set({ role }, { merge: true });

    // Audit log
    await db.collection("role_audit").doc().set({
      targetUid: uid,
      assignedRole: role,
      assignedBy: context.auth.uid,
      assignedByEmail: context.auth.token.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: `Successfully assigned role '${role}' to user '${uid}'` };
  } catch (error) {
    console.error("Error setting custom claim:", error);
    throw new functions.https.HttpsError("internal", "An error occurred while setting the role.");
  }
});

// ─── Cloud Function 2: onProductStockChange ──────────────────────────────────
// Firestore trigger: keeps /notifications/{productId} in sync with stock levels.
// When stock <= minThreshold → write notification.
// When stock recovers → delete notification.
// This lets the frontend Layout listen to a small /notifications collection
// instead of the entire /products collection (eliminates O(N) reads).
export const onProductStockChange = onDocumentWritten("products/{productId}", async (event) => {
  const productId = event.params.productId;
  const snapshot = event.data;
  const notifRef = db.collection("notifications").doc(productId);

  // Product deleted — clean up any notification
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
        type: "low_stock",
        title: "Stock Bajo",
        message: `El producto "${name}" tiene stock bajo (${stock} unidades).`,
        productId,
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Error writing low-stock notification:", err);
    }
  } else {
    try {
      await notifRef.delete();
    } catch (err) {
      // Safe to ignore if notification doesn't exist
    }
  }
});
