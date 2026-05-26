// Tier 5.A2 — Migrate /customers from custom auth (plain-text password) to Firebase Auth.
//
// Reads each /customers doc, creates a Firebase Auth user with the same email,
// assigns custom claim { role: "customer", branchId: "default" }, writes a
// canonical profile under /customers/{newUid} (without the password field),
// and audits the migration to /role_audit. Idempotent and resumable via a
// checkpoint doc in /_migrations.
//
// Usage:
//   # 1) Dry run first — no writes, no Auth users created, just logs what WOULD happen.
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     pnpm tsx scripts/migrate-customers-to-firebase-auth.ts
//
//   # 2) Real run when ready.
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json DRY_RUN=false \
//     pnpm tsx scripts/migrate-customers-to-firebase-auth.ts
//
//   # 3) Resume from a specific doc id (if a previous run aborted mid-flight).
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json DRY_RUN=false \
//     RESUME_FROM=<lastProcessedDocId> \
//     pnpm tsx scripts/migrate-customers-to-firebase-auth.ts
//
// Environment vars:
//   DRY_RUN       (default "true")  Set to "false" to perform actual writes.
//   BATCH_SIZE    (default "50")    Number of customer docs read per Firestore page.
//   RESUME_FROM   (optional)        Doc id to resume after (used with startAfter).
//   SEND_RESET    (default "false") If "true", calls auth.generatePasswordResetLink + logs it.
//                                    No email is sent — operator copies the link manually.
//                                    (Pierre's decision: do NOT auto-email.)
//
// Idempotency:
//   Each customer doc is tagged with { _migrationVersion: "tier5a-v1", _migratedAt: ts }.
//   On re-run, docs with this tag are skipped. Aborting mid-flight is safe — the next
//   run picks up where the previous one left off.
//
// Rollback:
//   - The original /customers data is captured in backups/customers-pre-tier5a-<date>.json
//     before any run (see CLAUDE.md Tier 5 runbook A.0).
//   - Firebase Auth users created during a run can be deleted via Firebase Console > Auth.
//   - To restore the original /customers docs, replay the backup JSON with a small loader.

import * as crypto from "crypto";
import { adminDb } from "../server/services/firebaseAdmin";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

const MIGRATION_VERSION = "tier5a-v1";
const CHECKPOINT_PATH = "_migrations/tier5a-customer-auth";

const DRY_RUN = process.env.DRY_RUN !== "false";
const BATCH_SIZE = Math.max(1, Math.min(500, parseInt(process.env.BATCH_SIZE || "50", 10)));
const RESUME_FROM = process.env.RESUME_FROM || null;
const SEND_RESET = process.env.SEND_RESET === "true";

interface Checkpoint {
  lastProcessedId: string | null;
  processedCount: number;
  createdAuthCount: number;
  reusedAuthCount: number;
  skippedAlreadyMigratedCount: number;
  skippedStaffConflictCount: number;
  errorCount: number;
  startedAt: FirebaseFirestore.Timestamp | null;
  finishedAt: FirebaseFirestore.Timestamp | null;
}

interface MigrationOutcome {
  ok: boolean;
  oldDocId: string;
  newUid: string | null;
  email: string | null;
  action: "created" | "reused" | "skipped_no_email" | "skipped_already_migrated" | "skipped_staff_conflict" | "error";
  resetLink?: string | null;
  error?: string;
  existingRole?: string | null;
}

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s);
}

function generateStrongPassword(): string {
  return crypto.randomBytes(15).toString("base64url");
}

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, dryRun: DRY_RUN, ts: new Date().toISOString(), ...data }));
}

async function loadCheckpoint(): Promise<Checkpoint> {
  const snap = await adminDb.doc(CHECKPOINT_PATH).get();
  if (!snap.exists) {
    return {
      lastProcessedId: RESUME_FROM,
      processedCount: 0,
      createdAuthCount: 0,
      reusedAuthCount: 0,
      skippedAlreadyMigratedCount: 0,
      skippedStaffConflictCount: 0,
      errorCount: 0,
      startedAt: null,
      finishedAt: null,
    };
  }
  const data = snap.data() as Partial<Checkpoint>;
  return {
    lastProcessedId: RESUME_FROM ?? data.lastProcessedId ?? null,
    processedCount: data.processedCount ?? 0,
    createdAuthCount: data.createdAuthCount ?? 0,
    reusedAuthCount: data.reusedAuthCount ?? 0,
    skippedAlreadyMigratedCount: data.skippedAlreadyMigratedCount ?? 0,
    skippedStaffConflictCount: data.skippedStaffConflictCount ?? 0,
    errorCount: data.errorCount ?? 0,
    startedAt: data.startedAt ?? null,
    finishedAt: data.finishedAt ?? null,
  };
}

