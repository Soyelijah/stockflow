// Multi-branch (Tier 1.2) — one-time backfill.
// Walks every document in the following collections and sets `branchId="default"`
// on any doc that doesn't have one yet:
//   - transactions
//   - shipments
//   - stockMovements
//   - inventory_audits
//   - expenses
//   - cash_closures
//   - cashRegisters
//
// After this runs, every new write also includes `branchId` (per Tier 1.2 code changes),
// so the field is universal across the dataset. Tier 1.3 will tighten Firestore rules
// to require/scope by branchId. Tier 1.4 will add the UI selector for filtering.
//
// Idempotent: skips docs that already have a branchId.
// Safe to re-run after partial failures or interruption.
//
// Prerequisites:
//   - scripts/seed-default-branch.ts has run (/branches/default exists).
//
// Run: pnpm tsx scripts/migrate-backfill-branchid-transactional.ts

import { adminDb } from "../server/services/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const DEFAULT_BRANCH_ID = "default";

const COLLECTIONS = [
  "transactions",
  "shipments",
  "stockMovements",
  "inventory_audits",
  "expenses",
  "cash_closures",
  "cashRegisters",
] as const;

const BATCH_SIZE = 400;  // Firestore batch limit is 500 — leave headroom

async function backfillCollection(name: string): Promise<{ scanned: number; updated: number; skipped: number }> {
  console.log(`📋 Scanning /${name} ...`);

  const snap = await adminDb.collection(name).get();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  let batch = adminDb.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data();
    if (data?.branchId) {
      skipped++;
      continue;
    }

    batch.set(
      doc.ref,
      {
        branchId: DEFAULT_BRANCH_ID,
        backfilledAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batchCount++;
    updated++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   ↪ committed batch of ${batchCount}`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ↪ committed final batch of ${batchCount}`);
  }

  console.log(`   ✅ /${name} done. scanned=${scanned} updated=${updated} skipped=${skipped}`);
  return { scanned, updated, skipped };
}

async function main() {
  console.log("🚚 [Backfill branchId on transactional collections] Starting Tier 1.2 ...");

  // Sanity check: default branch must exist.
  const defaultBranch = await adminDb.collection("branches").doc(DEFAULT_BRANCH_ID).get();
  if (!defaultBranch.exists) {
    console.error("❌ /branches/default not found. Run `pnpm tsx scripts/seed-default-branch.ts` first.");
    process.exit(1);
  }

  const totals = { scanned: 0, updated: 0, skipped: 0 };
  for (const col of COLLECTIONS) {
    try {
      const res = await backfillCollection(col);
      totals.scanned += res.scanned;
      totals.updated += res.updated;
      totals.skipped += res.skipped;
    } catch (err: any) {
      console.error(`❌ Failed on /${col}: ${err.message}`);
      // Continue with other collections rather than abort — partial is better than nothing.
    }
  }

  console.log("");
  console.log("🏁 [Backfill branchId on transactional collections] Done.");
  console.log(`   total scanned=${totals.scanned} updated=${totals.updated} skipped=${totals.skipped}`);
  console.log("");
  console.log("ℹ️  Note: every document now carries branchId. Tier 1.3 will tighten");
  console.log("    Firestore rules to require it on writes. Tier 1.4 will add the UI");
  console.log("    branch-filter dropdown for cross-branch users.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal backfill failure:", err);
    process.exit(1);
  });
