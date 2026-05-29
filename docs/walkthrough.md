# StockFlow — Walkthrough de sprints

> Historial técnico detallado por sprint del Tier 5.
> Para roadmap futuro ver `docs/ROADMAP.md`.
> Para contrato del repo ver `AGENTS.md`.

## Tier 5.A — Customer Firebase Auth migration

Migración de autenticación de clientes de localStorage (email/RUT) a Firebase Auth real.
Cumple path Law 21.719. Habilita reset de contraseña, verificación de email, y custom
claims `role: "customer"` para todos los registrados en `/cliente`.

**Evidencia**: Sf Client APK funcional en runtime real con login/register/recover/activate
validados por CC-mobile.

## Tier 5.B + B.5 + B.6 — APK split + branding + Settings UX

Commits: `c8ed5e0` (split monolith en 3 APKs) + B.5 (icons + orange Client) + `67adb6e`
(Settings users responsive + Dashboard cleanup).

**Cambios principales**:

- 3 APKs separadas con package distintos:
  - `cl.stockflow.staff` (Staff app indigo)
  - `cl.sfclient.app` (Sf Client orange)
  - `cl.sfdriver.app` (Sf Driver cyan)
- Bundle isolation enforcement vía `scripts/bundle-check.cjs`: cada bundle prohíbe
  símbolos del otro role (`AdminRoutes`/`MobilePOS` no aparecen en client/driver
  bundles, `costPrice`/`ShrinkageReport` no aparecen en client, etc.).
- B.5: adaptive icons launcher Xiaomi (Staff indigo S, Client orange C, Driver cyan D).
  Sf Client UI orange-first, Staff UI indigo, Driver UI cyan.
- B.6: Settings users con responsive cards + MapPin branch display + debounced search +
  role grouping. Dashboard panel obsoleto "App Movil de Clientes" removido.

**Evidencia**: `pnpm build:all` produce 3 distintos (`dist-staff` 2434 KB, `dist-client`
1210 KB, `dist-driver` 1360 KB). `bundle:check` verde con 0 forbidden symbols
cross-leaked. Playwright before/after capturado por Antigravity.

## Tier 5.C.1 — Route guards por rol + Forbidden component

Commit: `4b36da1`.

`RouteGuard.tsx` + `Forbidden.tsx` nuevos. 14 rutas admin envueltas con
`<RouteGuard allowedRoles={[...]}>`. Bypass de owner funcional. Seller redirect a
MobilePOS preservado. `bundle-check.cjs` actualizado para flag `RouteGuard` y
`Forbidden` como forbidden symbols en client/driver bundles.

**Evidencia**: Antigravity Playwright before/after — seller en `/settings` redirigido,
logistics en `/pos` ve 403 con Forbidden component, owner accede a todo.

## Tier 5.C.2 — POS offline sync idempotency

Commits: `fb50fdd` (idempotency check + auto-sync) + `e94914d` (hotfix rules pinned
sellers + Sf Client BranchProvider crash).

**Bug crítico encontrado**: retry de sync offline después de timeout podía
double-decrement stock y double-award loyalty points si la primera sync había
parcialmente completado.

**Fix**: en `handleSyncOfflineSales` se chequea `transactions/${orderId}_${items[0].id}`
existencia ANTES de decrement / points. Si ya existe, skip transaction (return) y
mark exitosa para limpiar la cola local. Auto-sync al togglear offline→online
(300 ms delay). Audit log `POS_OFFLINE_SYNC_IDEMPOTENT_SKIP` para ops visibility.

**Hotfix `e94914d` necesario** porque la implementación original rompía pinned
sellers en producción:

- Rule de `/transactions` read fallaba con resource null (idempotency check sobre
  doc inexistente). Fallback `resourceBranch()='default'` rechazaba sellers pinned
  a branches concretas. Fix: agregar `resource == null` al OR del rule isSeller.
- Rule de `/role_audit` create requería isAdmin. Sellers silently dropped. Fix:
  whitelist seller para `POS_OFFLINE_SYNC_IDEMPOTENT_SKIP` con
  `operatorUid == auth.uid`.
- Bug paralelo Sf Client crash en tab "Despacho": `main-client.tsx` sin
  `BranchProvider` wrapping → `DeliveryMap` con `useBranch()` crasheaba. Fix:
  agregar `<BranchProvider>` (no rompe behavior — cliente fall back a "default"
  branch).

