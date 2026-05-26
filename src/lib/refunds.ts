// Tier 2 — Refund / void transaction helpers.
// A "void" reverses a single transaction line (one item of an order). The original
// transaction document is NOT deleted — audit integrity. Instead it's tagged with
// voided=true + a pointer to the corresponding /refunds record.
//
// What the operation does atomically (single runTransaction):
//   1. Reads the original transaction (must exist, must be a "sale", must not be already voided).
//   2. Reads the product + its product_stock for the original branchId.
//   3. Reads the customer (if any) to deduct loyalty points awarded by the sale.
//   4. Writes:
//      - product_stock: stock = current + quantity (return to inventory).
//      - products.stock: same value (dual-write mirror, removed in Tier 1.5).
//      - stockMovements: new "return" entry referencing the original tx.
//      - transactions/{txId}: voided=true, voidedAt, voidedBy, voidReason, refundId.
//      - refunds/{refundId}: full refund record (separate collection for clean audit).
//      - customers/{customerId}: points decrement (if applicable).
//
// Payment reversal (Flow / MP API call) is intentionally NOT part of this transaction —
// it's a side effect of the business decision, requires gateway-specific logic + idempotency,
// and tracks better as a separate workflow. The /refunds record carries paymentReversed: false
// so finance can reconcile manually.

import {
  collection,
  doc,
  DocumentReference,
  runTransaction,
  serverTimestamp,
  Transaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { productStockRef, stockIdFor } from "./productStock";
import { DEFAULT_BRANCH_ID } from "./branches";

export interface VoidTransactionParams {
  // The transaction line to void (one /transactions doc).
  txId: string;
  // Reason text from the operator. Stored on both /transactions and /refunds.
  reason: string;
  // Operator identity for audit. Sourced from the auth profile at the call site.
  operatorUid: string;
  operatorName: string;
}

export interface VoidTransactionResult {
  refundId: string;
  reversedQuantity: number;
  reversedAmount: number;
  branchId: string;
  pointsDeducted: number;
}

export async function voidTransaction(params: VoidTransactionParams): Promise<VoidTransactionResult> {
  if (!params.txId) throw new Error("txId requerido para anular transacción.");
  if (!params.reason || params.reason.trim().length < 4) {
    throw new Error("Debe indicar una razón de al menos 4 caracteres.");
  }
  const reason = params.reason.trim();
  if (reason.length > 500) {
    throw new Error("La razón no puede exceder 500 caracteres.");
  }

  const txRef = doc(db, "transactions", params.txId);
  const refundRef = doc(collection(db, "refunds"));

  return runTransaction(db, async (transaction): Promise<VoidTransactionResult> => {
    // 1. Read the original transaction.
    const txSnap = await transaction.get(txRef);
    if (!txSnap.exists()) {
      throw new Error(`Transacción ${params.txId} no existe.`);
    }
    const txData = txSnap.data();

    if (txData.type !== "sale") {
      throw new Error("Solo se pueden anular transacciones de venta.");
    }
    if (txData.voided === true) {
      throw new Error("Esta transacción ya fue anulada previamente.");
    }

    const productId: string = txData.productId;
    const quantity: number = Number(txData.quantity) || 0;
    const amount: number = Number(txData.amount) || 0;
    const branchId: string = txData.branchId || DEFAULT_BRANCH_ID;
    const customerId: string | null = txData.customerId || null;
    const pointsAwarded: number = Number(txData.pointsAwarded) || 0;

    if (!productId || quantity <= 0) {
      throw new Error("Transacción sin productId o cantidad inválida.");
    }

    // 2. Read product + per-branch stock so we can compute the new stock value.
    const productRef = doc(db, "products", productId);
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error(`Producto ${productId} ya no existe — no se puede reversar stock.`);
    }
    const stockRef = productStockRef(productId, branchId);
    const stockSnap = await transaction.get(stockRef);

    let previousStock: number;
    let isLegacyStock = false;
    if (stockSnap.exists()) {
      previousStock = Number(stockSnap.data()?.stock) || 0;
    } else {
      // Legacy: no product_stock doc yet (pre-Tier-1.1 migration straggler).
      previousStock = Number(productSnap.data()?.stock) || 0;
      isLegacyStock = true;
    }
    const newStock = previousStock + quantity;

    // 3. Read customer (only if there's a customer + points to refund).
    let customerRef: DocumentReference | null = null;
    let customerCurrentPoints = 0;
    if (customerId && pointsAwarded > 0) {
      customerRef = doc(db, "customers", customerId);
      const custSnap = await transaction.get(customerRef);
      if (custSnap.exists()) {
        customerCurrentPoints = Number(custSnap.data()?.points) || 0;
      }
    }

    // 4. Writes (all reads are done — Firestore rule).

    // 4a. product_stock — return the units.
    if (isLegacyStock) {
      transaction.set(stockRef, {
        productId,
        branchId,
        stock: newStock,
        lastUpdated: serverTimestamp(),
      });
    } else {
      transaction.update(stockRef, {
        stock: newStock,
        lastUpdated: serverTimestamp(),
      });
    }

    // 4b. products.stock dual-write (deprecated mirror — Tier 1.5 drops this).
    transaction.update(productRef, {
      stock: newStock,
      updatedAt: serverTimestamp(),
    });

    // 4c. stockMovements — append-only reverse entry. Type "return" so reports can
    //     distinguish reversals from organic purchases.
    const moveRef = doc(collection(db, "stockMovements"));
    transaction.set(moveRef, {
      productId,
      productName: txData.productName || "Producto",
      type: "return",
      quantity,
      previousStock,
      newStock,
      reason: `Anulación venta ${params.txId}: ${reason}`,
      reference: params.txId,
      userId: params.operatorUid,
      userName: params.operatorName,
      branchId,
      source: "refund",
      timestamp: serverTimestamp(),
    });

    // 4d. refunds — full record (separate collection for audit + queryability).
    transaction.set(refundRef, {
      originalTransactionId: params.txId,
      originalOrderId: txData.orderId || params.txId,
      productId,
      productName: txData.productName || "Producto",
      quantity,
      amount,
      branchId,
      customerId,
      customerName: txData.customerName || null,
      pointsDeducted: pointsAwarded > 0 ? pointsAwarded : 0,
      paymentReversed: false,  // Manual reconciliation flag for Flow/MP refunds.
      reason,
      refundedBy: params.operatorUid,
      refundedByName: params.operatorName,
      refundedAt: serverTimestamp(),
    });

    // 4e. transactions — mark voided + back-reference to refund record.
    transaction.update(txRef, {
      voided: true,
      voidedAt: serverTimestamp(),
      voidedBy: params.operatorUid,
      voidReason: reason,
      refundId: refundRef.id,
    });

    // 4f. customer — deduct points if applicable. Clamp at 0 (never negative balance).
    let actuallyDeducted = 0;
    if (customerRef && pointsAwarded > 0) {
      actuallyDeducted = Math.min(pointsAwarded, customerCurrentPoints);
      transaction.update(customerRef, {
        points: customerCurrentPoints - actuallyDeducted,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      refundId: refundRef.id,
      reversedQuantity: quantity,
      reversedAmount: amount,
      branchId,
      pointsDeducted: actuallyDeducted,
    };
  });
}
