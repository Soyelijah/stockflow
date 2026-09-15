import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateStocksByBranch,
  finalizeAggregatedStocks,
  resolveAggregatedStock,
} from "../src/lib/stockAggregation";

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

describe("aggregateStocksByBranch", () => {
  it("distinguishes an existing zero document from an absent legacy document", async () => {
    const readings = new Map([
      ["sold-out:north", { exists: true, stock: 0 }],
      ["sold-out:south", { exists: true, stock: 0 }],
      ["legacy:north", { exists: false }],
      ["legacy:south", { exists: false }],
    ]);

    const result = await aggregateStocksByBranch(
      ["sold-out", "legacy"],
      ["north", "south"],
      new Map([["sold-out", 50], ["legacy", 8]]),
      async (productId, branchId) => readings.get(`${productId}:${branchId}`) ?? { exists: false },
    );

    assert.deepEqual(Object.fromEntries(result), { "sold-out": 0, legacy: 8 });
  });

  it("sums stock across branches", async () => {
    const result = await aggregateStocksByBranch(
      ["coffee"],
      ["north", "south"],
      new Map([["coffee", 99]]),
      async (_productId, branchId) => ({ exists: true, stock: branchId === "north" ? 3 : 4 }),
    );

    assert.equal(result.get("coffee"), 7);
  });

  it("rejects instead of returning a partial total when any read fails", async () => {
    await assert.rejects(
      aggregateStocksByBranch(
        ["coffee"],
        ["north", "south"],
        new Map(),
        async (_productId, branchId) => {
          if (branchId === "south") throw new Error("Firestore unavailable");
          return { exists: true, stock: 3 };
        },
      ),
      /Firestore unavailable/,
    );
  });
});
