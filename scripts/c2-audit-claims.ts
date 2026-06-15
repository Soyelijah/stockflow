// C2 — claims-vs-/users divergence audit (READ-ONLY, no writes, no PII).
//
// Dimensions the lockout risk of moving isAdmin/isLogistics/isSeller/isDriver from the
// current /users doc-lookup to claim-only. Reads Firebase Auth custom claims + /users
// docs and compares them. Writes NOTHING (no Auth, no Firestore). Logs NO full emails or
// PII — only counts, truncated uids (first6…last2), and the lockout estimate.
//
// Run:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//     pnpm tsx scripts/c2-audit-claims.ts

import { adminDb } from "../server/services/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";

const STAFF_ROLES = ["owner", "admin", "manager", "seller", "logistics", "driver"];
const VALID_ROLES = [...STAFF_ROLES, "customer"];

function truncUid(uid: string): string {
  return uid.length > 10 ? `${uid.slice(0, 6)}…${uid.slice(-2)}` : uid;
}

// Access a role grants TODAY (current rules): owner via claim, admin/manager/logistics/
// seller/driver via the /users doc-lookup.
function todayAccess(claimRole: string | null, docRole: string | null) {
  const isAdmin = claimRole === "owner" || docRole === "admin" || docRole === "manager";
  return {
    admin: isAdmin,
    logistics: isAdmin || docRole === "logistics",
    seller: isAdmin || docRole === "seller",
    driver: docRole === "driver",
  };
}

// Access a role would grant under CLAIM-ONLY helpers (the C2 refactor target).
function claimOnlyAccess(claimRole: string | null) {
  const isAdmin = claimRole === "owner" || claimRole === "admin" || claimRole === "manager";
  return {
    admin: isAdmin,
    logistics: isAdmin || claimRole === "logistics",
    seller: isAdmin || claimRole === "seller",
    driver: claimRole === "driver",
  };
}

async function main() {
  console.log("🔎 C2 claims audit — READ-ONLY (no writes, no PII). Named DB.");

  // 1. All Auth users → claim role.
  const claimByUid = new Map<string, string | null>();
  let pageToken: string | undefined = undefined;
  do {
    const res: any = await getAuth().listUsers(1000, pageToken);
    for (const u of res.users) {
      const r = (u.customClaims && typeof u.customClaims.role === "string") ? u.customClaims.role : null;
      claimByUid.set(u.uid, r);
    }
    pageToken = res.pageToken;
  } while (pageToken);

  // 2. All /users docs → mirror role.
  const docByUid = new Map<string, string | null>();
  const usersSnap = await adminDb.collection("users").get();
  usersSnap.forEach((d) => {
    const r = d.data()?.role;
    docByUid.set(d.id, typeof r === "string" ? r : null);
  });

  // 3. Union of uids (Auth is the universe of accounts; /users-only docs are orphans).
  const allUids = new Set<string>([...claimByUid.keys(), ...docByUid.keys()]);

  const claimCounts: Record<string, number> = {};
  const docCounts: Record<string, number> = {};
  const divergences: Array<{ uid: string; claim: string; doc: string }> = [];
  let claimMissing = 0;        // signed-up Auth user with no role claim
  let docMissing = 0;          // no /users doc or no role field
  let invalidRole = 0;
  const invalidExamples = new Set<string>();
  const lockout: Array<{ uid: string; claim: string; doc: string; lost: string[] }> = [];

  for (const uid of allUids) {
    const claimRole = claimByUid.has(uid) ? claimByUid.get(uid)! : null;
    const docRole = docByUid.has(uid) ? docByUid.get(uid)! : null;

    claimCounts[claimRole ?? "(none)"] = (claimCounts[claimRole ?? "(none)"] || 0) + 1;
    docCounts[docRole ?? "(none)"] = (docCounts[docRole ?? "(none)"] || 0) + 1;

    if (claimRole === null) claimMissing++;
    if (docRole === null) docMissing++;
    for (const r of [claimRole, docRole]) {
      if (r !== null && !VALID_ROLES.includes(r)) { invalidRole++; invalidExamples.add(r); }
    }

    if (claimRole !== null && docRole !== null && claimRole !== docRole) {
      divergences.push({ uid: truncUid(uid), claim: claimRole, doc: docRole });
    }

    // Lockout: privilege held TODAY but lost under claim-only.
    const t = todayAccess(claimRole, docRole);
    const c = claimOnlyAccess(claimRole);
    const lost: string[] = [];
    for (const k of ["admin", "logistics", "seller", "driver"] as const) {
      if (t[k] && !c[k]) lost.push(k);
    }
    if (lost.length > 0) {
      lockout.push({ uid: truncUid(uid), claim: claimRole ?? "(none)", doc: docRole ?? "(none)", lost });
    }
  }

  // ---- Report ----
  console.log("");
  console.log(`total users reviewed (Auth ∪ /users): ${allUids.size}  (Auth=${claimByUid.size}, /users docs=${docByUid.size})`);
  console.log("");
  console.log("counts by role in customClaims:");
  for (const [r, n] of Object.entries(claimCounts).sort((a, b) => b[1] - a[1])) console.log(`   ${r.padEnd(10)} ${n}`);
  console.log("");
  console.log("counts by role in /users:");
  for (const [r, n] of Object.entries(docCounts).sort((a, b) => b[1] - a[1])) console.log(`   ${r.padEnd(10)} ${n}`);
  console.log("");
  console.log(`claim-missing (Auth user, no role claim): ${claimMissing}`);
  console.log(`/users role-missing (no doc or no role):  ${docMissing}`);
  console.log(`invalid-role cases: ${invalidRole}${invalidExamples.size ? ` (values: ${[...invalidExamples].join(", ")})` : ""}`);
  console.log("");
  console.log(`divergences (claim ≠ doc, both present): ${divergences.length}`);
  for (const d of divergences) console.log(`   ${d.uid}  claim=${d.claim}  doc=${d.doc}`);
  console.log("");
  console.log(`🔒 LOCKOUT estimate if helpers go claim-only: ${lockout.length} user(s) would lose access`);
  for (const l of lockout) console.log(`   ${l.uid}  claim=${l.claim}  doc=${l.doc}  loses=[${l.lost.join(",")}]`);
  console.log("");
  if (lockout.length === 0) {
    console.log("✅ No lockout — every user's claim already grants what their doc grants. Claim-only is safe.");
  } else {
    console.log(`⚠️  ${lockout.length} user(s) need their custom claim repaired (via setUserRole) BEFORE the claim-only refactor deploys.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal claims-audit failure:", err);
    process.exit(1);
  });
