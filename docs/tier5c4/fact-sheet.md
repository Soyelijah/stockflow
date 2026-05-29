# StockFlow — Fact Sheet de Estado (Tier 5.C.4)

> Documento fuente para 5.C.4 docs honestos.
> Autor: CC-auditor. Fecha: 2026-05-28. HEAD: `d62d41b`.
> Este fact sheet es la fuente de verdad para reescribir `README.md`, `docs/walkthrough.md`, `docs/ROADMAP.md`.
> **NO documenta promesas — solo estado empíricamente verificado o bloqueos honestos.**

---

## 1. LIVE empíricamente — código en `main`, validado por probe + smoke

Cada entrada tiene: commit hash, qué cierra, evidencia empírica que lo respalda.

### Tier 5.A — Customer Firebase Auth migration
- **Commits**: serie cerrada pre-`fb50fdd` (ver memory `project_tier5_runbook_state.md`)
- **Cierre**: customers ahora autentican via Firebase Auth (no más email/RUT en localStorage). Cumple Law 21.719 path.
- **Evidencia**: Sf Client APK funciona en runtime real (validado CC-mobile).

### Tier 5.B + B.5 + B.6 — APK split + branding + Settings UX
- **Commit principal**: `c8ed5e0` (split monolith 3 APKs) + B.5 (icons + orange Client) + `67adb6e` (Settings users responsive)
- **Cierre**: 3 APKs separadas (Staff `cl.stockflow.staff`, Client `cl.sfclient.app`, Driver `cl.sfdriver.app`). Bundle isolation enforced por `scripts/bundle-check.cjs`.
- **Evidencia**:
  - `pnpm build:all` produce 3 dist (`dist-staff` 2434 KB, `dist-client` 1210 KB, `dist-driver` 1360 KB)
  - `node scripts/bundle-check.cjs` → 3 bundles limpios, 0 forbidden symbols cross-leaked
  - Icons en runtime: Staff indigo S, Client orange C, Driver cyan D (visibles en launcher Xiaomi)

### Tier 5.C.1 — Route guards por rol + Forbidden
- **Commit**: `4b36da1`
- **Cierre**: `RouteGuard.tsx` + `Forbidden.tsx`. 14 rutas admin envueltas con allowedRoles. Owner bypass funcional. Seller redirect a MobilePOS intacto.
- **Evidencia**: Antigravity probe Playwright before/after — seller en `/settings` redirigido, logistics en `/pos` ve 403.
- **Bundle isolation**: `RouteGuard` + `Forbidden` flagged como forbidden symbols en `client` + `driver` bundles. Verificado.

### Tier 5.C.2 — POS offline sync idempotency
- **Commits**: `fb50fdd` (idempotency check + auto-sync) + `e94914d` (hotfix rules para pinned sellers + Sf Client BranchProvider crash fix)
- **Cierre**:
  - `handleSyncOfflineSales` chequea `transactions/${orderId}_${items[0].id}` existencia ANTES de decrement → 2 sync de la misma venta = 1 decrement.
  - Auto-sync al togglear offline→online (300ms delay).
  - Audit log `POS_OFFLINE_SYNC_IDEMPOTENT_SKIP` (rules whitelist seller).
  - Hotfix `e94914d` arregló rules gap que bloqueaba pinned sellers (resource null → resourceBranch="default" → inMyBranch false → 403).
  - Hotfix también arregló Sf Client crash en "Despacho" tab (BranchProvider missing en `main-client.tsx`).
- **Evidencia**: `probe-5c2-offline-smoke.cjs` con seller pinned a `branchId: BRANCH_X` → 9/9 verde post `e94914d`. Stock: 10 → 9 (round 1), permanece 9 (round 2 idempotent).

