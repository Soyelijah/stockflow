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
pnpm test                                # pruebas unitarias con node:test + tsx
pnpm lint                                # tsc --noEmit (0 errors required)
pnpm build:all                           # vite x3 (staff/client/driver)
pnpm bundle:check                        # bundle isolation enforcement
pnpm --prefix functions build            # TypeScript de Cloud Functions
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

## Estado del producto

StockFlow ya es una **plataforma funcional en etapa piloto**, no todavía un SaaS listo
para escalar comercialmente sin supervisión. Las tres superficies, el control de acceso
por roles, el inventario por sucursal, el POS, la logística, la fidelización y el gateway
Express existen. La siguiente etapa debe privilegiar confiabilidad transaccional,
operación real y observabilidad antes que sumar más pantallas.

| Área | Estado actual | Criterio para considerarla lista |
|---|---|---|
| Staff / POS / inventario | Funcional; MobilePOS tiene cola offline y el stock se separa por sucursal | Pruebas de concurrencia, conciliación y turnos completos en dispositivos reales |
| Sf Client | Funcional, autenticado, con catálogo, fidelización y postventa | Checkout idempotente y pagos certificados en sandbox y producción controlada |
| Sf Driver | Piloto, con firma, GPS y evidencia fotográfica preparada | Storage + Maps habilitados y smoke test en APK/dispositivo real |
| Seguridad por roles | Custom Claims, reglas y guards implementados; verificación de email obligatoria sin bypass por dominio | Matriz automatizada allow/deny por cada rol y colección en CI |
| Pagos | Integración API parcial/piloto con Flow.cl y MercadoPago | Webhooks, reintentos, duplicados y conciliación financiera validados end-to-end |
| Calidad | TypeScript, builds separados, probes y primeras pruebas unitarias | CI obligatorio con unitarias, emuladores Firebase y E2E críticos |

La evidencia histórica por sprint vive en `docs/walkthrough.md`. El estado operativo y
los bloqueos detallados viven en `docs/ROADMAP.md`; ese archivo es la fuente canónica del
roadmap. El `ROADMAP.md` de la raíz se conserva como checklist histórico de funcionalidades
y no debe usarse para decidir el estado de producción.

## Visión de producto y estrategia recomendada

### Norte del producto

Ser el sistema operativo simple para comercios chilenos que necesitan vender, controlar
stock por sucursal y despachar sin mantener varias herramientas desconectadas. La ventaja
no debe ser “tener más módulos”, sino ofrecer una operación trazable desde la recepción
del producto hasta la venta, pago, entrega, devolución y conciliación.

### Usuarios prioritarios

1. **Dueño/administrador:** necesita margen, caja, inventario y excepciones en una vista confiable.
2. **Vendedor:** necesita cobrar rápido, incluso con conectividad inestable, sin vender stock inexistente.
3. **Logística:** necesita preparar, asignar y auditar cada movimiento de inventario y entrega.
4. **Cliente:** necesita comprar, pagar y conocer el estado de su pedido sin fricción.
5. **Conductor:** necesita completar la ruta con evidencia mínima y pocos toques.

### Decisiones que tomaría como CEO y responsable técnico

- **Congelar temporalmente nuevas funcionalidades** hasta cerrar los riesgos P0 de dinero,
  stock, autorización e idempotencia. Una interfaz atractiva no compensa una venta duplicada
  o inventario negativo.
- **Vender primero a un piloto pequeño y medible** (1–3 comercios, pocas sucursales), con
  soporte cercano y feature flags, antes de una apertura pública.
- **Definir un único flujo financiero autoritativo en servidor**. El cliente puede iniciar
  y mostrar un pago, pero la confirmación, el descuento de stock, la emisión de movimientos
  y la conciliación deben quedar unidos por una operación idempotente y auditable.
- **Medir valor operacional**, no cantidad de pantallas: exactitud de stock, tiempo de cobro,
  entregas exitosas, diferencias de caja, disponibilidad y tasa de errores.
