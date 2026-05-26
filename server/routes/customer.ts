// Customer-facing API routes.
//
// Tier 5.A4: introduces /api/customer/claim — endpoint called by the customer
// portal IMMEDIATELY after createUserWithEmailAndPassword to install the
// custom claim `{role: "customer", branchId: "default"}` on the new auth user.
//
// Why an endpoint and not the Cloud Function setUserRole?
//   - setUserRole rejects callers without an admin/owner role (correct security
//     property — staff role escalation is privileged).
//   - A customer registering themselves cannot be admin/owner, so they cannot
//     call setUserRole. We need a narrowly-scoped endpoint that only assigns
//     the customer role to its own caller, never to anyone else.
//
// Safety properties (verified in tests in Phase C):
//   - Caller is authenticated via Bearer ID token (no anonymous).
//   - Endpoint only sets claim for `req.user.uid` — cannot target another user.
//   - Endpoint refuses to overwrite a staff role (defense-in-depth: if the
//     Auth user already has owner/admin/manager/seller/logistics/driver, the
//     call returns 409 — same as the migration script's skipped_staff_conflict).
//   - Audit log to /role_audit with action CUSTOMER_SELF_CLAIMED.

import { Router, Response } from "express";
import admin from "../services/firebaseAdmin";
import { adminDb } from "../services/firebaseAdmin";
import { requireAuthBearer, AuthenticatedRequest } from "../services/security";
import { FieldValue } from "firebase-admin/firestore";

export const customerRouter = Router();

const STAFF_ROLES = new Set(["owner", "admin", "manager", "seller", "logistics", "driver"]);

/**
 * POST /api/customer/claim
 * Bearer auth required.
 *
 * Idempotent: if the caller already has role=customer, returns success without
 * re-writing the claim. If they have a staff role, refuses (409).
 *
 * Side effects:
 *   - auth().setCustomUserClaims(uid, { role: "customer", branchId: "default" })
 *   - /role_audit entry
 *   (The customer profile doc at /customers/{uid} is created by the client
 *    AFTER this endpoint returns, using the standard create rule that requires
 *    email match the auth token. Two-step is intentional to keep the rule
 *    surface small.)
 */
customerRouter.post("/customer/claim", requireAuthBearer, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  const email = req.user?.email;

  if (!uid) {
    return res.status(401).json({ error: "Token sin uid." });
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>;
    const existingRole = typeof existingClaims.role === "string" ? existingClaims.role : null;

    if (existingRole === "customer") {
      return res.status(200).json({ success: true, role: "customer", already: true });
    }

    if (existingRole && STAFF_ROLES.has(existingRole)) {
      // Audit the attempt even when refused — useful for detecting misuse.
      await adminDb.collection("role_audit").add({
        action: "CUSTOMER_CLAIM_REFUSED_STAFF_CONFLICT",
        targetUserId: uid,
        existingRole,
        operatorUid: uid,
        operatorEmail: email || "unknown",
        operatorRole: existingRole,
        timestamp: FieldValue.serverTimestamp(),
      });
      return res.status(409).json({
        error: "Esta cuenta ya tiene un rol asignado. Para acceder como cliente, registra una cuenta nueva con otro correo.",
      });
    }

    await admin.auth().setCustomUserClaims(uid, { role: "customer", branchId: "default" });

    await adminDb.collection("role_audit").add({
      action: "CUSTOMER_SELF_CLAIMED",
      targetUserId: uid,
      newRole: "customer",
      newBranchId: "default",
      operatorUid: uid,
      operatorEmail: email || "unknown",
      operatorRole: "customer-self-register",
      timestamp: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true, role: "customer" });
  } catch (err: any) {
    console.error("❌ [customer/claim] Failed:", err.message || err);
    return res.status(500).json({ error: "Error al asignar rol cliente." });
  }
});

// Standard health probe (matches the shape used by other routers in server.ts).
export function healthCheck(): { status: "online"; ts: string } {
  return { status: "online", ts: new Date().toISOString() };
}