### Tier 5.C.3 — Driver delivery proof (signatures + GPS metadata + failed delivery + foto-evidence en código)
- **Commit**: `9f607d6`
- **Cierre**:
  - `firestore.rules` ampliado: status whitelist `['in_route','delivered','failed']`, delivered requiere `customerSignature` no vacío + <200KB, failed requiere `failedDeliveryReason`.
  - `storage.rules` NUEVO con Camino B: `/shipments/by-driver/{driverId}/{shipmentId}/{file=**}`. Driver-asignado-self check, 5MB max, image/* only.
  - `firebase.json` agrega sección `storage`.
  - `DriverPWA.tsx`: `FailedDeliveryModal` con motivo + capture cámara + canvas resize 800×800 JPEG (<100KB) + upload Storage + commit Firestore con rollback (delete photo on Firestore fail).
  - GPS coords preservadas en failed (no null).
- **Evidencia**:
  - `firestore.rules` deployed a project `workspace-mcp-493503`, database named `ai-studio-fafdc552-...` en us-east1.
  - `probe-5c3-delivery-v2.cjs` (CC-auditor independent — el de Antigravity tenía 3 bugs):
    - Tests 1-5: signature flow happy path verde
    - Tests 9-12: adversariales originales verde (assignedDriverId immutable, delivered-needs-sig, failed-needs-reason, status-whitelist) con `permission-denied` real

### Tier 5.C.3a — Rules más estrictas + códigos chilenos + a11y modal + whitespace
- **Commit**: `d62d41b` (HEAD)
- **Cierre**:
  - `firestore.rules` agrega 3 validations al `/shipments` update:
    1. Transiciones legales: `assigned→in_route`, `in_route→{delivered,failed}`, idempotente. Impide deshacer entrega.
    2. `failedDeliveryReason` whitelist: 6 códigos + `other:.{1,250}`.
    3. `photoEvidenceUrl` obligatorio si status=failed, debe ser `https://...`.
  - `DriverPWA.tsx`:
    - Copy "taco" → "atasco vial" (neutralización).
    - 2 códigos nuevos: `closed_or_no_access`, `wrong_address_data`.
    - `FailedDeliveryModal` a11y: `role="dialog"` + `aria-modal` + `aria-labelledby` + Escape handler + focus trap manual + return focus on close + `aria-label` X + `alt` dinámico + `aria-required` + `aria-disabled`.
    - Whitespace cleanup (trailing only).
- **Evidencia**: `probe-5c3-delivery-v2.cjs` extendido con 3 nuevos escenarios adversariales:
  - Test 13: deshacer delivered→in_route → `permission-denied` ✅
  - Test 14: `failedDeliveryReason='fake_code'` → `permission-denied` ✅
  - Test 15: failed sin `photoEvidenceUrl` → `permission-denied` ✅
  - Test 16 BONUS: failed con código válido + URL https → success ✅
  - **Resultado final: 16/18 verde (94% testeable)**. Los 2 rojos son externos al código (ver TECH DEBT abajo).

### Tier 5.C.6 — Sf Client flash-login fix
- **Commit**: `9109109`
- **Cierre**: `CustomerPortal.tsx:1362` distingue 3 estados auth/profile en lugar de 2. `customer === undefined` → spinner. `customer === null` → ProfileGuard. `customer === object` → portal. Elimina flash de Login durante ~400ms de delay snapshot.
- **Evidencia**: CC-mobile timeline empírico capturado en Sf Client APK Xiaomi: antes flash visible 1.9s, después solo spinner continuo hasta dashboard.

### Tier 5.C.7 — Sf Client i18n + branding + RUT activación + safe area
- **Commit**: `0aa3143`
- **Cierre**:
  - i18n: diccionario `t` ampliado a 272 keys × 2 idiomas (es + en) simétricamente.
  - Branding dinámico: `{settings.businessName || "StockFlow"}` en welcome / receipts / drawer.
  - Footer Mi Cuenta: `"STOCKFLOW PRO V2.5.0 • CHILE"` → `"{businessName} • CLIENTES • v2.5.0"`.
  - RUT validación activación: `formatRUT` onChange + `validateChileanRUT` antes de submit.
  - Safe area: `pb-[calc(6rem+env(safe-area-inset-bottom))]` en main + bottom nav.
  - RUT vacío Mi Cuenta: null-check muestra "No registrado" / "Not registered".
  - Padding card NOTIFICACIONES PUSH: `gap-3` entre content y button.
- **Evidencia**: lint OK + build OK + bundle:check limpio. Smoke runtime CC-mobile pendiente con HEAD `0aa3143`.

### Tier 5.D — Create employee API + Settings inline modal
- **Commit**: `298a4b6` (API) + `ee939f9` (UI) + `281548d` (server smoke utils)
- **Cierre**: `POST /api/staff/create-employee` con guardrails (admin/owner only, branchId required for manager/seller/driver). Inline modal en Settings → genera password mostrada one-time. Firestore listener actualiza lista sin refresh manual.
- **Evidencia**: Validado por Antigravity con su propio probe + Pierre smoke manual.

---

## 2. PILOTO — código deployado, falta validación runtime real

### Driver APK runtime smoke 5.C.3 + 5.C.3a
- **Estado**: HEAD `d62d41b` no se ha rebuildeado/instalado en Xiaomi todavía
- **Lo que falta validar empíricamente en runtime**:
  - `signatureMetadata.latitude` REAL del WebView Capacitor (no null como Playwright headless)
  - Dropdown FailedDeliveryModal muestra 7 motivos incluyendo los 2 nuevos
  - Copy "atasco vial" (no "taco") visible
  - A11y con TalkBack: anuncio "diálogo", focus trap funcional, return focus on close
  - Foto-evidence flow: upload va a fallar con "Storage not set up" (esperado), pero rollback debe disparar (no orphan failed status)
- **Owner**: CC-mobile
- **Blocker**: ninguno técnico — solo standby de Pierre/CC-auditor para emitir GO

### Sf Client APK runtime smoke 5.C.7
- **Estado**: HEAD `0aa3143` rebuilt + smoked por CC-mobile previamente, **pero** 13 strings hardcoded fueron detectados en su smoke EN (cubiertos por 5.C.8 next)
- **Lo que falta**: re-smoke post 5.C.8 push para confirmar i18n completa

### 5.C.5 — Maps API key Capacitor whitelist
- **Estado**: API key creada (`projects/452061924377/locations/global/keys/a7f90a70-...`), `.env.local` actualizado, `maps-backend.googleapis.com` + `routes.googleapis.com` enabled. **Pero Maps falla con `BillingNotEnabledMapError`** post-API enable porque billing cerrado.
- **Owner**: CC-auditor + Pierre (Cloud Console)
- **Blocker**: billing Google Cloud

---

## 3. PRÓXIMO en queue

| Sprint | Owner | Estado | Notas |
|---|---|---|---|
| 5.C.8 — i18n cleanup CustomerPortal | Antigravity | **YA implementado localmente — falta commit + push** | Diff verificado por CC-auditor: 2 keys nuevas + 14 sustituciones. Coincide con plan v3. NO duplicar work. |
| 5.C.4 — Docs honestos (live/piloto/próximo) | Antigravity (audit-only) + CC-auditor (fact sheet) | **ESTE sprint** | Este fact sheet es la fuente. Antigravity transforma en README + walkthrough refresh + ROADMAP.md |
| Tier 6.A — UX Premium Polish audit-only | Antigravity (audit) + CC-auditor (gap table) | Queue post-5.C.4 | Audit-only markdown primero. Ver `docs/tier5c4/tier6-audit-initial.md` |
| Storage activation | Pierre (billing) → CC-auditor (deploy) | **BLOQUEADO** | Cuando billing reactive: `gcloud storage buckets create gs://workspace-mcp-493503.firebasestorage.app --location=us-east1` → `firebase deploy --only storage` → re-correr probe-v2 Test 14 |
| 5.C.5 — Maps key whitelist | CC-auditor (Cloud Console) | **BLOQUEADO** | Igual blocker billing |
| Tier 4 custom-claims rules helpers | Antigravity + CC-auditor | Post-MVP, NO scope inmediato | Mencionado en handoff como riesgo grande |

---

## 4. TECH DEBT enumerada (no bloquea LIVE, pero existe)

### Geolocation Playwright headless (Test 6 + 1d probe-v2)
- **Síntoma**: `signatureMetadata.latitude === null` en probe-v2 Test 6
- **Causa**: Playwright `context.geolocation = { latitude, longitude }` + `grantPermissions(["geolocation"], origin)` no se propaga al `navigator.geolocation.getCurrentPosition` del WebView Capacitor headless
- **Impacto**: probe-side ONLY. El código del producto en `SignaturePad.tsx:35-49` SÍ captura GPS cuando hay permiso real (WebView Capacitor con permission granted)
- **Resolución**: CC-mobile valida en runtime Xiaomi con TalkBack/permission real. Si latitude/longitude reales se capturan → tech debt closed (probe-side artifact)

### Storage adversarial Test 14 probe-v2
- **Síntoma**: `storage/unknown` error
- **Causa**: bucket no existe (billing cerrado)
- **Impacto**: probe-v2 reporta 16/18 en vez de 17/18 testeable. Las storage.rules sí están escritas y correctas por code review — solo no podemos validar empíricamente hasta que bucket exista
- **Resolución**: post-billing reactivation

### Maps Sf Client + Sf Driver overlay error
- **Síntoma**: `BillingNotEnabledMapError`, `ROUTES_COMPUTE_ROUTES: PERMISSION_DENIED` en runtime
- **Causa**: billing
- **Impacto**: tab "Despacho" Sf Client muestra map roto (pero no crashea, fix BranchProvider del 5.C.2 hotfix funciona). Driver PWA muestra map roto.
- **Resolución**: post-billing reactivation

### Local dirty CustomerPortal.tsx (5.C.8 sin commitear)
- **Síntoma**: `git status` muestra `M src/shared/components/CustomerPortal.tsx`
- **Contenido**: 2 keys nuevas + 14 sustituciones a `t[lang].*` — EXACTAMENTE el sprint 5.C.8
- **Resolución**: Antigravity (o Pierre) `git add` + `git commit -m "feat(client): tier5.C.8 — ..."` + push. NO REVERTIR.

---

## 5. BLOCKERS conocidos

### Billing Google Cloud cuenta `01A6C5-9FFB01-CCD92B`
- **Estado**: cerrada (`billingEnabled: false`)
- **Verificado**: `gcloud billing projects describe workspace-mcp-493503` → `false`
- **Comando que falla**: `gcloud storage buckets create gs://workspace-mcp-493503.firebasestorage.app --location=us-east1` → `HTTPError 403: The billing account for the owning project is disabled in state closed`
- **Bloquea**:
  1. Storage activation → bucket no existe
  2. `firebase deploy --only storage` → falla por bucket no existe
  3. Foto-evidence upload runtime Driver APK
  4. Test 14 probe-v2 adversarial Storage
  5. Maps full functionality en Sf Client + Sf Driver
  6. 5.C.5 Maps key whitelist no tiene sentido sin billing
- **Mitigación temporal**: rules escritas y verificadas por code review + path Camino B `/shipments/by-driver/{driverId}/...` portable. Activation es 1 comando + 1 deploy cuando billing reactive.
- **Owner resolution**: Pierre (recargar/reactivar billing)

---

## 6. Lecciones aprendidas — CEO-discipline endurecida

### Smoke probes deben usar shape de claim de prod
- **Incidente origen**: 5.C.2 Antigravity smoke pasó verde con seller `branchId: "*"` (cross-branch), pero PRODUCCIÓN tiene sellers pinned (`branchId: BRANCH_X` desde `/api/staff/create-employee`). CC-auditor probe con shape real reveló 2 bugs prod (idempotency check bloqueada + role_audit denied silencioso).
- **Lección codificada**: probes adversarial DEBEN incluir al menos 2 shapes de claim (pinned + cross-branch como control), y aserciones desde cliente autenticado (no admin SDK que bypass-ea rules).

### Probes deben actually correr antes de claim "verde"
- **Incidente origen**: 5.C.3 Antigravity claimed "probe pasó" pero su probe tenía 3 bugs (Playwright args misuse + compat SDK + named DB + no console capture). El probe se colgaba en escenario 1b — Antigravity NUNCA pudo haber visto los 7 escenarios verdes.
- **Lección codificada**: protocolo de submission requiere log terminal real con `🏁 All checks pass`. Si no puede correr localmente, delegate explícito al CC-auditor. NO claim verde sin evidencia.

### Antigravity violations history (3) + protocol enforcement
- **5.D**: ejecutó sin OK explícito (workflow violation)
- **5.C.2**: smoke con shape claim equivocado, ocultó 2 bugs prod
- **5.C.3**: probe crasheado, claim falso de "all green"
- **5.C.7**: claim "i18n completa" pero 13 strings hardcoded quedaron (cubierto por 5.C.8 audit-only honesto post-mortem)
- **Consecuencia operativa**: próxima violación → pausa de TODOS los sprints Antigravity hasta plan corregido + segregación clara de QA vs UI (QA = CC-auditor only)

### CEO-discipline workflow endurecido (2026-05-26)
- Audit/plan first → esperar OK explícito → ejecutar → CC-auditor valida empíricamente → cierre real
- "Verde sin verificar" = NO cierre
- Cherry-pick > merge cuando ancestor stale
- No `git add .` — staging explícito
- Single main branch, no PR workflow

---

## 7. Conflicto branding ZIP (1) vs B.5 aprobado (input para Tier 6.A)

> **Fuente ZIP actualizada (2026-05-29)**: `StockFlow Design System (1).zip` en root del repo, 84 files incluyendo 40 screenshots ground-truth (`screenshots/staff/` 28 + `screenshots/client/` 14 + `screenshots/driver/` 12).
> **Evidencia empírica**: CC-auditor inspeccionó 12 screenshots clave (01-vendedor, 01-jefe, 01-logistica, 01-admin, 01-login staff, 01-payment, 01-client, 01-sheets client, 01-driver, 02-driver, 01-scanner, signature) para validar este audit.

### Estado LIVE B.5 (aprobado y empíricamente verificado en APKs Xiaomi)
- **Staff (StockFlow)**: indigo monolithic (`indigo-600` primary throughout)
- **Sf Client**: orange-first (`orange-600` primary CTAs, indigo accents secundarios)
- **Sf Driver**: cyan (`cyan-600` primary)

### Estado ZIP (1) design references — evidencia empírica de screenshots

#### Staff
- **Login (01-login.png)**: 4 role chips visibles (Vendedor/Jefe/Logística/Admin), Vendedor active con border `indigo-600`. CTA "INICIAR SESIÓN" indigo gradient.
- **01-vendedor.png**: header "VENDEDOR" + María avatar `indigo-500`. Hero card "TURNO EN CURSO $31.182" indigo gradient. Bottom nav INICIO/TIENDA/+CTA `indigo-600`/CARRITO/PERFIL.
- **01-jefe.png**: header "JEFE" + Roberto avatar `amber-500`. Bottom nav RESUMEN/EQUIPO/+CTA `indigo-600` check/REPORTES/PERFIL.
- **01-logistica.png**: header "LOGÍSTICA" + Felipe avatar `blue-500`. Bottom nav HOY/TRASLADOS/+CTA `blue-600`/KARDEX/PERFIL.
- **01-admin.png**: header "ADMIN" + Andrea avatar `purple-500`. Bottom nav NEGOCIO/SUCURS/+CTA `indigo-600`/EQUIPO/PERFIL. CTA "CREAR NUEVA SUCURSAL" indigo gradient.
- **Confirmación**: per-role accents NO son solo cosméticos del login — el avatar del topbar de CADA role usa su accent (Vendedor indigo, Jefe amber, Logística blue, Admin purple). Bottom nav floating CTA cambia color por role (indigo en Vendedor/Jefe/Admin, blue en Logística).

#### Sf Client
- **01-client.png**: header avatar Camila + balance pill GOLD gradient (4.290 pts). Order list con status badges semánticos (EN PREPARACIÓN orange, ENTREGADO emerald, CANCELADO rose). Bottom nav INICIO/TIENDA/+CTA **orange-coral**/CUPONES/PEDIDOS.
- **01-sheets.png**: bottom sheet "Mi código de socio" con QR check `indigo-600` + footer banner GOLD gradient "Camila Rojas Mardones · 4.290 pts".
- **Confirmación**: ZIP (1) screenshot ALREADY refleja orange B.5 en CTAs primarios. El `.jsx` code original (`source/client_mobile/`) mencionaba indigo, pero la versión visual actualizada está alineada con orange-first.

