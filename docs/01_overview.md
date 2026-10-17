# 1. Visión General y Alcance (Overview)

## 1.1. Propósito del Sistema

Xion-Pay es una plataforma SaaS de administración interna de misión crítica diseñada exclusivamente para el equipo administrativo y directivo del ecosistema Xion. Su objetivo principal es centralizar la gestión de inquilinos (*tenants*), supervisar la salud financiera (MRR, churn, retención), auditar y conciliar pagos manuales multimoneda (USD y Bolívares vía Pago Móvil, Zelle y transferencias bancarias), y actuar como la autoridad certificadora central que expide tokens de licenciamiento criptográfico y despacha eventos vía webhooks para habilitar y restringir el funcionamiento operativo de las instancias cliente de **Xion-Manager** y sus terminales **Xion-POS**.

## 1.2. Alcance del Proyecto

### Dentro del Alcance (In Scope):
* Panel de métricas SaaS operativas y financieras (MRR, comercios activos, pruebas activas, tasa de retención, mora).
* Directorio integral de comercios (*tenants*) con control de ciclo de vida (activación, congelamiento, suspensión, prórrogas manuales).
* Catálogo paramétrico de planes y tarifas multidivisa (USD / Bs) con modulación de límites técnicos (sucursales, cajas concurrentes, módulos activos).
* Bandeja de entrada para conciliación de pagos manuales en 1 clic con visualización de comprobantes y validación de referencias.
* Mecanismo antifraude estricto en base de datos para impedir duplicidad de referencias bancarias.
* Generador y firmador criptográfico de licencias digitales de software.
* Despachador de webhooks seguros hacia instancias remotas de Xion-Manager.
* Canal de notificaciones administrativas en tiempo real ante nuevos pagos reportados.
* Módulo de tolerancia operativa (24 horas de gracia preventiva al reportar pago).
* Generación y descarga de comprobantes/facturas de suscripción en formato PDF.
* Autenticación delegada exclusiva para administradores mediante Google OAuth2 y emisión de JSON Web Tokens (JWT).
* Diseño adaptativo web y móvil (*full-responsive*).

### Fuera del Alcance (Out of Scope):
* Módulos de punto de venta y facturación comercial a consumidor final (responsabilidad de Xion-POS).
* Gestión de inventarios, compras, almacenes y ventas minoristas del comercio (responsabilidad de Xion-Manager).
* Procesamiento automatizado con pasarelas de pago recurrentes internacionales automatizadas (Stripe, Adyen, debitos directos SEPA/ACH). Toda la verificación en esta fase es manual asistida.
* Acceso directo o autoservicio de clientes finales dentro del dominio de Xion-Pay (los comercios interactúan exclusivamente desde Xion-Manager).

## 1.3. Reglas de Negocio Globales

* **Autoridad Central de Ejecución:** Xion-Manager no puede operar de forma autónoma sin un token de licencia criptográficamente firmado y validado por Xion-Pay.
* **Restricción Antifraude Inquebrantable:** Ninguna transacción puede ser procesada o registrada si la tupla `(banco_origen, numero_referencia, monto)` ya existe en la base de datos de Xion-Pay, independientemente del comercio que la ingrese.
* **Ventana de Tolerancia Operativa:** Si un comercio reporta un comprobante de pago el día exacto de su fecha de corte o vencimiento, el sistema otorga un estado transitorio de contingencia de 24 horas (*"Pago en Proceso de Verificación"*), impidiendo el bloqueo preventivo de las cajas de Xion-POS mientras administración concilia.
* **Inmutabilidad de Auditoría:** Una vez que un pago manual es Aprobado o Rechazado por un administrador, el registro queda sellado con marca de tiempo, usuario auditor y justificación técnica (en caso de rechazo), impidiendo modificaciones posteriores sobre la misma transacción.
* **Caducidad Automática de Licencias:** Todo token de licencia emitido contiene una marca temporal estricta (`exp`). Si la instancia de Xion-Manager no recibe un webhook de renovación antes de dicho límite, entra automáticamente en modo degradado o bloqueo según sus políticas locales.

## 1.4. Glosario de Términos

* **Tenant (Comercio):** Entidad jurídica registrada que contrata el servicio, identificada con un identificador tributario (RIF/Cédula) y asociada a una o más sucursales.
* **Xion-Manager:** Sistema ERP/administrativo desplegado para el comercio cliente, el cual reporta pagos y consume licencias de Xion-Pay.
* **Xion-POS:** Terminales de punto de venta físicas o lógicas dependientes de Xion-Manager que ejecutan transacciones de venta concurrentes.
* **MRR (Monthly Recurring Revenue):** Métrica normalizada de ingresos recurrentes mensuales calculada en base a las suscripciones activas pagadas.
* **Período de Gracia (Grace Period):** Ventana de tiempo configurable otorgada a un comercio moroso antes de suspender totalmente el servicio.
* **Token Criptográfico de Licencia:** Cadena firmada digitalmente (formato JWT asimétrico RS256) que encapsula los privilegios técnicos contratados por el comercio.
* **Conciliación Manual en 1 Clic:** Flujo de trabajo administrativo donde se valida el extracto bancario contra el comprobante adjunto y se aprueba la renovación de forma atómica.
