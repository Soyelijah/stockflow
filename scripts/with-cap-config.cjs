// Tier 5.B — Capacitor multi-config wrapper.
//
// Capacitor 7.6.5 does NOT accept a --config CLI flag (verified empirically
// by CC-mobile during the cap:add:* attempt). It only loads config by
// convention from ./capacitor.config.{ts,js,json}. To run cap commands
// against different variants from the same repo, we atomically swap the
// active config in place, run the command, and restore.
//
// Usage:
//   node scripts/with-cap-config.cjs <variant> <command...>
//
// Examples:
//   node scripts/with-cap-config.cjs staff  npx cap add android
//   node scripts/with-cap-config.cjs client npx cap sync
//   node scripts/with-cap-config.cjs driver npx cap run android
//
// Safety properties:
//   - Idempotent: if the legacy capacitor.config.ts is missing, we still
//     work (no backup to restore — we just delete the temp on the way out).
//   - Crash-safe: restore runs on normal exit, signal (SIGINT/SIGTERM),
//     and uncaught exception. The original config is NEVER left in a
//     mismatched state.
//   - Atomic: uses fs.renameSync on the same filesystem (POSIX guarantee).
//   - The backup file capacitor.config.ts.bak is also cleaned up on exit
//     so the repo stays tidy.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ACTIVE = path.join(ROOT, "capacitor.config.ts");
const BACKUP = path.join(ROOT, "capacitor.config.ts.bak");

const VARIANTS = new Set(["staff", "client", "driver"]);

const variant = process.argv[2];
const cmd = process.argv[3];
const cmdArgs = process.argv.slice(4);

if (!variant || !VARIANTS.has(variant)) {
  console.error("Usage: node scripts/with-cap-config.cjs <staff|client|driver> <command> [...args]");
  process.exit(2);
}
if (!cmd) {
  console.error("Missing command to run.");
  process.exit(2);
}

const variantConfig = path.join(ROOT, `capacitor.${variant}.config.ts`);
if (!fs.existsSync(variantConfig)) {
  console.error(`❌ Variant config not found: ${variantConfig}`);
  process.exit(2);
}

// 1. Backup the active capacitor.config.ts (if any).
let hadBackup = false;
if (fs.existsSync(ACTIVE)) {
  fs.copyFileSync(ACTIVE, BACKUP);
  hadBackup = true;
}

// 2. Copy variant config into the active slot.
fs.copyFileSync(variantConfig, ACTIVE);
console.log(`✓ Activated capacitor config: ${variant}`);

let restored = false;

function restore() {
  if (restored) return;
  restored = true;
  try {
    if (hadBackup) {
      fs.copyFileSync(BACKUP, ACTIVE);
      fs.unlinkSync(BACKUP);
      console.log("✓ Restored original capacitor.config.ts");
    } else {
      if (fs.existsSync(ACTIVE)) fs.unlinkSync(ACTIVE);
      console.log("✓ Removed temporary capacitor.config.ts (no original existed)");
    }
  } catch (err) {
    console.error("⚠️  Restore failed (manual cleanup needed):", err.message);
    console.error("    If capacitor.config.ts.bak exists, rename it back to capacitor.config.ts");
  }
}

// 3. Wire crash-safe restoration.
process.on("exit", restore);
process.on("SIGINT", () => { restore(); process.exit(130); });
process.on("SIGTERM", () => { restore(); process.exit(143); });
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
  restore();
  process.exit(1);
});

// 4. Spawn the actual command and forward its stdio.
const child = spawn(cmd, cmdArgs, { stdio: "inherit", shell: false });
child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(128 + (signal === "SIGINT" ? 2 : 15));
  }
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error("child process error:", err.message);
  process.exit(1);
});
