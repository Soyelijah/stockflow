// C1 (Tier S security) — Phase 4 strip. THE LEAK CLOSES HERE.
//
// Removes costPrice + supplierId from every /products/{id} (public, allow read: if true)
// once the private mirror /product_private/{id} provably holds the same values. After
// this runs, the public catalog no longer exposes the retailer's cost structure or
// supplier list via Firestore REST.
//
// HARD PRECONDITION — zero data loss: a product's fields are stripped ONLY when its
// /product_private mirror exists AND its normalized costPrice/supplierId MATCH the
// /products values. If ANY product that still carries the fields fails this check, the
// run ABORTS and strips nothing (even in commit mode) — we never delete a value that the
// mirror hasn't safely captured.
//
// Idempotent + resumable: products already stripped (no costPrice/supplierId) are skipped,
// so a partial/interrupted run is safe to re-run.
//
// Named Firestore DB via adminDb (server/services/firebaseAdmin.ts:33).
//
// DRY RUN BY DEFAULT. No writes unless DRY_RUN=false.
//
// Dry run (default — reports what it would strip, writes nothing):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     pnpm tsx scripts/migrate-product-private-strip.ts
//
// Commit (actually strips — LEAK CLOSES):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json DRY_RUN=false \
//     pnpm tsx scripts/migrate-product-private-strip.ts
//
// Sequencing note: Phase 5 already landed — Inventory/Logistics no longer write
// costPrice/supplierId into the /products payload, so nothing re-adds them after this
// strip. Next is the D2 rules (reject costPrice/supplierId in /products writes), which is
// safe to deploy now that no writer sends those fields.
//
// Rollback: scripts/migrate-restore-costprice-to-products.ts copies product_private
// values back into /products (only meaningful before Phase 5/D2).

import { adminDb } from "../server/services/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN !== "false";
const BATCH_SIZE = 400; // Firestore batch limit is 500 — leave headroom.

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, dryRun: DRY_RUN, ts: new Date().toISOString(), ...data }));
}

// Same normalization the backfill used, so the value-match is apples-to-apples.
function normCost(v: unknown): number {
  return Number(v) || 0;
}
function normSupplier(v: unknown): string | null {
  return v ? String(v) : null;
}

async function main() {
  log("strip_start", {
    db: "named (firebaseConfig.firestoreDatabaseId)",
    mode: DRY_RUN ? "DRY_RUN (no writes)" : "COMMIT (LEAK CLOSES)",
  });

  const [productsSnap, privSnap] = await Promise.all([
    adminDb.collection("products").get(),
    adminDb.collection("product_private").get(),
  ]);
  const privById = new Map<string, any>();
  privSnap.forEach((d) => privById.set(d.id, d.data()));

  const productsCount = productsSnap.size;
  const toStrip: FirebaseFirestore.DocumentReference[] = [];
  const unsafe: Array<{ id: string; reason: string }> = [];
  let alreadyStripped = 0;

  for (const productDoc of productsSnap.docs) {
    const data = productDoc.data();
    const hasCost = Object.prototype.hasOwnProperty.call(data, "costPrice");
    const hasSupplier = Object.prototype.hasOwnProperty.call(data, "supplierId");

    if (!hasCost && !hasSupplier) {
      alreadyStripped++;
      continue;
    }

    const priv = privById.get(productDoc.id);
    if (!priv) {
      unsafe.push({ id: productDoc.id, reason: "no /product_private mirror" });
      continue;
    }
    // Each field that still lives on /products must be safely captured in the mirror.
    const costOk = !hasCost || normCost(priv.costPrice) === normCost(data.costPrice);
    const supplierOk = !hasSupplier || normSupplier(priv.supplierId) === normSupplier(data.supplierId);
    if (!costOk) {
      unsafe.push({ id: productDoc.id, reason: `costPrice mismatch (products=${normCost(data.costPrice)} private=${normCost(priv.costPrice)})` });
      continue;
    }
    if (!supplierOk) {
      unsafe.push({ id: productDoc.id, reason: "supplierId mismatch" });
      continue;
    }
    toStrip.push(productDoc.ref);
  }

  const coverageOk = unsafe.length === 0;
  log("precondition", {
    productsCount,
    alreadyStripped,
    wouldStrip: toStrip.length,
    unsafeCount: unsafe.length,
    coverageGate: coverageOk ? "PASS" : "FAIL",
  });
  for (const u of unsafe) log("unsafe_product", u);

  // HARD STOP: never strip if even one product's value isn't safely mirrored.
  if (!coverageOk) {
    console.log("");
    console.log(`❌ ABORT — ${unsafe.length} product(s) are NOT safely mirrored. Stripping would lose data.`);
    console.log("   Fix coverage first: re-run scripts/migrate-product-private-backfill.ts (DRY_RUN=false), then retry.");
    process.exit(2);
  }

  if (DRY_RUN) {
    console.log("");
    console.log(`🏁 [C1 Phase 4 strip] DRY RUN — coverage PASS.`);
    console.log(`   products=${productsCount}  wouldStrip=${toStrip.length}  alreadyStripped=${alreadyStripped}  unsafe=0`);
    console.log("   NO writes made. Re-run with DRY_RUN=false to strip (LEAK CLOSES).");
    return;
  }

  // Commit: delete the fields. FieldValue.delete() on an absent field is a harmless no-op.
  let stripped = 0;
  for (let i = 0; i < toStrip.length; i += BATCH_SIZE) {
    const chunk = toStrip.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();
    for (const ref of chunk) {
      batch.update(ref, {
        costPrice: FieldValue.delete(),
        supplierId: FieldValue.delete(),
      });
    }
    await batch.commit();
    stripped += chunk.length;
    log("batch_committed", { size: chunk.length, stripped });
  }

  console.log("");
  console.log(`🏁 [C1 Phase 4 strip] COMMIT done — LEAK CLOSED for existing /products.`);
  console.log(`   products=${productsCount}  stripped=${stripped}  alreadyStripped=${alreadyStripped}  unsafe=0`);
  console.log("");
  console.log("⚠️  Next: deploy the D2 rules (reject costPrice/supplierId in /products writes).");
  console.log("    Phase 5 already landed, so no writer re-adds the fields — D2 is safe now.");
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error("❌ Fatal strip failure:", err);
    process.exit(1);
  });
