# StockFlow — Claude Code Operating Manual

> Multi-role retail inventory + POS + delivery platform for the Chilean market.
> Built with React 19 + Vite 6 + Firebase + Express + Flow.cl + MercadoPago.
> This document is the source of truth for any AI agent contributing to the codebase.

---

## 1. Product Context

| Field | Value |
|---|---|
| **Industry** | Retail — small-to-medium businesses |
| **Market** | Chile (Spanish neutral chileno) |
| **Currency** | CLP — **integer-only, no decimals** |
| **Payment rails** | Flow.cl (HMAC-SHA256) + MercadoPago Chile (x-signature HMAC) |
| **Auth** | Firebase Auth + Custom Claims (`role`) — via `setUserRole` Cloud Function |
| **Maps** | `@vis.gl/react-google-maps` (delivery routing) |
| **AI** | Gemini 2.5 Flash via `@google/genai` — **server-side only** |

## 2. Stack (exact versions)

```
React 19.0.1     Vite 6.2.3      TypeScript ~5.8 strict
Tailwind CSS 4.1.14 (with @source restrictions to src/ + index.html)
Firebase 12.13.0 (client SDK)    firebase-admin 13.10.0 (server)
Express 4.21.2 + express-rate-limit 8.5.2 + cors 2.8.6
react-router-dom 7.15.1 (with React.lazy + Suspense for code-splitting)
motion 12.23.24 (animations)     lucide-react 0.546.0 (icons)
recharts 3.8.1 (dashboards)      html5-qrcode 2.3.8 (barcode)
mercadopago 2.12.1 + pdfkit 0.18.0 (server-side receipts)
Package manager: pnpm ONLY — see §11 anti-patterns
```

## 3. Repository layout

```
src/
  apps/
    admin/routes.tsx       → Routes for owner/admin/manager/seller/logistics/inventory_manager
    store/routes.tsx       → Public customer portal (/cliente)
    delivery/routes.tsx    → Driver/delivery interactive map
  shared/components/       → SINGLE canonical home for all UI components
    ui/                    → Primitives (BarcodeScanner, ModernAlert, etc.)
  contexts/                → AuthContext, SettingsContext
  lib/
    roles.ts               → 6-role tuple + helpers (isOwner, isAdmin, isAdminOrManager, isLogistics, isSeller)
    coupons.ts             → Seed data
    firebase.ts            → Client SDK init
  services/aiService.ts    → Client wrapper for /api/ai/insights (Bearer auth)
  App.tsx                  → Role-based routing: profile?.role decides which sub-app loads
  main.tsx                 → <BrowserRouter> wrapper

server.ts                  → Bootstrap (131 lines, modular routers)
server/routes/
  barcode.ts               → Barcode lookup endpoints + healthCheck
  payments.ts              → Flow.cl + MercadoPago webhooks + healthCheck
  comms.ts                 → SendGrid/Twilio receipts + healthCheck
  ai.ts                    → /api/ai/insights (Bearer + role check + server-side product fetch)
server/services/
  lowStockMonitor.ts       → Background polling for low stock

functions/src/index.ts     → Cloud Functions: setUserRole, onProductStockChange, onClaimResolved

scripts/bootstrap-admin.ts → One-shot owner promotion via Firebase Admin SDK
docs/refactor-multirole.md → Architectural decision record
firestore.rules            → Custom-claims-based security rules
firestore.indexes.json     → Composite indexes for users collection
```

## 4. Commands

```bash
pnpm install                                  # ONLY pnpm — never npm/yarn
pnpm dev                                       # tsx server.ts (Vite middleware mode)
pnpm build                                     # Vite + esbuild → dist/server.cjs
pnpm lint                                      # tsc --noEmit (0 errors required)
pnpm --prefix functions build                  # Cloud Functions tsc
pnpm tsx scripts/bootstrap-admin.ts <email>    # Promote first owner (one-time)
```

## 5. Canonical roles (single source of truth: `src/lib/roles.ts`)

```ts
const ROLES = ["owner", "admin", "manager", "seller", "logistics", "driver"] as const;
```

