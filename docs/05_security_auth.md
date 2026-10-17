# 5. Seguridad, Autenticación y Sesiones (Security & Auth)

## 5.1. Estrategia de Autenticación

* **Identidad Delegada (Google OAuth 2.0):** Los administradores ingresan mediante el flujo *Google Identity Services* en el frontend, obteniendo un `id_token` firmado por Google.
* **Intercambio de Token en Backend:** El backend valida el token con las librerías oficiales de Google (`google.oauth2.id_token.verify_oauth2_token`), extrayendo el `email` y `sub`.
* **Control de Acceso de Lista Blanca:** Solo se permite el acceso si el correo electrónico extraído de Google existe previamente en la tabla `admin_users` y posee `is_active = TRUE`. Se rechaza cualquier otro intento con código `403 Forbidden`.

## 5.2. Ciclo de Vida de la Sesión

* **Access Token:** JSON Web Token (JWT) firmado con algoritmo simétrico HS256 (o asimétrico RS256 con clave interna del core de auth). Vida útil: **30 minutos**.
* **Refresh Token:** Almacenado en cookies seguras `HttpOnly`, `Secure`, `SameSite=Strict`. Vida útil: **8 horas** (jornada operativa).
* **Revocación Inmediata:** Si un usuario es desactivado en `admin_users`, el middleware de autenticación del backend comprueba la validez del estado en caché/base de datos, expulsando la sesión de inmediato.

## 5.3. Modelo de Autorización (RBAC)

| Módulo / Acción | Rol: `superadmin` | Rol: `operator` | Rol: `auditor` |
| --- | --- | --- | --- |
| Ver Dashboard y Métricas SaaS | Sí | Sí | Sí |
| Ver Directorio de Clientes | Sí | Sí | Sí |
| Suspender / Congelar / Prorrogar Clientes | Sí | Sí | No |
| Crear y Modificar Planes / Tiers | Sí | No | No |
| Aprobar / Rechazar Pagos en Bandeja | Sí | Sí | No |
| Gestionar Usuarios Administradores | Sí | No | No |
| Descargar Facturas e Historial | Sí | Sí | Sí |
