// C1 (Tier S) — Phase 3 empirical security probe (READ-ONLY, non-destructive).
//
// Validates the actual Firestore-rules enforcement of the cost/supplier split by
// signing in as each role with the CLIENT SDK (the same enforcement path the APK
// webview hits) and attempting to read /products/{id} and /product_private/{id}.
//
// Expected matrix (read):
//   /products         → ALLOW for everyone (public catalog).
//   /product_private  → ALLOW only for isCostViewer (owner/admin/manager/logistics);
//                       DENY for seller/customer/driver/anon.
//
// This script ONLY reads. It never writes, so there is nothing to clean up on either
// the pass or the fail path. Write-deny is enforced by the SAME isCostViewer gate on
// create/update/delete in firestore.rules, so the read result is representative.
//
// Credentials are NEVER hardcoded. Provide them via env as a JSON map (passwords stay
// out of the repo and out of logs — the script prints roles + verdicts, never secrets):
//
//   C1_PROBE_CREDS='{"owner":{"email":"...","password":"..."},
//                    "admin":{"email":"admin@stockflow.com","password":"..."},
//                    "manager":{"email":"manager@stockflow.com","password":"..."},
//                    "logistics":{"email":"logistics@stockflow.com","password":"..."},
//                    "seller":{"email":"seller@stockflow.com","password":"..."},
//                    "driver":{"email":"driver@stockflow.cl","password":"..."},
//                    "customer":{"email":"...","password":"..."}}' \
//     pnpm tsx scripts/c1-probe-product-private.ts
//
// "anon" is always probed (no sign-in). Roles without creds are SKIPPED.
//
// Exit codes (this is a GATE, so a partial run is not green by default):
//   0  every role validated and matched the matrix (or a partial run explicitly opted
//      in via C1_PROBE_ALLOW_SKIPS=true — NOT for the pre-strip gate).
//   2  SECURITY MISMATCH — a role got a verdict it should not (takes precedence).
//   3  INCOMPLETE MATRIX — one or more roles SKIPPED and C1_PROBE_ALLOW_SKIPS is not set.
//
// Named Firestore DB is taken from firebase-applet-config.json (firestoreDatabaseId).

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, getDocs, query, collection, limit } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const DB_ID = (firebaseConfig as any).firestoreDatabaseId;

// Source of truth for the expected /product_private read verdict per role.
const EXPECT_PRIVATE_ALLOW: Record<string, boolean> = {
  owner: true, admin: true, manager: true, logistics: true,
  seller: false, customer: false, driver: false, anon: false,
};

type Creds = { email: string; password: string };

function loadCreds(): Record<string, Creds> {
  const raw = process.env.C1_PROBE_CREDS;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e: any) {
    console.error("❌ C1_PROBE_CREDS is not valid JSON:", e.message);
    process.exit(1);
  }
}

// Returns "ALLOW" if the read resolves, "DENY" if rules reject it, or throws on a
// non-permission error (network, etc.) so it isn't silently miscounted as a verdict.
async function tryRead(db: any, path: [string, string]): Promise<"ALLOW" | "DENY"> {
  try {
    await getDoc(doc(db, path[0], path[1]));
    return "ALLOW";
  } catch (e: any) {
    if (e?.code === "permission-denied") return "DENY";
    throw e;
  }
}

