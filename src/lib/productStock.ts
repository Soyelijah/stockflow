// Multi-branch (Tier 1.1) — per-branch stock helpers.
// /product_stock/{productId}_{branchId} is the authoritative source of inventory
// per branch. /products/{productId} keeps its `stock` field as a deprecated mirror
// during the transition window (dual-write) so legacy code paths continue to work.
//
// Removal of the dual-write happens in Tier 1.5 cleanup once every read site is
// migrated and confirmed.

import {
  doc,
  DocumentReference,
  getDoc,
  serverTimestamp,
  Transaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_BRANCH_ID } from "./branches";
import { finalizeAggregatedStocks } from "./stockAggregation";

export interface ProductStock {
  productId: string;
  branchId: string;
  stock: number;
  lastUpdated?: any;
}

// Deterministic doc id so single-read lookup is possible: `${productId}_${branchId}`.
// Sanitizes branchId for the "*" cross-branch sentinel — that sentinel should NEVER
// reach product_stock (stock is always concrete-branch-scoped). Throw if it does.
export function stockIdFor(productId: string, branchId: string): string {
  if (branchId === "*") {
    throw new Error("Cannot scope product_stock to the cross-branch sentinel '*'. Pick a concrete branchId.");
  }
  if (!productId || !branchId) {
    throw new Error(`Invalid stockId components: productId=${productId} branchId=${branchId}`);
  }
  return `${productId}_${branchId}`;
}

export function productStockRef(productId: string, branchId: string): DocumentReference {
  return doc(db, "product_stock", stockIdFor(productId, branchId));
}

// =====================================================================
// In-transaction helpers (for runTransaction in POS / MobilePOS / FlowResult)
// =====================================================================

export interface ReadStockInTxResult {
  productSnap: any;
  productRef: DocumentReference;
  stockRef: DocumentReference;
  currentStock: number;
  isLegacyStock: boolean; // true if /product_stock doc does NOT exist yet — fell back to products.stock
}

// Within a runTransaction, reads BOTH the product doc and its per-branch stock doc.
// Returns the authoritative current stock for (productId, branchId) plus the refs
// needed to write back. If the product_stock doc doesn't exist, falls back to the
// legacy products.stock field — caller will create the product_stock doc on write.
//
// IMPORTANT: this MUST be called BEFORE any writes in the same transaction
// (Firestore rule: all reads must precede all writes).
export async function readProductAndStockInTx(
  transaction: Transaction,
  productId: string,
  branchId: string,
): Promise<ReadStockInTxResult> {
  const productRef = doc(db, "products", productId);
  const productSnap = await transaction.get(productRef);
  if (!productSnap.exists()) {
    throw new Error(`Producto ${productId} no existe en el catálogo.`);
  }

  const stockRef = productStockRef(productId, branchId);
  const stockSnap = await transaction.get(stockRef);

  if (stockSnap.exists()) {
    return {
      productSnap,
      productRef,
      stockRef,
      currentStock: Number(stockSnap.data()?.stock) || 0,
      isLegacyStock: false,
    };
  }

  // Legacy fallback: a product that existed before Tier 1.1 migration ran.
  // We'll create the product_stock doc on write.
  return {
    productSnap,
    productRef,
    stockRef,
    currentStock: Number(productSnap.data()?.stock) || 0,
    isLegacyStock: true,
  };
}

// Within a runTransaction, writes the new stock to BOTH /product_stock and /products.
// During the transition window we dual-write so legacy readers (and rollback safety)
// continue to see the right value on /products.stock. Tier 1.5 will remove the dual-write.
export function writeStockInTx(
  transaction: Transaction,
  params: {
    productId: string;
    branchId: string;
    newStock: number;
    productRef: DocumentReference;
    stockRef: DocumentReference;
    isLegacyStock: boolean;
  }
): void {
  if (params.isLegacyStock) {
    // First-time creation of the per-branch stock doc for this product.
    transaction.set(params.stockRef, {
      productId: params.productId,
      branchId: params.branchId,
      stock: params.newStock,
      lastUpdated: serverTimestamp(),
    });
  } else {
    transaction.update(params.stockRef, {
      stock: params.newStock,
      lastUpdated: serverTimestamp(),
    });
  }

  // Dual-write mirror to /products.stock — removed in Tier 1.5 cleanup.
  transaction.update(params.productRef, {
    stock: params.newStock,
    updatedAt: serverTimestamp(),
  });
}

// =====================================================================
// Non-transaction helpers (for Inventory / CustomerPortal display)
// =====================================================================