- **Mantener tres aplicaciones, un modelo de dominio y librerías compartidas en un solo
  repositorio** mientras el equipo sea pequeño. Separar repositorios ahora aumentaría
  coordinación y riesgo de drift.

## Plan de ejecución recomendado

### Fase 0 — Confiabilidad y seguridad (P0, antes de nuevos pilotos)

- [ ] Migrar primero `src/shared/components/FlowResult.tsx`: hoy finaliza la orden y descuenta
      inventario desde el callback del navegador mediante `writeBatch` + `increment`. La operación
      autoritativa debe vivir en servidor, usar `runTransaction` y rechazar stock insuficiente.
- [ ] Auditar después los demás caminos que descuentan stock. Dos ventas concurrentes de la
      última unidad deben producir una venta y un rechazo, nunca stock negativo.
- [ ] Demostrar idempotencia de pagos ante callback duplicado, refresh del navegador, reintento
      del proveedor y entrega desordenada de webhooks. Una clave del proveedor debe materializar
      como máximo una venta, un movimiento de stock y una asignación de puntos.
- [x] Retirar los bypasses de verificación basados en `@stockflow.com` de los shells de aplicación;
      los entornos demo deben habilitarse mediante configuración explícita solo fuera de producción.
- [ ] Antes de desplegar ese guard, auditar cuentas existentes no verificadas y confirmar su
      identidad; enviar verificación o corregirlas administrativamente para evitar bloqueos legítimos.
- [x] Sanitizar el log de `/api/payments/flow/confirm`: nunca registrar `statusData` completo;
      aplicar el allowlist de auditoría `{ id, total }` sin payer, email ni payload del proveedor.
- [ ] Crear pruebas con Firebase Emulator Suite para roles, reglas, stock, devoluciones y webhooks.
- [ ] Validar que `costPrice`, PII, tokens y payloads completos nunca lleguen a bundles, respuestas
      ni logs de usuarios no privilegiados.
- [ ] Definir conciliación diaria: pago del proveedor ↔ venta ↔ boleta ↔ caja ↔ movimiento de stock.

**Salida de fase:** cero negativos por concurrencia, cero duplicados por reintento, matriz de
permisos verde y procedimiento documentado para recuperar pagos aprobados con orden incompleta.

| Trabajo P0 | Responsable recomendado | Horizonte | Evidencia de cierre |
|---|---|---|---|
| Orquestador server-side de pago + stock | Backend/payments + auditor de seguridad | 1–2 semanas | Prueba concurrente e idempotente con emuladores |
| Eliminación de bypasses por email | Auth/Firebase | Completado en código; auditar cuentas antes del deploy | Verificación obligatoria + build de las tres apps |
| Redacción de logs de pagos | Backend/payments | Completado | Helper allowlist probado sin PII ni token |
| Reglas Firestore y aislamiento de datos sensibles | Firebase/security | 1 semana | Suite allow/deny por rol en Emulator Suite |
| Flujo de conciliación y recuperación | Producto + operaciones + backend | 1 semana | Simulación de pago aprobado con fallo intermedio |

### Fase 1 — Piloto operacional (P0/P1)

- [ ] Reactivar billing y cerrar Firebase Storage, Maps/Routes y restricciones de API key para APK.
- [ ] Ejecutar recorridos reales por rol en Android: apertura de caja, venta, pedido, picking,
      entrega, falla de entrega, devolución y cierre de caja.
- [ ] Incorporar alertas y trazas con identificadores de correlación, sin PII, para seguir una
      orden desde pago hasta entrega.
- [ ] Preparar backup, restauración, exportación contable y runbook de incidentes.

**Salida de fase:** un comercio piloto puede operar una semana completa, reconciliar el día y
recuperarse de una falla conocida sin editar Firestore manualmente.

### Fase 2 — Producto comercial mínimo (P1)

