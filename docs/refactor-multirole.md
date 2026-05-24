# Documentación y Walkthrough: Refactor Multi-Rol, Seguridad y Monitoreo

Este documento consolida la explicación técnica y el historial de cambios (walkthrough) correspondientes a la reestructuración de enrutamiento multi-rol, la consolidación del árbol de componentes unificado, la eliminación de backdoors de seguridad y las mejoras en el robustecimiento operativo del proyecto StockFlow.

---

## 1. Enrutamiento Multi-Rol y Código Compartido

### Enrutamiento Declarativo
La aplicación ahora utiliza un esquema de enrutamiento declarativo basado en `react-router-dom` envuelto en `src/main.tsx`. Toda la lógica de enrutamiento por rol en `src/App.tsx` consulta de forma imperativa `profile?.role` desde el `AuthContext` tras verificar que el usuario inició sesión, eliminando el antiguo sistema basado en shims y lectura directa de `window.location.pathname`.

### Sub-Aplicaciones con Code-Splitting (Carga Perezosa)
Para solucionar la regresión de bundle monolítico (2.4 MB) y optimizar el rendimiento de la aplicación en conexiones móviles o de baja velocidad:
- Se implementó `React.lazy()` y `<Suspense>` en `src/App.tsx` para cargar de forma asíncrona y perezosa las rutas de cada rol:
  - `AdminRoutes` (`src/apps/admin/routes.tsx`): Para roles operativos y de oficina (`owner`, `admin`, `manager`, `seller`, `logistics`).
  - `StoreRoutes` (`src/apps/store/routes.tsx`): Para el portal público del cliente (`/cliente`).
  - `DeliveryRoutes` (`src/apps/delivery/routes.tsx`): Para el portal interactivo de repartidores (`driver`).

### Consolidación y Limpieza de Código Muerto
Para cumplir con la directiva de cero duplicación de código, se eliminaron por completo las carpetas heredadas (legacy) con shims antiguos:
- `src/components/` (shims obsoletos).
- `src/apps/admin/pages/` (páginas antiguas duplicadas).
- `src/apps/admin/layout/` (layouts antiguos duplicados).
- `src/apps/store/pages/` (páginas de cliente duplicadas).
- El componente `BarcodeScanner.tsx` se movió permanentemente a `src/shared/components/ui/BarcodeScanner.tsx` para actuar como el único lector de códigos de barra unificado de la aplicación.

---

## 2. Seguridad Empresarial: Cero Emails Hardcodeados

Se han removido por completo todos los bypasses de seguridad y validaciones basadas en el correo electrónico `solier.elijah@gmail.com` en los puntos críticos del sistema:

1. **Contexto de Autenticación (`src/contexts/AuthContext.tsx`):** El método `register()` ya no asigna privilegios de administración automáticamente por coincidencia de email.
2. **Endpoint de Inteligencia Artificial (`server/routes/ai.ts`):** La ruta `/api/ai/insights` valida los roles de forma estricta mediante la función helper `isAdminOrManager` y no permite excepciones por email.
3. **Cloud Functions (`functions/src/index.ts`):** La función Callable `setUserRole` ya no cuenta con bypass de superadministrador. Adicionalmente, solo un usuario con el rol de `owner` (dueño) puede promover a otros a la jerarquía de `owner`.
4. **Semillas y Cupones (`src/lib/coupons.ts`):** Se modificó la semilla del cliente Elijah Solier para utilizar un dominio de desarrollo corporativo: `elijah.solier@stockflow.com`.

### Script de Inicialización Segura (Bootstrap Admin)
Para designar al primer usuario administrador principal (`owner`) sin depender de código hardcodeado, se utiliza un script de inicialización en el servidor que utiliza el Firebase Admin SDK.

#### Requisitos
- Contar con el archivo `serviceAccountKey.json` en la raíz del proyecto.
- El usuario deseado debe haberse registrado primero en la aplicación mediante Firebase Auth.

#### Ejecución del Script
Ejecuta el script desde la raíz del proyecto pasando el correo electrónico del usuario registrado:

```bash
npx tsx scripts/bootstrap-admin.ts elijah.solier@stockflow.com
```

#### Acciones del Script
1. Busca al usuario en Firebase Authentication mediante su correo electrónico para obtener su `UID`.
2. Asigna de forma segura el Custom Claim `{ role: "owner" }` a nivel de autenticación.
3. Actualiza el documento del usuario en la colección `/users` de Firestore para reflejar el nuevo rol.
4. Genera un registro de auditoría en la colección `/role_audit` para fines de cumplimiento normativo y seguridad.

---

## 3. Robustecimiento Operativo y Monitoreo

### Monitoreo en Settings (API Gateway Health)
Se añadió la tarjeta interactiva **API Gateway Health** en la subpestaña **General** de configuración (`Settings.tsx`):
- Evalúa el estado del enrutador en tiempo real mediante sondeos automáticos cada 10 segundos o clics en "Probar Conexión".
- Calcula de forma exacta la latencia (en milisegundos) de respuesta de cada ráfaga (`performance.now()`), presentando el resultado bajo indicadores cromáticos correspondientes (Verde < 150ms, Ámbar para latencia media, Rojo para desconexión).
- Incluye un gráfico de historial de ráfagas que dibuja la tendencia de velocidad de las últimas 5 peticiones.
- Desglosa interactivamente el estado interno e individual de cada módulo del gateway (`barcode`, `payments`, `comms` y `ai`).

### Indexación Compuesta de Firestore
- Se creó el archivo `/firestore.indexes.json` con la definición definitiva de los índices compuestos requeridos para búsquedas eficaces en la colección `users`, optimizando ordenamientos y segmentaciones por `email`, `role`, `name` y `createdAt`.
- Se optimizó `handleSearchUser()` para utilizar consultas por rango prefijado (starts-with range queries) que viajan directo y optimizado a través del motor de base de datos indexado de Firestore en lugar de realizar escaneos completos del lado del cliente.
- Se implementó un mecanismo de recuperación de fallos (graceful fallback) que conmuta automáticamente a un mapeador de concordancia local si un índice compuesto no ha terminado de aprovisionarse, asegurando la continuidad del flujo de trabajo en entornos locales o de prueba.

---

## 4. Verificación y Construcción

Para verificar que el sistema es completamente seguro, no tiene errores de tipos y compila adecuadamente, se ejecutan las siguientes pruebas:

- **Chequeo de Tipos y Linter:**
  ```bash
  npm run lint
  ```
  *Debe retornar 0 errores de TypeScript (`tsc --noEmit`).*

- **Construcción del Frontend y Servidor:**
  ```bash
  npm run build
  ```
  *Genera el bundle de React (con chunks separados gracias a React.lazy) en `dist/` y compila el API Gateway Express en `dist/server.cjs`.*

- **Compilación de Cloud Functions:**
  ```bash
  pnpm --prefix functions run build
  ```
  *Compila todo el código TypeScript de las funciones en `functions/lib/` listo para desplegar.*
