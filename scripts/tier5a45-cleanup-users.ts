// Tier 5.A4.5 cleanup — sanitize /users + Firebase Auth roster.
//
// Performs three idempotent operations:
//   1. DELETE the 5 demo accounts that were created via the now-removed
//      email-backdoor + auto-provisioning paths in AuthContext.tsx.
//      Each deletion: /users/{uid} + Firebase Auth user + audit log.
//   2. CREATE the missing admin account (shop@zgamersa.com) using the same
//      pattern as scripts/bootstrap-admin.ts: random password printed ONCE,
//      Firebase Auth user, custom claim {role:"admin", branchId:"*"},
//      /users/{uid} mirror, audit log.
//   3. FIX the name on bpier@zgamersa.com (was "Ulmer Solier" per the
//      incident #7 ghost trail; the real owner is Pierre Solier).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     pnpm tsx scripts/tier5a45-cleanup-users.ts            # dry run (default)
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     DRY_RUN=false pnpm tsx scripts/tier5a45-cleanup-users.ts
//
// Safety:
//   - Demos to delete are matched by EXACT email (no wildcards). If a future
//     real account happens to use the same email, edit the list before running.
//   - Pierre's primary owner (solier.elijah@gmail.com) is explicitly listed
//     in KEEP, never deleted. Same for admin@stockflow.cl (the bootstrap owner)
//     and the other real staff accounts.
//   - Idempotent: re-runs are safe. Each step checks "already done" state.
//   - Audit log entries with action TIER5A45_USER_DELETED / _CREATED / _RENAMED.

import * as crypto from "crypto";
import { adminDb } from "../server/services/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN !== "false";

// Emails to permanently delete (Auth user + /users doc).
// All 5 were created by the now-removed email-backdoor + auto-provisioning
// paths in AuthContext.tsx. None have real production data attached.
const TO_DELETE = [
  "admin@stockflow.com",
  "logistics-demo@stockflow.com",
  "logistics@stockflow.com",
  "manager@stockflow.com",
  "seller@stockflow.com",
];

// New admin to create. Pierre's choice (chat 2026-05-26).
const NEW_ADMIN_EMAIL = "shop@zgamersa.com";
const NEW_ADMIN_NAME = "Administrador Sf Shop";

// Rename: bpier@zgamersa.com had name "Ulmer Solier" (incident #7 ghost).
// Real owner is Pierre Solier.
const RENAME_TARGET_EMAIL = "bpier@zgamersa.com";
const RENAME_NEW_NAME = "Pierre Solier";

function generateStrongPassword(): string {
  return crypto.randomBytes(15).toString("base64url");
}

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, dryRun: DRY_RUN, ts: new Date().toISOString(), ...data }));
}

