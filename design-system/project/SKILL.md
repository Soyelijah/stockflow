---
name: stockflow-design
description: Use this skill to generate well-branded interfaces and assets for StockFlow (the Chilean retail POS + inventory app for sellers, managers and logistics workers), either for production or throwaway prototypes / mocks / decks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the Staff (worker) mobile app.
user-invocable: true
---

# StockFlow Design Skill

Read `README.md` first — it covers product context, content fundamentals (Chilean Spanish, operational vocabulary like *boleta / factura / RUT / turno / arqueo*), visual foundations (indigo primary, slate neutrals, chunky‑round radii, tinted shadows), and iconography (Lucide React).

Then explore:
- `colors_and_type.css` — drop‑in CSS variables and semantic classes.
- `preview/` — the visual specimen cards. Skim them to see the system at a glance.
- `ui_kits/worker_mobile/` — high‑fidelity React recreation of the worker mobile app (POS, cart, profile/turno, login). Borrow components from here.
- `assets/` — brand marks and app icons.

## When invoked

If creating visual artifacts (slides, mocks, throwaway prototypes, design comps):
1. Link `colors_and_type.css` into your HTML.
2. Load Inter from Google Fonts and `lucide-react` (or the CDN build of `lucide`) — never substitute a different sans‑serif or icon set.
3. Build with the chunky‑round radii (cards = `rounded-2xl`/16px, CTAs = `rounded-xl`/12px, hero/sheet = `rounded-[2rem]`+).
4. Write copy in **Chilean Spanish** with uppercase microlabels (`tracking-widest`, `font-black`, 9–10px).
5. Use motion sparingly: 200ms fade+slide on entrance, spring on toasts, confetti only at financial success moments.

If working on production code (the live StockFlow repo):
- Copy color tokens out of `colors_and_type.css` and match the Tailwind class patterns documented in `README.md`.
- Read the corresponding component in `stockflow/src/shared/components/` before editing — the codebase has strong conventions (multi‑branch awareness, offline queue, role‑based routing).

If the user invokes this skill with no specific guidance, ask them what they want to build (a new screen for the worker app? a slide showcasing the brand? a sales deck?), ask a few clarifying questions, and act as an expert designer who outputs either HTML artifacts or production‑ready React/Tailwind code, depending on the need.

## Hard rules

- **Brand mark = Lucide `Zap` (lightning bolt), filled white, inside an indigo‑600 rounded square.** Not the 3D‑gloss `S` sphere in `assets/icon-*.png` (those are placeholder launcher icons).
- **No bluish‑purple decorative gradients.** Real gradients are only `slate-900 → indigo-950` on banners and `indigo-500 → indigo-600` on progress bars.
- **Light mode dominates.** Dark slate appears only on (1) Login, (2) the total/checkout card at the bottom of the cart, (3) payment‑simulation modals.
- **No illustrations, no full‑bleed photography, no decorative SVG.** This is a tool.
- **Emoji are functional, not decorative** — reuse the existing set (`💵 💳 🔄 📱 🔒 🟢 🎉 ⚠️ ✕ ✓ ⚠ ⭐`); don't invent new ones.
- **Numbers use `font-variant-numeric: tabular-nums`** and the Chilean format (`$1.500`, no decimals, period as thousands separator).
