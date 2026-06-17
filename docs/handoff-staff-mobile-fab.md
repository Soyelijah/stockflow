# Handoff — Staff mobile: el FAB central "+" (RoleMobileShell)

> **Para:** Antigravity / quien itere el staff-mobile shell.
> **De:** CC-mobile (validación on-device, emulator-5554/5556).
> **Verificado:** HEAD `fef8280` · emulator-5556 (360dp) y 5554 (448dp) · rol owner/admin.

## Qué es
El botón circular **"+"** (cruz) en el centro de la bottom-nav del `RoleMobileShell`
(`src/shared/components/RoleMobileShell.tsx`). Es el FAB de la barra inferior de los shells
mobile de **manager / logistics / admin / owner**.

## Qué hace HOY (y por qué parece "que no funciona")
El handler `onFab` (RoleMobileShell.tsx:358-365) **solo navega de tab** — hace
`setActiveTab(fab.target)`. NO abre ningún formulario ni acción de crear. Config por rol
(`fabConfig`, RoleMobileShell.tsx:102-104):

| Rol | Icono | Label | Acción actual del "+" |
|---|---|---|---|
| manager | Check (✓) | "Aprobar" | navega al tab **Equipo** (team) |
| logistics | Plus (+) | "Entrega" | navega al tab **Traslados** (transfers) |
| admin / owner | Plus (+) | "Crear" | navega al tab **Sucursales** (branches) |

> **owner** mapea a la config de **admin** (`roleFromProfile`, :109).

**Síntoma reportado** ("no funciona"): para **admin/owner**, su tab por defecto YA es
"Sucursales" → tocar el "+" hace `setActiveTab("branches")` = el tab donde ya está = **no pasa
nada visible**. Además, aunque el label dice "Crear", **no dispara la acción de crear** — la
acción real es el botón **"CREAR NUEVA SUCURSAL"** dentro de la pantalla Sucursales. O sea: el
FAB promete una acción primaria pero solo cambia de pestaña.

Confirmado en device (emulator-5556, owner): tap "+" → pantalla sin cambios, sin modal
(`modalOpen:false`), sigue en Sucursales.

## Decisión pendiente (elegir una)
1. **Hacerlo una acción primaria real** (recomendado): el "+" debe ejecutar la acción de su
   label, no solo navegar:
   - admin/owner "Crear" → abrir el flujo de **crear sucursal** (mismo que "CREAR NUEVA SUCURSAL").
   - manager "Aprobar" → abrir el panel/modal de **aprobaciones** (si hay pendientes).
   - logistics "Entrega" → abrir form de **nueva entrega/traslado**.
   Implementación: en `onFab` disparar el handler de la acción (abrir sheet/modal) en vez de
   `setActiveTab`. Es UI → Antigravity.
2. **Dejarlo como atajo de navegación** pero entonces: cambiar el label a algo de navegación
   (no "Crear"/"Aprobar"/"Entrega" que implican acción), y para admin/owner evitar el no-op
   (si ya estás en el tab destino, que al menos haga scroll-to-top o abra el create).

## Estado de los otros 2 fixes del top-bar (ya resueltos, verificados en device)
- **owner-shell** (`432dfb6`): owner ahora entra al RoleMobileShell (antes caía al Layout desktop).
- **☰ Menú** (`fef8280`): abre sheet de opciones ("Cerrar sesión") en vez de logout silencioso.
- Pendientes menores del top-bar: botones **"Cambiar sucursal"** (Building2) y **"Notificaciones"**
  (Bell) siguen **inertes** (sin onClick) — decidir si se conectan o se ocultan.

## Nota de entorno (no es bug del app)
emulator-5556 (AVD S23_2) arranca 720×1280 @ 480dpi = **240dp** (más angosto que cualquier
teléfono real) → textos solapados/"desordenado". Fix: `adb -s emulator-5556 shell wm density 320`
(→ 360dp, limpio). emulator-5554 (AVD S23, 448dp) está bien de fábrica — usar como device QA primario.
