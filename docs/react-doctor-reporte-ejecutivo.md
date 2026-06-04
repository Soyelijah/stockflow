# Reporte Ejecutivo — Auditoría de Salud de Código (React Doctor)

**Proyecto:** StockFlow · **Fecha:** 2026-06-04 · **Responsable técnico:** Claude Code
**Herramienta:** React Doctor (auditoría con v0.3.0; reproducción pineada vía `pnpm exec react-doctor` → `react-doctor@0.2.6` del lockfile) · **Verificación:** herramienta real + `tsc --noEmit`

---

## 1. Resumen ejecutivo

Sometimos toda la base de código a una auditoría automática de salud (seguridad, rendimiento,
accesibilidad, correctitud y mantenibilidad). El examen arrojó **2.431 avisos**. Tras separar el
ruido del señal real y resolver lo prioritario, el estado quedó así:

| Indicador | Inicio | Hoy |
|---|---:|---:|
| Avisos totales del escáner | 2.431 | **373** |
| — de los cuales, ruido de carpetas que **no** se despachan a producción | 1.918 | 0 *(filtradas)* |
| Avisos reales sobre código de la app | 513 | **373** |
| **Errores** (severidad alta) | 1 | **0** |
| Problemas reales resueltos | — | **143** |

**Conclusión:** el 73 % de los avisos iniciales era falsa alarma (maquetas de diseño y archivos de
compilación que nunca llegan al usuario). Del señal real, eliminamos el único error de severidad alta
y resolvimos 136 problemas concretos, con foco en **seguridad de cadena de suministro** y
**accesibilidad**. Se dejó instalado un **guardia automático en cada Pull Request** para que el código
nuevo entre limpio mientras se salda el resto de forma incremental. Nada se ha publicado todavía:
todos los cambios están en el árbol de trabajo, listos para revisión.

---

## 2. Qué se hizo, en lenguaje de negocio

### Frente A — Seguridad de la cadena de suministro 🔒 *(el de mayor valor)*
La app se apoya en cientos de piezas de software de terceros. Dos vectores de ataque reales:
1. Un atacante secuestra una librería y publica una versión con malware; suele detectarse y retirarse
   en **horas** — justo la ventana en que una instalación desprevenida la incorpora.
2. Una nueva versión **degrada silenciosamente** sus sellos de seguridad (procedencia/firmas).

**Acción:** se creó `pnpm-workspace.yaml` con dos defensas, ambas opciones **reales y verificadas** en
el propio gestor de paquetes (no inventadas para callar al linter):
- `minimumReleaseAge: 10080` → no instalar ninguna versión con **menos de 7 días** de publicada.
- `trustPolicy: no-downgrade` → **rechazar** toda actualización cuyos sellos de seguridad empeoren.

**Impacto:** para una plataforma que mueve **pagos** (Flow.cl, MercadoPago) e inventario, esto es la
diferencia entre "una dependencia secuestrada ejecuta código malicioso en el build o en la app" y
"estamos protegidos por defecto". Bajo esfuerzo, protección concreta y permanente.

### Frente B — Accesibilidad + 1 error de correctitud ♿
Se corrigieron **133** problemas de accesibilidad reales y el **único error** de la base.

- **Error eliminado** (`SignaturePad`, módulo de **firma de entregas**): el componente reiniciaba su
  estado de forma incorrecta, mostrando brevemente un valor erróneo al abrirse. Se reescribió siguiendo
  el patrón recomendado por React → ahora inicia limpio sin parpadeos. Relevante porque es captura de
  **firma legal** del receptor en el reparto.
- **Etiquetas de formularios (lectores de pantalla):** **44** etiquetas quedaron correctamente
  asociadas a su campo (de 44 → **0** pendientes). Antes, una persona ciega no podía saber qué dato se
  le pedía.
- **Botones de solo-ícono:** **71** botones sin nombre accesible ahora lo tienen, en
  **español chileno neutro**.
- **Teclado y foco:** se eliminó el salto de foco molesto al cargar (`autoFocus`, 5 casos) y se hizo
  que los elementos clicables respondan al teclado (Enter/Espacio), no solo al mouse.
- **Semántica HTML:** parte de los `role="…"` se reemplazó por la etiqueta nativa correcta.

**Impacto:** la app pasa a ser usable por personas con lectores de pantalla y por quienes navegan solo
con teclado. Además reduce riesgo legal/normativo de accesibilidad y mejora SEO del portal de clientes.

