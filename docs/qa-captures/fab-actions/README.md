# QA capturas — SPEC-fab-actions (FAB "+" acción real de crear)

Capturas on-device de la implementación de `design_handoff_stockflow_apps/SPEC-fab-actions.md`
(Opción 1: el FAB "+" ejecuta una acción real de crear, no navega a un tab).

- **Device:** emulator-5556 (Android, density 320 = 360dp).
- **Rol/cuenta:** cuentas throwaway `fabsmoke-*@stockflow.test` (con claim real), eliminadas tras la prueba.
- **Backend:** datos escritos contra Firestore real a través de las `firestore.rules` desplegadas.

## Fase 1 — Logística (FAB → CreateTransferSheet → `/transfers`)

| Archivo | Qué muestra |
|---|---|
| `fase1-logistica-01-home.png` | Home del shell logística (bottom-nav + FAB). |
| `fase1-logistica-02-traslados-vacio.png` | Tab Traslados con empty-state honesto (0 activos). |
| `fase1-logistica-03-sheet-abierto.png` | CreateTransferSheet abierto (origen/destino/productos/nota). |
| `fase1-logistica-04-sheet-lleno.png` | Form lleno: Principal → Centro, Corona ×3, nota. |
| `fase1-logistica-05-traslado-creado.png` | Traslado creado → tarjeta PENDIENTE en la lista, KPI Pendientes=1. |
| `fase1-logistica-06-fab-abre-sheet.png` | El FAB "+" abre el sheet (prueba de que ya no es no-op). |

## Fase 2 — Admin/Owner (FAB → CreateMenuSheet)

| Archivo | Qué muestra |
|---|---|
| `fase2-admin-01-menu-crear.png` | CreateMenuSheet (Nueva sucursal / Nuevo usuario / Nuevo producto). |
| `fase2-admin-02-sucursal-lleno.png` | CreateBranchSheet lleno (nombre/ciudad/dirección/activa). |
| `fase2-admin-03-sucursal-creada.png` | "Sucursal Centro" creada → 2 ACTIVAS. |
| `fase2-admin-04-producto-lleno.png` | CreateProductSheet (Agua Mineral 500ml, $990, 48 un, Centro). |
| `fase2-admin-05-post-producto.png` | Estado tras crear el producto. |
| `fase2-admin-06-usuario-deshabilitado.png` | CreateUserSheet: form listo + submit deshabilitado ("Requiere deploy de backend" → Cloud Function `createStaffUser`). |

## Fase 3 — Jefe/Gerente (FAB → resolver `/approvals`)

Seed de 2 aprobaciones `pending` vía Admin SDK (productor vendedor = pasada POS futura).

| Archivo | Qué muestra |
|---|---|
| `fase3-jefe-01-home-pendientes.png` | Home con "2 PENDIENTES" + tarjetas (Descuento $12.000, Devolución $64.990) + FAB ✓ activo. |
| `fase3-jefe-02-sheet-descuento.png` | ApprovalDetailSheet (Descuento, RIESGO BAJO, contexto data-driven, nota habilitada). |
| `fase3-jefe-03-sheet-devolucion-alto.png` | ApprovalDetailSheet (Devolución $64.990 = RIESGO ALTO ≥ $50.000). |
| `fase3-jefe-04-sin-pendientes.png` | Tras aprobar+rechazar: 0 pendientes, empty-state honesto, FAB neutro/deshabilitado "Sin pendientes". |

Verificado en Firestore: aprobó/rechazó con `status` + `resolvedBy` + `resolutionNote`;
`type/refId/amount/requestedBy/branchId` inmutables (rules). Teardown completo.
