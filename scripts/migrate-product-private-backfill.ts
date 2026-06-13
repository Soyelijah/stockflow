// C1 (Tier S security) — Phase 2 backfill.
// Copies costPrice + supplierId from every /products/{id} into the private mirror
// /product_private/{id} (SAME doc id). The mirror is readable only by the
// isCostViewer() roles (owner/admin/manager/logistics) per firestore.rules, so
// once Phase 4 strips the fields from /products the public catalog can no longer
// leak the retailer's cost structure or supplier list.
//
// This backfill seeds the mirror for products created BEFORE the Phase 1 dual-write
// (commit 8ed1f06). It also self-heals two edge cases:
//   - orphans from the Inventory create-path (addDoc(products) succeeded but the
//     follow-up setDoc(product_private) failed — they are not 100% atomic);
//   - drift, if a mirror doc somehow disagrees with /products (source of truth).
//
// Idempotent + resumable: re-running skips docs already in sync, so a partial run
// (interrupted / failed mid-batch) is safe to re-run — it only writes what is still
// missing or stale. No checkpoint doc needed for a bounded catalog collection.
//
// Named Firestore DB: adminDb targets firebaseConfig.firestoreDatabaseId
// (server/services/firebaseAdmin.ts:33), NOT the empty (default) db — a bare
// getFirestore(app) would false-green over 0 docs.
//
// DRY RUN BY DEFAULT. No writes unless DRY_RUN=false.
//
// Dry run (default — reports counts, writes nothing):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     pnpm tsx scripts/migrate-product-private-backfill.ts
//
// Commit (actually writes the mirror):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json DRY_RUN=false \
//     pnpm tsx scripts/migrate-product-private-backfill.ts

import { adminDb } from "../server/services/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN !== "false";
const BATCH_SIZE = 400; // Firestore batch limit is 500 — leave headroom.

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, dryRun: DRY_RUN, ts: new Date().toISOString(), ...data }));
}

// Normalize for comparison + write. /products may store supplierId as "" / undefined;
// the mirror stores it as null. costPrice is integer CLP (default 0).
function normCost(v: unknown): number {
  return Number(v) || 0;
}
function normSupplier(v: unknown): string | null {
  return v ? String(v) : null;
}

async function main() {
  log("backfill_start", {
    db: "named (firebaseConfig.firestoreDatabaseId)",
    mode: DRY_RUN ? "DRY_RUN (no writes)" : "COMMIT (writes enabled)",
  });

  const productsSnap = await adminDb.collection("products").get();
  const productsCount = productsSnap.size;
  log("products_scanned", { productsCount });

  let created = 0;   // mirror was missing → would create / created
  let corrected = 0; // mirror existed but cost/supplier drifted → would fix / fixed
  let inSync = 0;    // mirror existed and matched → skipped
  let failed = 0;

  let batch = adminDb.batch();
  let batchCount = 0;

  async function flush() {
    if (batchCount === 0) return;
    if (!DRY_RUN) await batch.commit();
    log("batch_committed", { size: batchCount });
    batch = adminDb.batch();
    batchCount = 0;
  }

  for (const productDoc of productsSnap.docs) {
    const productId = productDoc.id;
    const p = productDoc.data();
    const costPrice = normCost(p?.costPrice);
    const supplierId = normSupplier(p?.supplierId);

    try {
      const privateRef = adminDb.collection("product_private").doc(productId);
      const privateSnap = await privateRef.get();

      if (privateSnap.exists) {
        const m = privateSnap.data() || {};
        const matches = normCost(m.costPrice) === costPrice && normSupplier(m.supplierId) === supplierId;
        if (matches) {
          inSync++;
          continue;
        }
        corrected++;
      } else {
        created++;
      }

      batch.set(
        privateRef,
        {
          costPrice,
          supplierId,
          productId,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: "backfill-script",
          // Only seed deletedAt on first creation; never clobber an existing value.
          ...(privateSnap.exists ? {} : { deletedAt: null }),
        },
        { merge: true }
      );
      batchCount++;

      if (batchCount >= BATCH_SIZE) await flush();
    } catch (err: any) {
      failed++;
      log("doc_failed", { productId, error: err?.message || String(err) });
    }
  }

  await flush();

  // Coverage gate. In commit mode this is the real post-state; in dry-run it is the
  // projected post-state (current mirror count + docs we would have created).
  const privateSnapAfter = await adminDb.collection("product_private").get();
  const privateCountActual = privateSnapAfter.size;
  const privateCountProjected = DRY_RUN ? privateCountActual + created : privateCountActual;
  const wouldWrite = created + corrected;
  const coverageOk = privateCountProjected >= productsCount;

  log("backfill_done", {
    productsCount,
    created,
    corrected,
    inSync,
    failed,
    wouldWrite,
    privateCountActual,
    privateCountProjected,
    coverageGate: coverageOk ? "PASS" : "FAIL",
  });

  console.log("");
  console.log(`🏁 [C1 Phase 2 backfill] ${DRY_RUN ? "DRY RUN" : "COMMIT"} done.`);
  console.log(`   products=${productsCount}  created=${created}  corrected=${corrected}  inSync=${inSync}  failed=${failed}`);
  console.log(`   product_private (now)=${privateCountActual}  projected=${privateCountProjected}  gate(>=products)=${coverageOk ? "PASS ✅" : "FAIL ❌"}`);
  if (DRY_RUN) {
    console.log("");
    console.log(`ℹ️  DRY RUN — NO writes were made. Would write ${wouldWrite} mirror docs.`);
    console.log("    Re-run with DRY_RUN=false to apply.");
  }
  if (failed > 0) {
    console.log("");
    console.log(`⚠️  ${failed} docs failed — safe to re-run (idempotent); only missing/stale get rewritten.`);
  }

  // Non-zero exit if the projected coverage can't reach 100% (e.g. failures blocked it).
  if (!coverageOk) process.exitCode = 2;
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error("❌ Fatal backfill failure:", err);
    process.exit(1);
  });
