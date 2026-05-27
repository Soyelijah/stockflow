# StockFlow Worker Mobile — UI Kit

A high‑fidelity, **banking‑app premium** recreation of the StockFlow worker (Staff / Trabajadores) mobile app. Built with React + inline JSX, no build step. Open `index.html` in any modern browser.

## What's inside

| File | Role |
|---|---|
| `index.html` | Phone‑frame mockup that auto‑scales to viewport; mounts React app at `#root`. |
| `styles.css` | Imports `../../colors_and_type.css` then adds kit‑local utilities (sf‑*) and keyframes. |
| `Icons.jsx` | Inline‑SVG Lucide‑style icon set (24 icons). `<Icon name="Zap" size={24}/>`. |
| `atoms.jsx` | `Pill`, `IconChip`, `ProgressRing`, `Avatar`, `MoneyTicker` (count‑up), `Divider`. |
| `mockData.jsx` | Spanish‑Chilean mock data: products, customers, branches, today's transactions, notifications. |
| `TopBar.jsx` | Avatar greeting + sucursal switcher + notification bell. |
| `HeroBalance.jsx` | The bank‑style hero card: today's sales, progress ring, commission. |
| `QuickActions.jsx` | 4 tappable icon cards (Escanear, Clientes, Cierre, Kardex). |
| `HomeTab.jsx` | Hero + quick actions + shift mini‑summary + recent‑txn feed. |
| `ShopTab.jsx` | Catalog browser with category chips and animated product rows. |
| `CartTab.jsx` | Checkout: doc type, customer, payment method, line items, coupon, total. |
| `ProfileTab.jsx` | Identity card + performance card + shift control + history. |
| `BottomNav.jsx` | Floating 5‑slot nav with a center FAB (Zap / "cobrar"). |
| `SideDrawer.jsx` | Slide‑in profile drawer with branch switcher and nav links. |
| `Sheets.jsx` | Bottom sheets: ShiftOpen · Customer · Notifications · BranchSwitch. |
| `PaymentSheet.jsx` | Full‑screen dark NFC/QR payment simulation + SuccessSheet with confetti. |
| `App.jsx` | Orchestrator: auth, tab routing, cart state, shift state, all overlays. |

## Stack

- **React 18** + **Babel Standalone** (in‑browser JSX). For production you'd swap to a Vite build.
- No motion library — every animation is pure CSS (keyframes + transitions) using `cubic-bezier(0.32, 0.72, 0, 1)` (iOS spring).
- Number tickers use `requestAnimationFrame` + ease‑out‑quart.

## Design notes

- **No bluish‑purple decorative gradients.** Brand gradient is reserved for: the hero card (`#312e81 → #6366f1`, 135°), the FAB, and progress fills. All else is light slate.
- **Light mode dominates.** Dark slate appears only on: Login, the total/checkout card at the bottom of the cart, and the payment‑simulation modal.
- **Chunky‑round radii** — buttons `rounded-xl`, cards `rounded-2xl`, hero `rounded-3xl`, sheets `rounded-[28px]`.
- **Microlabels** (10/900/uppercase/0.12em tracking) caption everything.
- **Confetti** fires once, on successful sale (30 CSS‑animated pieces).

## Faithfulness to the real product

Patterns are taken from `stockflow/src/shared/components/MobilePOS.tsx` (~2,400 LOC) and `Layout.tsx`:

- Branch awareness in the top bar (the real product also surfaces this in the sidebar via `BranchContext`).
- The full cash‑register lifecycle: open shift → declare opening cash → sell → retiros → close → arqueo / discrepancy.
- Boleta vs Factura logic (factura requires a customer with RUT).
- Payment methods exactly mirror real code: `efectivo`, `tarjeta`, `transferencia`, `digital`.
- Offline / sync behavior is visible as a pill in the top bar (this is real code in `MobilePOS`).
- All Chilean‑Spanish copy + emoji as functional indicators (`💵 💳 🔄 📱 🔒 🟢 🎉 ⚠️`).

## Caveats

- **Demo only** — no Firebase / real persistence. State resets on reload.
- **Icon set** is a hand‑rolled subset of Lucide. For production, replace `Icons.jsx` with the real `lucide-react` package.
- **Login** is a single‑button mock. Backed by `useAuth` in the real codebase.
- **Sheets and drawer** use simple CSS transitions in inline styles rather than the rich Framer Motion gestures used in the real product. The visual rhythm is preserved.