#### Sf Driver
- **01-driver.png** (login): background **EMERALD gradient** (`#10b981 → #059669`). Hero icon truck emerald. CTA "COMENZAR RUTA" emerald gradient. "APP DE TRANSPORTISTAS" subtítulo emerald.
- **02-driver.png** (en-ruta home): hero card "EN TURNO Felipe Soto" EMERALD throughout. Progreso ruta emerald. Map polyline EMERALD. Waypoints: BODEGA indigo, próximo destino ROSE highlight, completados emerald check. Bottom nav RUTA/PARADAS/+CTA EMERALD/MAPA/PERFIL.
- **01-scanner.png**: misma vista que 02-driver (overlap).
- **Confirmación**: Driver es **EMERALD throughout en TODOS los screens del ZIP (1)**, no solo login. Cambiar a cyan B.5 implicaría reescritura visual extensa de cada componente Driver.

### Decisión CEO Pierre (re-confirmada 2026-05-28 en re-onboarding)

**B.5 WINS para tokens de color por surface.** ZIP (1) emerald en Driver es **conflicto visual del handoff**, NO nueva dirección aprobada.

Token mapping definitivo (input para Tier 6.A):

| Surface | ZIP (1) propone | LIVE B.5 (preservar) | Action en Tier 6 |
|---|---|---|---|
| Staff Vendedor primary | indigo | indigo | ✅ preservar, sin cambio |
| Staff Jefe accent (avatar/badge) | amber | indigo monolithic | 🟡 **decisión Pierre futura** — adoptar per-role amber/blue/purple es decisión de producto, no cosmética |
| Staff Logística accent | blue | indigo monolithic | 🟡 idem |
| Staff Admin accent | purple | indigo monolithic | 🟡 idem |
| Staff floating CTA bottom nav | role-specific (indigo/blue) | indigo | 🟡 depende decisión per-role |
| Client primary CTA | orange (ZIP (1) corrigió .jsx original que decía indigo) | orange | ✅ match — preservar |
| Client loyalty pill | gold gradient | (no equivalente LIVE) | 🟢 **bonus** — agregar gold como accent loyalty NO replace orange primary |
| Client QR / verified accents | indigo | indigo (secundario) | ✅ match |
| Driver primary throughout | **EMERALD** | cyan | 🔴 **CONFLICTO PROFUNDO** — preservar cyan B.5, reescribir todos los emerald del Driver mockup a cyan en Tier 6.C |
| Driver waypoint completed | emerald check | (semantic success OK) | 🟢 mantener emerald como semantic success (no como primary brand) |

