# 3. Especificación Modular y Requerimientos (Modules)

## 3.1. Listado de Módulos

1. Módulo de Métricas y Salud SaaS (Analytics Engine).
2. Módulo de Directorio de Tenants y Control de Cuentas.
3. Módulo de Planes y Parámetros Técnicos.
4. Módulo de Bandeja de Conciliación de Pagos (Reconciliation Inbox).
5. Módulo de Licenciamiento Criptográfico y Webhooks.
6. Módulo de Alertas Administrativas en Tiempo Real y Facturación.

---

## 3.2. Especificación Detallada por Módulo

### Módulo 1: Panel General y Métricas SaaS

#### 3.2.1. Requerimientos Funcionales
* Calcular y desplegar en tiempo real el MRR agrupado por moneda (USD y contravalor en Bs).
* Mostrar contadores segmentados: Comercios Activos, Comercios en Trial (período de prueba), Comercios en Período de Gracia y Comercios Suspendidos.
* Calcular la Tasa de Retención mensual y Tasa de Cancelación (*Churn Rate*).
* Desplegar un panel de alertas operativas con badges de urgencia: pagos pendientes por auditar, suscripciones con expiración inferior a 72 horas y cuentas en morosidad.

#### 3.2.2. Flujo de Datos / Algoritmo
1. El backend recibe petición autenticada en `GET /api/v1/metrics/dashboard`.
2. Ejecuta consultas agregadas asíncronas en PostgreSQL:
   * Suma de cuotas normalizadas de suscripciones con estado `active` divididas por periodicidad (mensual = 1, trimestral = 3, anual = 12).
   * Agrupación `COUNT` por estado de inquilino.
   * Filtro sobre tabla `payment_reports` con estado `pending`.
3. Retorna un objeto JSON unificado; el frontend refresca las tarjetas métricas con soporte de caché en memoria de 60 segundos.

#### 3.2.3. Wireframe / UI Concept
* **Desktop:** Barra superior con switch de moneda (USD/Bs). Cuadrícula de 4 KPI cards superiores (MRR, Clientes Activos, En Trial, Retención %). Sección central dividida: izquierda gráfico de barras de retención mensual, derecha panel de alerta con listado de pagos pendientes destacados en color ámbar.
* **Mobile:** Tarjetas métricas en carrusel horizontal deslizable. Lista vertical de alertas prioritarias con accesos directos táctiles a la bandeja de conciliación.

---

### Módulo 2: Directorio de Clientes (Tenants)

#### 3.2.1. Requerimientos Funcionales
* Registrar, listar, buscar y filtrar comercios por RIF/Documento, Nombre Comercial o Correo.
* Modificar manualmente el estado de un comercio: `active`, `trial`, `frozen`, `suspended`.
* Otorgar días de prórroga/cortesía con un solo clic, extendiendo la fecha de expiración sin requerir pago previo.
* Visualizar el hardware/cajas registradoras activas reportadas por el comercio.

#### 3.2.2. Flujo de Datos / Algoritmo
1. El administrador selecciona una acción sobre el cliente (ej. "Congelar Cuenta").
2. Frontend envía `PATCH /api/v1/tenants/{tenant_id}/status` con nuevo estado y motivo.
3. El servicio actualiza el estado en PostgreSQL, invalida el token de licencia vigente y encola un evento en el despachador de webhooks (`account.suspended`).
4. Se notifica a la instancia de Xion-Manager vía webhook firmado.

#### 3.2.3. Wireframe / UI Concept
* Tabla de clientes interactiva con paginación, barra de búsqueda reactiva y filtros por estado.
* Cada fila dispone de una columna de acciones rápidas (botón de 3 puntos): "Ver Ficha", "Conceder Prórroga", "Suspender/Reactivar".
* Ficha de cliente desplegable en un panel lateral (*Slide-over modal*) con detalle de sucursales, límite de cajas y contacto directo.

---

### Módulo 3: Catálogo de Planes y Parámetros

#### 3.2.1. Requerimientos Funcionales
* Creación y edición de planes de suscripción (ej. Básico, Avanzado, Enterprise).
* Definición de restricciones técnicas:
  * Límite máximo de sucursales autorizadas.
  * Límite máximo de cajas registradoras concurrentes para Xion-POS.
  * Flags de funcionalidades: `inventory_transfers`, `advanced_audit`, `external_api`.
* Configuración de precios multimoneda (USD / Bs) y esquemas de descuento porcentual por ciclo de cobro (mensual, trimestral, anual).

#### 3.2.2. Flujo de Datos / Algoritmo
1. El usuario administrador envía `POST /api/v1/plans` con payload de límites y precios.
2. El sistema valida mediante Pydantic que los límites numéricos sean enteros no negativos y que los descuentos oscilen entre 0% y 100%.
3. El registro se persiste; cualquier cambio posterior sobre un plan existente no muta contratos vigentes hasta la siguiente renovación del comercio.

#### 3.2.3. Wireframe / UI Concept
* Vistas de tarjetas de planes estilo pricing grid.
* Modal de edición con tabs: "Límites Técnicos", "Precios y Ciclos" y "Módulos Habilitados" con switches para cada flag.