async function audit(action: string, payload: Record<string, unknown>) {
  if (DRY_RUN) return;
  try {
    await adminDb.collection("role_audit").add({
      action,
      ...payload,
      operatorUid: "tier5a45-cleanup-script",
      operatorEmail: "tier5a45-cleanup-script@stockflow.system",
      operatorRole: "cleanup-script",
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("⚠️  Audit write failed:", err);
  }
}

async function deleteOne(email: string) {
  const auth = getAuth();
  let uid: string | null = null;
  try {
    const u = await auth.getUserByEmail(email);
    uid = u.uid;
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      log("delete_skipped_auth_lookup_error", { email, error: err.message });
      return;
    }
  }

  // Find the /users doc — usually keyed by uid, but be defensive in case of orphans.
  let docId = uid;
  let docExists = false;
  if (uid) {
    const snap = await adminDb.collection("users").doc(uid).get();
    docExists = snap.exists;
  }
  if (!docExists) {
    // Fallback: search by email field
    const orphan = await adminDb.collection("users").where("email", "==", email).limit(1).get();
    if (!orphan.empty) {
      docId = orphan.docs[0].id;
      docExists = true;
    }
  }

  if (!uid && !docExists) {
    log("delete_skipped_not_found", { email });
    return;
  }

  log("delete_planned", { email, uid, docId, docExists });

  if (DRY_RUN) return;

  if (docExists && docId) {
    await adminDb.collection("users").doc(docId).delete();
    log("delete_users_doc_done", { email, docId });
  }
  if (uid) {
    await auth.deleteUser(uid);
    log("delete_auth_user_done", { email, uid });
  }
  await audit("TIER5A45_USER_DELETED", { email, uid, docId, reason: "demo cleanup" });
}

async function createAdmin() {
  const auth = getAuth();
  let userRecord;
  let password: string | null = null;

  try {
    userRecord = await auth.getUserByEmail(NEW_ADMIN_EMAIL);
    log("admin_exists_already", { email: NEW_ADMIN_EMAIL, uid: userRecord.uid });
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      log("admin_create_failed_lookup", { email: NEW_ADMIN_EMAIL, error: err.message });
      throw err;
    }
    if (DRY_RUN) {
      log("admin_would_create", { email: NEW_ADMIN_EMAIL });
      return;
    }
    password = generateStrongPassword();
    userRecord = await auth.createUser({
      email: NEW_ADMIN_EMAIL,
      emailVerified: true,
      password,
      displayName: NEW_ADMIN_NAME,
    });
    log("admin_created", { email: NEW_ADMIN_EMAIL, uid: userRecord.uid });
  }

  if (DRY_RUN) return;

  // Idempotent claim set
  const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>;
  if (existingClaims.role !== "admin" || existingClaims.branchId !== "*") {
    await auth.setCustomUserClaims(userRecord.uid, { role: "admin", branchId: "*" });
    log("admin_claim_set", { uid: userRecord.uid });
  }

  // Idempotent /users doc upsert
  await adminDb.collection("users").doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: NEW_ADMIN_EMAIL,
      name: NEW_ADMIN_NAME,
      role: "admin",
      branchId: "*",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  log("admin_mirror_upserted", { uid: userRecord.uid });

  await audit("TIER5A45_USER_CREATED", { email: NEW_ADMIN_EMAIL, uid: userRecord.uid, role: "admin", branchId: "*" });

  if (password) {
    console.log("");
    console.log("⚠️  TEMPORARY PASSWORD for " + NEW_ADMIN_EMAIL + " (copy NOW, never shown again):");
    console.log("");
    console.log("    " + password);
    console.log("");
    console.log("    Login at /login (staff panel), then change it from Settings.");
  }
}

async function fixName() {
  const auth = getAuth();
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(RENAME_TARGET_EMAIL);
  } catch (err: any) {
    log("rename_skipped_no_auth_user", { email: RENAME_TARGET_EMAIL, error: err.message });
    return;
  }

  const ref = adminDb.collection("users").doc(userRecord.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    log("rename_skipped_no_mirror_doc", { email: RENAME_TARGET_EMAIL, uid: userRecord.uid });
    return;
  }
  const currentName = snap.data()?.name;
  if (currentName === RENAME_NEW_NAME) {
    log("rename_already_done", { email: RENAME_TARGET_EMAIL, name: currentName });
    return;
  }

  log("rename_planned", { email: RENAME_TARGET_EMAIL, currentName, newName: RENAME_NEW_NAME });

  if (DRY_RUN) return;

  await ref.update({ name: RENAME_NEW_NAME, updatedAt: FieldValue.serverTimestamp() });
  // Also update the Auth displayName for consistency.
  await auth.updateUser(userRecord.uid, { displayName: RENAME_NEW_NAME });
  log("rename_applied", { uid: userRecord.uid, oldName: currentName, newName: RENAME_NEW_NAME });
  await audit("TIER5A45_USER_RENAMED", { email: RENAME_TARGET_EMAIL, uid: userRecord.uid, oldName: currentName, newName: RENAME_NEW_NAME });
}

async function run() {
  log("cleanup_started", { toDelete: TO_DELETE, newAdmin: NEW_ADMIN_EMAIL, renameTarget: RENAME_TARGET_EMAIL });

  console.log("\n=== STEP 1: Delete demo accounts ===\n");
  for (const email of TO_DELETE) {
    await deleteOne(email);
  }

  console.log("\n=== STEP 2: Create admin shop@zgamersa.com ===\n");
  await createAdmin();

  console.log("\n=== STEP 3: Rename bpier@zgamersa.com → Pierre Solier ===\n");
  await fixName();

  console.log("");
  if (DRY_RUN) {
    console.log("ℹ️  DRY RUN complete. No writes made. Re-run with DRY_RUN=false to apply.");
  } else {
    console.log("🏁 Cleanup complete. Check Firebase Auth + Firestore /users to confirm.");
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal:", err.message || err);
    process.exit(1);
  });