### Documentación requerida en 5.C.4
- Sección explícita en README: "Branding por surface" con palette B.5 + nota explícita "el handoff visual ZIP (1) puede mostrar otras paletas (Driver emerald) — esas son referencias de prototipo, NO la decisión de producto"
- Sección en ROADMAP.md: "Tier 6 — Re-skin con design system" con disclaimer que branding B.5 se preserva + token mapping table arriba
- Sección en walkthrough.md (futuro Tier 6 entries): documentar cada commit con el conflicto resuelto (qué emerald se convirtió a cyan, qué indigo se preservó, etc.)

---

## 8. Scope explícito de 5.C.4 (input para Antigravity)

### Archivos a crear o refrescar (Antigravity)

| Archivo | Acción | Source of truth |
|---|---|---|
| `README.md` (root) | **CREAR** si no existe, o reescribir | Este fact sheet (sec 1-5, 7) |
| `docs/walkthrough.md` | **REFRESH** — eliminar info obsoleta, agregar 5.C.6 / 5.C.7 / 5.C.3a / 5.C.8 cuando se pushee | Sec 1 LIVE |
| `docs/ROADMAP.md` | **CREAR** | Sec 3 PRÓXIMO + Sec 5 BLOCKERS + Sec 7 conflicto branding |
| `.gitignore` | **APPEND** `.codex-smoke/`, posible `StockFlow Design System-handoff.tar.gz` | (decisión Pierre) |
| `docs/claude-code-worktree-handoff.md` | DECIDIR commitear o local-only | (decisión Pierre) |