async function saveCheckpoint(cp: Checkpoint, fields: Partial<Checkpoint> = {}) {
  if (DRY_RUN) return;
  const merged: Record<string, unknown> = { ...cp, ...fields };
  await adminDb.doc(CHECKPOINT_PATH).set(merged, { merge: true });
}

async function processCustomer(doc: FirebaseFirestore.QueryDocumentSnapshot): Promise<MigrationOutcome> {
  const oldDocId = doc.id;
  const data = doc.data() as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : null;
  const name = typeof data.name === "string" ? data.name : undefined;

  // Idempotency check.
  if (data._migrationVersion === MIGRATION_VERSION) {
    return { ok: true, oldDocId, newUid: oldDocId, email, action: "skipped_already_migrated" };
  }

  if (!isValidEmail(email)) {
    return { ok: false, oldDocId, newUid: null, email: null, action: "skipped_no_email", error: "missing or invalid email" };
  }

  const auth = getAuth();
  let userRecord: UserRecord;
  let action: "created" | "reused";

  try {
    userRecord = await auth.getUserByEmail(email);
    action = "reused";

    // SAFETY: never demote a staff Auth user to customer. If this email already
    // exists as owner/admin/manager/seller/logistics/driver, skip the migration.
    // The customer doc is preserved as-is — operator decides what to do manually
    // (probably: this email shouldn't be both staff AND customer; split into two).
    const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>;
    const existingRole = typeof existingClaims.role === "string" ? existingClaims.role : null;
    if (existingRole && existingRole !== "customer") {
      return {
        ok: true,
        oldDocId,
        newUid: userRecord.uid,
        email,
        action: "skipped_staff_conflict",
        existingRole,
      };
    }
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      return { ok: false, oldDocId, newUid: null, email, action: "error", error: `auth.getUserByEmail: ${err.message || err.code}` };
    }
    if (DRY_RUN) {
      // In dry run we don't create. Pretend we would.
      return { ok: true, oldDocId, newUid: "<would-be-created>", email, action: "created" };
    }
    try {
      userRecord = await auth.createUser({
        email,
        emailVerified: false,
        password: generateStrongPassword(),
        displayName: name || email.split("@")[0],
      });
      action = "created";
    } catch (createErr: any) {
      return { ok: false, oldDocId, newUid: null, email, action: "error", error: `auth.createUser: ${createErr.message || createErr.code}` };
    }
  }

  if (DRY_RUN) {
    return { ok: true, oldDocId, newUid: userRecord.uid, email, action };
  }

  try {
    await auth.setCustomUserClaims(userRecord.uid, { role: "customer", branchId: "default" });
  } catch (err: any) {
    return { ok: false, oldDocId, newUid: userRecord.uid, email, action: "error", error: `setCustomUserClaims: ${err.message || err.code}` };
  }

  // Write canonical profile under /customers/{newUid}. Strip password + photoURL base64 blobs
  // are preserved (they're already in the source doc; we just copy minus the password field).
  const { password: _pw, ...safeData } = data;
  const targetRef = adminDb.collection("customers").doc(userRecord.uid);
  const sourceRef = adminDb.collection("customers").doc(oldDocId);

  try {
    await targetRef.set(
      {
        ...safeData,
        uid: userRecord.uid,
        email,
        _migrationVersion: MIGRATION_VERSION,
        _migratedAt: FieldValue.serverTimestamp(),
        _migratedFromDocId: oldDocId !== userRecord.uid ? oldDocId : null,
      },
      { merge: true },
    );
  } catch (err: any) {
    return { ok: false, oldDocId, newUid: userRecord.uid, email, action: "error", error: `customers/{newUid}.set: ${err.message || err.code}` };
  }

  // If oldDocId !== newUid, the old doc is now orphaned. Delete it after the new one is
  // confirmed written. We swallow this error because the migration is functionally complete
  // even if the orphan deletion fails — operator can clean it manually.
  if (oldDocId !== userRecord.uid) {
    try {
      await sourceRef.delete();
    } catch (err: any) {
      console.error(`⚠️  Could not delete orphan /customers/${oldDocId}: ${err.message || err.code}`);
    }
  }

  // Audit log.
  try {
    await adminDb.collection("role_audit").add({
      action: "CUSTOMER_AUTH_MIGRATED",
      targetUserId: userRecord.uid,
      newRole: "customer",
      newBranchId: "default",
      oldDocId,
      migratedAction: action,
      operatorUid: "tier5a-migration-script",
      operatorEmail: "tier5a-migration-script@stockflow.system",
      operatorRole: "migration-script",
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error(`⚠️  Audit write failed for ${oldDocId}: ${err.message || err.code}`);
  }

  // Optional reset link generation (logged only — Pierre's decision: no auto-email).
  let resetLink: string | null = null;
  if (SEND_RESET) {
    try {
      resetLink = await auth.generatePasswordResetLink(email);
    } catch (err: any) {
      console.error(`⚠️  Could not generate reset link for ${email}: ${err.message || err.code}`);
    }
  }

  return { ok: true, oldDocId, newUid: userRecord.uid, email, action, resetLink };
}

async function run() {
  log("migration_started", { migrationVersion: MIGRATION_VERSION, batchSize: BATCH_SIZE, resumeFrom: RESUME_FROM, sendReset: SEND_RESET });

  const cp = await loadCheckpoint();
  if (!cp.startedAt && !DRY_RUN) {
    await saveCheckpoint(cp, { startedAt: FieldValue.serverTimestamp() as any });
  }

  let lastProcessedId = cp.lastProcessedId;
  let pageNum = 0;

  while (true) {
    pageNum++;
    let q = adminDb.collection("customers").orderBy("__name__").limit(BATCH_SIZE);
    if (lastProcessedId) {
      const lastSnap = await adminDb.collection("customers").doc(lastProcessedId).get();
      if (lastSnap.exists) {
        q = q.startAfter(lastSnap);
      }
    }

    const pageSnap = await q.get();
    if (pageSnap.empty) {
      log("migration_no_more_docs", { pageNum });
      break;
    }

    log("page_loaded", { pageNum, count: pageSnap.docs.length });

    for (const doc of pageSnap.docs) {
      const outcome = await processCustomer(doc);
      cp.processedCount++;
      if (outcome.ok) {
        if (outcome.action === "created") cp.createdAuthCount++;
        else if (outcome.action === "reused") cp.reusedAuthCount++;
        else if (outcome.action === "skipped_already_migrated") cp.skippedAlreadyMigratedCount++;
        else if (outcome.action === "skipped_staff_conflict") cp.skippedStaffConflictCount++;
      } else {
        cp.errorCount++;
      }
      lastProcessedId = doc.id;
      cp.lastProcessedId = lastProcessedId;
      log("customer_processed", { ...outcome });
    }

    // Persist checkpoint at end of every page (real runs only).
    await saveCheckpoint(cp);

    if (pageSnap.docs.length < BATCH_SIZE) {
      log("migration_last_page", { pageNum });
      break;
    }

    // Small breather to avoid hammering Firestore + Auth admin endpoints.
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!DRY_RUN) {
    await saveCheckpoint(cp, { finishedAt: FieldValue.serverTimestamp() as any });
  }

  log("migration_summary", {
    processedCount: cp.processedCount,
    createdAuthCount: cp.createdAuthCount,
    reusedAuthCount: cp.reusedAuthCount,
    skippedAlreadyMigratedCount: cp.skippedAlreadyMigratedCount,
    skippedStaffConflictCount: cp.skippedStaffConflictCount,
    errorCount: cp.errorCount,
  });

  if (DRY_RUN) {
    console.log("");
    console.log("ℹ️  DRY RUN complete. NO writes were made. Re-run with DRY_RUN=false to apply.");
  } else {
    console.log("");
    console.log(`🏁 Migration complete. processed=${cp.processedCount} created=${cp.createdAuthCount} reused=${cp.reusedAuthCount} skipped_already=${cp.skippedAlreadyMigratedCount} skipped_staff=${cp.skippedStaffConflictCount} errors=${cp.errorCount}`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal:", err.message || err);
    process.exit(1);
  });
