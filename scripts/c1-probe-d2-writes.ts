// C1 D2 — post-deploy write-probe (validates the /products cost-field guard).
//
// After the D2 rules deploy, the public /products doc must REJECT any create/update that
// carries costPrice or supplierId, while still ALLOWING clean stock/barcode/metadata
// writes for a permitted role. This probe asserts exactly that against the real rules
// via the CLIENT SDK (the same enforcement path the app hits).
//
// Non-destructive: it operates ONLY on its own throwaway product docs
// (__c1d2probe__ / __c1d2probe2__, clean — no cost fields) and deletes them in a finally
// block so cleanup runs on BOTH the pass and the fail path. It never touches real
// products and never creates a product_private mirror.
//
// Credentials: a PRIVILEGED throwaway account (isCostViewer — owner/admin/manager/
// logistics; admin is fine) via env, never the repo, never logged:
//
//   C1_D2_CREDS='{"email":"c1gate-admin-<ts>@stockflow.test","password":"..."}' \
//     pnpm tsx scripts/c1-probe-d2-writes.ts
//
// Exit 0 = every case matched (DENY where expected, ALLOW where expected); non-zero on
// any mismatch or error.

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const DB_ID = (firebaseConfig as any).firestoreDatabaseId;
const PROBE_ID = "__c1d2probe__";
const PROBE_ID2 = "__c1d2probe2__";

function loadCreds(): { email: string; password: string } {
  const raw = process.env.C1_D2_CREDS;
  if (!raw) {
    console.error("❌ C1_D2_CREDS env missing. Provide a privileged throwaway account: {email,password}.");
    process.exit(1);
  }
  try {
    const c = JSON.parse(raw);
    if (!c.email || !c.password) throw new Error("need email + password");
    return c;
  } catch (e: any) {
    console.error("❌ C1_D2_CREDS is not valid JSON:", e.message);
    process.exit(1);
  }
}

type Row = { name: string; expected: "ALLOW" | "DENY"; actual: string; verdict: string };

async function expectResult(
  rows: Row[],
  name: string,
  expected: "ALLOW" | "DENY",
  fn: () => Promise<unknown>
) {
  let actual: string;
  try {
    await fn();
    actual = "ALLOW";
  } catch (e: any) {
    actual = e?.code === "permission-denied" ? "DENY" : `ERROR(${e?.code || e?.message})`;
  }
  const ok = actual === expected;
  rows.push({ name, expected, actual, verdict: ok ? "PASS ✅" : "FAIL ❌" });
}

async function main() {
  const creds = loadCreds();
  const app = initializeApp(firebaseConfig as any);
  const auth = getAuth(app);
  const db = getFirestore(app, DB_ID);

  console.log(`🔐 C1 D2 write-probe — db "${DB_ID}" (throwaway docs only)`);

  await signInWithEmailAndPassword(auth, creds.email, creds.password);

  const ref = doc(db, "products", PROBE_ID);
  const ref2 = doc(db, "products", PROBE_ID2);
  const rows: Row[] = [];

  try {
    // Start clean (ignore if absent).
    await deleteDoc(ref).catch(() => {});
    await deleteDoc(ref2).catch(() => {});

    // ALLOW: create a clean throwaway product (no cost fields).
    await expectResult(rows, "create clean product", "ALLOW", () =>
      setDoc(ref, { name: "C1 D2 Probe", price: 1000, stock: 5, barcodes: [PROBE_ID], minThreshold: 2 })
    );

    // DENY: create carrying costPrice.
    await expectResult(rows, "create with costPrice", "DENY", () =>
      setDoc(ref2, { name: "C1 D2 Probe 2", price: 1, costPrice: 5 })
    );

    // DENY: update that adds costPrice.
    await expectResult(rows, "update add costPrice", "DENY", () =>
      updateDoc(ref, { costPrice: 999 })
    );

    // DENY: update that adds supplierId.
    await expectResult(rows, "update add supplierId", "DENY", () =>
      updateDoc(ref, { supplierId: "PROV-X" })
    );

    // ALLOW: clean stock/barcode update.
    await expectResult(rows, "update clean stock/barcodes", "ALLOW", () =>
      updateDoc(ref, { stock: 7, barcodes: [PROBE_ID, "__alt__"] })
    );
  } finally {
    // Cleanup on BOTH pass and fail paths.
    await deleteDoc(ref).catch(() => {});
    await deleteDoc(ref2).catch(() => {});
    await signOut(auth).catch(() => {});
  }

  console.log("");
  console.log("CASE                          | expected | actual | verdict");
  console.log("------------------------------|----------|--------|--------");
  for (const r of rows) {
    console.log(`${r.name.padEnd(29)} | ${r.expected.padEnd(8)} | ${r.actual.padEnd(6)} | ${r.verdict}`);
  }
  const failures = rows.filter((r) => !r.verdict.startsWith("PASS")).length;
  console.log("");
  console.log(`🏁 D2 write-probe done. failures=${failures}  (throwaway docs deleted)`);
  if (failures > 0) {
    console.log("   ❌ D2 mismatch — a cost-field write was not denied, or a clean write was not allowed.");
    process.exitCode = 2;
  } else {
    console.log("   ✅ D2 enforced: cost-field writes DENIED, clean writes ALLOWED.");
  }
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error("❌ Fatal D2 probe failure:", err);
    process.exit(1);
  });
