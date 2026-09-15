/**
 * Resolves the stock displayed to cross-branch users after branch reads finish.
 *
 * A legacy fallback is valid only when no per-branch stock document exists. An
 * observed total of zero is authoritative and must not resurrect stale stock
 * from the deprecated `products.stock` mirror.
 */
export function resolveAggregatedStock(
  aggregatedStock: number,
  hasBranchStock: boolean,
  legacyFallback?: number,
): number {
  return hasBranchStock ? aggregatedStock : (legacyFallback ?? 0);
}

export function finalizeAggregatedStocks(
  productIds: string[],
  aggregatedStocks: ReadonlyMap<string, number>,
  productsWithBranchStock: ReadonlySet<string>,
  legacyFallbacks: ReadonlyMap<string, number>,
): Map<string, number> {
  return new Map(
    productIds.map((productId) => [
      productId,
      resolveAggregatedStock(
        aggregatedStocks.get(productId) ?? 0,
        productsWithBranchStock.has(productId),
        legacyFallbacks.get(productId),
      ),
    ]),
  );
}

export type BranchStockReading = { exists: boolean; stock?: unknown };
export type BranchStockReader = (
  productId: string,
  branchId: string,
) => Promise<BranchStockReading>;

/** Aggregates all requested pairs or rejects; partial inventory is never returned. */
export async function aggregateStocksByBranch(
  productIds: string[],
  branchIds: string[],
  legacyFallbacks: ReadonlyMap<string, number>,
  readStock: BranchStockReader,
): Promise<Map<string, number>> {
  const totals = new Map(productIds.map((productId) => [productId, 0]));
  const migratedProducts = new Set<string>();

  await Promise.all(branchIds.flatMap((branchId) => productIds.map(async (productId) => {
    const reading = await readStock(productId, branchId);
    if (!reading.exists) return;

    migratedProducts.add(productId);
    const stock = Number(reading.stock);
    totals.set(productId, (totals.get(productId) ?? 0) + (Number.isFinite(stock) ? stock : 0));
  })));

  return finalizeAggregatedStocks(productIds, totals, migratedProducts, legacyFallbacks);
}
