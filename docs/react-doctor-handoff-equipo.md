# Runbook de Handoff — Saneamiento de Salud de Código (React Doctor)
### Documento de entrega: CEO → Equipo de Trabajo (agentes)

**Proyecto:** StockFlow · **Fecha:** 2026-06-04 · **Preparado por:** Claude Code (auditor)
**Estado del código base:** 2.431 → **373** avisos · **0 errores** · `tsc` en verde · CI activo
**Acompaña a:** `docs/react-doctor-reporte-ejecutivo.md` (reporte ejecutivo de la auditoría)

> **Propósito.** Este runbook le permite al CEO entregar al equipo un plan **accionable, con dueños,
> orden, recetas y criterios de aceptación** para cerrar los 373 avisos restantes **sin romper
> producción**. Está escrito para que cada agente sepa exactamente qué le toca y bajo qué reglas.

---

## 0. Estado del repositorio y cómo continuar

- Todo el trabajo de esta auditoría quedó **commiteado localmente en `main`** (no se hizo `push`).
- **Revisar antes de publicar:** `git show --stat HEAD` y `git diff HEAD~1`.
- **Publicar (cuando el CEO lo apruebe):** `git push origin main`.
- **Revertir si se desea:** `git reset --soft HEAD~1` (conserva los cambios en el árbol).
- **Re-medir en cualquier momento:** `pnpm exec react-doctor --full` · gate local: `pnpm lint`.

---

## 1. Resumen de lo ya hecho (3 pasadas, verificado contra la herramienta real)

| Frente | Resultado | Verificación |
|---|---|---|
| **Ruido eliminado** | Escáner enfocado solo en código que se despacha (ignora maquetas, compilados, Android) | 1.918 avisos de ruido fuera |
| **Seguridad cadena de suministro** | `minimumReleaseAge` + `trustPolicy: no-downgrade` en `pnpm-workspace.yaml` | `pnpm config get` OK |
| **CI guardia por-PR** | `.github/workflows/react-doctor.yml` (escanea el diff, `fail-on: error` con rampa a `warning`) | flujo presente |
| **Error crítico** | `SignaturePad` (firma de entregas) corregido | 1 → 0 errores |
| **Accesibilidad estructural** | 133 arreglos: etiquetas, teclado, foco, semántica | `label-has-associated-control` 44→0 |
| **Bugs reales seguros** | 7: mutación de estado, `type` de botón, claves de lista, input controlado | medido antes/después |
| **Fast Refresh** | `IconChip` separado en `sfIconMap.ts` | regla en 0 |

**Total resuelto: 143 problemas reales · 0 regresiones · 25 archivos · +311/−301 líneas.**

---

## 2. Reglas del juego (NO negociables para todos los agentes)

1. **Producción de pagos primero.** Nada de lo de §6 del `CLAUDE.md` se toca sin revisión de
   `payment-integrations-specialist`: idempotencia de webhooks, `runTransaction` en stock,
   verificación de firmas, **`costPrice` no sale del servidor**.
2. **Pruebas antes de refactorizar estado.** Ningún cambio de manejo de estado (los de "Correctitud")
   se hace sin una prueba E2E que cubra ese flujo **antes y después** (ver Fase 1).
3. **Cero barridas autónomas de lógica.** Los refactors `no-derived-state` / `prefer-useReducer` /
   `exhaustive-deps` / `no-event-handler` se hacen **componente por componente, con humano en el ciclo**.
4. **No borrar "código muerto" a ciegas.** Antes de eliminar un `unused-file`/`unused-export`, verificar
   que no entre por `React.lazy()` / import dinámico / string de ruta.
5. **Propiedad respetada.** **Antigravity** = diseño visual (color, tokens, layout premium).
   **Claude Code** = seguridad, infra, librería, servidor, transversal. No se pisan.
6. **No callar al linter.** Si algo es falso positivo, se **documenta**, no se modifica código correcto
   ni se silencia la regla globalmente.
7. **Cada PR cierra limpio:** `pnpm lint` (0 errores), CI React Doctor en verde sobre el diff,
   el score no baja, copy en **español chileno neutro**.

---

## 3. Backlog maestro (373) — por categoría, riesgo y dueño

