import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requiresEmailVerification, shouldShowEmailVerification } from "../src/lib/authPolicy";

describe("requiresEmailVerification", () => {
  it("blocks unverified accounts including demo-domain users and owners", () => {
    for (const account of [
      { emailVerified: false, email: "demo@stockflow.com", role: "seller" },
      { emailVerified: false, email: "owner@stockflow.com", role: "owner" },
      { emailVerified: false, email: "driver@example.cl", role: "driver" },
      { emailVerified: false, email: "client@example.cl", role: "customer" },
    ]) {
      assert.equal(requiresEmailVerification(account.emailVerified), true, account.email);
    }
  });

  it("allows an account only after Firebase marks its email as verified", () => {
    assert.equal(requiresEmailVerification(true), false);
  });

  it("keeps the public customer portal open only when there is no signed-in account", () => {
    assert.equal(shouldShowEmailVerification(null), false);
    assert.equal(shouldShowEmailVerification({ emailVerified: false }), true);
    assert.equal(shouldShowEmailVerification({ emailVerified: true }), false);
  });
});
