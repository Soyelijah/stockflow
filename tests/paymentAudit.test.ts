import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  flowConfirmationAuditSummary,
  paymentAuditSummary,
} from "../server/services/paymentAudit";

describe("paymentAuditSummary", () => {
  it("returns only the approved payment audit fields", () => {
    const providerPayload = {
      commerceOrder: "order-42",
      amount: 15990,
      payer: "cliente@example.cl",
      payerName: "Persona Privada",
      token: "secret-token",
    };

    const summary = paymentAuditSummary(providerPayload.commerceOrder, providerPayload.amount);

    assert.deepEqual(summary, { id: "order-42", total: 15990 });
    assert.deepEqual(Object.keys(summary).sort(), ["id", "total"]);
    assert.equal(JSON.stringify(summary).includes(providerPayload.payer), false);
    assert.equal(JSON.stringify(summary).includes(providerPayload.token), false);
  });

  it("rejects invalid CLP totals instead of fabricating a zero-value payment", () => {
    assert.throws(
      () => paymentAuditSummary({ payer: "private@example.cl" }, "not-a-number"),
      /Invalid CLP total/,
    );
  });

  it("rejects fractional CLP totals", () => {
    assert.throws(() => paymentAuditSummary(123, 1990.6), /Invalid CLP total/);
  });

  it("does not derive a logged id from the Flow token when commerceOrder is absent", () => {
    const providerPayload = {
      amount: 2500,
      payer: "private@example.cl",
      token: "super-secret-token",
    };
    const summary = flowConfirmationAuditSummary(providerPayload);

    assert.deepEqual(summary, { id: "unknown", total: 2500 });
    assert.equal(JSON.stringify(summary).includes("super-secret-token"), false);
  });
});
