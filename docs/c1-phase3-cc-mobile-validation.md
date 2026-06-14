# C1 Phase 3 — CC-mobile validation runbook (before the Phase 4 strip)

Phase 3 is fully on `main` (HEAD `6f20b6b`). All privileged readers source cost from
`product_private`; the seller (MobilePOS) reads no cost and writes no `cost`/`profit`.
**The leak is still OPEN** — `/products` still carries `costPrice`/`supplierId` until the
Phase 4 strip. This validation must be GREEN before we run the strip (the point of
partial no-return).

Owner: **CC-mobile** (Xiaomi `UGKNRODMRGQCIZUO`, the real APK enforcement path).

---

## 1. Role read-matrix on `/product_private` (empirical, via the rules)

Run the read-only probe (it only reads — nothing to clean up on pass or fail):

```bash
C1_PROBE_CREDS='{"owner":{"email":"...","password":"..."},
                 "admin":{"email":"admin@stockflow.com","password":"..."},
                 "manager":{"email":"manager@stockflow.com","password":"..."},
                 "logistics":{"email":"logistics@stockflow.com","password":"..."},
                 "seller":{"email":"seller@stockflow.com","password":"..."},
                 "driver":{"email":"driver@stockflow.cl","password":"..."},
                 "customer":{"email":"...","password":"..."}}' \
  pnpm tsx scripts/c1-probe-product-private.ts
```

Expected (the script asserts this and exits non-zero on any mismatch):

| role | `/products` | `/product_private` |
|---|---|---|
| anon | ALLOW | **DENY** |
| customer | ALLOW | **DENY** |
| seller | ALLOW | **DENY** |
| driver | ALLOW | **DENY** |
| logistics | ALLOW | ALLOW |
| admin | ALLOW | ALLOW |
| manager | ALLOW | ALLOW |
| owner | ALLOW | ALLOW |

`anon` is always probed (no sign-in). Roles without creds are SKIPPED and reported —
a skip is NOT a pass; supply the creds to close the matrix. Passwords come from env
only, never the repo, and are never printed.

**The script enforces this as a gate** (exit codes): `0` = complete + matched; `2` =
SECURITY MISMATCH (takes precedence); `3` = INCOMPLETE MATRIX (one or more roles
SKIPPED). A partial run therefore **fails by default** — it does not read as green. Only
set `C1_PROBE_ALLOW_SKIPS=true` for a non-gate exploratory run; **never** for this
pre-strip gate.

**Pass condition for the strip gate:** the script exits `0` with `failures=0` AND
`skipped=0` (full creds supplied, every role matched). Capture the printed table.

---

## 2. Seller MobilePOS — ONLINE sale writes no cost/profit

On the device, signed in as the **seller**:
1. Add 1–2 products to the cart, complete an online sale.
2. Note the `orderId`.
3. Inspect the resulting `/transactions/{orderId}_{productId}` docs (Firebase console
   or an admin read).

**Pass condition:** each line-item doc has `amount`, `quantity`, `productId`, etc., but
**no `cost` key and no `profit` key at all** (absent, not `0`). The absence is what lets
the Dashboard recompute distinguish seller sales.

---

## 3. Seller MobilePOS — OFFLINE sale + sync writes no cost/profit

As the **seller**, with the device offline (airplane mode / no network):
1. Complete a sale offline (it queues).
2. Restore network; let the offline queue sync.
3. Inspect the synced `/transactions/{orderId}_{productId}` docs (source
   `mobile_pos_offline`).

**Pass condition:** same as #2 — `cost`/`profit` keys **absent** (not `0`). Also confirm
stock decremented exactly once (no double-decrement on sync) and loyalty points applied
once.

---

## 4. Dashboard recomputes profit for the cost-less seller sales

Signed in as **admin/owner/manager** (so the private mirror is readable), open the
Dashboard:
1. With the seller sales from #2/#3 in range, check the Utilidad / profit KPI, the
   7-day profit chart, and the category profitability chart.

**Pass condition:** the seller sales contribute a non-zero, sensible margin (recomputed
as `amount − product_private.costPrice × quantity`), not `0`. POS-desktop (source `web`)
sales keep their frozen profit. Cross-check one seller line-item: its recomputed margin
should equal `(price − current product_private.costPrice) × quantity`.

---

## Sign-off

Only when **all four are GREEN** do we proceed to prepare the Phase 4 strip script
(`scripts/migrate-product-private-strip.ts`, dry-run first, precondition: backfill
coverage 100% — currently 4/4). The strip is where the leak finally closes.

Report back the #1 table + the #2/#3 doc shapes (cost/profit absent) + the #4 margin
cross-check. If any cell is RED, do NOT strip — file the mismatch and we fix forward.