| Role | Capabilities |
|---|---|
| `owner` | Super-admin. Assigns other owners. Sees everything in sidebar. |
| `admin` | Full operational access except owner-assignment. |
| `manager` | Same as admin minus user-management. |
| `seller` | Forced to MobilePOS view. No desktop layout. |
| `logistics` | Inventory + Logistics + Suppliers + Kardex. |
| `driver` | Routed to DeliveryRoutes (interactive map). |

**Use the helpers, never compare strings inline:**
```ts
import { isOwner, isAdmin, isAdminOrManager, isLogistics, isSeller } from "@/src/lib/roles";
```

Role storage: **Firebase Custom Claim `role`** is authoritative. Firestore `/users/{uid}.role` is a mirror for UI display only. Server-side checks (Express routes, Cloud Functions, Firestore rules) MUST read the claim, not the Firestore document.

## 6. Critical security patterns (non-negotiable)

### 6.1 Custom Claims — never email-based privilege

NEVER write `if (email === "someone@somewhere.com")` for privilege checks. Use:
```ts
// Server (Express / Cloud Functions)
const role = decodedToken.role;
if (!["admin", "owner"].includes(role)) return res.status(403)...

// Client
if (isAdminOrManager(profile?.role)) { ... }
```

Bootstrap the first `owner` via `scripts/bootstrap-admin.ts` — never via hardcoded check. The script uses `setCustomUserClaims(uid, { role: "owner" })` + writes to `role_audit` collection for compliance.

### 6.2 `costPrice` never leaves the server

`/api/ai/insights` reads `products.costPrice` from Firestore Admin **on the server** and uses it for AI analysis only. **NEVER expose `costPrice` in any Firestore listener consumed by non-privileged roles.** If a `Dashboard` or `Inventory` component runs for `seller`, it must not subscribe to a product query that includes `costPrice`.

### 6.3 `runTransaction` for stock decrements

POS sales MUST decrement `products.stock` via `runTransaction`, not `batch.update`. Two concurrent sales of the last unit must result in one success + one "out of stock" error, not negative stock.

### 6.4 Webhook signature verification

| Provider | Verification |
|---|---|
| **Flow.cl** | HMAC-SHA256 over sorted-key query string. Reject if mismatch. |
| **MercadoPago** | `x-signature` header HMAC. `data.id` taken from query string. |

Both webhook handlers MUST be idempotent (use Firestore doc with payment ID as key + `runTransaction` to detect duplicates). Store an audit row per webhook event.

### 6.5 PII in logs — strict allowlist

`/api/send-receipt` and similar endpoints log ONLY `{ id, total }`. NEVER log:
- Customer email, name, phone, RUT, address
- Card numbers, tokens, secrets
- Full webhook payloads (only the redacted summary)

### 6.6 Rate limiting

`/api/ai/insights` is capped at 10 req/min. General `/api/*` at 100 req/min. Never disable rate limit middleware to "debug" — use a separate test account in dev.

### 6.7 CORS

Open in dev (`NODE_ENV !== "production"`), strict origin allowlist in production (`.run.app` Cloud Run domains).

## 7. UI conventions

- **Theme**: dark by default with indigo accent (`indigo-600`). No light-mode toggle yet.
- **Icons**: `lucide-react` ONLY. Do not mix icon libraries.
- **Animations**: `motion/react` (formerly framer-motion). Use `<AnimatePresence>` for page transitions.
- **Spanish copy**: neutral Chilean Spanish. Avoid Mexican or Argentine slang. Currency formatting: `$1.234.567` (CLP integers, dot as thousand separator).
- **Accessibility**: every interactive element needs `aria-label`. Loading states for async ops. Error states for failures. Empty states for empty lists.
- **Mobile**: `seller` role MUST hit `MobilePOS` regardless of viewport. Other roles get responsive layout from `Layout.tsx`.

## 8. TypeScript conventions

- `strict: true` enforced. No `any` without inline justification comment.
- Opaque type for currency: `type CLP = number & { __brand: 'CLP' }`. Helpers in `lib/money.ts` (if/when added). Integer-only arithmetic.
- Path alias: `@/*` → `./*` (configured in `tsconfig.json` and `vite.config.ts`).
- `tsc --noEmit` MUST pass before any commit. Run `pnpm lint`.

