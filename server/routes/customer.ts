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

import { Router, Request, Response } from "express";
import * as crypto from "crypto";
import "../services/firebaseAdmin";
import { adminDb } from "../services/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { requireAuthBearer, AuthenticatedRequest } from "../services/security";
import { FieldValue } from "firebase-admin/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export const customerRouter = Router();

const STAFF_ROLES = new Set(["owner", "admin", "manager", "seller", "logistics", "driver"]);

// Normalize a Chilean RUT (or any taxId) to digits + verifier upper, no formatting.
// "12.345.678-9" → "123456789", "12345678-K" → "12345678K", "  12345678k" → "12345678K".
function normalizeRut(input: string): string {
  return input.replace(/[^0-9kK]/g, "").toUpperCase();
}

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s);
}

function generateStrongPassword(): string {
  return crypto.randomBytes(15).toString("base64url");
}

// Fire-and-log: ask Firebase Auth to send the standard password reset email.
// Uses the Identity Toolkit REST endpoint (public web API key — same one the
// client SDK uses for sendPasswordResetEmail). Server-side call lets us keep
// the uniform 200 response without leaking whether the address was sent to.
// If the call fails, we audit it but still respond 200 to the caller.
async function sendPasswordResetEmailServerSide(email: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = (firebaseConfig as any).apiKey;
  if (!apiKey) {
    return { ok: false, error: "missing apiKey in firebase config" };
  }
  try {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email })
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

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
    const userRecord = await getAuth().getUser(uid);
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

    await getAuth().setCustomUserClaims(uid, { role: "customer", branchId: "default" });

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

/**
 * POST /api/customer/activate-request
 * NO auth required (the user is not signed in yet — they're a legacy customer
 * who bought in the physical store and wants to claim their existing /customers/*
 * profile online for the first time).
 *
 * Body: { rut: string }
 *
 * Behavior (uniform 200 response — anti-enumeration):
 *   1. Normalize the RUT.
 *   2. Look up /customers where taxId or rut matches (try both formatted and
 *      unformatted variants).
 *   3. If found AND the doc has a valid email:
 *      a. Look up Firebase Auth by that email.
 *      b. If no Auth user yet: create one with a random strong password.
 *      c. If the customer doc id is NOT the Auth uid, copy the doc to /customers/{uid}
 *         and delete the orphan (same pattern as migration script). Stamp
 *         _migrationVersion: "tier5a-activation".
 *      d. Ensure custom claim {role: "customer", branchId: "default"}.
 *      e. Trigger Firebase's password reset email via Identity Toolkit REST.
 *   4. If NOT found, or found but no email associated, do NOTHING but still
 *      respond 200. The user sees the same message either way.
 *   5. Always audit: CUSTOMER_ACTIVATION_REQUESTED (success / not_found /
 *      no_email_on_file / staff_conflict / error).
 *
 * Why this exists (per CEO Pierre's preference for the retail-hybrid flow):
 *   Cajero captures customer at POS (RUT, name, email, etc.) — no Firebase
 *   Auth user is created at that moment. Later, the customer visits the portal,
 *   types their RUT, and the system sends them a password setup email. This
 *   mimics the original "RUT-first onboarding" while staying compatible with
 *   the new Firebase Auth-driven security model.
 */
