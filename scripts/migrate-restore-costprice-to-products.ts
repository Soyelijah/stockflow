// C1 (Tier S security) — Phase 4 ROLLBACK / safety net.
//
// Restores costPrice + supplierId from the private mirror /product_private/{id} BACK
// into the public /products/{id}. This UNDOES the Phase 4 strip — use it only if the
// strip caused a problem and we need the fields back on /products (e.g. a privileged
// reader was missed and is now showing 0 cost).
//
// ⚠️ Running this RE-OPENS the leak (costPrice/supplierId become public again on every
// restored product). It is meaningful only BEFORE the D2 rules land (which reject
// costPrice/supplierId in /products writes). If D2 is already deployed, roll D2 back
// first, then run this.
//
// Only existing /products docs are touched (set merge) — a private-only entry whose
// product was deleted is skipped, never resurrected as a partial product.
//
// Idempotent: re-running writes the same values. Named DB via adminDb.
//
// DRY RUN BY DEFAULT. No writes unless DRY_RUN=false.
//
// Dry run (default):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     pnpm tsx scripts/migrate-restore-costprice-to-products.ts
//
// Commit (actually restores — RE-OPENS the leak):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json DRY_RUN=false \
//     pnpm tsx scripts/migrate-restore-costprice-to-products.ts

import { adminDb } from "../server/services/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN !== "false";
const BATCH_SIZE = 400; // Firestore batch limit is 500 — leave headroom.

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, dryRun: DRY_RUN, ts: new Date().toISOString(), ...data }));
}

function normCost(v: unknown): number {
  return Number(v) || 0;
}
function normSupplier(v: unknown): string | null {
  return v ? String(v) : null;
}

async function main() {
  log("restore_start", {
    db: "named (firebaseConfig.firestoreDatabaseId)",
    mode: DRY_RUN ? "DRY_RUN (no writes)" : "COMMIT (RE-OPENS leak)",
  });

  const [privSnap, productsSnap] = await Promise.all([
    adminDb.collection("product_private").get(),
    adminDb.collection("products").get(),
  ]);
  const productIds = new Set<string>();
  productsSnap.forEach((d) => productIds.add(d.id));

  let restored = 0;
  let skippedOrphan = 0; // private entry whose /products doc no longer exists
  const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];

  for (const privDoc of privSnap.docs) {
    if (!productIds.has(privDoc.id)) {
      skippedOrphan++;
      continue;
    }
    const priv = privDoc.data();
    writes.push({
      ref: adminDb.collection("products").doc(privDoc.id),
      data: {
        costPrice: normCost(priv.costPrice),
        supplierId: normSupplier(priv.supplierId),
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  log("restore_plan", {
    privateCount: privSnap.size,
    productsCount: productsSnap.size,
    wouldRestore: writes.length,
    skippedOrphan,
  });

  if (DRY_RUN) {
    console.log("");
    console.log(`🏁 [C1 rollback restore] DRY RUN — would restore ${writes.length} product(s).`);
    console.log(`   private=${privSnap.size}  products=${productsSnap.size}  skippedOrphan=${skippedOrphan}`);
    console.log("   NO writes made. Re-run with DRY_RUN=false to restore (RE-OPENS leak).");
    return;
  }

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const chunk = writes.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();
    for (const w of chunk) batch.set(w.ref, w.data, { merge: true });
    await batch.commit();
    restored += chunk.length;
    log("batch_committed", { size: chunk.length, restored });
  }

  console.log("");
  console.log(`🏁 [C1 rollback restore] COMMIT done — costPrice/supplierId restored to /products.`);
  console.log(`   restored=${restored}  skippedOrphan=${skippedOrphan}`);
  console.log("   ⚠️  The public leak is RE-OPENED on the restored products.");
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error("❌ Fatal restore failure:", err);
    process.exit(1);
  });
