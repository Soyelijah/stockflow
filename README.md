# StockFlow

> Plataforma multi-role de gestión retail para el mercado chileno.
> Inventario + POS + delivery + fidelización en una única base de código,
> con APKs separadas para staff, clientes y conductores.

## Stack

- React 19 + Vite 6 + TypeScript 5.8 strict
- Tailwind CSS 4
- Firebase 12 (Auth + Firestore; Storage code-ready / billing-blocked)
- Express 4 + Firebase Admin SDK (server)
- Capacitor (APK Android: Staff / Sf Client / Sf Driver)
- Package manager: **pnpm only** (npm/yarn forbidden, ver `AGENTS.md` §11.5)

## Apps por superficie

| App | Package | Branding aprobado (B.5) | Audiencia |
|---|---|---|---|
| **StockFlow Staff** | `cl.stockflow.staff` | Indigo | Owner, admin, manager, seller, logistics |
| **Sf Client** | `cl.sfclient.app` | Orange-first | Clientes finales (loyalty, pedidos, cupones) |
| **Sf Driver** | `cl.sfdriver.app` | Cyan | Repartidores (rutas, firma, foto-evidencia code-ready) |

> Las paletas de color por superficie son decisión de producto aprobada (B.5).
> Los handoffs visuales presentes en el repo (`design-system/`, ZIPs locales) pueden
> mostrar otras paletas (ej. Driver emerald). Esas son referencias visuales de prototipo,
> **NO la decisión de producto**. Cualquier cambio de branding requiere aprobación explícita.

## Quick start (desarrollo local)

```bash
pnpm install
pnpm dev                                 # tsx server.ts (Vite middleware + Express)
pnpm lint                                # tsc --noEmit (0 errors required)
pnpm build:all                           # vite x3 (staff/client/driver)
pnpm bundle:check                        # bundle isolation enforcement
```

Para APK ver `docs/APK.md`. Para arquitectura multi-role ver `docs/refactor-multirole.md`.
Para roadmap futuro ver `docs/ROADMAP.md`. Para historial de sprints ver `docs/walkthrough.md`.

## Documentación interna (agentes Claude / Antigravity / Codex)

- `AGENTS.md` — operating manual y contrato del repo
- `docs/refactor-multirole.md` — decisión arquitectónica multi-role
- `docs/APK.md` — guía Capacitor + Android Gradle + JDK 21

## Bloqueos operativos conocidos

Ambos bloqueos comparten root cause: cuenta de billing Google Cloud cerrada. Pero son
servicios distintos con consecuencias separadas.

- **Firebase Storage**: code-ready / billing-blocked.
  El bucket `gs://workspace-mcp-493503.firebasestorage.app` no está creado todavía.
  `storage.rules` está escrita y vinculada en `firebase.json`. Bloquea: creación del
  bucket en `us-east1`, deploy de `storage.rules`, y upload runtime de foto-evidencia
  de entregas fallidas en Sf Driver. El código que llama al upload (`DriverPWA.tsx`
  con orden estricto upload→commit + rollback) está implementado y validado por code
  review; queda pendiente reactivación de billing para validación empírica end-to-end.

- **Google Maps / Routes APIs**: code-ready / billing-blocked.
  API key creada (`maps-backend.googleapis.com` + `routes.googleapis.com` enabled,
  `.env.local` configurado). Runtime falla con `BillingNotEnabledMapError` y
  `ROUTES_COMPUTE_ROUTES: PERMISSION_DENIED` mientras billing esté cerrado. Afecta:
  tab "Despacho" en Sf Client (no crashea post-fix BranchProvider, solo muestra
  overlay de error) y vista de mapa en Sf Driver. Whitelist de origin del
  WebView Capacitor (`https://localhost/`) pendiente como sub-bloque post-billing.

## Roles canónicos

```
owner, admin, manager, seller, logistics, driver
```

Custom claim `role` es autoritativo. Firestore `/users/{uid}.role` es mirror UI-only.
Server-side checks (Express, Cloud Functions, Firestore rules) leen el claim, no el
documento. Ver `src/lib/roles.ts` para helpers (`isAdmin`, `isSeller`, etc.).

## Estado de sprints (resumen)

| Sprint | Estado | Commit |
|---|---|---|
| Tier 5.A — Customer Firebase Auth migration | LIVE | varios pre-5.B |
| Tier 5.B + B.5 + B.6 — APK split + branding + Settings UX | LIVE | `c8ed5e0` + `67adb6e` |
| Tier 5.C.1 — Route guards + Forbidden | LIVE | `4b36da1` |
| Tier 5.C.2 — POS offline sync idempotency | LIVE | `fb50fdd` + `e94914d` |
| Tier 5.C.3 — Driver delivery proof (signature + foto-evidencia) | PILOTO | `9f607d6` |
| Tier 5.C.3a — Rules más estrictas + a11y modal + códigos chilenos | PILOTO | `d62d41b` |
| Tier 5.C.6 — Sf Client flash-login | LIVE | `9109109` |
| Tier 5.C.7 — Sf Client i18n + branding + RUT + safe area | LIVE | `0aa3143` |
| Tier 5.C.8 — i18n cleanup CustomerPortal | LOCAL pending push | (sin commit) |
| Tier 5.D — Create employee API + Settings modal | LIVE | `298a4b6` + `ee939f9` + `281548d` |
| Tier 5.C.4 — Docs honestos | EN CURSO | Ver `docs/ROADMAP.md` |
| Tier 6 — UX Premium Polish | PLANIFICADO post 5.C.4 | TBD |

Detalle completo: `docs/ROADMAP.md` y `docs/walkthrough.md`.

> **Sobre 5.C.3 / 5.C.3a en estado PILOTO**: el código y las firestore.rules están
> deployadas y validadas con probe automatizado (16/18 verde, 94 % testeable). Los 2
> escenarios no cerrados son externos al código: Test 14 (Storage adversarial) requiere
> bucket creado, bloqueado por billing; Test 6 (geolocation latitude) requiere validación
> runtime en WebView Capacitor real (mock Playwright headless no se propaga). Pasarán a
> LIVE cuando se cierren ambos via reactivación de billing + smoke runtime CC-mobile.

## Licencia

[a definir]
