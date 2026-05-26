// Multi-branch (Tier 1.0) — one-time seed.
// Creates /branches/default representing the pre-multi-branch state of the retailer.
// All legacy data (transactions, shipments, stock movements, etc.) gets backfilled
// to branchId="default" by `migrate-users-add-branchid.ts` and the upcoming Tier 1.2
// data backfill script.
//
// Run: pnpm tsx scripts/seed-default-branch.ts
// Idempotent: safe to re-run; will skip if already present.

import { adminDb } from "../server/services/firebaseAdmin";
import * as admin from "firebase-admin";

async function seedDefaultBranch() {
  console.log("🏪 [Seed Default Branch] Checking /branches/default ...");

  const ref = adminDb.collection("branches").doc("default");
  const snap = await ref.get();

  if (snap.exists) {
    console.log("ℹ️  /branches/default already exists. Skipping.");
    return;
  }

  await ref.set({
    name: "Sucursal Principal",
    address: "",
    phone: "",
    geolocation: null,
    active: true,
    managerUserId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("✅ Created /branches/default (Sucursal Principal).");
  console.log("   Next: run `pnpm tsx scripts/migrate-users-add-branchid.ts` to backfill users.");
}

seedDefaultBranch()
  .then(() => {
    console.log("🏁 [Seed Default Branch] Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Fatal seed failure:", err);
    process.exit(1);
  });
