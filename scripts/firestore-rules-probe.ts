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
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, query, collection, where } from "firebase/firestore";

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
  await setDoc(doc(db, "redemptions", "redeem1"), { customerId: "customer-uid", status: "pending", pointsCost: 100, productId: "rew-1" });
  await setDoc(doc(db, "transfers", "t1"), { branchId: "default", status: "pending", items: [{ productId: "p1", productName: "P", qty: 2 }], origin: "default", createdAt: 1 });
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

console.log("\n=== /redemptions — staff-mediated: well-formed own-pending create; staff fulfill (immutable fields) ===");
const customer2 = env.authenticatedContext("customer2-uid", { role: "customer" });
const cust = ctx("customer"); // uid "customer-uid" == seeded redeem1.customerId
const mkRedeem = (c: any, id: string, data: any) => setDoc(doc(c.firestore(), "redemptions", id), data);
const upRedeem = (c: any, id: string, data: any) => updateDoc(doc(c.firestore(), "redemptions", id), data);
const validRedeem = { customerId: "customer-uid", customerName: "c", customerRUT: "r", customerEmail: "e", productId: "rew-1", productName: "Premio", pointsCost: 100, validationCode: "RDM-X", status: "pending", timestamp: 1 };
// CREATE
await check("customer create OWN well-formed pending ALLOWED", assertSucceeds(mkRedeem(cust, "r-own", validRedeem)));
await check("customer create FORGED customerId DENIED", assertFails(mkRedeem(cust, "r-forged", { ...validRedeem, customerId: "customer2-uid" })));
await check("customer create status=fulfilled (pre-confirmed) DENIED", assertFails(mkRedeem(cust, "r-pre", { ...validRedeem, status: "fulfilled" })));
await check("customer create pointsCost<=0 DENIED (malformed)", assertFails(mkRedeem(cust, "r-mal1", { ...validRedeem, pointsCost: 0 })));
await check("customer create missing validationCode DENIED (malformed)", assertFails(mkRedeem(cust, "r-mal2", { customerId: "customer-uid", status: "pending", productId: "rew-1", productName: "P", pointsCost: 100, timestamp: 1 })));
await check("customer create EXTRA key DENIED (hasOnly)", assertFails(mkRedeem(cust, "r-mal3", { ...validRedeem, fulfilledBy: "hacker" })));
await check("anon create DENIED", assertFails(mkRedeem(anon, "r-anon", validRedeem)));
// READ
await check("customer read OWN ALLOWED", assertSucceeds(read(cust, "redemptions", "redeem1")));
await check("OTHER customer read DENIED", assertFails(read(customer2, "redemptions", "redeem1")));
await check("seller read ALLOWED (staff)", assertSucceeds(read(ctx("seller"), "redemptions", "redeem1")));
await check("admin read ALLOWED (staff)", assertSucceeds(read(ctx("admin"), "redemptions", "redeem1")));
await check("anon read DENIED", assertFails(read(anon, "redemptions", "redeem1")));
// UPDATE — deny cases first (redeem1 stays pending), allow last
await check("customer update DENIED (no self-fulfill)", assertFails(upRedeem(cust, "redeem1", { status: "fulfilled" })));
await check("logistics update DENIED (not isSeller)", assertFails(upRedeem(ctx("logistics"), "redeem1", { status: "fulfilled" })));
await check("seller change pointsCost DENIED (immutable)", assertFails(upRedeem(ctx("seller"), "redeem1", { status: "fulfilled", pointsCost: 1 })));
await check("seller change customerId DENIED (immutable)", assertFails(upRedeem(ctx("seller"), "redeem1", { status: "fulfilled", customerId: "x" })));
await check("seller change validationCode DENIED (immutable)", assertFails(upRedeem(ctx("seller"), "redeem1", { status: "fulfilled", validationCode: "HACK" })));
await check("seller fulfill (status + fulfilledBy) ALLOWED", assertSucceeds(upRedeem(ctx("seller"), "redeem1", { status: "fulfilled", fulfilledBy: "seller-uid" })));

console.log("\n=== /transfers — Logística (isLogistics): pending-only create, immutable items, status enum, admin delete ===");
const validTransfer = { branchId: "default", status: "pending", items: [{ productId: "p1", productName: "P", qty: 1 }], origin: "default", createdAt: 1 };
const mkT = (c: any, id: string, data: any) => setDoc(doc(c.firestore(), "transfers", id), data);
const upT = (c: any, id: string, data: any) => updateDoc(doc(c.firestore(), "transfers", id), data);
const delT = (c: any, id: string) => deleteDoc(doc(c.firestore(), "transfers", id));
// create
await check("logistics create pending valid-branch ALLOWED", assertSucceeds(mkT(ctx("logistics"), "t-own", validTransfer)));
await check("admin create pending ALLOWED (isLogistics)", assertSucceeds(mkT(ctx("admin"), "t-adm", validTransfer)));
await check("logistics create status!=pending DENIED", assertFails(mkT(ctx("logistics"), "t-bad1", { ...validTransfer, status: "received" })));
await check("logistics create invalid branchId('*') DENIED", assertFails(mkT(ctx("logistics"), "t-bad2", { ...validTransfer, branchId: "*" })));
await check("seller create DENIED (not isLogistics)", assertFails(mkT(ctx("seller"), "t-sel", validTransfer)));
await check("customer create DENIED", assertFails(mkT(ctx("customer"), "t-cus", validTransfer)));
await check("anon create DENIED", assertFails(mkT(anon, "t-anon", validTransfer)));
// read
await check("logistics read ALLOWED", assertSucceeds(read(ctx("logistics"), "transfers", "t1")));
await check("admin read ALLOWED (isLogistics)", assertSucceeds(read(ctx("admin"), "transfers", "t1")));
await check("seller read DENIED (not isLogistics)", assertFails(read(ctx("seller"), "transfers", "t1")));
await check("customer read DENIED", assertFails(read(ctx("customer"), "transfers", "t1")));
await check("anon read DENIED", assertFails(read(anon, "transfers", "t1")));
// update — deny cases first (t1 stays pending), allow last
await check("logistics change items DENIED (immutable)", assertFails(upT(ctx("logistics"), "t1", { status: "in_transit", items: [] })));
await check("logistics change branchId DENIED (immutable)", assertFails(upT(ctx("logistics"), "t1", { status: "in_transit", branchId: "x" })));
await check("logistics status out-of-enum DENIED", assertFails(upT(ctx("logistics"), "t1", { status: "hacked" })));
await check("seller update DENIED (not isLogistics)", assertFails(upT(ctx("seller"), "t1", { status: "in_transit" })));
await check("logistics transition (status + sentAt/By) ALLOWED", assertSucceeds(upT(ctx("logistics"), "t1", { status: "in_transit", sentAt: 1, sentBy: "log" })));
// delete (admin only)
await check("logistics delete DENIED (admin-only)", assertFails(delT(ctx("logistics"), "t1")));
await check("admin delete ALLOWED", assertSucceeds(delT(ctx("admin"), "t1")));

await env.cleanup();

console.log("");
if (fail === 0) {
  console.log(`🏁 FIRESTORE RULES PROBE GREEN — ${pass}/${pass} assertions passed (Fase A + B + redemptions + transfers).`);
  process.exit(0);
} else {
  console.log(`❌ FIRESTORE RULES PROBE RED — ${fail} failed, ${pass} passed.`);
  process.exit(1);
}
