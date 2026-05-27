# StockFlow Design System

A design system reverse‑engineered from the **StockFlow** codebase — a Chilean retail SaaS that ships three mobile/web apps from one repo: **Staff** (workers — sellers, managers, admins, logistics), **Client** (customers/loyalty), and **Driver** (delivery). This system focuses on the **Staff / Trabajadores** surface that the user asked to redesign in full.

The product is a mobile‑first **POS + inventory + cash‑register + logistics** tool that runs on Android (Capacitor) and the web (Vite + React + Tailwind v4 + Firebase). Everything in the worker app is Spanish‑Chilean (boleta, factura, RUT, sucursal, arqueo, cierre, turno, comisión).

## Sources used to build this system

- **Codebase (read‑only mount):** `stockflow/` — the live monorepo. Worker‑app shell lives at `src/apps/staff/AppShell.tsx`, the main POS screen at `src/shared/components/MobilePOS.tsx` (~2,400 LOC, all worker UI patterns are in there), shared chrome at `src/shared/components/Layout.tsx`, auth at `src/shared/components/Login.tsx`.
- **GitHub:** [Soyelijah/stockflow](https://github.com/Soyelijah/stockflow) — open the repo to explore Cash Register, Inventory, Logistics, Suppliers, Customers, Profile etc. that live behind the same chrome.

> If you have access to either of the above, browse them — every visual decision in this system is taken from real code (no guessing from screenshots).

---

## Index

| File / folder | What's inside |
|---|---|
| `README.md` | This file — overview, content fundamentals, visual foundations, iconography. |
| `SKILL.md` | Agent‑Skills‑compatible entry point. |
| `colors_and_type.css` | Color + type CSS variables and semantic classes. Drop‑in. |
| `assets/` | App icons + key brand marks (Zap lightning logo, app icons). |
| `preview/` | The cards rendered in the Design System tab — read these to see the system at a glance. |
| `ui_kits/worker_mobile/` | High‑fidelity React recreation of the Staff (worker) mobile app — POS, cart, profile/turno, login. |
| `fonts/` | Webfont substitutes documented here (we use Inter from Google Fonts; no local TTFs needed). |

---

## Product context

StockFlow ships **three APKs from one codebase**: each role gets its own bundle and routing, sharing components from `src/shared/`.

| App | Bundle | Roles | What it does |
|---|---|---|---|
| **Sf Staff** (this system's focus) | `dist-staff` | owner, admin, manager, seller, logistics | POS, cash register / shift control, inventory, logistics, kardex, customers/CRM, settings. Sellers are **forced** to the `MobilePOS` view — no sidebar, no desktop chrome. |
| Sf Client | `dist-client` | customer | Self‑service portal, loyalty/points, coupons, online orders. |
| Sf Driver | `dist-driver` | driver | Route lists, delivery map, signature pad. |

The redesign mandate from the user: **rebuild the worker mobile app in full, omitting nothing.** That's the `MobilePOS` flow — Tienda (catalog), Carrito (cart + payment + coupons), Perfil (shift control, sales targets, commissions, cash‑drawer reconciliation).

---

## Content fundamentals

All worker‑facing copy is **Chilean Spanish**, with a tone that's **direct, operational, lightly informal but never cute**. The app talks to a cashier on shift, not a marketing audience.

### Voice
- **Imperative + second‑person formal/implicit:** "Iniciar Turno y Abrir Caja", "Confirmar Arqueo y Cerrar", "Buscar por nombre, SKU o código de barras…". You're telling the cashier what the button does, in command form.
- **Operational vocabulary** — these terms are non‑negotiable and recur everywhere:
  - **Boleta / Factura** (receipt types — boleta = consumer, factura = business)
  - **RUT** (Chilean tax ID — required for factura)
  - **Sucursal** (branch / store location)
  - **Turno** (shift), **Apertura** (open), **Cierre** (close), **Arqueo** (cash count / reconciliation), **Retiro** (cash drop)
  - **Fondo Inicial / Efectivo Inicial** (opening float)
  - **Kardex** (stock movements ledger), **Merma** (shrinkage), **Cuadratura** (reconciliation)
  - **Venta General** (anonymous walk‑in sale)
  - **Cupón**, **Comisión**, **Meta** (sales target)
- **Money:** Chilean pesos, no decimals. `formatCurrency(1500) → "$1.500"`. Period as thousands separator.
- **Microlabels in ALL CAPS** with `tracking-widest`: every section label, every status pill, every metric caption. Lowercase body copy is rare — most text in the UI is either a heading (`font-black`, tight tracking) or an uppercase microlabel.
- **Emoji as functional icons** in alerts and audit logs only — never decorative. Examples seen in code: `💵 Efectivo Registrado`, `💳 Tarjetas`, `🔒 Caja Cerrada`, `🟢 Turno en Curso`, `🎉 ¡Sincronización Exitosa!`, `⚠️` for errors, `✕ Agotado`, `⭐ Efectivo Teórico Esperado`. Don't add new ones; reuse this set.
- **Number / status precision over poetry:** `"Pocas unidades (5)"`, `"Avance Comercial · 42% Completado"`, `"Tasa: 2.5%"`. Numbers are always there.

### Examples lifted directly from code
> "🔒 Caja Cerrada: Para registrar ventas, primero debe iniciar el turno declarando el efectivo inicial en la pestaña Perfil."
> "Lectura NFC correcta. Obteniendo credenciales del chip…"
> "Esta es la app de Trabajadores. Tu cuenta es de cliente. Descarga e instala la app Sf Client para acceder a tus beneficios."
> "Cuadratura fiduciaria de fondos de calle"
> "Buscar por nombre, SKU o código de barras…"

The vibe: a **professional cashier tool that talks like an experienced shift lead** — exact, slightly bureaucratic where it matters (legal/financial language: "normativa PCI‑DSS v4.0", "boleta", "factura", "Tokenización"), and warm only at success moments (`🎉`, confetti on shift open).

---

## Visual foundations

### Color
- **Primary:** Indigo 600 (`#4f46e5`) — every primary action, brand mark background, active tab. Subtle gradients to Indigo 950 (`#1e1b4b`) on hero/banner cards.
- **Neutrals:** Slate. Page background is **`#f8f9fc`** (a custom near‑white slate tint), cards are pure `white`, text is `slate-800/900`, borders are `slate-100`, muted text is `slate-400/500`. The dark surface (login, payment simulation modal) is `slate-900`/`#060608`.
- **Semantic:**
  - `emerald-500/600` — success, "in stock", cash on hand, sync OK.
  - `rose-500` / `red-500` — destructive, "agotado", logout, errors. (`rose` is the brand red, not `red`.)
  - `amber-500` — warnings, low stock, "pending sync", offline queue.
  - `blue-500` — tarjeta (card payment) accents; informational.
  - `purple-500` — customer/CRM accents in search results.
- Every accent is paired with its **`-50` tint as a background** + the **`-200/100` as a border** + the saturated tone as text. Pattern: `bg-emerald-50 border-emerald-100 text-emerald-600`.

### Type
- **Family:** **Inter** (Google Fonts) — weights 400, 500, 600, 700, 800, **900**. Loaded via `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap')`.
- **No serif. No mono for body** — mono (`font-mono`) is used only for IDs, SKUs, transaction numbers, timestamps.
- **`font-black` (900) is the workhorse** for headings, button labels, microcopy. `font-bold` (700) for body. `font-medium` (500) is the lightest weight you'll see in UI; nothing thinner.
- **Microlabels:** `text-[10px]` or `text-[9px]`, `font-black`, `uppercase`, `tracking-widest`. They're everywhere — section captions, status pills, helper text under inputs.
- **Headings on cards:** `text-xs font-black uppercase tracking-widest` (not big H1s — this is mobile, density matters).
- **Number displays:** `font-black tracking-tight` so digits hug.

### Spacing & layout
- **Base unit: 4px (Tailwind default).** Common gaps: `gap-x-2` (8), `gap-x-3` (12), `gap-x-4` (16). Section spacing: `space-y-4` / `space-y-6` inside cards.
- **Page padding:** `p-6` on mobile, `p-8` on desktop. Inside a card: `p-4` or `p-6`.
- **Touch targets** never below 40px — buttons are `h-12` / `h-14` for primary actions, `size-8` for inline icons.
- **Bottom nav** is fixed, `pb-10` for safe‑area on Android. Main content has `pb-32` to clear it.

### Corner radii
A deliberately **chunky‑round** vocabulary, escalating with importance:
- `rounded-lg` (8px) — inline tags, mini swatches.
- `rounded-xl` (12px) — buttons, icon chips, inputs.
- `rounded-2xl` (16px) — cards, product rows, payment‑method tiles.
- `rounded-3xl` (24px) — large CTA blocks, totals card.
- `rounded-[2rem]` / `rounded-[2.2rem]` / `rounded-[2.5rem]` (32–40px) — hero banners, bottom sheets, profile panels.
- `rounded-full` — avatars, pills, badges.

### Shadows
Real and **tinted to the element's color**, not generic black drop shadows.
- Icon chips: `shadow-lg shadow-indigo-200` (primary), `shadow-indigo-100`, `shadow-emerald-950/40` etc.
- Cards: `shadow-sm` (default) → `shadow-xl` (hero) → `shadow-2xl` (modals).
- Phone‑frame mockup on wide displays: `shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)]` for a heavy, lifted look.
- Toasts: `shadow-[0_25px_60px_rgba(0,0,0,0.4)]` on a dark slate body.

### Borders
- `border-slate-100` is the default card border — barely visible, just enough to separate from `#f8f9fc` bg. `border-slate-200` for stronger separation. `border-white/5` on dark surfaces.
- **Selected / active state = colored border + matching `-50` background**, never a fill alone: `bg-indigo-50 border-indigo-200 text-indigo-600`.
- Dashed borders signal **load more / placeholder**: `border-dashed border-indigo-200`.

### Backgrounds
- **Light mode dominates** — `bg-[#f8f9fc]` page, `bg-white` cards, occasional `bg-slate-50` for nested wells.
- **Dark slate** (`bg-slate-900` to `bg-slate-950`, plus `bg-[#060608]` on Login, `bg-[#0b0b0e]` on Login card) appears in three places: (1) Login screen, (2) total/checkout card at the bottom of the cart, (3) payment‑simulation modals (NFC + QR flows). The dark surface signals "this is a moment of focus and trust" — money + security.
- **Gradients are reserved** — used sparingly: `bg-gradient-to-r from-slate-900 to-indigo-950` for the profile/vendor banner, `bg-gradient-to-r from-indigo-500 to-indigo-600` for progress bars. Never bluish‑purple decorative gradients.
- **No background patterns, no illustrations, no full‑bleed photography.** This is a tool, not a marketing surface.

### Animation
- **Library:** `motion/react` (Framer Motion) + `canvas-confetti` for the shift‑open celebration.
- **Entrance:** `initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}}` — short fade + 20px horizontal slide. Tab transitions slide opposite directions.
- **Page transitions** in admin layout: `initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}}` with `duration: 0.2`.
- **Toasts / modals:** `{type:"spring", stiffness:350, damping:26}` for the FCM push toast — a snappy spring, not a soft bounce.
- **Bottom sheets:** `initial={{y:"100%"}} animate={{y:0}}` — slide up from the bottom edge.
- **Custom keyframe:** `animate-soft-bounce` — 1.4s ease‑out‑expo Y‑translate, replaces Tailwind's `animate-bounce` (which the codebase comments call "dated and tacky").
- **Loaders:** `Loader2` icon (Lucide) with `animate-spin`. Connection indicator uses `animate-pulse`.
- **Confetti** fires twice in the worker flow: opening a shift, completing a sale.
- **`prefers-reduced-motion: reduce` is fully respected** — globally clamps duration to 0.01ms.

### Interactive states
- **Hover (desktop):** primary buttons go one step darker (`bg-indigo-600 → hover:bg-indigo-700`), cards stay flat but icons shift hue, nav items get `bg-slate-50`.
- **Active (touch):** `active:scale-95` (or `:scale-[0.98]` for big CTAs) — a tactile press‑down. Used on every button worth tapping.
- **Focus:** `focus:ring-2 ring-indigo-500/30` or `focus:ring-4 ring-indigo-500/10` on inputs — colored translucent rings, no default browser outlines.
- **Disabled:** `bg-slate-100 text-slate-400 cursor-not-allowed shadow-none` — visibly inert, not just dimmed.

### Transparency & blur
- **Backdrop blur** is applied only on full‑screen scrims: `bg-slate-900/40 backdrop-blur-sm` over modals and the mobile drawer.
- **Translucency on dark surfaces:** `bg-white/10`, `bg-white/5`, `border-white/5` for the inner avatar chips on dark banners and login cards.
- **Translucent accent fills:** `bg-rose-500/20`, `bg-indigo-500/15` for soft pills inside dark contexts.

### Iconography baseline
- **Lucide React.** Every icon in the codebase imports from `lucide-react`. Default size 16–20px in normal use, 24px in bottom nav. Stroke weight: Lucide default (2px). See ICONOGRAPHY below.

### Other recurring motifs
- **Pill badges** (rounded‑full, `text-[8px]–[10px]`, uppercase, tracking‑widest) — used for status (`Disponible`, `Agotado`, `Pocas unidades`), branch names, transaction IDs.
- **Number‑in‑square** category swatches — `size-12 rounded-xl` with a single letter (`p.name?.charAt(0).toUpperCase()`) when there's no product image. The square shifts color when the row is selected (`bg-indigo-600 text-white ring-4 ring-indigo-50`).
- **Inline divider tags** for SKU: `text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 rounded`.
- **Tinted progress bars:** `bg-slate-100` track, `bg-gradient-to-r from-indigo-500 to-indigo-600` fill, with a `p-0.5 border` inset.

---

## Iconography

**System:** `lucide-react` — installed and used throughout the codebase, no exceptions. The system is loaded from the NPM package in the real product; in this design system we either:

1. **Recreate UI in HTML:** load the CDN build → `<script src="https://unpkg.com/lucide@latest"></script>` and call `lucide.createIcons()`, OR
2. **Use the React/JSX build** in the UI kit via `https://unpkg.com/lucide-react`.

**Icons seen in the Staff app (non‑exhaustive, from the real imports):**
`LayoutDashboard, Package, ShoppingCart, History, LogOut, Menu, X, ChevronLeft, Bell, Search, Zap, Users, CreditCard, ArrowRightLeft, Smartphone, AlertTriangle, Info, CheckCircle2, Truck, Building2, MinusCircle, Receipt, UserCircle, Settings, TrendingDown, TrendingUp, Coins, Plus, Minus, Trash2, Tag, Banknote, Loader2, RefreshCw, Store, User, FileText, Ticket, Camera, Lock, Unlock, Wifi, WifiOff`.

**Brand mark:** the StockFlow logo in‑product is the **Lucide `Zap` (lightning bolt)** glyph, white, filled, inside an **indigo‑600 rounded square** (`size-8 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200`). The lightning‑bolt + filled style is consistent in every header (Login, Layout sidebar, mobile header, MobilePOS header — though MobilePOS uses `Store` instead of `Zap`). The PNG app‑icons in `stockflow/assets/{staff,client,driver}/icon.png` are obvious placeholder 3D‑gloss spheres with a white `S` — **not used in the running UI**, only as the Android launcher icon. We've copied them for completeness but flag them: **the real visual brand is the Lucide Zap glyph on indigo‑600**, not the sphere icon.

**Emoji as icons:** allowed in three specific contexts: payment‑method audit logs (`💵 💳 🔄 📱`), alert messages (`🔒 🟢 🎉 ⚠️`), and stock status (`✕ ✓ ⚠`). Don't add new ones outside these patterns.

**Unicode‑char icons:** not used. Custom SVGs: only one — a small hand‑drawn QR code inside the payment‑simulation modal (`<svg viewBox="0 0 100 100">…`). Everything else is Lucide.

**No icon font.** No custom icon set. Stick to Lucide for new work.

> **Flag — placeholder asset substitution:** the launcher PNG icons (`assets/icon-*.png`) are generic 3D‑gloss "S" spheres that don't match the in‑product brand. The real product brand is the Zap glyph on indigo. **Ask the product team for proper launcher icons** if you're shipping new APKs; for design mocks, use the Lucide Zap on indigo.

---

## Font substitution flag

**No substitution needed.** The product loads Inter from Google Fonts at runtime. This system does the same. If you need Inter offline, download from [rsms.me/inter](https://rsms.me/inter/) — the file set we'd use is `Inter-roman.var.woff2` (variable) covering all weights 100–900. We've left `fonts/` empty for that purpose.

---

## How to use this system

1. Open the **Design System tab** for the visual specimen cards.
2. Open `ui_kits/worker_mobile/index.html` for the live recreation of the Staff app.
3. Drop `colors_and_type.css` into any new HTML file to inherit the tokens and semantic classes.
4. Borrow components from `ui_kits/worker_mobile/*.jsx` — they're small, modular, and faithful to the real source.

**Caveats:** the launcher icons in `assets/` are placeholders (flagged above). The "client" and "driver" apps share the same chrome as Staff and are not covered in this system — the user's brief was the Staff/worker app. If you need those surfaces, browse the GitHub repo linked at the top.
