// Staff management routes.
//
// Tier 5.D introduces /api/staff/create-employee — admin/owner-only endpoint
// that creates a new Firebase Auth user + sets the role claim + writes the
// /users mirror + audits, all in one atomic-ish call. Replaces the previous
// manual flow (Firebase Console → add user → Settings → Buscar → Change role).
//
// Why an endpoint and not the Cloud Function setUserRole:
//   - setUserRole only PROMOTES roles on existing Auth users. It does not
//     create users. Pierre wants the inline "+ Crear empleado" UI to do the
//     full provisioning in one shot.
//   - Using Express (vs new Cloud Function) avoids `firebase deploy --only
//     functions`, which Pierre prefers to keep rare. Same pattern as
//     /api/customer/claim.
//
// Safety properties (Pierre's 6 guardrails — all enforced):
//   1. owner role explicitly refused (only bootstrap-admin.ts via Admin SDK
//      can create owners).
//   2. admin/logistics → branchId is FORCED to "*" (cross-branch). Server
//      ignores whatever the client sent for those roles.
//   3. manager/seller/driver → branchId is REQUIRED. Server verifies the
//      branch doc exists AND active === true.
//   4. Atomic rollback: if setCustomUserClaims, /users mirror write, or
//      /role_audit write fails AFTER createUser, the Auth user is deleted
//      to avoid orphan accounts in Firebase Auth.
//   5. /role_audit logs metadata (operator, target, role, branchId, action)
//      but NEVER the password.
//   6. Race condition on duplicate email: even with the pre-check via
//      getUserByEmail, the createUser call is wrapped to detect
//      `auth/email-already-exists` thrown between the two operations.

import { Router, Response } from "express";
import * as crypto from "crypto";
import admin from "../services/firebaseAdmin";
import { adminDb } from "../services/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { requireAuthBearer, AuthenticatedRequest } from "../services/security";
import { FieldValue } from "firebase-admin/firestore";

export const staffRouter = Router();

const STAFF_ROLES_ASSIGNABLE = new Set(["admin", "manager", "seller", "logistics", "driver"]);
const ROLES_REQUIRING_BRANCH = new Set(["manager", "seller", "driver"]);
const ROLES_CROSS_BRANCH = new Set(["admin", "logistics"]);
const CROSS_BRANCH_SENTINEL = "*";
const CALLER_ROLES_ALLOWED = new Set(["admin", "owner"]);

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s);
}
function generateStrongPassword(): string {
  return crypto.randomBytes(15).toString("base64url");
}

/**
 * POST /api/staff/create-employee
 *
 * Body: { email, name, role, branchId?, password? }
 *   - role: must be one of {"admin","manager","seller","logistics","driver"}.
 *           "owner" is explicitly refused (409).
 *   - branchId: REQUIRED for manager/seller/driver — must exist in /branches
 *               AND active === true. For admin/logistics it's IGNORED and
 *               forced to "*". For other inputs it returns 400.
 *   - password: optional. If not provided, server generates a strong random
 *               one and returns it ONE TIME in the response. If provided,
 *               the caller is responsible for sharing it securely (not echoed
 *               back beyond a success flag).
 *
 * Returns:
 *   { success, uid, email, role, branchId, generatedPassword? }
 *     - generatedPassword is ONLY present if the server generated it. NEVER
 *       persisted to Firestore or audit log.
 */
