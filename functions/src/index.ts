import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const setUserRole = functions.https.onCall(async (data, context) => {
  // 1. Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can set roles."
    );
  }

  // 2. Verify caller has permission (must be owner or admin)
  // If the target is being made an owner, maybe only owners can do it?
  // We'll allow admin or owner to assign roles, but only owner to assign owner.
  const callerRole = context.auth.token.role || "customer";
  
  // Temporary bootstrap logic: if caller is solier.elijah@gmail.com and has no role, allow (day 1 to day 2 bridge)
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

  // Allowed roles whitelist
  const allowedRoles = ["admin", "manager", "seller", "logistics", "owner", "inventory_manager", "cashier", "driver", "customer"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", `Role must be one of: ${allowedRoles.join(", ")}`);
  }

  // Extra check: only owner can assign owner role
  if (role === "owner" && callerRole !== "owner" && !isSuperAdminFallback) {
    throw new functions.https.HttpsError("permission-denied", "Only an owner can assign the owner role.");
  }

  try {
    // 3. Set Custom Claim
    await admin.auth().setCustomUserClaims(uid, { role });

    // 4. Update the role in Firestore (legacy support until removed)
    await db.collection("users").doc(uid).set({ role }, { merge: true });

    // 5. Audit Log
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const auditRef = db.collection("role_audit").doc();
    await auditRef.set({
      targetUid: uid,
      assignedRole: role,
      assignedBy: context.auth.uid,
      assignedByEmail: context.auth.token.email,
      timestamp: timestamp,
    });

    return { message: `Successfully assigned role '${role}' to user '${uid}'` };
  } catch (error) {
    console.error("Error setting custom claim:", error);
    throw new functions.https.HttpsError("internal", "An error occurred while setting the role.");
  }
});
