// Tier 5.B post-build helper.
//
// Vite preserves the entry HTML filename in its output. With our per-variant
// entries (index-staff.html, index-client.html, index-driver.html), the
// dist-*/ folders contain e.g. dist-staff/index-staff.html. But Capacitor
// expects dist-staff/index.html as the root document to copy into the
// android-staff/app/src/main/assets/public/ tree.
//
// Rather than introduce a custom rollup plugin (Opción B in CC-mobile's
// report), we keep the build pipeline boring: after `vite build`, we copy
// the variant-named HTML to plain index.html. The original is preserved
// for debugging and so bundle-check can still inspect either filename.
//
// Usage:
//   node scripts/postbuild-rename-html.cjs <staff|client|driver>

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const variant = process.argv[2];

if (!variant || !["staff", "client", "driver"].includes(variant)) {
  console.error("Usage: node scripts/postbuild-rename-html.cjs <staff|client|driver>");
  process.exit(2);
}

const src = path.join(ROOT, `dist-${variant}`, `index-${variant}.html`);
const dst = path.join(ROOT, `dist-${variant}`, "index.html");

if (!fs.existsSync(src)) {
  console.error(`❌ Source not found: ${src}`);
  console.error(`   Did you run \`pnpm build:${variant}\` first?`);
  process.exit(1);
}

fs.copyFileSync(src, dst);
console.log(`✓ Copied dist-${variant}/index-${variant}.html → dist-${variant}/index.html (for Capacitor)`);