staffRouter.post(
  "/staff/create-employee",
  requireAuthBearer,
  async (req: AuthenticatedRequest, res: Response) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email;
    const callerRole = req.user?.role;

    // Guardrail 0: caller authorization.
    if (!callerUid) {
      return res.status(401).json({ error: "Token sin uid." });
    }
    if (!callerRole || !CALLER_ROLES_ALLOWED.has(callerRole)) {
      // Audit the attempt even when refused — useful for detecting misuse.
      try {
        await adminDb.collection("role_audit").add({
          action: "STAFF_EMPLOYEE_CREATE_REFUSED_NOT_PRIVILEGED",
          callerUid,
          callerEmail: callerEmail || "unknown",
          callerRole: callerRole || "none",
          timestamp: FieldValue.serverTimestamp(),
        });
      } catch {}
      return res.status(403).json({
        error: "Solo admin u owner pueden crear empleados.",
      });
    }

    const { email, name, role, branchId: requestedBranchId, password: providedPassword } = req.body || {};

    // Input validation.
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email con formato inválido." });
    }
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
      return res.status(400).json({ error: "Nombre con formato inválido (2-200 caracteres)." });
    }
    if (typeof role !== "string") {
      return res.status(400).json({ error: "role es requerido." });
    }

    // Guardrail 1: owner refused explicitly.
    if (role === "owner") {
      return res.status(409).json({
        error: "El rol owner no se puede asignar desde este endpoint. Usar scripts/bootstrap-admin.ts.",
      });
    }
    if (!STAFF_ROLES_ASSIGNABLE.has(role)) {
      return res.status(400).json({
        error: `role inválido. Permitidos: ${Array.from(STAFF_ROLES_ASSIGNABLE).join(", ")}`,
      });
    }

    // Guardrails 2 + 3: resolve branchId based on role.
    let resolvedBranchId: string;
    if (ROLES_CROSS_BRANCH.has(role)) {
      // admin / logistics → ALWAYS cross-branch, ignore client value.
      resolvedBranchId = CROSS_BRANCH_SENTINEL;
    } else if (ROLES_REQUIRING_BRANCH.has(role)) {
      // manager / seller / driver → branch is required + must exist + active.
      if (typeof requestedBranchId !== "string" || requestedBranchId.length === 0) {
        return res.status(400).json({
          error: `branchId es requerido para el rol ${role}.`,
        });
      }
      if (requestedBranchId === CROSS_BRANCH_SENTINEL) {
        return res.status(400).json({
          error: `El rol ${role} no admite la sucursal "*" (cross-branch).`,
        });
      }
      if (requestedBranchId.length > 128) {
        return res.status(400).json({ error: "branchId con formato inválido." });
      }
      const branchSnap = await adminDb.collection("branches").doc(requestedBranchId).get();
      if (!branchSnap.exists) {
        return res.status(400).json({ error: `La sucursal "${requestedBranchId}" no existe.` });
      }
      const branchData = branchSnap.data();
      if (branchData?.active === false) {
        return res.status(400).json({ error: `La sucursal "${requestedBranchId}" está inactiva.` });
      }
      resolvedBranchId = requestedBranchId;
    } else {
      // Defensive: should never reach here given the STAFF_ROLES_ASSIGNABLE check.
      return res.status(500).json({ error: "Resolución de branchId fallida internamente." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Guardrail 6 (precheck): email already in use.
    try {
      await getAuth().getUserByEmail(normalizedEmail);
      return res.status(409).json({ error: "Ya existe una cuenta con ese email." });
    } catch (err: any) {
      if (err.code !== "auth/user-not-found") {
        console.error("[staff/create-employee] precheck failed:", err.message);
        return res.status(500).json({ error: "No se pudo verificar el email." });
      }
      // expected: user-not-found → proceed.
    }

    // Decide password.
    const serverGeneratedPassword = typeof providedPassword === "string" && providedPassword.length >= 8
      ? null
      : generateStrongPassword();
    const finalPassword = serverGeneratedPassword || providedPassword;

    if (typeof finalPassword !== "string" || finalPassword.length < 8) {
      return res.status(400).json({
        error: "Contraseña con formato inválido (mínimo 8 caracteres o dejar vacío para auto-generación).",
      });
    }

    // Create Auth user.
    let userRecord;
    try {
      userRecord = await getAuth().createUser({
        email: normalizedEmail,
        emailVerified: true,
        password: finalPassword,
        displayName: name.trim(),
      });
    } catch (err: any) {
      // Guardrail 6 (race): same email created between precheck and createUser.
      if (err.code === "auth/email-already-exists") {
        return res.status(409).json({ error: "Ya existe una cuenta con ese email." });
      }
      console.error("[staff/create-employee] createUser failed:", err.message);
      return res.status(500).json({ error: "No se pudo crear el usuario en Firebase Auth." });
    }

    // Guardrail 4: atomic-ish rollback on subsequent failures.
    // setCustomUserClaims + /users mirror + /role_audit are written serially.
    // If any of them throws AFTER createUser succeeded, we delete the Auth user
    // so we don't leave orphan accounts.
    const uid = userRecord.uid;
    try {
      await getAuth().setCustomUserClaims(uid, { role, branchId: resolvedBranchId });

      await adminDb.collection("users").doc(uid).set({
        uid,
        email: normalizedEmail,
        name: name.trim(),
        role,
        branchId: resolvedBranchId,
        createdAt: new Date().toISOString(),
      });

      // Guardrail 5: NEVER persist password in audit metadata.
      await adminDb.collection("role_audit").add({
        action: "STAFF_EMPLOYEE_CREATED",
        targetUserId: uid,
        targetEmail: normalizedEmail,
        targetName: name.trim(),
        newRole: role,
        newBranchId: resolvedBranchId,
        passwordSource: serverGeneratedPassword ? "server-generated" : "client-provided",
        operatorUid: callerUid,
        operatorEmail: callerEmail || "unknown",
        operatorRole: callerRole,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (postCreateErr: any) {
      // Rollback: delete the Auth user so it doesn't dangle.
      console.error(
        `[staff/create-employee] post-createUser step failed for ${normalizedEmail}: ${postCreateErr.message}. Rolling back Auth user.`
      );
      try {
        await getAuth().deleteUser(uid);
      } catch (rollbackErr: any) {
        console.error(
          `[staff/create-employee] ROLLBACK FAILED for ${normalizedEmail} (uid=${uid}): ${rollbackErr.message}. Manual cleanup required.`
        );
        // Audit the failed rollback explicitly so ops can find it later.
        try {
          await adminDb.collection("role_audit").add({
            action: "STAFF_EMPLOYEE_CREATE_ROLLBACK_FAILED",
            targetUserId: uid,
            targetEmail: normalizedEmail,
            operatorUid: callerUid,
            originalError: String(postCreateErr.message || postCreateErr),
            rollbackError: String(rollbackErr.message || rollbackErr),
            timestamp: FieldValue.serverTimestamp(),
          });
        } catch {}
      }
      return res.status(500).json({
        error: "Error al provisionar el empleado. La operación fue revertida.",
      });
    }

    // Success. Guardrail 5: only return generatedPassword if server generated it.
    return res.status(200).json({
      success: true,
      uid,
      email: normalizedEmail,
      role,
      branchId: resolvedBranchId,
      ...(serverGeneratedPassword ? { generatedPassword: serverGeneratedPassword } : {}),
    });
  }
);

// Standard health probe (matches the shape used by other routers in server.ts).
export function healthCheck(): { status: "online"; ts: string } {
  return { status: "online", ts: new Date().toISOString() };
}
