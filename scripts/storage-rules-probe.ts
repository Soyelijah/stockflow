// Offline, non-destructive probe for storage.rules (Propuesta 4).
//
// Runs entirely against the Firebase Storage EMULATOR via
// @firebase/rules-unit-testing — no live project, no real data, no deploy.
// Asserts the CEO permission matrix for dispatch evidence + profile avatars.
//
// NOTE: named with a `-probe.ts` SUFFIX (not `probe-*` prefix) on purpose —
// `.gitignore` ignores `probe-*.ts` (ephemeral probes), and this is permanent
// audit tooling that must be tracked.
//
// Run (emulator auto-started + torn down):
//   pnpm exec firebase emulators:exec --only storage --project demo-stockflow \
//     "pnpm tsx scripts/storage-rules-probe.ts"

import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const IMG = { contentType: "image/jpeg" };
const EVID = "shipments/by-driver/driverA/ship1/evidence.jpg";
const AVATAR = "profiles/userA/avatar.jpg";

let pass = 0;
let fail = 0;
async function check(name: string, p: Promise<unknown>) {
  try {
    await p;
    console.log(`  ✅ ${name}`);
    pass++;
  } catch (e: any) {
    console.log(`  ❌ ${name} — ${e?.message || e}`);
    fail++;
  }
}

const env: RulesTestEnvironment = await initializeTestEnvironment({
  projectId: "demo-stockflow",
  storage: { rules: readFileSync("storage.rules", "utf8") },
});

// Contexts (uid + custom claims).
const driverA = env.authenticatedContext("driverA", { role: "driver" });
const driverB = env.authenticatedContext("driverB", { role: "driver" });
const owner = env.authenticatedContext("ownerU", { role: "owner" });
const admin = env.authenticatedContext("adminU", { role: "admin" });
const manager = env.authenticatedContext("mgrU", { role: "manager" });
const logistics = env.authenticatedContext("logU", { role: "logistics" });
const seller = env.authenticatedContext("sellerU", { role: "seller" });
const customer = env.authenticatedContext("custU", { role: "customer" });
const userA = env.authenticatedContext("userA", { role: "customer" });
const anon = env.unauthenticatedContext();

const put = (ctx: any, path: string, meta = IMG) =>
  uploadBytes(ref(ctx.storage(), path), JPEG, meta);
const read = (ctx: any, path: string) => getBytes(ref(ctx.storage(), path));
const del = (ctx: any, path: string) => deleteObject(ref(ctx.storage(), path));

// Seed objects bypassing rules so read/delete cases have something to act on.
await env.withSecurityRulesDisabled(async (ctx) => {
  await uploadBytes(ref(ctx.storage(), EVID), JPEG, IMG);
  await uploadBytes(ref(ctx.storage(), AVATAR), JPEG, IMG);
});

console.log("=== EVIDENCE read (owner driver + staff allow; others deny) ===");
await check("driverA (owner) read", assertSucceeds(read(driverA, EVID)));
await check("owner read (audit)", assertSucceeds(read(owner, EVID)));
await check("admin read (audit)", assertSucceeds(read(admin, EVID)));
await check("manager read (audit)", assertSucceeds(read(manager, EVID)));
await check("logistics read (audit)", assertSucceeds(read(logistics, EVID)));
await check("driverB read DENIED", assertFails(read(driverB, EVID)));
await check("seller read DENIED", assertFails(read(seller, EVID)));
await check("customer read DENIED", assertFails(read(customer, EVID)));
await check("anon read DENIED", assertFails(read(anon, EVID)));

console.log("\n=== EVIDENCE write (owner driver only; guards) ===");
await check("driverA create own path", assertSucceeds(put(driverA, "shipments/by-driver/driverA/ship2/e.jpg")));
await check("driverA update own path", assertSucceeds(put(driverA, "shipments/by-driver/driverA/ship2/e.jpg")));
await check("driverA non-image DENIED (contentType guard)", assertFails(put(driverA, "shipments/by-driver/driverA/ship3/e.pdf", { contentType: "application/pdf" })));
await check("driverB write to driverA path DENIED", assertFails(put(driverB, EVID)));
await check("admin write DENIED", assertFails(put(admin, EVID)));

console.log("\n=== EVIDENCE delete (denied for everyone — audit material) ===");
await check("driverA delete own evidence DENIED", assertFails(del(driverA, EVID)));
await check("admin delete evidence DENIED", assertFails(del(admin, EVID)));

console.log("\n=== AVATAR read (subject-only) ===");
await check("userA read own avatar", assertSucceeds(read(userA, AVATAR)));
await check("driverB read avatar DENIED", assertFails(read(driverB, AVATAR)));
await check("admin read avatar DENIED (no staff audit on avatars)", assertFails(read(admin, AVATAR)));
await check("anon read avatar DENIED", assertFails(read(anon, AVATAR)));

console.log("\n=== AVATAR write (subject-only) ===");
await check("userA create/update own avatar", assertSucceeds(put(userA, AVATAR)));
await check("driverB write userA avatar DENIED", assertFails(put(driverB, AVATAR)));
await check("anon write avatar DENIED", assertFails(put(anon, AVATAR)));

console.log("\n=== AVATAR delete (subject-only — own profile) ===");
await check("driverB delete userA avatar DENIED", assertFails(del(driverB, AVATAR)));
await check("userA delete own avatar ALLOWED", assertSucceeds(del(userA, AVATAR)));

await env.cleanup();

console.log("");
if (fail === 0) {
  console.log(`🏁 STORAGE RULES PROBE GREEN — ${pass}/${pass} matrix assertions passed.`);
  process.exit(0);
} else {
  console.log(`❌ STORAGE RULES PROBE RED — ${fail} failed, ${pass} passed.`);
  process.exit(1);
}