**Evidencia**: `probe-5c2-offline-smoke.cjs` con seller pinned a branchId concreto
post-`e94914d`: 9/9 verde. Stock 10→9 round 1, permanece 9 round 2 con
idempotency. role_audit row escrita.

## Tier 5.C.3 — Driver delivery proof (signature + foto-evidencia code-ready)

Commit: `9f607d6`.

**Cambios firestore.rules**: `/shipments` update por driver amplía allowlist con
`signatureMetadata` + `failedDeliveryReason` + `failedAt` + `photoEvidenceUrl`.
Validations: status ∈ ['in_route', 'delivered', 'failed']; delivered requiere
`customerSignature` non-empty + < 200 KB; failed requiere `failedDeliveryReason`.

**Nuevo storage.rules**: Camino B (path encoded driver UID, sin firestore.get cross-DB
fragile). Path: `/shipments/by-driver/{driverId}/{shipmentId}/{file=**}`. Driver
asignado puede escribir su folder; size limit 5 MB; image/* only.

**`firebase.json`**: agrega sección storage para deploy.

**`DriverPWA.tsx`**: `FailedDeliveryModal` nuevo con motivo + capture cámara
(`accept="image/*" capture="environment"`) + canvas resize 800×800 JPEG (<100 KB)
+ upload Storage + commit Firestore con rollback (delete photo si Firestore falla).
GPS coords preservadas en failed (no nullear). Orden estricto upload→commit.

**Evidencia**: `firestore.rules` deployadas. `storage.rules` code-ready pero deploy
bloqueado por billing. `probe-5c3-delivery-v2.cjs` tests 1-5 + 9-12 verde
(signature flow + adversariales originales) con `permission-denied` real.

## Tier 5.C.3a — Rules más estrictas + a11y modal + códigos chilenos + whitespace

Commit: `d62d41b` (HEAD actual del walkthrough).

**`firestore.rules`**: 3 validations nuevas al `/shipments` update:

1. Transiciones legales: `assigned→in_route`, `in_route→{delivered,failed}`,
   idempotente. Impide deshacer entrega ya marcada.
2. `failedDeliveryReason` whitelist (6 códigos):
   `address_not_found / recipient_not_available / recipient_rejected /
   force_majeure / closed_or_no_access / wrong_address_data` o
   `^other:.{1,250}$`.
3. `photoEvidenceUrl` obligatorio si status=failed, debe matchear `^https://.*`.

**`DriverPWA.tsx`**:

- Copy "taco" → "atasco vial" (neutralización Chile, "taco" es slang).
- 2 códigos nuevos en `reasons` array: `closed_or_no_access` ("Local cerrado /
  sin acceso al edificio") + `wrong_address_data` ("Dirección incorrecta en el
  sistema").
- `FailedDeliveryModal` a11y completa: `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby` + Escape handler + focus trap manual + return focus on close
  + `aria-label="Cerrar modal"` en botón X + alt dinámico en imagen preview +
  `aria-required` en select + `aria-disabled` en confirm.
- Whitespace cleanup (trailing only, no Prettier full).

**Evidencia**: `probe-5c3-delivery-v2.cjs` extendido a 18 tests, 16/18 verde
(94 % testeable). Los 2 rojos son externos:

- Test 6: `signatureMetadata.latitude=null` (probe-side, Playwright headless
  geolocation mock no se propaga al WebView Capacitor). Producto OK por code
  review; validación runtime en Xiaomi real pendiente.
- Test 14: Storage adversarial bucket inexistente (billing-blocked).

Nuevos tests 13-15 verdes (deshacer entrega bloqueado, reason fuera de
whitelist bloqueado, failed sin photoEvidenceUrl bloqueado). Test 16 bonus
verde (failed con whitelist + https valid → success).

## Tier 5.C.6 — Sf Client flash-login fix

Commit: `9109109`.

`CustomerPortal.tsx:1362` distinguía solo 2 estados auth/profile (logged-in vs
not). Resultado: durante los ~400 ms de delay del snapshot `/customers/{uid}`,
mostraba el Login screen aunque el user ya estuviera autenticado.

**Fix**: 3 estados explícitos.

- `customer === undefined` (snapshot pendiente) → spinner orange.
- `customer === null` (snapshot vacío / sin perfil) → LoginScreen / ProfileGuard.
- `customer === object` → portal happy path.

**Evidencia**: CC-mobile timeline empírico en Sf Client APK Xiaomi:
antes flash visible ~1.9 s; después solo spinner continuo hasta dashboard.

## Tier 5.C.7 — Sf Client i18n + branding + RUT activación + safe area

Commit: `0aa3143`.

- Diccionario `t` ampliado a 272 keys × 2 idiomas (es + en) simétricamente.
- Branding dinámico: `{settings.businessName || "StockFlow"}` en welcome /
  receipts headers / drawer footer.
- Footer Mi Cuenta: `"STOCKFLOW PRO V2.5.0 • CHILE"` →
  `"{businessName} • CLIENTES • v2.5.0"`.
- RUT activación: `formatRUT` onChange dinámico + `validateChileanRUT` antes de
  submit (intercepta requests con dígito verificador incorrecto).
- Safe area: `pb-[calc(6rem+env(safe-area-inset-bottom))]` en main wrapper +
  bottom nav (no más superposición con home indicator iOS/Android).
- RUT vacío Mi Cuenta: null-check muestra "No registrado" / "Not registered".
- Padding card NOTIFICACIONES PUSH: `gap-3` entre content y button.

**Evidencia**: lint + build + bundle:check verde. CC-mobile smoke runtime
pendiente con HEAD `0aa3143`.

## Tier 5.C.8 — i18n cleanup CustomerPortal

Commit: `28b4f29`.

- 2 keys nuevas en `t.es` y `t.en`: `viewReceipts` + `accountSecurity`.
- 14 sustituciones de strings hardcoded a `t[lang].*` en Mi Cuenta drawer +
  Tienda Online tab + footer.
- Traducida la sección completa para asegurar coherencia en el cambio de idiomas.

## Tier 5.D — Create employee API + Settings inline modal

Commits: `298a4b6` (API backend) + `ee939f9` (UI modal) + `281548d` (server smoke
utils).

- `POST /api/staff/create-employee`: guardrails (admin/owner only;
  `branchId` REQUERIDO para manager/seller/driver con validation que el branch
  existe en `/branches`).
- Settings inline modal: crear empleado sin salir de Settings. Genera password
  one-time mostrada en banner verde post-creación. Firestore listener
  actualiza lista sin refresh manual.
- A11y modal completo (role dialog + aria-modal + focus management).

**Evidencia**: Antigravity probe + Pierre smoke manual.

## Tier 6.A — UX Premium Polish — Foundations

Commit: `[6.A-commit-hash]`.

**Cambios principales**:
- **Tipografía Autohospedada**: Instalación de la tipografía variable Inter (`@fontsource-variable/inter` ^5.1.0) para asegurar compatibilidad offline en Capacitor. El CSS importa la versión `latin.css` (OBS #2 aplicada para forzar empaquetado del subset latin de ~102 KB).
- **Mapeo de Tokens de Diseño (Tailwind v4)**: Declaración de las variables semánticas `--sf-*` en `:root` y mapeo en el bloque `@theme` dentro de `src/index.css` (duraciones, sombras, easings).
- **Clases de Utilidad Estandarizadas**: Creación del archivo `src/shared/styles/sf-utilities.css` que incluye `.sf-microlabel`, `.sf-tap` (active scale 0.96), `.sf-press` (active scale 0.99 con Y-translate, OBS #1 aplicada), `.sf-spring` (transición elástica global) y `.sf-tabular-nums`.
- **8 Componentes Atómicos Primitivos**: Creados en `src/shared/components/ui/sf/` con tipado TypeScript y named imports de Lucide para tree-shaking (Pill, IconChip, Avatar, ProgressRing, MoneyTicker, Sparkline, StatTile, Divider).
- **Control de Iconos Inexistentes (Safeguard)**: Guard en `IconChip.tsx` que advierte en consola de desarrollo si se intenta cargar un icono no registrado en la whitelist, previniendo excepciones en runtime.
- **MotionConfig Global**: Inyección de dinámicas de resorte centralizadas (`ease: [0.32, 0.72, 0, 1]`, `duration: 0.35`) en `main-staff.tsx`, `main-client.tsx` y `main-driver.tsx`.

**Evidencia**:
- `pnpm lint`: 0 errores.
- `pnpm build:all`: Compilación de producción exitosa en dist-staff, dist-client y dist-driver.
- `pnpm bundle:check`: 100% verde con driver totalizando **1360.6 KB** (bajo el límite de 1400 KB).