- [ ] Onboarding autoservicio de empresa, sucursales, impuestos, usuarios y catálogo.
- [ ] Aislamiento formal por comercio (`tenantId`) en datos, claims, reglas, índices y auditoría.
- [ ] Planes, límites, facturación SaaS, términos, privacidad y soporte para Chile.
- [ ] Panel de salud operacional y analítica con definiciones únicas para ventas, margen y stock.
- [ ] Accesibilidad, rendimiento y UX premium sobre flujos ya estabilizados, no antes.

**Salida de fase:** incorporación repetible de un cliente sin intervención del desarrollador y
sin posibilidad de acceso cruzado entre comercios.

### Fase 3 — Escala (P2)

- [ ] Reducir fan-out y lecturas Firestore mediante agregados derivados medidos, no prematuros.
- [ ] Automatizar despliegues graduales, rollback, migraciones reanudables y pruebas de carga.
- [ ] Agregar integraciones contables, tributarias o de marketplace según demanda comprobada.
- [ ] Evaluar IA solo donde reduzca quiebres de stock o trabajo operativo con métricas verificables.

## Riesgos técnicos que deben permanecer visibles

| Riesgo | Impacto | Mitigación recomendada |
|---|---|---|
| Descuento de stock fuera de transacciones | Sobreventa o inventario negativo | Inventariar call sites, migrarlos y probar concurrencia |
| Reprocesamiento de pagos/webhooks | Cobro, venta o puntos duplicados | Clave idempotente por proveedor + transacción Firestore |
| Lógica crítica en callbacks del navegador | Pago aprobado con orden incompleta | Orquestador server-side y cola de conciliación |
| Bypass de verificación por dominio de correo | Acceso indebido si se confunde demo con producción | Configuración explícita de entorno; nunca inferir privilegios del email |
| Respuesta completa de Flow en logs | Exposición de email u otros datos del pagador | Log estructurado con allowlist `{ id, total }` |
| Falta de aislamiento multiempresa | Exposición cruzada al crecer a SaaS | Diseñar `tenantId` antes del segundo cliente independiente |
| Dependencia de billing/servicios externos | Driver y evidencia incompletos | Entorno sandbox financiado, límites de gasto y fallback explícito |
| Cobertura automatizada todavía reducida | Regresiones silenciosas | Pirámide: unitarias → emuladores → E2E por rol |
| Dos documentos de roadmap | Estados contradictorios | `docs/ROADMAP.md` canónico; raíz solo histórico |

## Métricas para decidir, no adivinar

| Dimensión | KPI inicial recomendado |
|---|---|
| Inventario | Exactitud por SKU/sucursal y eventos de stock negativo (objetivo: 0) |
| Ventas | Tiempo medio de checkout, tasa de ventas offline sincronizadas y duplicados (objetivo: 0) |
| Pagos | Aprobados conciliados automáticamente, webhooks rechazados y tiempo de recuperación |
| Logística | Entregas al primer intento, tiempo por parada y pedidos con evidencia completa |
| Confiabilidad | Disponibilidad, errores por 1.000 operaciones y tiempo medio de recuperación |
| Negocio | Comercios activos, GMV procesado, retención a 30/90 días y costo de soporte por comercio |

## Puerta de calidad para cada cambio

Todo cambio debe entrar por la rama oficial, mantenerse pequeño y reversible, y cumplir:

```bash
pnpm test
pnpm lint
pnpm build                            # cliente principal + servidor Express
pnpm build:all
pnpm bundle:check
pnpm --prefix functions build
git diff --check
git check-ignore -v serviceAccountKey.json
```

Los cambios en pagos, auth, Firestore o stock requieren además pruebas adversariales e
idempotentes. “Compila” no significa “listo para producción”. No se deben mantener ramas
paralelas de larga vida: trabajo local → validación → commit → PR → rama oficial remota.

## Licencia

[a definir]