### 3.1 Correctitud / "Bugs" (135) — *el grueso del valor de calidad*
| Regla | N° | Riesgo | Dueño sugerido | Receta / Acción |
|---|---:|---|---|---|
| `no-derived-state` | 23 | Medio | `react-component-builder` | Derivar en render (o `useMemo`), borrar el `useState`+`useEffect`. |
| `prefer-useReducer` | 21 | Medio | `react-component-builder` | Agrupar `useState` relacionados en `useReducer`. |
| `exhaustive-deps` | 21 | **Alto** | `react-component-builder` + `stockflow-code-reviewer` | **Leer el callback primero.** Usar updater functions / `useEffectEvent`; NO agregar deps a ciegas. |
| `no-event-handler` | 20 | Medio | `react-component-builder` | Mover el efecto secundario al handler que lo dispara. |
| `no-chain-state-updates` | 18 | Medio | `react-component-builder` | Setear el estado junto en el handler, no encadenar vía `useEffect`. |
| `no-cascading-set-state` | 11 | Medio | `react-component-builder` | Combinar en `useReducer`. |
| `no-initialize-state` | 5 | Bajo | `react-component-builder` | Inicializar en `useState(valor)` en vez de efecto de montaje. |
| `no-effect-chain` | 2 | Medio | `react-component-builder` | Calcular en render + setear todo en el handler raíz. |
| `prefer-use-effect-event` | 1 | Bajo | `react-component-builder` | `useEffectEvent` (React 19) para callbacks no-dep. |
| `no-array-index-as-key` | 1 | Bajo | — | `DeliveryMap` log append-only: **dejar** (índice correcto ahí). |
| `no-fetch-in-effect` | 3 | **Alto/arquitectura** | `firebase-architect` + CC | Decisión de adoptar `@tanstack/react-query`/SWR. **No** improvisar. |
| `rendering-hydration-mismatch-time` | 9 | **No-aplica** | CC | App sin SSR (`createRoot`). Suprimir en config del linter, **no** tocar código. |

### 3.2 Rendimiento (85)
| Regla | N° | Riesgo | Dueño | Acción |
|---|---:|---|---|---|
| `use-lazy-motion` | 28 | Medio | `performance-profiler` + `react-component-builder` | `LazyMotion`+`m` de `motion` → recorta bundle de animaciones. Probar animaciones. |
| `js-combine-iterations` | 19 | **Bajo/mecánico** | `react-component-builder` | Fusionar `.map().filter()` en una pasada. Preserva comportamiento. |
| `rerender-state-only-in-handlers` | 14 | Medio | `react-component-builder` | Mover estado a handlers; sensible a comportamiento → con tests. |
| `async-await-in-loop` | 7 | Bajo | CC | `Promise.all` donde sea independiente. |
| `js-tosorted-immutable` | 3 | **Bajo/mecánico** | CC | `.toSorted()`/copia en vez de `.sort()` en sitio. |
| `jsx-no-constructed-context-values` | 3 | Bajo | `react-component-builder` | Memoizar el value del Provider. |
| `prefer-dynamic-import` | 3 | Bajo | `performance-profiler` | `React.lazy()` para code-splitting. |
| `js-index-maps` / `js-min-max-loop` / `js-set-map-lookups` / `js-flatmap-filter` | 5 | **Bajo/mecánico** | CC | Micro-optimizaciones JS seguras. |
| `no-long-transition-duration` / `no-inline-bounce-easing` / `async-parallel` | 3 | Bajo | varios | Ajustes menores. |

### 3.3 Mantenibilidad (81)
| Regla | N° | Riesgo | Dueño | Acción |
|---|---:|---|---|---|
| `no-giant-component` | 20 | **Alto esfuerzo** | `migration-planner` (plan) + `react-component-builder` | Dividir componentes gigantes. Requiere runbook previo. |
| `prefer-module-scope-pure-function` | 19 | **Bajo/mecánico** | `react-component-builder` | Subir funciones puras a scope de módulo. |
| `unused-export` | 13 | Bajo | CC | Quitar exports muertos (verificar antes). |
| `unused-file` | 12 | Medio | CC | Borrar archivos muertos **solo** tras verificar no-import dinámico. |
| `prefer-module-scope-static-value` | 8 | **Bajo/mecánico** | `react-component-builder` | Subir constantes a scope de módulo. |
| `no-react19-deprecated-apis` | 3 | Bajo | CC | Migrar APIs deprecadas de React 19. |
| `unused-dependency` | 3 | Bajo | CC | Quitar deps no usadas de `package.json`. |
| `no-multi-comp` / `no-inline-exhaustive-style` | 3 | Bajo | `react-component-builder` | Separar componentes / extraer estilos. |