async function main() {
  const creds = loadCreds();
  const app = initializeApp(firebaseConfig as any);
  const auth = getAuth(app);
  const db = getFirestore(app, DB_ID);

  console.log(`🔐 C1 product_private read-matrix probe — db "${DB_ID}" (READ-ONLY)`);
  console.log("");

  // Grab a real product id (anon can read /products — it is public).
  let sampleId: string;
  try {
    const snap = await getDocs(query(collection(db, "products"), limit(1)));
    if (snap.empty) {
      console.error("❌ /products is empty — cannot probe. Seed a product first.");
      process.exit(1);
    }
    sampleId = snap.docs[0].id;
  } catch (e: any) {
    console.error("❌ Could not read /products as anonymous:", e?.code || e?.message);
    process.exit(1);
  }
  console.log(`ℹ️  sample product id: ${sampleId}`);
  console.log("");

  const roles = ["anon", "owner", "admin", "manager", "logistics", "seller", "driver", "customer"];
  const rows: Array<{ role: string; products: string; private: string; expectPriv: string; verdict: string }> = [];
  let failures = 0;
  let skipped = 0;

  for (const role of roles) {
    if (role !== "anon") {
      const c = creds[role];
      if (!c) { skipped++; rows.push({ role, products: "—", private: "—", expectPriv: EXPECT_PRIVATE_ALLOW[role] ? "ALLOW" : "DENY", verdict: "SKIP (no creds)" }); continue; }
      try {
        await signInWithEmailAndPassword(auth, c.email, c.password);
      } catch (e: any) {
        skipped++; rows.push({ role, products: "—", private: "—", expectPriv: EXPECT_PRIVATE_ALLOW[role] ? "ALLOW" : "DENY", verdict: `SKIP (auth failed: ${e?.code || "error"})` }); continue;
      }
    }

    let productsVerdict: string, privateVerdict: string;
    try {
      productsVerdict = await tryRead(db, ["products", sampleId]);
      privateVerdict = await tryRead(db, ["product_private", sampleId]);
    } catch (e: any) {
      rows.push({ role, products: "ERR", private: "ERR", expectPriv: EXPECT_PRIVATE_ALLOW[role] ? "ALLOW" : "DENY", verdict: `ERROR (${e?.code || e?.message})` });
      failures++;
      if (role !== "anon") await signOut(auth).catch(() => {});
      continue;
    }

    const expectPriv = EXPECT_PRIVATE_ALLOW[role] ? "ALLOW" : "DENY";
    const ok = productsVerdict === "ALLOW" && privateVerdict === expectPriv;
    if (!ok) failures++;
    rows.push({ role, products: productsVerdict, private: privateVerdict, expectPriv, verdict: ok ? "PASS ✅" : "FAIL ❌" });

    if (role !== "anon") await signOut(auth).catch(() => {});
  }

  // Report.
  console.log("ROLE        | /products | /product_private | expected | verdict");
  console.log("------------|-----------|------------------|----------|--------");
  for (const r of rows) {
    console.log(
      `${r.role.padEnd(11)} | ${r.products.padEnd(9)} | ${r.private.padEnd(16)} | ${r.expectPriv.padEnd(8)} | ${r.verdict}`
    );
  }
  console.log("");
  const allowSkips = process.env.C1_PROBE_ALLOW_SKIPS === "true";
  console.log(`🏁 probe done. failures=${failures} skipped=${skipped}`);
  if (skipped > 0) {
    console.log(`   ⚠️  ${skipped} role(s) SKIPPED — NOT validated. Supply their creds in C1_PROBE_CREDS to close the matrix.`);
  }

  // Exit-code gate. A security MISMATCH is the worst outcome and takes precedence.
  // A partial run (any SKIP) is NOT green by default — it would be a false-pass for the
  // pre-strip gate — so it exits non-zero unless explicitly opted into.
  if (failures > 0) {
    console.log("   ❌ SECURITY MISMATCH — a role read /product_private it should not (or was denied /products).");
    process.exitCode = 2;
  } else if (skipped > 0 && !allowSkips) {
    console.log("   ❌ INCOMPLETE MATRIX — skipped roles make this an unreliable gate. Re-run with full creds,");
    console.log("      or set C1_PROBE_ALLOW_SKIPS=true to explicitly accept a partial run (NOT for the pre-strip gate).");
    process.exitCode = 3;
  } else if (skipped > 0) {
    console.log("   ⚠️  partial run accepted (C1_PROBE_ALLOW_SKIPS=true). Validated roles matched, but the matrix is INCOMPLETE.");
  } else {
    console.log("   ✅ every role matched the expected matrix — complete.");
  }
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error("❌ Fatal probe failure:", err);
    process.exit(1);
  });
