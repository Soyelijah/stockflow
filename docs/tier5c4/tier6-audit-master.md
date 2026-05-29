# Tier 6 — UX Premium Polish — Audit Master (Markdown Only)

> **Fuente north-star definitiva**: `Copia de StockFlow Design System.zip` en root del repo (89 entries, 721 KB)
> Contiene: `design_handoff_stockflow_apps/README.md` (155L guía maestra completa con tokens, motion, Tailwind mapping, spec por app/rol/screen, state, assets) + `source/` 43 archivos JSX prototype + `screenshots/` 40 capturas ground-truth.
>
> Este audit es PRE-WORK Tier 6. NO toca código. Espera OK explícito Pierre antes de cualquier ejecución.
>
> Supersedes `tier6-audit-initial.md` (que se basaba solo en ZIP (1) sin spec maestro).
>
> Branding aprobado B.5 se preserva: Staff indigo / Client orange / Driver cyan.
> Conflictos visuales del handoff (Staff per-role accents, Client gold loyalty, Driver emerald) NO son decisión de producto — son referencias visuales que requieren resolución explícita en cada commit Tier 6.

---

## 1. Comparación pantalla real LIVE vs screenshot ZIP (por surface)

### 1.1 Staff (`StockFlow` APK `cl.stockflow.staff`)

#### LIVE inventario
- Entry: `src/main-staff.tsx` → `App.tsx`
- Router: `apps/admin/routes.tsx` con 14 rutas Lazy
- Seller (Vendedor role): forzado a `MobilePOS.tsx` (3 tabs: `shop` / `cart` / `profile`)
- Otros roles (admin/manager/logistics): `Layout.tsx` desktop con sidebar nav → carga Dashboard / Inventory / Settings / etc.
- Bottom nav LIVE Vendedor: 3 tabs (Tienda / Carrito / Perfil)
- **NO existe FAB central** en LIVE

#### ZIP (1) propone Staff Vendedor (per README maestro)
- Bottom nav 5-position: `[tabA, tabB, FAB, tabC, tabD]` = Inicio (HomeTab) / Tienda (ShopTab) / **FAB ⚡ Cobrar** / Carrito (CartTab) / Perfil (ProfileTab)
- HomeTab: `HeroBalance` (ventas personales + ring + sparkline) + `QuickActions` (4 tiles: Escanear / Clientes / Kardex / Cierre) + stats grid + week chart + txn feed
- Per-role accents en avatar topbar: Vendedor indigo (match B.5)

#### Gaps Staff Vendedor (comparison LIVE vs ZIP)

| # | Aspect | LIVE | ZIP (1) screenshot `01-vendedor.png` | Gap severity |
|---|---|---|---|---|
| 1 | Tab structure | 3 tabs (shop/cart/profile) | 5-position (Inicio+Tienda+FAB+Carrito+Perfil) | 🔴 ALTO — falta HomeTab + FAB |
| 2 | HomeTab existence | ❌ NO existe | hero card "TURNO EN CURSO $31.182" + sparkline + ProgressRing + week chart | 🔴 ALTO — pantalla completa nueva |
| 3 | QuickActions row | ❌ NO existe (algunas en sidebar desktop only) | 4 tiles color-coded (ESCANEAR purple / CLIENTES indigo / KARDEX cyan / CIERRE orange) | 🟡 MEDIO — quick reactions útiles para POS móvil |
| 4 | FAB central Cobrar | ❌ NO existe | floating ⚡ Cobrar indigo gradient + glow shadow | 🔴 ALTO — diferencia visual fuerte |
| 5 | TopBar role badge | ❌ NO badge "VENDEDOR" + María avatar | "VENDEDOR" badge indigo + María avatar `indigo-500` + branch chip "Centro" + notif bell | 🟡 MEDIO — branding consistency |
| 6 | Tienda layout | catálogo cards básico | search bar + camera button + category chips (TODOS/BEBIDAS/SNACKS/LÁCTEOS) + cards con stock badges (DISPONIBLE/POCAS/AGOTADO) + + button accent indigo | 🟡 MEDIO — visual refresh |
| 7 | Cart/Payment | inline alert | dedicated `PaymentSheet` con NFC/efectivo/QR sim + `SuccessSheet` confetti | 🔴 ALTO — flujo completo nuevo |
| 8 | Drawer (sidebar mobile) | ❌ NO drawer mobile en MobilePOS | `SideDrawer` con role-specific link sections + footer "STOCKFLOW v2.5.0 • SF" | 🟡 MEDIO |