customerRouter.post("/customer/activate-request", async (req: Request, res: Response) => {
  const rawRut = typeof req.body?.rut === "string" ? req.body.rut : "";
  if (!rawRut || rawRut.length > 30) {
    // Even on bad input we respond 200 to avoid hinting which inputs are "real" shape.
    return res.status(200).json({ success: true, message: "Si tu RUT está registrado y tiene email asociado, recibirás un correo." });
  }

  const normalized = normalizeRut(rawRut);
  if (normalized.length < 2) {
    return res.status(200).json({ success: true, message: "Si tu RUT está registrado y tiene email asociado, recibirás un correo." });
  }

  let outcome: "success" | "not_found" | "no_email" | "staff_conflict" | "error" = "not_found";
  let foundDocId: string | null = null;
  let foundEmail: string | null = null;
  let resultingUid: string | null = null;
  let errorDetail: string | null = null;

  try {
    // Build candidate match values. The customer doc may store RUT in either
    // normalized form ("123456789") or formatted ("12.345.678-9") in taxId,
    // and we also check the legacy `rut` field. Cover all permutations.
    const candidates = new Set<string>();
    candidates.add(normalized);
    // Reconstruct formatted version e.g. "12.345.678-9" if length is 8-9 digits.
    if (normalized.length >= 8) {
      const body = normalized.slice(0, -1);
      const verifier = normalized.slice(-1);
      if (/^\d+$/.test(body)) {
        const reversed = body.split("").reverse().join("");
        const grouped = reversed.match(/.{1,3}/g)!.join(".").split("").reverse().join("");
        candidates.add(`${grouped}-${verifier}`);
      }
    }

    // Search in /customers by taxId and rut for each candidate, until we find one.
    let foundDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    for (const candidate of candidates) {
      const taxIdQuery = await adminDb.collection("customers").where("taxId", "==", candidate).limit(1).get();
      if (!taxIdQuery.empty) {
        foundDoc = taxIdQuery.docs[0];
        break;
      }
      const rutQuery = await adminDb.collection("customers").where("rut", "==", candidate).limit(1).get();
      if (!rutQuery.empty) {
        foundDoc = rutQuery.docs[0];
        break;
      }
    }

    if (foundDoc) {
      foundDocId = foundDoc.id;
      const data = foundDoc.data();
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : null;

      if (!isValidEmail(email)) {
        outcome = "no_email";
      } else {
        foundEmail = email;
        // Look up Auth user by email.
        let userRecord;
        try {
          userRecord = await getAuth().getUserByEmail(email);
        } catch (err: any) {
          if (err.code !== "auth/user-not-found") throw err;
          // Create Auth user with random password — the actual password is
          // never used; the customer sets one via the password reset link.
          userRecord = await getAuth().createUser({
            email,
            emailVerified: false,
            password: generateStrongPassword(),
            displayName: typeof data.name === "string" ? data.name : undefined,
          });
        }

        // Safety: if this Auth user already carries a STAFF role, refuse to
        // overwrite the claim. They'd lose staff access. Operator must split
        // accounts manually.
        const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>;
        const existingRole = typeof existingClaims.role === "string" ? existingClaims.role : null;
        if (existingRole && STAFF_ROLES.has(existingRole)) {
          outcome = "staff_conflict";
        } else {
          // Set/refresh customer claim.
          await getAuth().setCustomUserClaims(userRecord.uid, { role: "customer", branchId: "default" });

          // If the customer doc id is NOT the Auth uid, relocate it (same pattern
          // as the migration script). Drop the password field if it slipped in
          // through a legacy code path.
          if (foundDocId !== userRecord.uid) {
            const { password: _pw, ...safeData } = data;
            await adminDb.collection("customers").doc(userRecord.uid).set(
              {
                ...safeData,
                uid: userRecord.uid,
                email,
                _migrationVersion: "tier5a-activation",
                _activatedAt: FieldValue.serverTimestamp(),
                _migratedFromDocId: foundDocId,
              },
              { merge: true },
            );
            try {
              await adminDb.collection("customers").doc(foundDocId).delete();
            } catch (delErr) {
              console.warn("Could not delete orphan after activation:", delErr);
            }
          } else {
            // Same id — just stamp activation metadata + strip password.
            const { password: _pw, ...safeData } = data;
            await adminDb.collection("customers").doc(userRecord.uid).set(
              {
                ...safeData,
                uid: userRecord.uid,
                email,
                _activatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
          }

          // Trigger password reset email via Identity Toolkit REST API.
          const sendResult = await sendPasswordResetEmailServerSide(email);
          if (!sendResult.ok) {
            errorDetail = sendResult.error || null;
            outcome = "error";
          } else {
            outcome = "success";
          }
          resultingUid = userRecord.uid;
        }
      }
    }
  } catch (err: any) {
    outcome = "error";
    errorDetail = err?.message || String(err);
    console.error("❌ [customer/activate-request] Internal:", errorDetail);
  }

  // Audit every attempt — useful for ops to spot enumeration scans + debugging.
  try {
    await adminDb.collection("role_audit").add({
      action: "CUSTOMER_ACTIVATION_REQUESTED",
      outcome,
      ipHint: req.ip || null,
      uaHint: typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string).slice(0, 200) : null,
      targetDocId: foundDocId,
      targetUid: resultingUid,
      // We log a TRUNCATED hash of the RUT, never the RUT itself (PII).
      rutHash: crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12),
      errorDetail,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (auditErr) {
    console.error("⚠️  Failed to write activation audit:", auditErr);
  }

  // UNIFORM RESPONSE regardless of outcome — anti-enumeration.
  // The only "honest" thing we tell the user is: check your email if the cuenta
  // existe. Otherwise the message gives no signal.
  return res.status(200).json({
    success: true,
    message: "Si tu RUT está registrado y tiene email asociado, te enviamos un correo con instrucciones para crear tu contraseña.",
  });
});

// Standard health probe (matches the shape used by other routers in server.ts).
export function healthCheck(): { status: "online"; ts: string } {
  return { status: "online", ts: new Date().toISOString() };
}
