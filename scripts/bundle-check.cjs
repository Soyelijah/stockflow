// Tier 5.B — Bundle isolation check.
//
// Run AFTER `pnpm build:all` to confirm each app's bundle does NOT contain
// symbols/code from the other apps. This is the empirical contract for
// "3 apps, one repo, zero cross-leak."
//
// Usage:
//   pnpm bundle:check
//
// Exits 0 if all assertions pass, exits 1 with a report on first failure.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VARIANTS = [
  {
    name: "staff",
    dir: path.join(ROOT, "dist-staff"),
    // staff IS allowed to contain almost anything (it's the big app).
    // We mostly want to check that it builds + has the entry.
    forbidden: [],
    requiredOne: ["AdminRoutes", "MobilePOS", "Layout"],
  },
  {
    name: "client",
    dir: path.join(ROOT, "dist-client"),
    // Client must NOT contain admin/driver/staff-only security code.
    forbidden: [
      "AdminRoutes",
      "MobilePOS",
      "DeliveryRoutes",
      "DriverPWA",
      "setUserRole",       // Cloud Function name — admin tool surface
      "costPrice",          // CRITICAL: never leak cost prices to customer bundle (CLAUDE.md §6.2)
      "ShrinkageReport",
      "Kardex",
      "RouteGuard",
      "Forbidden",
    ],
    requiredOne: ["CustomerPortal"],
  },
  {
    name: "driver",
    dir: path.join(ROOT, "dist-driver"),
    forbidden: [
      "AdminRoutes",
      "MobilePOS",
      "CustomerPortal",
      "setUserRole",
      "costPrice",
      "ShrinkageReport",
      "RouteGuard",
      "Forbidden",
    ],
    requiredOne: ["DeliveryRoutes"],
  },
];

let totalFailures = 0;

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && (full.endsWith(".js") || full.endsWith(".html"))) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function check(variant) {
  const files = listJsFiles(variant.dir);
  if (files.length === 0) {
    console.error(`❌ [${variant.name}] no build output at ${variant.dir} — run pnpm build:${variant.name}`);
    totalFailures++;
    return;
  }
  const combined = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  console.log(`\n=== [${variant.name}] ${files.length} files, ${(combined.length / 1024).toFixed(1)} KB combined ===`);

  // forbidden symbols → fail on any occurrence in any source map / minified code
  let bundleClean = true;
  for (const symbol of variant.forbidden) {
    const re = new RegExp(`\\b${symbol}\\b`);
    if (re.test(combined)) {
      console.error(`  ❌ FORBIDDEN symbol "${symbol}" found in ${variant.name} bundle`);
      bundleClean = false;
      totalFailures++;
    }
  }
  if (bundleClean) {
    console.log(`  ✅ no forbidden symbols`);
  }

  // requiredOne — at least one of these must be present
  const foundAny = variant.requiredOne.some((s) => new RegExp(`\\b${s}\\b`).test(combined));
  if (!foundAny) {
    console.error(`  ❌ NONE of the required symbols [${variant.requiredOne.join(", ")}] found — bundle may be empty/broken`);
    totalFailures++;
  } else {
    console.log(`  ✅ at least one required symbol present`);
  }

  // sanity: report size
  const bytes = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(`  ℹ️  total bytes: ${(bytes / 1024).toFixed(1)} KB`);
}

console.log("Tier 5.B — bundle isolation check\n");
for (const v of VARIANTS) check(v);

console.log("");
if (totalFailures > 0) {
  console.error(`💥 ${totalFailures} failure(s). See above.`);
  process.exit(1);
}
console.log("🏁 All bundles clean.");
process.exit(0);