### 3.4 Accesibilidad (72) — *en su mayoría ya cerrada o no-accionable por código*
| Grupo | N° | Dueño | Acción |
|---|---:|---|---|
| `control-has-associated-label` (falsos positivos id dinámico) | 47 | CC | **No tocar código.** Opcional: afinar config del linter (`ignore.overrides`). |
| `no-gray-on-colored-background` (contraste) | 11 | **Antigravity** | Token de color correcto del tema (ver §6 para ubicaciones). |
| `prefer-tag-over-role` + `prefer-html-dialog` + `no-noninteractive-*` + `no-static-*` | 14 | `react-component-builder` | Semántica HTML (`<dialog>`, backdrops) — sensible a comportamiento, con cuidado. |

---

## 4. Plan por fases (orden recomendado por el CEO)

- **Fase 0 — Higiene del tablero (CC, rápido).** Afinar `doctor.config.json` para descartar los 47
  falsos positivos de id dinámico y los 9 de hidratación no-aplicables → el score refleja la realidad.
- **Fase 1 — Red de seguridad (PREREQUISITO · `playwright-e2e-author`).** E2E de los flujos críticos:
  login por rol, alta de producto, escaneo de código, **venta en POS**, cierre de caja, pedido de
  delivery, **firma de entrega**, aceptar ruta repartidor. **Sin esto no se toca el estado.**
- **Fase 2 — Correctitud (con Fase 1 verde · `react-component-builder` + revisión de
  `stockflow-code-reviewer`).** 126 reales. Atacar por concentración: `Logistics`, `Settings`,
  `MobilePOS`, `RefundsHistory`. Decidir aparte `no-fetch-in-effect` con `firebase-architect`.
- **Fase 3 — Rendimiento (`performance-profiler`).** Primero lo mecánico-seguro (js-*), luego
  `use-lazy-motion` (bundle) y context values. Medir reads/día y peso del bundle antes/después.
- **Fase 4 — Mantenibilidad (`migration-planner` + `react-component-builder` + CC).** Hoists de
  módulo (seguros) → dead-code (con verificación) → componentes gigantes (con plan).
- **Fase 5 — Diseño (Antigravity).** Los 11 de contraste con los tokens del tema.
- **Continuo — CI.** El guardia por-PR ya atrapa errores nuevos mientras se salda lo anterior. Cuando
  el backlog baje lo suficiente, **subir el gate de `fail-on: error` a `warning`** (una línea en el
  workflow) para exigir también cero avisos en código nuevo.

---

## 5. Definición de "Hecho" (criterio de cierre de cada PR)

- [ ] `pnpm lint` (`tsc --noEmit`) en **0 errores**.
- [ ] CI React Doctor **verde** sobre el diff del PR; **0 avisos nuevos**.
- [ ] La/s regla/s objetivo del PR pasan de N→0 (verificado con `pnpm exec react-doctor --full`).
- [ ] Si tocó estado: prueba E2E del flujo afectada y **pasando**.
- [ ] Revisión de `stockflow-code-reviewer` (y `payment-integrations-specialist` si tocó §6).
- [ ] Sin cambios fuera de alcance; copy en español chileno neutro.

---

## 6. Apéndice — ubicaciones de los diferidos a Diseño (contraste, Antigravity)

`no-gray-on-colored-background` (texto gris lavado sobre fondo de color — usar token correcto del tema):
```
CategoryManager.tsx:224, :250
Transactions.tsx:502, :512
CustomerPortal.tsx:4591
Settings.tsx:1574
POS.tsx:939
BranchesManager.tsx:306
Logistics.tsx:1823
MobilePOS.tsx:1060, :1756
```

## 7. Apéndice — comandos de operación

```bash
pnpm exec react-doctor --full                 # auditoría completa (humano)
pnpm exec react-doctor --full --json --no-score > out.json   # para medir antes/después
pnpm exec react-doctor --diff origin/main     # solo lo que cambió un branch (como en CI)
pnpm lint                                       # gate de tipos (tsc --noEmit)
```

> **Reproducibilidad / supply-chain.** Usamos `pnpm exec react-doctor` (binario
> pineado por `pnpm-lock.yaml` → `react-doctor@0.2.6`), **no** `npx …@latest`, para
> que toda re-medición corra exactamente la misma versión y no descargue código
> nuevo en cada ejecución. En CI la Action está pineada a SHA (`react-doctor.yml`).
> Para subir de versión: bump deliberado en `package.json` + `pnpm install` + revisar diff.

**Nota final.** El estado actual (373, 0 errores, CI activo) es un punto de partida **sano y estable**.
La prioridad estratégica no es velocidad sino **no introducir regresiones en una plataforma de pagos**:
por eso Fase 1 (pruebas) habilita todo lo demás.
