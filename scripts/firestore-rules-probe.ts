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
import { doc, getDoc, setDoc } from "firebase/firestore";

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
  await setDoc(doc(db, "coupons", "coup1"), { code: "X", active: true });
});

console.log("=== /categories read — Fase A: signed-in ALLOW, anon DENY ===");
await check("anon read /categories DENIED", assertFails(read(anon, "categories", "cat1")));
for (const r of ROLES) {
  await check(`${r} read /categories ALLOWED`, assertSucceeds(read(ctx(r), "categories", "cat1")));
}

console.log("\n=== no-regression controls (unchanged public reads stay public) ===");
await check("anon read /products ALLOWED (control)", assertSucceeds(read(anon, "products", "prod1")));
await check("anon read /settings/global ALLOWED (control)", assertSucceeds(read(anon, "settings", "global")));
await check("anon read /coupons ALLOWED (control, unchanged)", assertSucceeds(read(anon, "coupons", "coup1")));

await env.cleanup();

console.log("");
if (fail === 0) {
  console.log(`🏁 FIRESTORE RULES PROBE GREEN — ${pass}/${pass} assertions passed (Fase A).`);
  process.exit(0);
} else {
  console.log(`❌ FIRESTORE RULES PROBE RED — ${fail} failed, ${pass} passed.`);
  process.exit(1);
}
