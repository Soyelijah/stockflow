# StockFlow — Roadmap

> Estado por sprint con commits + evidence type.
> Honest reporting: si algo no está validado end-to-end con probe + smoke runtime, no está LIVE.

## Convenciones de estado

- **LIVE**: código en `main`, validado empíricamente con probe automatizado + smoke runtime real.
- **PILOTO**: código en `main`, validado estáticamente (lint / build / bundle) y/o con probe parcial; falta cierre runtime (típicamente bloqueado por dependencias externas).
- **PRÓXIMO**: planeado, plan audit-only aprobado o pendiente.
- **BLOCKED**: bloqueado externamente (billing, payments, dependencies).
- **LOCAL**: implementado localmente, sin commit ni push (típicamente por decisión CEO de congelar el push).

## Tier 5 — Auth + APK split + Endurecimiento

### Closed

| Sprint | Estado | Commit | Evidence |
|---|---|---|---|
| 5.A | LIVE | varios pre-5.B | Customer Firebase Auth migration completa. Sf Client funcional en runtime. |
| 5.B + B.5 + B.6 | LIVE | `c8ed5e0` + `67adb6e` | 3 APKs separadas con bundle isolation enforced. Branding indigo/orange/cyan en launcher Xiaomi empírico. Settings users responsive. |
| 5.C.1 | LIVE | `4b36da1` | Route guards por rol + Forbidden component. 14 rutas wrapped. Bundle isolation: RouteGuard/Forbidden bloqueados en client/driver bundles. |
| 5.C.2 | LIVE | `fb50fdd` + `e94914d` | POS offline sync idempotency. probe-5c2 9/9 con seller pinned a branch concreta. Hotfix `e94914d`: rules gap pinned sellers + Sf Client BranchProvider crash. |
| 5.C.3 | PILOTO | `9f607d6` | Driver delivery proof: signature + GPS metadata + failed delivery con foto-evidencia (código). storage.rules code-ready. Pasa a LIVE cuando Storage runtime se valide post-billing + geolocation runtime CC-mobile. |
| 5.C.3a | PILOTO | `d62d41b` | Rules más estrictas (transition + reason whitelist + photo mandatory). a11y modal completo. Códigos chilenos neutros (atasco vial). probe-v2 16/18 (94 % testeable). Test 14 (Storage adversarial) y Test 6 (geolocation runtime) son externos al código; pasarán a LIVE con los mismos prerequisitos que 5.C.3. |
| 5.C.6 | LIVE | `9109109` | Sf Client flash-login eliminado. 3 estados auth/profile. Timeline runtime CC-mobile confirmado. |
| 5.C.7 | LIVE | `0aa3143` | Sf Client i18n + branding dinámico + RUT validation activación + safe area. 272 keys × 2 idiomas. |
| 5.D | LIVE | `298a4b6` + `ee939f9` + `281548d` | Create employee API + Settings inline modal + server smoke utils. |

### Pending push / próximos en queue

| Sprint | Estado | Owner | Notas |
|---|---|---|---|
| 5.C.8 | LOCAL pending push | Antigravity | i18n cleanup CustomerPortal — 14 sustituciones + 2 keys nuevas. Diff verificado coincide con plan v3. **Congelado por decisión CEO hasta nueva instrucción.** |
| 5.C.4 | LIVE (este sprint cuando se cierre) | Claude Code Worktree | Docs honestos — README + ROADMAP + walkthrough + .gitignore. |
| 5.C.5 | BLOCKED | CC-auditor + Pierre | Maps API key whitelist Capacitor. Bloqueado por billing. |

## Tier 6 — UX Premium Polish (PRÓXIMO post 5.C.4)

Audit master completo en `docs/tier5c4/tier6-audit-master.md`. Resumen:

| Phase | Scope | Owner | Estado |
|---|---|---|---|
| 6.A | Foundations: Inter font global + Tailwind theme con tokens del design handoff + atoms compartidos (Pill / IconChip / Avatar / ProgressRing / MoneyTicker / Sparkline / StatTile / Divider) + MotionConfig spring + utility classes. | Antigravity audit → CC-auditor / Pierre OK → execute | PRÓXIMO |
| 6.B | Sf Client polish: LoyaltyCard hero + tab consolidation (7→4 + FAB) + CouponCard ticket shape + OrderTracker 4-step + CartSheet + Login orange refresh + microlabels uniformization. | Antigravity incremental (3-5 commits) | post 6.A |
| 6.C | Sf Driver polish: tab shell nuevo (Ruta/Paradas/Mapa/Perfil + FAB QR scanner) + TopBar route hero + ActiveStopCard rose + Map custom styling + ScannerSheet QR. **Branding cyan B.5 preservado** (NO emerald del handoff). | Antigravity incremental (3-4 commits) | post 6.B |
| 6.D | Staff polish: bottom nav 5-position con FAB Cobrar + HomeTab Vendedor + QuickActions + PaymentSheet + SuccessSheet + SideDrawer mobile + per-role accents (decisión Pierre). **OPCIONAL / post-MVP** por riesgo y tamaño. | Antigravity, decisión Pierre | post 6.C o deferido |