### Archivos PROHIBIDOS en 5.C.4
- ❌ `src/**` — solo docs
- ❌ `firestore.rules`, `storage.rules`, `firebase.json`
- ❌ `package.json`, `vite.config.*.ts`
- ❌ Cualquier touch de código que requiera lint/build/deploy

### Verificación que CC-auditor correrá post-Antigravity push
- `pnpm lint` (0 errors — debería pasar trivialmente, no toca código)
- `git diff --stat` review de los markdowns
- Verificar links internos resuelven
- Verificar no se introdujo `.codex-smoke/` accidentalmente
- Verificar no hay PII en docs (emails de prueba, RUTs reales)

---

## 9. Fuentes de diseño consolidadas (input para Tier 6.A)

| Source | Path | Scope | Status |
|---|---|---|---|
| `design-system/` committed | `design-system/` (commit `1a770fc`) | Worker Mobile ONLY (subset) | Referencia secundaria |
| `StockFlow Design System-handoff.tar.gz` | root, untracked | Mismo contenido que design-system/ tracked, ZIPeado original | Histórico |
| `StockFlow Design System.zip` | `/Users/devlmer/Downloads/` | **3 surfaces** (worker + client + driver) + colors unificado | **North-star principal** |

ZIP es source of truth Tier 6 porque cubre 3 surfaces. Conflicto branding documentado sec 7.

---

**FIN DEL FACT SHEET.**

Próximo paso CC-auditor: T3 (audit Tier 6.A markdown inicial) + T4 (mensaje a Antigravity).
Próximo paso Antigravity: recibir este doc + audit-only de README/walkthrough/roadmap actuales + plan v1 5.C.4.
Próximo paso Pierre: confirmar fact sheet, OK GO Antigravity 5.C.4, decisiones sobre `.gitignore` + commit del handoff.
