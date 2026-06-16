// Offline, non-destructive probe for firestore.rules (Propuesta 5 Fase A).
//
// Runs against the Firestore EMULATOR via @firebase/rules-unit-testing — no live
// project, no real data, no deploy. Validates the ONLY Fase A change
// (/categories read: public → signed-in) plus no-regression controls on the
// other public reads (/products, /settings, /coupons stay public this phase).
//
// NOTE: `-probe.ts` SUFFIX on purpose — `.gitignore` ignores `probe-*.ts`
// (ephemeral); this is permanent audit tooling that must be tracked.
//
// Run (emulator auto-started + torn down):
//   pnpm exec firebase emulators:exec --only firestore --project demo-stockflow \
//     "pnpm tsx scripts/firestore-rules-probe.ts"

import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, getDocs, query, collection, where } from "firebase/firestore";

let pass = 0;
let fail = 0;
async function check(name: string, p: Promise<unknown>) {
  try {
    await p;
    console.log(`  ✅ ${name}`);
    pass++;
  } catch (e: any) {
    console.log(`  ❌ ${name} — ${e?.code || e?.message || e}`);
    fail++;
  }
}

const env: RulesTestEnvironment = await initializeTestEnvironment({
  projectId: "demo-stockflow",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});

const ROLES = ["owner", "admin", "manager", "seller", "driver", "logistics", "customer"] as const;
const ctx = (role: string) => env.authenticatedContext(`${role}-uid`, { role });
const anon = env.unauthenticatedContext();
const read = (c: any, col: string, id: string) => getDoc(doc(c.firestore(), col, id));

// Seed docs (rules bypassed).
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "categories", "cat1"), { name: "Bebidas" });
  await setDoc(doc(db, "products", "prod1"), { name: "Item", price: 1000 });
  await setDoc(doc(db, "settings", "global"), { businessName: "X", currency: "CLP" });
  await setDoc(doc(db, "coupons", "coup-active"), { code: "ACT", active: true });
  await setDoc(doc(db, "coupons", "coup-inactive"), { code: "INA", active: false });
});

console.log("=== /categories read — Fase A: signed-in ALLOW, anon DENY ===");
await check("anon read /categories DENIED", assertFails(read(anon, "categories", "cat1")));
for (const r of ROLES) {
  await check(`${r} read /categories ALLOWED`, assertSucceeds(read(ctx(r), "categories", "cat1")));
}

console.log("\n=== no-regression controls (/products, /settings stay public) ===");
await check("anon read /products ALLOWED (control)", assertSucceeds(read(anon, "products", "prod1")));
await check("anon read /settings/global ALLOWED (control)", assertSucceeds(read(anon, "settings", "global")));

console.log("\n=== /coupons read — Fase B: public active-only; staff (isSeller) read all ===");
const listAll = (c: any) => getDocs(query(collection(c.firestore(), "coupons")));
const listActive = (c: any) => getDocs(query(collection(c.firestore(), "coupons"), where("active", "==", true)));
await check("anon GET active coupon ALLOWED", assertSucceeds(read(anon, "coupons", "coup-active")));
await check("anon GET inactive coupon DENIED", assertFails(read(anon, "coupons", "coup-inactive")));
await check("anon list UNFILTERED DENIED", assertFails(listAll(anon)));
await check("anon list where active==true ALLOWED", assertSucceeds(listActive(anon)));
await check("customer GET active coupon ALLOWED", assertSucceeds(read(ctx("customer"), "coupons", "coup-active")));
await check("customer GET inactive coupon DENIED", assertFails(read(ctx("customer"), "coupons", "coup-inactive")));
await check("customer list UNFILTERED DENIED", assertFails(listAll(ctx("customer"))));
await check("seller GET inactive coupon ALLOWED (POS 'Inactivo')", assertSucceeds(read(ctx("seller"), "coupons", "coup-inactive")));
await check("seller list UNFILTERED ALLOWED", assertSucceeds(listAll(ctx("seller"))));
await check("admin GET inactive coupon ALLOWED", assertSucceeds(read(ctx("admin"), "coupons", "coup-inactive")));
await check("admin list UNFILTERED ALLOWED (Settings mgmt)", assertSucceeds(listAll(ctx("admin"))));
await check("logistics GET inactive coupon DENIED (not isSeller)", assertFails(read(ctx("logistics"), "coupons", "coup-inactive")));
await check("driver GET inactive coupon DENIED (not isSeller)", assertFails(read(ctx("driver"), "coupons", "coup-inactive")));

await env.cleanup();

console.log("");
if (fail === 0) {
  console.log(`🏁 FIRESTORE RULES PROBE GREEN — ${pass}/${pass} assertions passed (Fase A + B).`);
  process.exit(0);
} else {
  console.log(`❌ FIRESTORE RULES PROBE RED — ${fail} failed, ${pass} passed.`);
  process.exit(1);
}
