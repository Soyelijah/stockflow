/**
 * Unit tests for the Chilean RUT validation library.
 * Run with: pnpm --prefix mcps/chile-rut-mcp test
 *
 * No test framework. Each test is a single assertion with an exit code.
 */

import { calculateDv, formatRut, normalizeRut, validateRut } from "../src/rut.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function expect<T>(actual: T, expected: T, name: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    failures.push(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

function expectThrows(fn: () => unknown, name: string) {
  try {
    fn();
    failed++;
    failures.push(`  ✗ ${name} — expected throw, did not throw`);
  } catch {
    passed++;
  }
}

// ===== calculateDv =====
// All expected values computed by hand using módulo 11 against the canonical algorithm.
expect(calculateDv("11111111"), "1", "calculateDv: 11111111 → 1");
expect(calculateDv("12345678"), "5", "calculateDv: 12345678 → 5");
expect(calculateDv("22222222"), "2", "calculateDv: 22222222 → 2");
expect(calculateDv("12345670"), "K", "calculateDv: 12345670 → K (canonical K case)");
expect(calculateDv("31"), "0", "calculateDv: 31 → 0 (canonical 0 case — sum is exactly 11)");
expect(calculateDv("1"), "9", "calculateDv: 1 → 9 (single-digit body)");
expect(calculateDv("76086428"), "5", "calculateDv: real-world example 76086428 → 5");
expectThrows(() => calculateDv(""), "calculateDv: throws on empty");
expectThrows(() => calculateDv("abc"), "calculateDv: throws on non-digit");
expectThrows(() => calculateDv("123456789"), "calculateDv: throws on >8 digits");

// ===== validateRut — valid cases =====
expect(validateRut("12.345.678-5").valid, true, "validateRut: 12.345.678-5 with dots");
expect(validateRut("12345678-5").valid, true, "validateRut: 12345678-5 without dots");
expect(validateRut("123456785").valid, true, "validateRut: 123456785 bare");
expect(validateRut("12.345.670-K").valid, true, "validateRut: 12.345.670-K with uppercase K");
expect(validateRut("12.345.670-k").valid, true, "validateRut: 12.345.670-k with lowercase k");
expect(validateRut(" 11.111.111-1 ").valid, true, "validateRut: trims whitespace");
expect(validateRut("11111111-1").valid, true, "validateRut: 11.111.111-1 canonical");

// ===== validateRut — invalid cases =====
expect(validateRut("12.345.678-9").valid, false, "validateRut: wrong DV → invalid");
expect(validateRut("12.345.678-9").reason?.includes("esperado: 5"), true, "validateRut: error message says expected DV");
expect(validateRut("").valid, false, "validateRut: empty string");
expect(validateRut("abc").valid, false, "validateRut: garbage");
expect(validateRut("12.345.678-X").valid, false, "validateRut: invalid DV character");
expect(validateRut("12.345.678.901-5").valid, false, "validateRut: too long");

// ===== validateRut — structured output =====
const r1 = validateRut("12.345.678-5");
expect(r1.body, "12345678", "validateRut: extracts body");
expect(r1.dv, "5", "validateRut: extracts dv");
expect(r1.calculatedDv, "5", "validateRut: computes dv");
expect(r1.normalized, "12345678-5", "validateRut: normalized form");
expect(r1.formatted, "12.345.678-5", "validateRut: formatted form");

const rK = validateRut("12345670K");
expect(rK.valid, true, "validateRut: bare with K");
expect(rK.formatted, "12.345.670-K", "validateRut: formatted K");

// ===== formatRut =====
expect(formatRut("12345678", "5"), "12.345.678-5", "formatRut: 8-digit body");
expect(formatRut("9", "9"), "9-9", "formatRut: 1-digit body");
expect(formatRut("123", "K"), "123-K", "formatRut: 3-digit body");
expect(formatRut("1234567", "0"), "1.234.567-0", "formatRut: 7-digit body");

// ===== normalizeRut =====
expect(normalizeRut("12.345.678-5"), "12345678-5", "normalizeRut: strips dots and hyphen");
expect(normalizeRut("12345678-5"), "12345678-5", "normalizeRut: already normalized");
expect(normalizeRut("12.345.670-k"), "12345670-K", "normalizeRut: uppercases K");
expectThrows(() => normalizeRut(""), "normalizeRut: throws on empty");
expectThrows(() => normalizeRut("abc"), "normalizeRut: throws on garbage");

// ===== Summary =====
console.log(`\nchile-rut-mcp tests:`);
console.log(`  ✓ ${passed} passed`);
if (failed > 0) {
  console.log(`  ✗ ${failed} failed:\n`);
  console.log(failures.join("\n"));
  process.exit(1);
} else {
  console.log(`  All passed.\n`);
}
