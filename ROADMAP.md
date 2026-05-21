# Plan de Desarrollo: Módulos de Logística, Vendedores, Clientes y Repartidores

Este archivo sirve como el **Checklist Interactivo** y la hoja de ruta para completar las funcionalidades pendientes de la plataforma. Iremos marcando cada paso como `[x] Completado` a medida que avancemos.

---

## 📋 Diagnóstico y Recomendaciones (Brechas Identificadas)

### 🚚 1. App de Logística (Dashboard Principal)
*Lo que ya está:* Recepción de mercadería, emisión de órdenes de despacho individuales y visualización georreferenciada en el mapa con optimización de rutas (Google Maps API).
*Lo que le falta y recomendamos implementar:*
- [x] **1.1. Control de Carga / Checkout del Repartidor (Picking):** Un panel de verificación donde el bodeguero marca los ítems cargados en el camión antes de que el chofer inicie ruta, evitando despachos incompletos.
- [x] **1.2. Módulo de Reconciliación e Inventario Físico (Tomas de Inventario):** Flujo de escaneo continuo de código de barras para auditar stock físico contra inventario sistémico, guardando historiales de mermas o sobrantes.
- [x] **1.3. Alertas Críticas de Quiebre de Stock:** Alertas visuales con badges para productos bajo el stock crítico establecido, con enlace directo a órdenes de compra pre-llenadas para los proveedores asociados.
- [x] **1.4. Dashboard Analítico de Desempeño Logístico:** Métricas de tiempo de entrega promedio por chofer, porcentaje de entregas exitosas a la primera (First-Time Delivery %) y mermas en ruta.

---

### 💼 2. App de Vendedores (Mobile POS - Venta en Terreno)
*Lo que ya está:* Selección de productos, escaneo de códigos con cámara, buscador de clientes por RUT/nombre, boleta/factura, cupones y checkout.
*Lo que le falta por desarrollar:*
- [x] **2.1. Cierres y Arqueo de Caja Móvil (Apertura de Turno):** Habilitar que el vendedor inicie el día declarando su efectivo inicial, registrando retiros parciales de efectivo y un resumen de cierre de turno al finalizar la jornada.
- [x] **2.2. Robustez y Sincronización Fuera de Línea (Modo Offline de Emergencia):** Guardar preventas localmente en `localStorage` si se pierde la señal en terreno, sincronizándolas masivamente a Firebase automáticamente cuando se recupere la conexión.
- [x] **2.3. Panel de Metas Diarias y Comisiones:** KPI visual para el vendedor (barra de meta diaria de ventas, porcentaje de comisión ganado hoy e historial de sus ventas de los últimos 7 días).

---

### 👥 3. App de Clientes (Portal de Clientes Autogestionado)
*Lo que ya está:* Catálogo interactivo de productos, canje de recompensas por puntos, cupones de descuento, billetera electrónica y tracking de entregas en mapa real.
*Lo que le falta por desarrollar:*
- [x] **3.1. Gestión de Soporte, Cambios y Devoluciones (Claims / Reclamos):** Permitir al cliente iniciar un reclamo/devolución sobre un recibo previo (ej: "Llegó roto" / "Faltó un producto"), permitiéndole tomar una fotografía con su cámara y subir el caso para bodega.
- [x] **3.2. Pago Rápido por Código QR dinámico:** Generar un código QR dinámico que represente el token de pago de su saldo disponible para que pueda ser escaneado físicamente por un vendedor en sala.
- [x] **3.3. Programa de Fidelización Gamificado ("Desafíos del Mes"):** Retos visuales estilo logros (ej. "Realiza 3 compras sobre $20k este mes para obtener 500 puntos extra o subir a rango Platino").

---

### 🚛 4. App de Repartidores / Choferes (Driver Portal)
*Lo que ya está:* Hojas de despacho asignadas, cálculo de ruta óptima en mapa directo, llamada al cliente, estados de despacho básicos.
*Lo que le falta por desarrollar:*
- [x] **4.1. Firma Digital de Recepción y Fotografía de Evidencia:**
  - Pad de dibujo táctil (`canvas`) para que el cliente firme directamente en la pantalla de entrega móvil.
  - Activación de cámara para subir una foto de evidencia en el domicilio (ej: paquete bajo la puerta si no hay nadie).
