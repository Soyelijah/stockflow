export interface PaymentAuditSummary {
  id: string;
  total: number;
}

/** Strict allowlist for payment logs: never include payer data or provider payloads. */
export function paymentAuditSummary(id: unknown, total: unknown): PaymentAuditSummary {
  const normalizedTotal = Number(total);
  if (!Number.isSafeInteger(normalizedTotal) || normalizedTotal < 0) {
    throw new Error("Invalid CLP total in payment audit data.");
  }
  return {
    id: typeof id === "string" || typeof id === "number" ? String(id) : "unknown",
    total: normalizedTotal,
  };
}

export function flowConfirmationAuditSummary(statusData: {
  commerceOrder?: unknown;
  amount?: unknown;
}): PaymentAuditSummary {
  return paymentAuditSummary(statusData.commerceOrder, statusData.amount);
}
