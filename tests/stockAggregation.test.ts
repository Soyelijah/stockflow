import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { finalizeAggregatedStocks, resolveAggregatedStock } from "../src/lib/stockAggregation";

describe("resolveAggregatedStock", () => {
  it("preserves an authoritative zero when a branch stock document exists", () => {
    assert.equal(resolveAggregatedStock(0, true, 12), 0);
  });

  it("uses the legacy mirror only when no branch stock document exists", () => {
    assert.equal(resolveAggregatedStock(0, false, 12), 12);
  });

  it("keeps the sum of existing branch stock documents", () => {
    assert.equal(resolveAggregatedStock(7, true, 99), 7);
  });

  it("defaults missing legacy stock to zero", () => {
    assert.equal(resolveAggregatedStock(0, false), 0);
  });

  it("finalizes mixed migrated and legacy products without reviving stale zero stock", () => {
    const result = finalizeAggregatedStocks(
      ["sold-out", "legacy", "available"],
      new Map([["sold-out", 0], ["available", 7]]),
      new Set(["sold-out", "available"]),
      new Map([["sold-out", 12], ["legacy", 4], ["available", 99]]),
    );

    assert.deepEqual(Object.fromEntries(result), {
      "sold-out": 0,
      legacy: 4,
      available: 7,
    });
  });
});
