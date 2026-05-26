// Multi-branch (Tier 1.1) — one-time migration.
// For every /products/{id} that has a `stock` field, creates a corresponding
// /product_stock/{id}_default document with the same value.
//
// Strategy: leaves products.stock intact. Dual-write code in POS/MobilePOS/etc.
// keeps both in sync during the transition window. Tier 1.5 cleanup will drop
// products.stock when all reads/writes are off it.
//
// Idempotent: skips products whose /product_stock/{id}_default already exists.
// Safe to re-run after partial failures.
//
// Prerequisites:
//   - scripts/seed-default-branch.ts already ran (/branches/default exists).
//
// Run: pnpm tsx scripts/migrate-products-split-stock.ts

import { adminDb } from "../server/services/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

const DEFAULT_BRANCH_ID = "default";

async function migrate() {
  console.log("📦 [Migrate products → product_stock] Starting Tier 1.1 split ...");

  // Sanity check: default branch must exist.
  const defaultBranch = await adminDb.collection("branches").doc(DEFAULT_BRANCH_ID).get();
  if (!defaultBranch.exists) {
    console.error("❌ /branches/default not found. Run `pnpm tsx scripts/seed-default-branch.ts` first.");
    process.exit(1);
  }

  const productsSnap = await adminDb.collection("products").get();
  console.log(`📋 Found ${productsSnap.size} products in catalog.`);

  let migrated = 0;
  let skipped = 0;
  let zeroStock = 0;
  let failed = 0;

  for (const productDoc of productsSnap.docs) {
    const productId = productDoc.id;
    const productData = productDoc.data();
    const legacyStock = Number(productData?.stock) || 0;

    const stockId = `${productId}_${DEFAULT_BRANCH_ID}`;
    const stockRef = adminDb.collection("product_stock").doc(stockId);

    try {
      const existingStock = await stockRef.get();
      if (existingStock.exists) {
        skipped++;
        continue;
      }

      await stockRef.set({
        productId,
        branchId: DEFAULT_BRANCH_ID,
        stock: legacyStock,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      if (legacyStock === 0) {
        zeroStock++;
      }
      migrated++;
      console.log(`  ✅ ${productId} (${productData?.name || "?"}) → stock=${legacyStock}`);
    } catch (err: any) {
      failed++;
      console.error(`  ❌ ${productId}: ${err.message}`);
    }
  }

  console.log("");
  console.log(`🏁 [Migrate products → product_stock] Done.`);
  console.log(`   migrated=${migrated} (with ${zeroStock} at stock=0)`);
  console.log(`   skipped=${skipped} (already had product_stock doc)`);
  console.log(`   failed=${failed}`);
  console.log("");
  console.log("ℹ️  Note: products.stock is intentionally NOT cleared yet — dual-write");
  console.log("    code keeps both in sync during the transition window.");
  console.log("    Tier 1.5 cleanup script will drop products.stock once all writers migrate.");
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal migration failure:", err);
    process.exit(1);
  });