#### Gaps Staff Jefe/Logística/Admin

| # | Aspect | LIVE | ZIP (1) | Gap severity |
|---|---|---|---|---|
| 9 | Per-role bottom nav | Layout desktop con sidebar (no bottom nav) | Bottom nav 5-position por role (Jefe: Resumen/Equipo/✓Aprobar/Reportes/Perfil; Logística: Hoy/Traslados/+Entrega/Kardex/Perfil; Admin: Negocio/Sucursales/+Crear/Equipo/Perfil) | 🔴 ALTO — completamente diferente arquitectura |
| 10 | Per-role accents | indigo monolithic | Vendedor indigo / Jefe **amber** / Logística **blue** / Admin **purple** en avatar + role badge | 🟡 MEDIO — decisión Pierre futura |
| 11 | Approval flow Jefe | sin pantalla específica | `ApprovalDetailSheet` con cards equipo, status (VENDIENDO/EN PAUSA/OFFLINE), tickets, AVG, % | 🔴 ALTO |
| 12 | Detail sheets Logística/Admin | sin equivalente | `DeliveryDetailSheet`, `BranchDetailSheet`, `UserDetailSheet` | 🔴 ALTO |

### 1.2 Sf Client (`Sf Client` APK `cl.sfclient.app`)

#### LIVE inventario
- Entry: `src/main-client.tsx` → `AppShell` → `CustomerPortal.tsx` (5200 líneas monolítico)
- 7 tabs LIVE: `home` / `shop` / `wallet` / `history` / `rewards` / `offers` / `delivery`
- Bottom nav LIVE: home / history / wallet (CTA central) / offers / delivery — 5 positions con CTA orange
- LIVE branding: orange-first primary CTA (`orange-600`), indigo accents secundarios, loyalty pill amber visible

#### ZIP (1) propone Sf Client
- 4 tabs + FAB: Inicio / Tienda / **FAB cart** / Cupones / Pedidos
- `LoyaltyCard` hero (indigo→gold gradient, tier crown badge, points MoneyTicker, progress bar, member id)
- `ClientHomeTab`: LoyaltyCard + QuickActions + active-order tracker (4-step) + featured ProductCard grid
- `RewardsTab`: `CouponCard` ticket shapes (perforation + color por type)
- `ClientShopTab`: search + categories + product grid
- `OrdersTab`: order history con status badges (semánticos)
- `ClientProfileTab`: loyalty card + account data + tier benefits
- `ClientSheets`: `QRSheet` (member QR), `CartSheet`, `NotifSheetClient`

#### Gaps Sf Client (comparison LIVE vs ZIP)

| # | Aspect | LIVE | ZIP (1) screenshot | Gap severity |
|---|---|---|---|---|
| 13 | Tab count | 7 tabs (home/shop/wallet/history/rewards/offers/delivery) | 4 tabs (Inicio/Tienda/Cupones/Pedidos) + FAB cart | 🟡 MEDIO — LIVE más granular, ZIP consolida (rewards+offers→Cupones, history+delivery→Pedidos) |
| 14 | LoyaltyCard hero | wallet tab muestra QR + saldo simulado | hero card prominente en Inicio con indigo→gold gradient + tier crown + MoneyTicker count-up + progress bar + member id + "Mi código" CTA | 🔴 ALTO — componente completo nuevo |
| 15 | Active order tracker | order listing simple | 4-step tracker visual (preparado/en camino/entregando/entregado) | 🟡 MEDIO |
| 16 | CouponCard shape | rectangular cards | ticket shape con perforation cutouts + color por type (loyalty gold, business orange, special purple) | 🟡 MEDIO |
| 17 | Bottom CTA carrito | LIVE: orange (post 5.C.7) | match ZIP orange ✅ | ✅ |
| 18 | Loyalty gold | LIVE: amber pill básica | ZIP: gold gradient + tier-specific (Bronze/Silver/Gold/Platinum visual escalation) | 🟢 BONUS — agregar visual escalation |
| 19 | Cart sheet "ganarás +X pts" | LIVE: cart inline | ZIP: dedicated `CartSheet` con line items + "ganarás +X pts" calculation + payment trigger | 🟡 MEDIO |
| 20 | QRSheet member | LIVE: wallet tab inline | ZIP: dedicated `QRSheet` bottom sheet con QR + verified checkmark indigo + footer banner gold | 🟡 MEDIO |

