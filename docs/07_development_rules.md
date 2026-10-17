# 7. Reglas de Desarrollo y Estilo (Development Rules)

## 7.1. Stack Tecnológico

* **Backend:** Python 3.11+, FastAPI 0.110+, SQLAlchemy 2.0 (Asyncpg), Alembic, Pydantic V2, PyJWT con Cryptography (para RS256).
* **Frontend:** React 18+, TypeScript 5+, Vite, Tailwind CSS, Lucide React (íconos), Axios.
* **Persistencia:** PostgreSQL 16.
* **Infraestructura:** Docker Engine & Docker Compose.

## 7.2. Convenciones de Código

### Python:
* Cumplimiento estricto de PEP 8.
* Tipado estático 100% obligatorio usando *Type Hints* nativos en todas las funciones y clases.
* Nomenclatura: `snake_case` para variables, funciones y métodos; `PascalCase` para clases y modelos de Pydantic/SQLAlchemy.

### TypeScript:
* `strict: true` activado en `tsconfig.json`. Prohibido el uso explícito o implícito del tipo `any`.
* Nomenclatura: `camelCase` para variables y funciones; `PascalCase` para componentes React, interfaces y tipos; `UPPER_SNAKE_CASE` para constantes.
* Componentes funcionales estructurados exclusivamente con hooks nativos.

## 7.3. Estrategia de Manejo de Errores

* Middleware de excepción global en FastAPI para capturar errores no controlados y registrarlos estructuradamente, evitando fugas de trazas internas (*stack traces*) al cliente.
* Excepciones de dominio personalizadas (`DuplicatePaymentException`, `TenantSuspendedException`, `InvalidLicenseException`) que derivan de una clase base `XionPayBaseException` mapeada a códigos HTTP RFC 7807 coherentes.
* En el frontend, interceptores de Axios gestionan automáticamente la expiración del token (código 401) redirigiendo a la pantalla de login, mientras que los fallos 409 y 422 renderizan mensajes directos y comprensibles al operador.

## 7.4. Lista de Prohibiciones Estrictas (Strict Bans)

1. **PROHIBIDO** almacenar contraseñas directas en el backend. Toda autenticación de usuarios administradores debe resolverse obligatoriamente vía Google Identity Services.
2. **PROHIBIDO** omitir validaciones en el backend confiando en que el frontend ya validó los campos. Toda entrada se valida rigurosamente en Pydantic.
3. **PROHIBIDO** procesar una conciliación de pago sin una transacción de base de datos atómica (`async with session.begin():`). Si falla la emisión del token o la persistencia, se debe revertir el cambio de estado.
4. **PROHIBIDO** hardcodear claves privadas de firma de licencias o secretos HMAC en el código fuente. Se leen obligatoriamente desde variables de entorno seguras.
5. **PROHIBIDO** deshabilitar o ignorar la restricción de índice único `idx_unique_payment_ref`.
