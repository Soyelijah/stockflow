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