### 1.3 Sf Driver (`Sf Driver` APK `cl.sfdriver.app`)

#### LIVE inventario
- Entry: `src/main-driver.tsx` → `DeliveryRoutes` → `DriverPWA.tsx` (~900 líneas) + `DeliveryMap.tsx` + `SignaturePad.tsx`
- **No tab system explícito** (single-view scroll vertical con secciones)
- Componentes: TopBar driver + activeStop card + GoogleMap (vis.gl) + signature modal + failed delivery modal
- LIVE branding: cyan-600 throughout (login + buttons + map polyline)

#### ZIP (1) propone Sf Driver
- 4 tabs + FAB: Ruta (`DriverHomeTab`) / Paradas (`DriverStopsTab`) / Mapa / Perfil / **FAB QR scanner**
- `DriverTopBar`: route hero big `delivered/total` + km + hours + glowing progress bar
- `DriverMap.jsx`: layered SVG map prototype (city blocks, park/water, named streets, gradient route w/ glow, warehouse/delivered/destination pins, live truck marker, ETA + GPS chips, zoom controls) — **en producción usar `@vis.gl/react-google-maps`** ✓ (LIVE ya tiene)
- `ActiveStopCard`: red gradient header (stop #, ETA, distance) + call/navigate buttons + order/bultos/valor chips + product chips + sequential CTA "Comenzar viaje" → "Escanear comprobante" / "Confirmar táctil"
- `DriverSheets`: `ScannerSheet` (full-screen viewfinder w/ corner brackets) + `SignatureSheet` (`<canvas>` + name field + GPS evidence note)
- State machine: `preparing → in_route → delivered`

#### Gaps Sf Driver (comparison LIVE vs ZIP)

| # | Aspect | LIVE | ZIP (1) screenshot `02-driver.png` | Gap severity |
|---|---|---|---|---|
| 21 | Tab structure | sin tabs (single view scroll) | 4 tabs + FAB (Ruta/Paradas/Mapa/Perfil + QR scanner FAB) | 🔴 ALTO — arquitectura completa nueva |
| 22 | Color throughout | cyan-600 | **EMERALD throughout** (login + topbar + map polyline + bottom nav + waypoints) | 🔴 **CONFLICTO B.5 PROFUNDO** — preservar cyan, reescribir cada emerald a cyan en ~15-20 spots |
| 23 | TopBar route hero | header simple con stops count | hero card "EN TURNO Felipe Soto" + delivered/total grande + km + hours + progress bar glow | 🟡 MEDIO — visual refresh significativo |
| 24 | ActiveStopCard | basic card con info entrega | red gradient header (rose-500) + call/navigate buttons + chips compactos (order/bultos/valor) + product chips + sequential CTA | 🟡 MEDIO |
| 25 | Map styling | Google Maps default styled | SVG prototype con gradient polyline + glow + ETA chips + GPS chips + zoom controls custom | 🟡 MEDIO — Google Maps real con custom styling JSON |
| 26 | Scanner sheet QR | ❌ NO existe scanner LIVE (Driver no escanea QR para confirm entrega) | `ScannerSheet` full-screen viewfinder w/ corner brackets | 🔴 ALTO — feature nueva |
| 27 | Signature sheet | LIVE: `FailedDeliveryModal` (a11y completo post 5.C.3a) + `SignaturePad.tsx` | match parcial — `<canvas>` + name + GPS evidence ✓ | 🟢 LOW — refinement visual |
| 28 | State machine viz | LIVE: status field oculto | "preparing → in_route → delivered" visible en stop card progression | 🟡 MEDIO |

---

## 2. Gap table consolidada por surface

### 2.1 Staff

| Categoría | Gap | Owner componente | Severity |
|---|---|---|---|
| **Layout** | Bottom nav 3 → 5-position con FAB central | `MobilePOS.tsx` + `Layout.tsx` per-role variants | 🔴 ALTO |
| **Layout** | HomeTab Vendedor nueva (hero + sparkline + week chart + feed) | `MobilePOS.tsx` (nueva tab) | 🔴 ALTO |
| **Layout** | Per-role bottom nav Jefe/Logística/Admin | `Layout.tsx` reescribir mobile o nueva `StaffMobileShell.tsx` | 🔴 ALTO |
| **Layout** | SideDrawer mobile (role-specific link sections) | nuevo `SideDrawer.tsx` | 🟡 MEDIO |
| **Layout** | PaymentSheet NFC/QR sim + SuccessSheet confetti | nuevos `PaymentSheet.tsx` + `SuccessSheet.tsx` | 🔴 ALTO |
| **Colores** | Vendedor indigo (match B.5) | n/a | ✅ |
| **Colores** | Jefe/Logística/Admin accents (amber/blue/purple) | decisión Pierre Tier 6.A | 🟡 deferred |
| **Colores** | Tinted shadows (CTA glow color-matched) | global utility | 🟡 MEDIO |
| **Tipografía** | Inter font global | `index.html` + `main-*.tsx` | 🟡 MEDIO |
| **Tipografía** | Microlabels (900 weight, 8-10px, 0.12-0.16em tracking) | utility class `.sf-microlabel` | 🟡 MEDIO |
| **Tipografía** | Tabular nums en money | global CSS | 🟡 MEDIO |
| **Motion** | Spring easing cubic-bezier(0.32,0.72,0,1) | `MotionConfig` global | 🟡 MEDIO |
| **Motion** | Tap scale(0.96) on :active | utility class `.sf-tap` | 🟡 MEDIO |
| **Motion** | Sheet slide-up + drawer slide-left | motion/react components nuevos | 🟡 MEDIO |
| **Componentes faltantes** | atoms.jsx primitives: Pill, IconChip, Avatar, ProgressRing, MoneyTicker, Sparkline, StatTile, Divider | nuevos en `src/shared/components/ui/sf/` | 🔴 ALTO |
| **Componentes faltantes** | HeroBalance + QuickActions + ApprovalDetailSheet + DeliveryDetailSheet + BranchDetailSheet + UserDetailSheet | nuevos por sub-feature | 🔴 ALTO |
| **Data risks** | Wire HomeTab a Firestore (shift / sales / metrics) sin leak costPrice | section sec 4 plan | 🟡 MEDIO |
| **Bundle risks** | Bundle staff puede crecer 200-400 KB con 7+ atomics nuevos + sheets | monitorear con bundle:check | 🟡 MEDIO |

### 2.2 Sf Client

| Categoría | Gap | Owner componente | Severity |
|---|---|---|---|
| **Layout** | Tab count 7 → 4 + FAB (consolidación rewards/offers → Cupones, history/delivery → Pedidos) | refactor `CustomerPortal.tsx` | 🟡 MEDIO |
| **Layout** | LoyaltyCard hero en Inicio | nuevo `LoyaltyCard.tsx` | 🔴 ALTO |
| **Layout** | Active order tracker 4-step | sub-component en Inicio | 🟡 MEDIO |
| **Layout** | CartSheet dedicated con "ganarás +X pts" | sub-component | 🟡 MEDIO |
| **Layout** | QRSheet bottom sheet con verified checkmark | extraer a sheet | 🟡 MEDIO |
| **Colores** | Orange primary CTA (match B.5 post 5.C.7) | n/a | ✅ |
| **Colores** | Loyalty gold gradient escalation por tier | tokens nuevos | 🟢 BONUS |
| **Colores** | Indigo accents secundarios (QR check, verified, accents) | preservar | ✅ |
| **Tipografía** | Inter + microlabels | shared con Staff | 🟡 MEDIO |
| **Motion** | MoneyTicker count-up animation | nuevo component | 🟡 MEDIO |
| **Motion** | Tier progress ring animation | nuevo | 🟡 MEDIO |
| **Componentes faltantes** | LoyaltyCard / CouponCard ticket shape / ProductCard grid / OrderTrackerSteps | nuevos | 🔴 ALTO |
| **Data risks** | Wire LoyaltyCard a Firestore (points, tier, member id) — ya hay infra parcial | revisar `customer.points` shape | 🟢 OK |
| **Data risks** | `costPrice` NUNCA en queries del Client (AGENTS §6.2) | verificar en Tier 6.A | 🟡 MEDIO |
| **Bundle risks** | CustomerPortal ya es 5200 líneas. Riesgo refactor masivo. | fragmentar en 3-5 commits | 🔴 ALTO |
| **i18n** | Nuevas keys requeridas (LoyaltyCard / OrderTracker / CartSheet) | append a `t.es/t.en` post-5.C.8 | 🟡 MEDIO |

### 2.3 Sf Driver

| Categoría | Gap | Owner componente | Severity |
|---|---|---|---|
| **Layout** | Tab structure (Ruta/Paradas/Mapa/Perfil + FAB QR) | reescribir `DriverPWA.tsx` con tab shell | 🔴 ALTO |
| **Layout** | DriverTopBar route hero (delivered/total + km + hours + glow progress) | nuevo sub-component | 🟡 MEDIO |
| **Layout** | ActiveStopCard rose gradient + call/navigate buttons + chips | refactor `DriverPWA.tsx` | 🟡 MEDIO |
| **Layout** | ScannerSheet QR full-screen | nuevo (LIVE no tiene scanner QR para entrega) | 🔴 ALTO — feature nueva |
| **Colores** | **EMERALD → CYAN throughout** (B.5 conflict) | reescribir ~15-20 spots en `DriverPWA.tsx` + `DeliveryMap.tsx` + `SignaturePad.tsx` | 🔴 **CONFLICTO CRÍTICO** |
| **Colores** | Rose danger para destino activo (ya hay LIVE) | preservar | ✅ |
| **Colores** | Emerald como semantic success (delivered check) | preservar (semantic, no brand) | ✅ |
| **Tipografía** | Inter + microlabels | shared | 🟡 MEDIO |
| **Motion** | Spring + tap scale shared | shared | 🟡 MEDIO |
| **Motion** | Map polyline glow + truck marker animation | custom CSS animation | 🟡 MEDIO |
| **Componentes faltantes** | ScannerSheet (QR full-screen viewfinder) | nuevo (con html5-qrcode?) | 🔴 ALTO |
| **Componentes faltantes** | Map custom styling JSON Google Maps | configurar vis.gl options | 🟡 MEDIO |
| **Data risks** | Geolocation continuous watch (route progress) | revisar permissions Capacitor | 🟡 MEDIO |
| **Data risks** | Storage foto-evidencia post-billing | preserve actual code 5.C.3 | 🟢 OK |
| **Bundle risks** | DriverPWA puede crecer con tab shell + scanner + nuevo TopBar | monitorear | 🟡 MEDIO |

---

## 3. Fases Tier 6 propuestas

### Fase 6.A — Foundations (shared, no surface-specific)
**Goal**: tokens + tipografía + motion + atoms compartidos. Sin tocar UI surface-specific todavía.

**Scope**:
- Inter font global (import en `index.html` o self-host en `public/fonts/`)
- Tailwind theme extend con tokens ZIP (`tailwind.config.*` o CSS vars via `@theme`)
- Utility classes shared en `src/shared/styles/sf-utilities.css`:
  - `.sf-microlabel` (900 weight 8-10px tracking 0.14em uppercase slate-400)
  - `.sf-tap` (transform scale 0.96 on :active)
  - `.sf-spring` (transition cubic-bezier 0.32 0.72 0 1)
  - `.sf-tabular-nums` (font-variant-numeric tabular-nums)
- Atoms primitives nuevos en `src/shared/components/ui/sf/`:
  - `Pill.tsx`, `IconChip.tsx`, `Avatar.tsx`, `ProgressRing.tsx`, `MoneyTicker.tsx`, `Sparkline.tsx`, `StatTile.tsx`, `Divider.tsx`
- MotionConfig global con spring easing en cada `main-*.tsx`
- Audit a11y de modales existentes (no del `FailedDeliveryModal` que ya está OK)

**Files touched**:
- `index.html` (Inter font)
- `src/main-staff.tsx`, `src/main-client.tsx`, `src/main-driver.tsx` (MotionConfig)
- `tailwind.config.*` o CSS theme (tokens)
- `src/shared/styles/sf-utilities.css` (nuevo)
- `src/shared/components/ui/sf/*.tsx` (~8 archivos nuevos atoms)
- `src/index.css` (import sf-utilities)

**Estimado**: 1-2 commits, ~300 líneas código.
**Risk**: bajo. No toca rules, payments, security.

### Fase 6.B — Sf Client polish (highest customer impact)
**Goal**: modernizar `CustomerPortal.tsx` usando ZIP `client_mobile/` como spec, preservando orange B.5.

**Scope incremental** (3-5 commits, evitar refactor de 5200 líneas en una pasada):

**6.B.1** — LoyaltyCard component + integración Inicio tab
- Nuevo `src/shared/components/client/LoyaltyCard.tsx`
- Refactor sec home tab de `CustomerPortal.tsx` para incluir LoyaltyCard hero
- MoneyTicker count-up + ProgressRing tier + member id + QR CTA → existente QRSheet

**6.B.2** — Tab consolidation: rewards+offers → Cupones, history+delivery → Pedidos
- Refactor activeTab system
- CouponCard ticket shape nuevo
- OrderTrackerSteps 4-step component nuevo

**6.B.3** — Login screen modernization (variant client)
- Refactor `Login.tsx` variant client con ZIP Login layout (orange gradient mesh)
- Preservar 5.C.7 i18n + RUT validation

**6.B.4** — CartSheet + QRSheet polish
- Extract CartSheet de inline cart
- Polish QRSheet con verified checkmark indigo + footer banner gold

**6.B.5** — Microlabels uniformization + safe area refinement
- Aplicar `.sf-microlabel` en ~30 spots
- Refinar `env(safe-area-inset-bottom)` ya aplicado en 5.C.7
- Validar gold gradient escalation por tier (visual)

**Files touched** (por commit):
- `src/shared/components/CustomerPortal.tsx` (refactor incremental)
- `src/shared/components/client/LoyaltyCard.tsx` (nuevo)
- `src/shared/components/client/CouponCard.tsx` (nuevo)
- `src/shared/components/client/OrderTrackerSteps.tsx` (nuevo)
- `src/shared/components/client/CartSheet.tsx` (extract)
- `src/shared/components/Login.tsx` (variant client refresh)

**Estimado**: 3-5 commits, ~1500 líneas código incremental.
**Risk**: medio. CustomerPortal monolítico + i18n + branding preservation.

### Fase 6.C — Sf Driver polish (conflicto profundo emerald→cyan)
**Goal**: modernizar `DriverPWA.tsx` usando ZIP `driver_mobile/` como spec, **preservando cyan B.5 (NO emerald)**.

**Scope incremental** (3-4 commits):

**6.C.1** — Tab shell + TopBar route hero
- Refactor `DriverPWA.tsx` con tab system (Ruta/Paradas/Mapa/Perfil)
- Nuevo `DriverTopBar.tsx` con delivered/total + km + hours + glow progress
- Branding cyan en todo (NO emerald)

**6.C.2** — ActiveStopCard refactor con rose gradient + chips
- Rose preservado para destino activo (ya OK)
- Cyan en CTAs principales

**6.C.3** — ScannerSheet (QR full-screen viewfinder)
- Nuevo componente con html5-qrcode integration
- Branding cyan

**6.C.4** — Map custom styling (Google Maps JSON style)
- Configurar `@vis.gl/react-google-maps` con styles JSON adaptado del prototype SVG
- Polyline cyan con glow shadow

**Files touched**:
- `src/shared/components/DriverPWA.tsx` (refactor extenso)
- `src/shared/components/driver/DriverTopBar.tsx` (nuevo)
- `src/shared/components/driver/ScannerSheet.tsx` (nuevo)
- `src/shared/components/DeliveryMap.tsx` (styling)
- `src/shared/components/SignaturePad.tsx` (cyan accent refresh)

**Estimado**: 3-4 commits, ~1200 líneas código.
**Risk**: alto por conflicto branding + scanner feature nuevo + Google Maps styling.

### Fase 6.D — Staff polish (OPCIONAL, post-MVP refinement)
**Goal**: modernizar `MobilePOS.tsx` Vendedor con HomeTab + QuickActions + FAB Cobrar + PaymentSheet, usando ZIP `worker_mobile/` spec.

**Scope incremental** (4-6 commits, opcional según roadmap):

**6.D.1** — Bottom nav 3→5-position con FAB Cobrar
**6.D.2** — HomeTab Vendedor (hero + sparkline + week chart + feed)
**6.D.3** — QuickActions row + product cards refresh
**6.D.4** — PaymentSheet NFC/efectivo/QR sim + SuccessSheet confetti
**6.D.5** — SideDrawer mobile (role-specific link sections)
**6.D.6** — Per-role accents en avatar topbar (decisión Pierre — Vendedor indigo / Jefe amber / Logística blue / Admin purple)
**6.D.7** — Jefe/Logística/Admin bottom nav per-role (decisión Pierre)

**Risk**: alto por per-role accents discusión Pierre + posible regression sidebar desktop.

**Recomendación CC-auditor**: Fase 6.D **post-MVP** (Tier 7+). Staff es internal workforce, no customer-facing → polish prioridad MENOR que Sf Client (face del producto) y Sf Driver (rebuild emerald→cyan crítico).

### Recomendación orden secuencial

1. **6.A primero** (foundations, low-risk) — desbloquea reutilización
2. **6.B después** (Sf Client highest customer impact) — visible mejora
3. **6.C después** (Sf Driver branding conflict resolution + scanner feature)
4. **6.D opcional / Tier 7+** (Staff polish, internal-facing, menor prioridad)

---

## 4. Archivos a tocar (consolidado Tier 6)

### Globales / Foundations (Fase 6.A)
```
index.html                                          # Inter font @import
src/main-staff.tsx                                  # MotionConfig spring
src/main-client.tsx                                 # MotionConfig spring
src/main-driver.tsx                                 # MotionConfig spring
src/index.css                                       # import sf-utilities
src/shared/styles/sf-utilities.css                  # NUEVO util classes
tailwind.config.* o CSS @theme                      # tokens ZIP
src/shared/components/ui/sf/Pill.tsx                # NUEVO
src/shared/components/ui/sf/IconChip.tsx            # NUEVO
src/shared/components/ui/sf/Avatar.tsx              # NUEVO
src/shared/components/ui/sf/ProgressRing.tsx        # NUEVO
src/shared/components/ui/sf/MoneyTicker.tsx         # NUEVO
src/shared/components/ui/sf/Sparkline.tsx           # NUEVO
src/shared/components/ui/sf/StatTile.tsx            # NUEVO
src/shared/components/ui/sf/Divider.tsx             # NUEVO
```

### Sf Client (Fase 6.B)
```
src/shared/components/CustomerPortal.tsx            # refactor incremental tabs + integrar Loyalty
src/shared/components/Login.tsx                     # variant client refresh
src/shared/components/client/LoyaltyCard.tsx        # NUEVO
src/shared/components/client/CouponCard.tsx         # NUEVO
src/shared/components/client/OrderTrackerSteps.tsx  # NUEVO
src/shared/components/client/CartSheet.tsx          # extract
```

### Sf Driver (Fase 6.C)
```
src/shared/components/DriverPWA.tsx                 # refactor tab shell + cyan throughout
src/shared/components/DeliveryMap.tsx               # styling Google Maps JSON
src/shared/components/SignaturePad.tsx              # cyan refresh
src/shared/components/driver/DriverTopBar.tsx       # NUEVO
src/shared/components/driver/ScannerSheet.tsx       # NUEVO
```

### Staff (Fase 6.D, opcional)
```
src/shared/components/MobilePOS.tsx                 # refactor 3→5 tabs + HomeTab
src/shared/components/Layout.tsx                    # per-role mobile shell (decisión Pierre)
src/shared/components/staff/HomeTab.tsx             # NUEVO
src/shared/components/staff/QuickActions.tsx        # NUEVO
src/shared/components/staff/PaymentSheet.tsx        # NUEVO
src/shared/components/staff/SuccessSheet.tsx        # NUEVO
src/shared/components/staff/SideDrawer.tsx          # NUEVO
src/shared/components/staff/ApprovalDetailSheet.tsx # NUEVO (Jefe)
src/shared/components/staff/DeliveryDetailSheet.tsx # NUEVO (Logística)
src/shared/components/staff/BranchDetailSheet.tsx   # NUEVO (Admin)
src/shared/components/staff/UserDetailSheet.tsx     # NUEVO (Admin)
```

### NO TOCAR en Tier 6
```
firestore.rules                                     # rules son security, NO UX
storage.rules                                       # idem + billing blocked
firebase.json                                       # NO touch
server/routes/*.ts                                  # backend, NO UX
functions/src/index.ts                              # Cloud Functions, NO UX
src/lib/firebase.ts                                 # SDK init, NO UX
src/lib/roles.ts                                    # contrato canónico
package.json                                        # no nuevas deps salvo discusión explícita
```

---

## 5. Verificación por Playwright + APK/Xiaomi

### Por cada commit Tier 6 (cualquier fase)

#### Static
```bash
pnpm lint                                           # tsc --noEmit, 0 errors
pnpm build:all                                       # vite x3 sin warnings
node scripts/bundle-check.cjs                       # bundle isolation + size delta reportado
```

#### Playwright before/after (mobile viewport)
```js
// Patrón base por surface
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 },             // Xiaomi-like
  deviceScaleFactor: 2,
});
// Login → navigate to surface key screen → screenshot
// Compare against ZIP screenshot correspondiente
```

Screens prioritarios para before/after por fase:

**6.A** (foundations):
- Login Staff Vendedor (Inter font + tap scale visual)
- Login Sf Client (Inter font)
- Login Sf Driver (Inter font, cyan preserved)

**6.B** (Client):
- Inicio con LoyaltyCard (vs `screenshots/client/01-client.png` + alguna sheet view)
- Cupones tab (vs CouponCard ZIP)
- Pedidos tab (vs `04-client.png` quizás)
- Login Sf Client (orange gradient + 5.C.7 form preservation)

**6.C** (Driver):
- Login Sf Driver (vs `01-driver.png` — pero **cyan B.5 no emerald**)
- En-ruta home (vs `02-driver.png` — cyan no emerald, topbar hero, ActiveStopCard rose)
- ScannerSheet (vs `01-scanner.png`)
- Signature (vs `signature.png`)

**6.D** (Staff Vendedor opcional):
- Login Staff (vs `staff/01-login.png` — indigo preserved, role chips visible)
- Vendedor home con HomeTab (vs `01-vendedor.png`)
- Tienda (vs `01-payment.png`)
- Cart + PaymentSheet (vs `01-payment.png` / `02-payment.png`)

#### Mobile/APK smoke (CC-mobile, Xiaomi real)

Por cada surface con commits Tier 6:

```bash
# Rebuild APK afectada
JAVA_HOME=<jdk21> PATH=<jdk21>:$PATH pnpm apk:<surface>:debug

# Install
/Users/devlmer/Library/Android/sdk/platform-tools/adb install -r android-<surface>/app/build/outputs/apk/debug/app-debug.apk

# Smoke
# - login flow
# - navegación entre tabs nuevos
# - sheets (open/close + a11y)
# - logcat clean (0 FATAL/AndroidRuntime)
# - performance subjetiva (jank de motion springs)

# Screenshots empíricos para comparar con ZIP screenshots
```

#### A11y (modal/sheet patterns)
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Escape key handler
- Focus trap manual
- Return focus on close
- aria-labels en interactive elements
- (patrón ya implementado en `FailedDeliveryModal` post 5.C.3a — reutilizar)

#### Performance
- Bundle size delta por commit en bundle:check report
- CustomerPortal chunk: 314 KB actual → monitorear
- Si crece >+50 KB por commit, justificar o code-split

---

## 6. Riesgos críticos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Driver branding conversion emerald→cyan**: si Antigravity copia tokens ZIP sin filtrar, Driver regresa a emerald | Code review estricto de cada commit Driver. Validar screenshot post-build vs `01-driver.png` ZIP **con cyan replaced**. CC-mobile smoke en Xiaomi real. |
| **CustomerPortal monolítico 5200L**: refactor masivo arriesga regresiones funcionales | Fragmentar Fase 6.B en 3-5 commits incrementales. Cada uno con lint + build + Playwright before/after. |
| **Per-role accents Staff (Jefe amber, etc.)**: decisión de producto, no cosmética | Diferir a Tier 6.D + decisión Pierre explícita. NO adoptar automáticamente. |
| **Tab consolidation Client (7→4)**: usuarios pueden tener bookmarks/expectativas | Comunicar en walkthrough.md cambio explícito. Mantener URL deep-links si existen. |
| **Inter font en APK offline**: CDN no carga sin red | Self-host Inter en `public/fonts/Inter-*.woff2` con `font-display: swap`. Adoptar en Fase 6.A. |
| **Touch a producción crítica (rules/security)**: regresión silenciosa | Lista explícita "NO TOCAR" sec 4. Cada PR/commit review by CC-auditor antes de push. |
| **Bundle bloat con nuevos atoms + sheets**: client chunk podría crecer significativo | bundle:check report por commit + chunkSizeWarningLimit Vite config. |
| **Cyan vs emerald confusion en code review**: tokens semánticos vs brand fácil de mezclar | Documentar en walkthrough convention: "emerald = semantic success only, brand = cyan en Driver" |
| **Scanner QR Driver feature nueva**: no existe en LIVE, requiere html5-qrcode integration + permissions Capacitor | Validar en Capacitor Android antes de Fase 6.C.3 |

---

## 7. Próximo step

**Esperar OK explícito Pierre antes de iniciar cualquier fase Tier 6.**

Orden propuesto para ejecución cuando se apruebe (NO ANTES):
1. CC-auditor entrega este audit master + fact-sheet a Antigravity
2. Antigravity audita su workspace contra este audit
3. Antigravity entrega plan v1 Fase 6.A audit-only (foundations primero)
4. Pierre/CC-auditor revisamos plan
5. Antigravity ejecuta 6.A
6. CC-auditor + CC-mobile validan
7. Loop similar para 6.B → 6.C → (6.D opcional)

**No ejecuto nada hasta OK explícito.**
