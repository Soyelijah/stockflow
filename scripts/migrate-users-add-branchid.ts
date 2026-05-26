// Multi-branch (Tier 1.0) — one-time migration.
// Walks every document in /users and backfills branchId on:
//   - The Firestore profile document (`users/{uid}.branchId`)
//   - The Firebase Auth custom claim (`request.auth.token.branchId`)
//
// Assignment rules:
//   - admin / owner / logistics → "*" (cross-branch)
//   - manager / seller / driver / customer / undefined → "default"
//
// Run: pnpm tsx scripts/migrate-users-add-branchid.ts
// Prerequisites: scripts/seed-default-branch.ts must have been run.
// Idempotent: safe to re-run; skips users that already have a branchId.
// Side-effect: users will need to log out and back in to refresh their token claims.

import { adminDb } from "../server/services/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

const CROSS_BRANCH_SENTINEL = "*";
const DEFAULT_BRANCH_ID = "default";

function defaultBranchForRole(role: string | undefined | null): string {
  if (role === "admin" || role === "owner" || role === "logistics") return CROSS_BRANCH_SENTINEL;
  return DEFAULT_BRANCH_ID;
}

async function migrate() {
  console.log("🚚 [Migrate users] Starting branchId backfill on /users ...");

  // Sanity check: default branch must exist.
  const defaultBranch = await adminDb.collection("branches").doc(DEFAULT_BRANCH_ID).get();
  if (!defaultBranch.exists) {
    console.error("❌ /branches/default not found. Run `pnpm tsx scripts/seed-default-branch.ts` first.");
    process.exit(1);
  }

  const auth = getAuth();
  const snap = await adminDb.collection("users").get();
  console.log(`📋 Found ${snap.size} user profiles.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const uid = doc.id;
    const role = data?.role;

    if (data?.branchId) {
      skipped++;
      continue;
    }

    const branchId = defaultBranchForRole(role);

    try {
      // 1. Read existing claims so we don't blow away anything else we may have added later.
      let existingClaims: Record<string, any> = {};
      try {
        const userRec = await auth.getUser(uid);
        existingClaims = (userRec.customClaims as Record<string, any>) || {};
      } catch (e: any) {
        if (e.code !== "auth/user-not-found") throw e;
        console.warn(`⚠️  No Auth record for user ${uid} (profile only). Skipping claim write.`);
      }

      // 2. Update claim (only if Auth record exists).
      if (Object.keys(existingClaims).length > 0 || role) {
        try {
          await auth.setCustomUserClaims(uid, {
            ...existingClaims,
            role: existingClaims.role || role,
            branchId,
          });
        } catch (e: any) {
          if (e.code !== "auth/user-not-found") throw e;
        }
      }

      // 3. Update profile document.
      await adminDb.collection("users").doc(uid).set(
        {
          branchId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      migrated++;
      console.log(`  ✅ ${uid} (${role || "no-role"}) → branchId=${branchId}`);
    } catch (err: any) {
      failed++;
      console.error(`  ❌ ${uid}: ${err.message}`);
    }
  }

  console.log("");
  console.log(`🏁 [Migrate users] Done. migrated=${migrated} skipped=${skipped} failed=${failed}`);
  console.log("");
  console.log("⚠️  Users will need to log out and back in to refresh their token claims.");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal migration failure:", err);
    process.exit(1);
  });
