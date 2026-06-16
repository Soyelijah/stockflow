// Static source probe for the Propuesta 3 mass-assignment fix.
//
// Verifies, deterministically and with no runtime deps, that operator identity
// in the audit log is DERIVED FROM THE BEARER TOKEN (req.user) and NEVER from
// the request body. A runtime unit harness is impractical here: buildAuditLogRecord
// lives in server/routes/audit.ts whose module-level imports (express, firebase-admin
// namespace, firebaseAdmin init) cannot be loaded cleanly under tsx without a
// refactor that is out of this commit's strict scope. The AUTHORITATIVE runtime
// check is the post-deploy HTTP probe (forge operatorEmail/operatorUid in the body,
// confirm Firestore stores the Bearer identity) — mandated separately.
//
// Run:
//   pnpm tsx scripts/probe-audit-operator-identity.ts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ❌ ${name}${detail ? `  — ${detail}` : ""}`);
    failures++;
  }
}

const audit = read("server/routes/audit.ts");

// Isolate the buildAuditLogRecord function body.
const fnStart = audit.indexOf("export function buildAuditLogRecord");
const fnBody = fnStart >= 0 ? audit.slice(fnStart, audit.indexOf("\n}\n", fnStart) + 3) : "";

console.log("=== server/routes/audit.ts — buildAuditLogRecord ===");
check("function is exported (unit-testable surface)", fnStart >= 0);
check("takes a separate `user` param typed from AuthenticatedRequest",
  /buildAuditLogRecord\([\s\S]*?user:\s*AuthenticatedRequest\["user"\]/.test(audit));
check("operatorEmail derived from user (Bearer), with system fallback",
  /operatorEmail:\s*user\?\.email\s*\|\|\s*"sistema@stockflow\.com"/.test(fnBody),
  "expected `operatorEmail: user?.email || \"sistema@stockflow.com\"`");
check("operatorUid derived from user (Bearer), with sys-cron fallback",
  /operatorUid:\s*user\?\.uid\s*\|\|\s*"sys-cron"/.test(fnBody),
  "expected `operatorUid: user?.uid || \"sys-cron\"`");

// Negative: the old body-first mass-assignment pattern must be GONE everywhere.
check("NO `parsed.operatorEmail` anywhere (old body-first vuln removed)",
  !/parsed\.operatorEmail/.test(audit));
check("NO `parsed.operatorUid` anywhere (old body-first vuln removed)",
  !/parsed\.operatorUid/.test(audit));
check("buildAuditLogRecord body never reads operator identity from the body payload",
  !/parsed\.(operatorEmail|operatorUid)/.test(fnBody) && !/body\.(operatorEmail|operatorUid)/.test(fnBody));

// Clients must no longer send operator identity in the `/audit/log` POST body.
// Scope precisely to fetch POST payloads (`JSON.stringify({...})`) — NOT UI filter
// state, NOT log display, NOT direct client-side addDoc writes (a separate path).
for (const f of ["src/shared/components/Expenses.tsx", "src/shared/components/Settings.tsx"]) {
  const src = read(f);
  const postBodies = src.match(/JSON\.stringify\(\{[\s\S]*?\}\)/g) || [];
  const leaky = postBodies.filter((b) => /operatorEmail|operatorUid/.test(b));
  check(`${f}: no fetch POST body carries operatorEmail/operatorUid (${postBodies.length} body block(s) scanned)`,
    leaky.length === 0,
    leaky.length ? `leaky body: ${leaky[0].slice(0, 80)}…` : undefined);
}

console.log("");
if (failures === 0) {
  console.log("🏁 PROBE GREEN — operator identity is bearer-derived in source; clients strip the fields; body-first pattern removed.");
  process.exit(0);
} else {
  console.log(`❌ PROBE RED — ${failures} assertion(s) failed.`);
  process.exit(1);
}