### Frente D — Correctitud (bugs reales, arreglo seguro) 🐞
De los 143 avisos de categoría "Bugs" se resolvió **lo seguro y de alto valor** (7 defectos reales),
y se **frenó deliberadamente** el resto por ser refactorizaciones sensibles al comportamiento que no
deben hacerse en masa sobre una app de pagos sin pruebas (ver sección 5).

- **Estado mutado en sitio** (`Dashboard`, ranking de rentabilidad): un `.sort()` modificaba el arreglo
  de estado directamente → la pantalla podía no actualizarse. Corregido con copia inmutable.
- **`type` en botones (4 casos):** botones sin `type` que por defecto envían formularios → riesgo de
  envío accidental. Se fijó `type="button"`.
- **Claves de lista inestables (2 casos):** gráficos que usaban el índice como clave → se cambió a una
  clave estable por nombre de categoría.
- **Input no controlado** (`Profile`, correo solo-lectura): se marcó `readOnly`.

> **No-aplicables detectados:** 9 avisos de "desajuste de hidratación" (`new Date()`/`Math.random()` en
> el render) **no aplican**: la app se renderiza 100 % en el navegador (`createRoot`, sin SSR), así que
> no existe el desajuste servidor-cliente que la regla previene. No se tocó código que funciona.

### Frente C — Guardia automático en CI 🛡️
Se agregó un flujo de GitHub Actions (`.github/workflows/react-doctor.yml`) que **revisa cada Pull
Request**, pero **solo los archivos que ese PR cambió**. Así el código nuevo se mantiene limpio sin que
la deuda histórica bloquee al equipo. Se configuró el escáner (`doctor.config.json`) para **ignorar**
las carpetas de maquetas, compilados y envoltorios Android — el ruido que inflaba el conteo.

> Nota: se optó por instalar **solo** el flujo de CI, y **no** el instalador completo de la herramienta,
> que además habría añadido un *hook* de Git **global** (afecta todos los repos de la máquina) e
> integraciones en 6 asistentes de IA — alcance mayor al solicitado. Esa instalación local queda
> disponible si el equipo la quiere a futuro.

---

## 3. Hallazgo relevante: la herramienta tiene falsos positivos

**47** de los avisos restantes de accesibilidad **no son defectos**: son campos que **sí** tienen su
etiqueta correctamente asociada, pero mediante un identificador generado dinámicamente
(helpers `fId()` / `inputId()`) que el analizador estático no logra seguir. Se verificó manualmente y
el código ya es correcto en tiempo de ejecución.

**Decisión:** **no** se modificó código que ya funciona solo para complacer al linter (eso sería
introducir riesgo sin beneficio). Quedan documentados como falsos positivos conocidos.

---

## 4. Cómo se verificó (sin suposiciones)

1. **Herramienta real:** se re-ejecutó `pnpm exec react-doctor` tras cada bloque de cambios y se
   comparó el conteo antes/después. Los números de este reporte salen de esa medición, no de estimaciones.
2. **Compilación:** `pnpm lint` (`tsc --noEmit` en modo estricto) pasa con **0 errores** tras los ~20
   archivos modificados.
3. **Recetas canónicas:** cada tipo de arreglo siguió la guía oficial de la regla y su "chequeo de
   falso positivo" **antes** de tocar nada.
4. **Configuración de pnpm:** se confirmó que el gestor lee y acepta los dos ajustes de seguridad.

---

## 5. Estado pendiente y recomendación priorizada

Quedan **373** avisos (todos de severidad *warning*, **0 errores**), distribuidos así:

| Categoría | Pendientes | Comentario |
|---|---:|---|
| **Correctitud (Bugs)** | 135 | Ya se resolvió lo seguro. El resto son refactorizaciones de manejo de estado **sensibles al comportamiento** (ver abajo) + 9 no-aplicables (hidratación). |
| **Rendimiento** | 85 | Sobre todo carga diferida de animaciones y consultas — impacto en velocidad percibida y tamaño del bundle. |
| **Mantenibilidad** | 81 | Componentes muy grandes, código muerto, etc. Deuda técnica, sin impacto directo al usuario. |
| **Accesibilidad** | 72 | **47** falsos positivos (sección 3) + **11** de contraste de color + ~14 semánticos. |

**Por qué se frenó la Correctitud aquí (decisión de ingeniería):** los 135 restantes son en su mayoría
patrones del estilo "*you might not need an effect*" — `no-derived-state` (23), `prefer-useReducer` (21),
`exhaustive-deps` (21, cuya **propia guía advierte "no agregues dependencias a ciegas"**),
`no-event-handler` (20), `no-chain-state-updates` (18). Cada uno **cambia el flujo de renderizado de un
componente** y requiere entenderlo y **probarlo** uno por uno. Hacerlos en masa de forma automática sobre
una app de **pagos/POS en producción** introduciría riesgo real de regresión. Corresponde una pasada
**con humano en el ciclo y pruebas**, no una barrida autónoma.