// Single-product read. Used by detail views.
// `fallbackStock` is the products.stock value from a caller's listener for legacy products.
export async function getStockForBranch(
  productId: string,
  branchId: string,
  fallbackStock?: number
): Promise<{ stock: number; isLegacy: boolean }> {
  if (branchId === "*") {
    throw new Error("getStockForBranch cannot be called with '*'. Use batchStockForBranches for aggregation.");
  }
  try {
    const snap = await getDoc(productStockRef(productId, branchId));
    if (snap.exists()) {
      return { stock: Number(snap.data()?.stock) || 0, isLegacy: false };
    }
  } catch (err) {
    console.warn(`[productStock] read failed for ${productId}@${branchId}:`, err);
  }
  return { stock: fallbackStock ?? 0, isLegacy: true };
}

// Batch read across multiple products for one branch. Used by Inventory / catalog listings.
// `fallbacks` is a Map<productId, products.stock> from a caller's already-fetched product list.
// Returns Map<productId, stockForBranch>.
//
// For products without a /product_stock doc yet, returns the fallback (legacy products.stock).
// This means: pre-migration data renders correctly even if migrate-products-split-stock
// hasn't run yet. Once migrated, the authoritative value comes from /product_stock.
export async function batchStockForBranch(
  productIds: string[],
  branchId: string,
  fallbacks: Map<string, number>
): Promise<Map<string, number>> {
  if (branchId === "*") {
    throw new Error("batchStockForBranch with '*' is not supported. Use batchStockAggregated for aggregation.");
  }
  const result = new Map<string, number>();
  if (productIds.length === 0) return result;

  const reads = productIds.map(async (id) => {
    try {
      const snap = await getDoc(productStockRef(id, branchId));
      if (snap.exists()) {
        result.set(id, Number(snap.data()?.stock) || 0);
      } else {
        result.set(id, fallbacks.get(id) ?? 0);
      }
    } catch (err) {
      console.warn(`[productStock] batch read failed for ${id}@${branchId}:`, err);
      result.set(id, fallbacks.get(id) ?? 0);
    }
  });
  await Promise.all(reads);
  return result;
}

// Aggregated stock across ALL branches for cross-branch users.
// Used in Dashboard / Inventory when selectedBranchId === "*".
// Strategy: read every requested product/branch pair and sum the documents that exist.
// Implementation uses a per-branch fanout (one read per branch+product), which is
// acceptable while branch count is ≤ ~10. If branch count grows, swap to a `collectionGroup`
// query or a denormalized aggregate field on the product.
export async function batchStockAggregated(
  productIds: string[],
  branchIds: string[],
  fallbacks: Map<string, number>
): Promise<Map<string, number>> {
  if (branchIds.length === 0 || branchIds.includes("*")) {
    throw new Error("batchStockAggregated requires concrete branchIds (no '*').");
  }
  const result = new Map<string, number>();
  const productsWithBranchStock = new Set<string>();
  if (productIds.length === 0) return result;

  for (const id of productIds) {
    result.set(id, 0);
  }

  const reads: Promise<void>[] = [];
  for (const branchId of branchIds) {
    for (const productId of productIds) {
      reads.push(
        (async () => {
          try {
            const snap = await getDoc(productStockRef(productId, branchId));
            if (snap.exists()) {
              productsWithBranchStock.add(productId);
              const branchStock = Number(snap.data()?.stock) || 0;
              result.set(productId, (result.get(productId) || 0) + branchStock);
            }
          } catch (err) {
            // Never present a partial aggregate as authoritative inventory.
            throw new Error(`No se pudo leer el stock de ${productId} en ${branchId}.`, { cause: err });
          }
        })()
      );
    }
  }
  await Promise.all(reads);

  // Fall back only when no branch document exists. A real aggregate of zero is
  // authoritative and must not be replaced by a stale positive products.stock mirror.
  return finalizeAggregatedStocks(productIds, result, productsWithBranchStock, fallbacks);
}

// Resolve the branchId to use for stock operations given a selectedBranchId from BranchContext.
// If "*" (cross-branch user with "all branches" filter), default to "default" branch — operations
// on a specific stock doc require a concrete branch. UI should typically prompt the user to pick
// a branch before allowing a stock-mutating action.
export function resolveBranchIdForStockOp(selectedBranchId: string | null | undefined): string {
  if (!selectedBranchId || selectedBranchId === "*") return DEFAULT_BRANCH_ID;
  return selectedBranchId;
}