---

### Módulo 4: Bandeja de Conciliación y Aprobación de Pagos

#### 3.2.1. Requerimientos Funcionales
* Listar en tiempo real los pagos manuales reportados por los clientes desde Xion-Manager.
* Visualizar el comprobante digital adjunto (soporte para imágenes PNG, JPG y documentos PDF).
* Permitir aprobación en 1 clic:
  * Valida la referencia y aplica la renovación de la suscripción.
  * Genera la nueva licencia criptográfica.
  * Emite el webhook de confirmación a Xion-Manager.
* Permitir rechazo en 1 clic:
  * Exige un motivo de rechazo seleccionable (ej. "Comprobante ilegible", "Referencia no encontrada en extracto bancario", "Monto insuficiente") o comentario libre.
  * Actualiza el estado de la transacción para que el cliente lo observe en Xion-Manager.

#### 3.2.2. Flujo de Datos / Algoritmo
```
[ Cliente reporta pago en Xion-Manager ]
                 │
                 ▼
[ POST /api/v1/payments/report a Xion-Pay ]
                 │
  ┌──────────────┴──────────────┐
  │ ¿Existe (banco, ref, monto)?│
  └──────────────┬──────────────┘
         SÍ ─────┴───── NO
         │              │
[ 409 Conflict: ]   [ Persiste Pago (Status: 'pending') ]
[ 'Referencia   ]   [ Activa Tolerancia 24h si vence hoy ]
[ duplicada'    ]   [ Envía Alerta WebSocket al Admin    ]
                        │
                        ▼
            [ Admin revisa en Bandeja ]
                        │
            ┌───────────┴───────────┐
      [ APROBAR ]              [ RECHAZAR ]
            │                        │
  - Actualiza a 'approved'  - Actualiza a 'rejected'
  - Genera Token Licencia   - Registra motivo
  - Despacha Webhook        - Despacha Webhook
    'payment.approved'        'payment.rejected'
```

#### 3.2.3. Wireframe / UI Concept
* **Bandeja de Entrada Dividida (Split View):**
  * *Panel Izquierdo:* Lista de pagos pendientes con badge de banco (Banesco, Mercantil, Pago Móvil, Zelle), monto, fecha y tiempo transcurrido.
  * *Panel Derecho:* Visor expandido del comprobante bancario, datos fiscales del comercio y dos botones principales fijos en la parte inferior: **Aprobar Pago** (verde) y **Rechazar Pago** (rojo con prompt de motivo).

---

### Módulo 5: Motor de Licenciamiento y Webhooks

#### 3.2.1. Requerimientos Funcionales
* Generar un token digital firmado con clave privada RSA (RS256) tras la aprobación de pago o prórroga manual.
* El token debe contener en su payload: `tenant_id`, `plan_code`, `max_branches`, `max_pos_registers`, `enabled_features`, `issued_at`, `expires_at`.
* Despachar eventos HTTP seguros a la URL configurada por el comercio con encabezado `X-Xion-Signature` generado mediante HMAC SHA-256.

#### 3.2.2. Algoritmo de Firma de Licencia
1. Servicio recupera los parámetros vigentes del plan asignado y la nueva fecha de expiración.
2. Construye el payload del token.
3. Firma criptográficamente con la clave privada de Xion-Pay.
4. Persiste el hash del token en `license_tokens` para auditoría.
5. Invoca a `WebhookDispatcher.send(tenant_id, event="payment.approved", data={license_token: ...})`.

#### 3.2.3. Wireframe / UI Concept
* Sub-panel técnico dentro de la ficha del cliente que muestra la licencia activa, vigencia restante en formato *"Vence en X días"* y un log histórico de los últimos 10 webhooks despachados con su código HTTP de respuesta (ej. 200 OK, 500 Error).

---

### Módulo 6: Notificaciones Administrativas, Trazabilidad e Historial

#### 3.2.1. Requerimientos Funcionales
* Emitir una alerta sonora y visual en tiempo real en la barra de navegación del administrador cuando entre un nuevo pago reportado.
* Proveer historial completo de transacciones conciliadas con filtros por rango de fechas, método y comercio.
* Generación de comprobantes oficiales de pago en formato PDF descargables tanto por el administrador como emitibles hacia el cliente.

#### 3.2.2. Flujo de Datos / Algoritmo
1. Cuando `POST /api/v1/payments/report` se completa exitosamente, el backend emite un mensaje JSON a través del `NotificationManager` a todas las sesiones activas en el WebSocket `/ws/admin/notifications`.
2. El frontend recibe el evento, reproduce una alerta discreta y añade un badge en la campana de notificaciones.
3. Para la descarga de PDF, `GET /api/v1/payments/{payment_id}/invoice-pdf` orquesta la compilación en memoria de la factura y retorna el stream de bytes con cabecera `Content-Type: application/pdf`.

#### 3.2.3. Wireframe / UI Concept
* Campana de notificaciones en el header con popover que lista las últimas alertas. Al hacer clic, redirige directamente al pago en la bandeja de conciliación.
* Página de Historial de Facturas con tabla de auditoría completa y botón "Descargar PDF" por cada transacción aprobada.
