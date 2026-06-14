# C1 Phase 3 — CC-mobile validation runbook (before the Phase 4 strip)

Phase 3 is fully on `main` (HEAD `6f20b6b`). All privileged readers source cost from
`product_private`; the seller (MobilePOS) reads no cost and writes no `cost`/`profit`.
**The leak is still OPEN** — `/products` still carries `costPrice`/`supplierId` until the
Phase 4 strip. This validation must be GREEN before we run the strip (the point of
partial no-return).

Owner: **CC-mobile** (Xiaomi `UGKNRODMRGQCIZUO`, the real APK enforcement path).

---

## 1. Role read-matrix on `/product_private` (empirical, via the rules)

### Test accounts — use DEDICATED THROWAWAYS, never real users

The real claim-holders are real people's accounts (the owner is the CEO's personal
account; manager/logistics/seller are real team members). **Do NOT use or reset real
users' passwords, and do NOT log in as a real seller to make test sales** (it pollutes
real transactions, stock and loyalty points).

Instead, create one disposable account per role via the Admin SDK, emails
`c1gate-<role>-<timestamp>@stockflow.test` (the timestamp avoids reusing a stale id),
strong known passwords (env/local only — never logged, never in the repo).

Each test user needs THREE things (verified against the real code — a custom claim alone
is NOT enough for the staff app):

1. **Firebase Auth user** (the account).
2. **Custom claims `{ role, branchId }`** — `setCustomUserClaims(uid, { role, branchId })`.
   `branchId` per `defaultBranchForRole` (src/lib/branches.ts:43): `owner`/`admin`/
   `logistics` → `"*"` (cross-branch); `manager`/`seller`/`driver`/`customer` → `"default"`.
3. **`/users/{uid}` mirror doc** for every STAFF role (owner/admin/manager/logistics/
   seller/driver), fields `{ uid, role, branchId, email, name, createdAt }`. This is
   REQUIRED and the **`uid` field is mandatory**: AuthContext (src/contexts/AuthContext.tsx)
   sets `profile = null` when a staff claim is present but `/users/{uid}` is missing
   (≈L128-132), AND on the happy path it does `profile = docSnap.data()` WITHOUT injecting
   `authUser.uid` (≈L136/146) — it trusts the doc's own `uid` field. Omit `uid` and
   `profile.uid` is `undefined`, so an online MobilePOS sale writes `userId: undefined`
   (MobilePOS.tsx:873) and Firestore rejects the write with a generic (NOT
   permission-denied) error. `customer` does not need the mirror unless the customer app
   demands it.

The CHECK 1 probe authenticates and reads Firestore directly (it bypasses AuthContext),
so for the probe the **claim alone** is what the rules evaluate — the `/users` mirror is
only needed for the CHECKS 2–4 app logins (seller in MobilePOS, admin/owner in Dashboard).
The CHECKS 2–4 test sale must use a DISPOSABLE test product (don't decrement real stock).

> ⚠️ **Mandatory teardown.** A throwaway `owner`/`admin` with a known password is a real
> privilege grant. After validation, DELETE all c1gate-* accounts (and their claims +
> mirror docs + any test product/transactions), then re-run the probe to confirm they no
> longer authenticate. Report the teardown as part of the sign-off. Leaving them is a
> backdoor.

Run the read-only probe with the throwaway creds (it only reads — nothing to clean up on
the probe's pass/fail path; teardown above is about the accounts you created):

```bash
C1_PROBE_CREDS='{"owner":{"email":"c1gate-owner@stockflow.test","password":"..."},
                 "admin":{"email":"c1gate-admin@stockflow.test","password":"..."},
                 "manager":{"email":"c1gate-manager@stockflow.test","password":"..."},
                 "logistics":{"email":"c1gate-logistics@stockflow.test","password":"..."},
                 "seller":{"email":"c1gate-seller@stockflow.test","password":"..."},
                 "driver":{"email":"c1gate-driver@stockflow.test","password":"..."},
                 "customer":{"email":"c1gate-customer@stockflow.test","password":"..."}}' \
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