## 9. Cloud Functions

3 functions in `functions/src/index.ts` (Node 18 engine):

```
setUserRole              onCall — admin/owner only — whitelist of 6 roles + audit log
onProductStockChange     Firestore trigger — keeps /notifications/{productId} in sync
onClaimResolved          Firestore trigger — writes customer notification on resolved claims
```

Deploy: `firebase deploy --only functions` (out of scope of `pnpm build`).

## 10. Available AI Agents

### Premium stockflow-specific (`.claude/agents/*.md`) — invoke via `@agent-<name>`

| Agent | When to use |
|---|---|
| `stockflow-code-reviewer` | After any non-trivial change. Before opening a PR. Catches race conditions, payment idempotency, cost-price leaks, Spanish copy, a11y, bundle bloat. |
| `firebase-architect` | Designing new collections, custom claims, security boundaries, denormalization tradeoffs, composite indexes, read-cost economics. |
| `firestore-rules-auditor` | Before merging any change touching `firestore.rules`, Firestore reads/writes, custom claims, or role logic. Detects under-/over-permissive rules and rules that explode read costs. |
| `react-component-builder` | Creating a new screen, modal, form, list, card, or reusable UI primitive. Follows the dark+indigo+lucide+motion design system. |
| `payment-integrations-specialist` | Touching server.ts payment routes, webhooks, refunds, money math. Enforces idempotency, signature verification, sandbox/prod separation, audit log. |
| `performance-profiler` | Adding a new screen, list, real-time listener, chart. When dashboard feels slow. When Firestore reads spike. Quantifies findings in reads/day and ms. |
| `playwright-e2e-author` | Adding a new critical flow. After fixing a regression that lacked coverage. Login by role, add product, scan barcode, process sale, place delivery order. |
| `migration-planner` | Schema changes, multi-role app restructure, renaming heavily-referenced symbols, dep major version migrations, anything touching >30 files. Produces idempotent, resumable, rollback-able runbooks. |

### DEE generic kept (`.claude/agents/*_agent.md`) — useful for stockflow

| Agent | When to use |
|---|---|
| `inventory_agent` | Stock level thresholds, reorder point predictions, low-inventory alerts. |
| `routing_agent` | Delivery route optimization with traffic + time windows. |
| `fleet_agent` | Driver schedules, vehicle health, fuel efficiency (when fleet module grows). |
| `pricing_agent` | Dynamic pricing experiments (future — currently static). |
| `notification_agent` | Smart notification routing (low stock, claim resolved, etc.). |
| `recommendation_agent` | Product recommendations for CustomerPortal (future). |
| `seo_agent` | When `CustomerPortal` becomes public-indexable. |
| `compat_agent` | Detecting breaking changes in Cloud Functions API contracts. |
| `docs_agent` | Auto-generating API docs, READMEs, migration guides. |

### DEE generic removed (not applicable to stockflow)

`feed_agent` (no social feed), `moderation_agent` (not a social platform), `dx_agent` (marginal value at current stage).

## 11. Anti-patterns (we hit these — do NOT regress)

1. **Doble escritura `src/components/` + `src/apps/*/pages/`**: any new component goes ONLY in `src/shared/components/`. The legacy `src/components/` is deleted. If you see "restore shims" or "propagate to apps/" in a commit message — it's a regression. The single tree rule is canonical.

2. **Email-hardcoded privileges**: forbidden in `AuthContext.tsx`, `server/routes/ai.ts`, `functions/src/index.ts`, `Layout.tsx`, etc. Use Custom Claims. Bootstrap via `scripts/bootstrap-admin.ts`.

3. **`window.location.pathname` routing**: React Router only. `App.tsx` reads `profile?.role` from context, never `window.location`.

4. **Static imports of route sub-apps**: `AdminRoutes`, `StoreRoutes`, `DeliveryRoutes` MUST be `React.lazy()` with `<Suspense>` fallback. Don't import statically — kills code-splitting.

