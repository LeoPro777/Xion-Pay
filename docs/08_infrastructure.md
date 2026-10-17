# 8. Infraestructura, DevOps y Resiliencia (Infrastructure)

## 8.1. Entornos y Variables de Entorno (`.env`)

```ini
# Configuración del Entorno
ENVIRONMENT=production # development | staging | production
APP_PORT=8000
SECRET_KEY=super-secret-crypto-hash-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Claves Asimétricas para Firma de Licencias (Ruta a ficheros montados en volumen)
RSA_PRIVATE_KEY_PATH=/app/certs/license_private.pem
RSA_PUBLIC_KEY_PATH=/app/certs/license_public.pem

# PostgreSQL
POSTGRES_USER=xionpay_admin
POSTGRES_PASSWORD=strong_vault_password_2026
POSTGRES_DB=xionpay_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://xionpay_admin:strong_vault_password_2026@postgres:5432/xionpay_db

# Google OAuth2
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com

# CORS & WebSockets
ALLOWED_ORIGINS=https://admin.xionpay.com,http://localhost:5173
```

## 8.2. Containerización / Despliegue (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: xionpay_postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: xionpay_backend
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    env_file:
      - .env
    volumes:
      - ./certs:/app/certs:ro
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: xionpay_frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

## 8.3. Mecanismo de Logs y Monitoreo

* **Logs Estructurados en JSON:** El backend implementa registro estructurado con marcas temporales ISO 8601, nivel de log (`INFO`, `WARNING`, `ERROR`, `CRITICAL`), ID de correlación de solicitud (*Request Correlation ID*) y módulo emisor.
* **Alertas Críticas:** Los errores en la emisión de licencias o fallos de conexión con bases de datos generan trazas prioritarias `ERROR` con detalle del contexto del cliente afectado para auditoría técnica inmediata.

## 8.4. Resiliencia de Red y Reintentos

* **Despacho de Webhooks con Retroceso Exponencial (Exponential Backoff):** Si la instancia remota de Xion-Manager no responde con código HTTP `200 OK` al recibir un evento de licencia, el despachador reintenta la entrega con la siguiente política:
  * Intento 1: Inmediato.
  * Intento 2: a los 30 segundos.
  * Intento 3: a los 5 minutos.
  * Intento 4: a los 30 minutos.
* **Persistencia de Fallos en Webhook Logs:** Si se agotan los 4 intentos sin respuesta satisfactoria, el registro se marca como `failed` en `webhook_logs`, notificando al administrador mediante una alerta operativa en el dashboard para intervención manual sin comprometer la consistencia de los datos en Xion-Pay.