### Conflictos branding documentados (handoff visual vs B.5 aprobado)

El design system entregado (`design_handoff_stockflow_apps/`) muestra paletas en sus
screenshots que difieren de B.5 aprobado en algunas surfaces. **Esas son referencias
visuales del prototipo, NO decisiones de producto.** En cada commit Tier 6 se preserva B.5.

| Surface | Handoff visual propone | B.5 aprobado (se preserva) | Action en Tier 6 |
|---|---|---|---|
| Staff Vendedor | indigo | indigo | ✅ match — sin cambio |
| Staff Jefe / Logística / Admin | per-role accents (amber / blue / purple) | indigo monolithic | 🟡 decisión Pierre futura, NO automática |
| Sf Client primary CTA | orange (screenshots actualizados ya alineados con B.5) | orange | ✅ match |
| Sf Client loyalty pill | gold gradient | (no equivalente LIVE) | 🟢 considerar como accent secundario, NO replace orange primary |
| **Sf Driver throughout** | **EMERALD** | **cyan** | 🔴 conflicto profundo — preservar cyan B.5, convertir todos los emerald del handoff a cyan en cada commit Driver |

## Tier 4 (post-MVP, deferido)

Migration custom-claims rules helpers. Riesgo grande, fuera de scope inmediato.

## Bloqueos persistentes

### Root cause común: Billing Google Cloud

- **Cuenta**: `01A6C5-9FFB01-CCD92B`
- **Estado**: `billingEnabled: false` (cerrada)
- **Resolución**: Pierre reactiva billing en Google Cloud Console.

A continuación dos servicios distintos bloqueados por el mismo root cause.

### Bloqueo derivado #1: Firebase Storage

- **Estado actual**: code-ready / billing-blocked.
  - `storage.rules` escrita y vinculada en `firebase.json` (commit `9f607d6`).
  - Path Camino B `/shipments/by-driver/{driverId}/{shipmentId}/{file=**}` portable, sin cross-DB `firestore.get()`.
  - `DriverPWA.tsx` con orden estricto upload→commit + rollback de Storage si Firestore falla (Nota Operacional #7 del plan v3).
- **Bloquea**:
  - Creación del bucket `gs://workspace-mcp-493503.firebasestorage.app` en `us-east1` (region match con Firestore named DB `ai-studio-fafdc552-...`).
  - Deploy `firebase deploy --only storage`.
  - Upload runtime de foto-evidencia de entregas fallidas en Sf Driver APK.
  - Test 14 de `probe-5c3-delivery-v2` (Storage adversarial: driver B intenta subir a folder de driver A → debe rechazar con 403).
- **Resolución post-billing**:
  ```bash
  gcloud storage buckets create gs://workspace-mcp-493503.firebasestorage.app \
    --project=workspace-mcp-493503 \
    --location=us-east1 \
    --default-storage-class=standard \
    --uniform-bucket-level-access
  firebase deploy --only storage --project workspace-mcp-493503
  ```
  Después re-correr `probe-5c3-delivery-v2.cjs` para cerrar Test 14. CC-mobile rebuild Sf Driver APK + smoke runtime para validar foto-evidencia upload + rollback empíricamente.

### Bloqueo derivado #2: Google Maps + Routes APIs

- **Estado actual**: code-ready / billing-blocked.
  - API key creada: `projects/452061924377/locations/global/keys/a7f90a70-1a69-4d16-9efe-01e5af253df2`.
  - APIs habilitadas: `maps-backend.googleapis.com` + `routes.googleapis.com`.
  - `.env.local` configurado con la key (gitignored).
- **Bloquea**:
  - Runtime real falla con `BillingNotEnabledMapError` y `ROUTES_COMPUTE_ROUTES: PERMISSION_DENIED`.
  - Sf Client tab "Despacho" muestra overlay de error (no crashea post-`e94914d` BranchProvider fix).
  - Sf Driver vista de mapa con polyline / waypoints / live truck marker queda no funcional.
- **Resolución post-billing**:
  - Una vez billing activo, Maps y Routes responden sin cambios de código.
  - Sub-bloque pendiente paralelo (`5.C.5`): whitelist de origin del WebView Capacitor (`https://localhost/`) + Android package signing fingerprint en Application restrictions de la API key. Trabajo de Cloud Console, sin código.