5. **`npm install` / `package-lock.json`**: forbidden. pnpm only. If you see `package-lock.json` appear, delete it and regenerate `pnpm-lock.yaml`. Mixing lockfiles diverges versions silently.

6. **`serviceAccountKey.json` outside `.gitignore`**: must always be ignored. Verify with `git check-ignore -v serviceAccountKey.json` before any commit.

7. **`firebase-admin` removed from `package.json`**: it's used by `server/routes/ai.ts:23` and `scripts/bootstrap-admin.ts:1`. Removing it breaks production deploys (works locally because `node_modules` survives).

8. **Bundle monolítico**: per-page `React.lazy()` in `apps/admin/routes.tsx` is REQUIRED. The 12 admin pages must each become their own chunk (~100-200 KB).

9. **Tokens/PII in logs**: see §6.5.

10. **Skipping audit on configs in a merge**: when fusionando work from another agent, ALWAYS `git show --stat <commit>` to see ALL files changed, not just the visible refactor. Config files (`.gitignore`, `package.json`, lockfiles, `.claude/`) are where silent regressions hide.

## 12. MCPs configured (`.claude/settings.json`)

10 MCPs, all without API keys by default. Activate with `bash .claude/setup-wizard.sh .`.

| MCP | Purpose | Key env |
|---|---|---|
| `firebase` | Firestore queries, Auth admin, claims inspection | `GOOGLE_APPLICATION_CREDENTIALS` |
| `context7` | Up-to-date docs (Firebase, React 19, Vite 6, Tailwind 4) — prefer over web search for library docs | none |
| `github` | PR/issues/CI inspection | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `sentry` | Production errors | `SENTRY_AUTH_TOKEN` |
| `slack` | Team notifications | `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` |
| `sendgrid` | Receipt email delivery | `SENDGRID_API_KEY` |
| `twilio` | SMS notifications to customers | (none yet) |
| `npm` | Package metadata | none |
| `datadog` | APM (optional) | `DD_API_KEY`, `DD_APP_KEY` |
| `google-analytics` | (optional, if CustomerPortal becomes public) | (none yet) |

**Removed (not applicable to stockflow)**: shopify, stripe, elasticsearch, redis.

## 13. Workflow for AI agents working on this repo

1. **Before any non-trivial change**: read this CLAUDE.md, then read the specific files referenced in §3.
2. **For new features**: invoke `@agent-react-component-builder` (UI), `@agent-firebase-architect` (data), `@agent-payment-integrations-specialist` (money).
3. **Before commit**:
   - `pnpm lint` must pass (0 errors).
   - `pnpm build` must produce code-split chunks, not a single 2MB bundle.
   - `grep -rn "solier.elijah@gmail.com" src/ server/ functions/src/` must return empty.
   - `git status` must NOT list `serviceAccountKey.json` as untracked (means it fell out of `.gitignore`).
4. **Before merging from another agent's branch**:
   - `git show --stat <their-commit>` — read every file touched, not just the obvious ones.
   - Audit `.gitignore`, `package.json`, lockfiles, `.claude/`, `functions/.gitignore` for silent deletions.
5. **After merge**: run `@agent-stockflow-code-reviewer` for second-pass audit.
6. **PR description**: use Spanish for user-facing copy notes, English for technical bullets.

## 14. Audit history (key incidents we learned from)

- **`d29a457`** (2026-05-23): silently deleted `firebase-admin` from `package.json`, removed `serviceAccountKey.json` from `.gitignore`, deleted `pnpm-lock.yaml`, deleted `functions/.gitignore`, deleted 8 premium agents from `.claude/agents/`. Resolved in `9e3a197` + `eb3abea`. **Lesson encoded in §11 anti-pattern 10**.
- **Pre-`4b2114e`** (2026-05-23): email backdoor `solier.elijah@gmail.com` in 4 places + bundle monolítico 2.4 MB + walkthrough.md inaccesible. Resolved by full security pass. **Lesson encoded in §6 + §11 anti-pattern 2**.

---

**This file is the contract.** When in doubt, read it before acting. When it's wrong, update it before the code drifts.