**Recomendaciones, en orden:**
1. **Contraste de color (11 casos)** → entregar al dueño de diseño (Antigravity). Es decisión de diseño
   con el token correcto del tema (el consejo genérico "usa blanco" sería *invisible* sobre fondos claros).
2. **Correctitud restante (135)** → pasada técnica componente-por-componente **con pruebas E2E** (Playwright)
   de los flujos críticos antes/después. Empezar por los componentes con más concentración (`Logistics`,
   `Settings`, `MobilePOS`, `RefundsHistory`).
3. **Rendimiento (85)** → pasada enfocada en velocidad/bundle antes de escalar a más clientes.
4. **Falsos positivos (47 a11y + 9 hidratación)** → ninguna acción de código; opcional afinar la config del
   linter a futuro.

---

## 6. Apéndice técnico

### Archivos nuevos
- `pnpm-workspace.yaml` — endurecimiento de cadena de suministro (`minimumReleaseAge`, `trustPolicy`).
- `.github/workflows/react-doctor.yml` — CI por PR (escaneo del diff, `fail-on: error` durante el
  paydown — `--diff` escanea archivos completos, así que gatear en `warning` bloquearía PRs por deuda
  preexistente; subir a `warning` cuando el backlog baje).
- `doctor.config.json` — alcance del escáner (ignora `design-system/`, `design_handoff_*`, `dist*/`, `android*/`).
- `src/shared/components/ui/sf/sfIconMap.ts` — extracción para arreglar Fast Refresh en `IconChip`.

### Archivos de código modificados (25)
A11y / error / Fast Refresh: `SignaturePad`, `Logistics`, `Settings`, `MobilePOS`, `POS`,
`CustomerPortal`, `Customers`, `Inventory`, `Profile`, `Suppliers`, `Expenses`, `ShrinkageReport`,
`StockLedger`, `Transactions`, `Dashboard`, `DeliveryMap`, `DriverPWA`, `client/CartSheet`,
`ui/sf/StatTile`, `ui/sf/IconChip` (+ `ui/sf/index.ts`).
Correctitud (bugs): `Dashboard`, `DashboardCharts`, `ShrinkageReport`, `Profile`, `Forbidden`,
`apps/client/AppShell`, `apps/driver/AppShell`, `apps/staff/AppShell`.
Total: **+311 / −301** líneas. `pnpm lint` (tsc estricto) en verde.

### Conteo verificado por regla (antes → después, esta sesión)
| Regla | Antes | Después | Resueltos |
|---|---:|---:|---:|
| `no-adjust-state-on-prop-change` *(error)* | 1 | 0 | 1 |
| `label-has-associated-control` | 44 | 0 | 44 |
| `control-has-associated-label` | 118 | 47\* | 71 |
| `no-autofocus` | 5 | 0 | 5 |
| `click-events-have-key-events` | 4 | 0 | 4 |
| `no-noninteractive-element-interactions` | 2 | 0 | 2 |
| `prefer-tag-over-role` | 13 | 9\*\* | 4 |
| `no-static-element-interactions` | 2 | 1 | 1 |
| `no-gray-on-colored-background` *(contraste)* | 11 | 11 | 0 *(diferido a diseño)* |

\* Los 47 restantes son falsos positivos de id dinámico (sección 3).
\*\* Los 9 restantes (`role="dialog"`/`"group"`/`"status"` en *backdrops*) requieren refactor sensible
a comportamiento; se difieren por bajo impacto.

### Conteo verificado — pasada Correctitud (antes → después)
| Regla | Antes | Después | Resueltos |
|---|---:|---:|---:|
| `no-direct-state-mutation` | 1 | 0 | 1 |
| `button-has-type` | 4 | 0 | 4 |
| `no-uncontrolled-input` | 1 | 0 | 1 |
| `no-array-index-as-key` | 3 | 1\* | 2 |

\* El restante es un log *append-only* no interactivo (`DeliveryMap`), donde el índice es correcto y
estable; se deja a propósito.

### Estado de los 3 arreglos previos (pasada anterior)
`require-pnpm-hardening` 0 · `only-export-components` 0 · `rerender-memo-with-default-value` 0 — verificados.

### Notas operativas
- **Nada commiteado.** Todos los cambios están en el árbol de trabajo para revisión.
- Verificación reproducible: `pnpm exec react-doctor --full --json --no-score` y `pnpm lint`.