- [x] **4.2. Registro Detallado de No-Entrega (Protocolos de Rechazo/Falla):**
  - Si el despacho falla, habilitar opciones explícitas: *"Cliente ausente"*, *"Dirección incorrecta"*, *"Pedido dañado"* o *"Rechazado por cliente"*. Esto cambia el despacho a estado de alerta y reprograma de inmediato en logística.
- [x] **4.3. Lanzador Asistente a Enrutadores Externos (Google Maps / Waze):** Un botón claro "Iniciar Navegación" que abra de manera nativa la app de Google Maps o Waze con las coordenadas exactas de la próxima entrega de fondo.

---

# 🚀 Plan de Ejecución Paso a Paso (Interactivo)

Para mantener la disciplina y orden en el desarrollo, **ejecutaremos este checklist fase por fase**. Le sugerimos seguir la secuencia a continuación. Por favor, indíqueme cuál de los siguientes bloques desea que configuremos primero:

### 📍 [Fase 1]: App de Repartidores (Driver Portal de Elite)
*Objetivo: Robustecer el flujo físico final de entrega, capturando datos e impidiendo fraudes o pérdidas.*
- [x] **Paso 1.1:** Desarrollar el **Pad de Firma Digital Táctil y Evidencia Fotográfica** dentro del flujo de entrega final en `DriverPortal.tsx`.
- [x] **Paso 1.2:** Implementar el **Módulo de Protocolo de Falla de Entrega** (por ausencias o daños) guardando motivos en la base de datos para control de bodega.
- [x] **Paso 1.3:** Agregar los accesos rápidos de **Lanzamiento de Navegadores Externos** (Google Maps / Waze nativos) con formateo directo de coordenadas GPS.

### 📍 [Fase 2]: App de Vendedores (Mobile POS con Control Financiero)
*Objetivo: Controlar el flujo comercial en calle y asegurar consistencia monetaria.*
- [x] **Paso 2.1:** Implementar el flujo de **Apertura de Caja, Declaración de Efectivo Inicial, Retiros de Caja y Cierre Diario** en `MobilePOS.tsx`.
- [x] **Paso 2.2:** Configurar el **Sistema de Sincronización Offline** usando colas persistentes locales en caso de pérdida de cobertura en terreno.
- [x] **Paso 2.3:** Crear el componente visual de **Comisiones del Día y Metas de Venta** para incentivar el desempeño de los vendedores.

### 📍 [Fase 3]: App de Clientes (Portal de Fidelidad y Postventa)
*Objetivo: Aumentar la retención y resolver la postventa de forma digital y sin fricciones.*
- [x] **Paso 3.1:** Crear el **Módulo de Reclamos y Soporte de Postventa (Claims)** subiendo fotos del paquete directamente a la transacción.
- [x] **Paso 3.2:** Integrar la **Generación de QR de Pago Dinámico** para unificar el saldo electrónico y acelerar la compra presencial.
- [x] **Paso 3.3:** Maquetar el **Panel de Logros y Desafíos Gamificados** para canje de puntos de fidelidad.

### 📍 [Fase 4]: Dashboard de Logística (Centro de Mando de Bodega)
*Objetivo: Integrar el picking interno y control de stock antes de que el camión salga.*
- [x] **Paso 4.1:** Construir la pestaña **Verificación del Bodeguero (Control de Carga)** en `Logistics.tsx` para sincronizar stock cargado real vs stock ideal de ruta.
- [x] **Paso 4.2:** Desarrollar la herramienta de **Auditoría e Inventario Físico (Tomas de Inventario)** con escáner continuo.
- [x] **Paso 4.3:** Crear el sistema de **Alertas Automáticas de Quiebre de Stock Crítico** y analíticas gráficas de despachos en `Logistics.tsx`.

---
*¿Listo para comenzar? Respóndame indicando con qué fase o paso específico le gustaría iniciar hoy.*
