# Xion-Pay

Plataforma SaaS de administración interna de misión crítica para el ecosistema Xion.

Xion-Pay centraliza la gestión de inquilinos (*tenants*), supervisa la salud financiera (MRR, churn, retención), audita y concilia pagos manuales multimoneda (USD y VES vía Pago Móvil, Zelle y transferencias bancarias), y actúa como la autoridad certificadora central que expide tokens de licenciamiento criptográfico (RS256) y despacha eventos vía webhooks (HMAC SHA-256) hacia **Xion-Manager** y **Xion-POS**.

---

## 📑 Documentación de Arquitectura y Especificaciones

* [01. Visión General y Alcance](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/01_overview.md)
* [02. Arquitectura y Estructura](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/02_architecture.md)
* [03. Especificación Modular y Requerimientos](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/03_modules.md)
* [04. Modelo y Estado de Datos (PostgreSQL DDL & Seeders)](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/04_data_model.md)
* [05. Seguridad, Autenticación y Sesiones](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/05_security_auth.md)
* [06. Contratos de Integración y API REST/Webhooks](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/06_api_spec.md)
* [07. Reglas de Desarrollo, Manejo de Errores y Prohibiciones Estrictas](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/07_development_rules.md)
* [08. Infraestructura, DevOps y Resiliencia](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/docs/08_infrastructure.md)

---

## 🛠️ Stack Tecnológico

* **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), Alembic, Pydantic V2, PyJWT + Cryptography (RS256 / HS256).
* **Frontend:** React 18+, TypeScript 5+ (Strict), Vite, Tailwind CSS, Lucide React, Axios.
* **Base de Datos:** PostgreSQL 16+ con UUIDs nativos y JSONB.
* **DevOps:** Docker Engine & Docker Compose.

---

## 💻 Ejecución Local (Sin Docker)

Para desarrollo local sin depender de Docker, utiliza cualquiera de las siguientes opciones para levantar **Backend (FastAPI)** y **Frontend (Vite React)** en conjunto:

### Opción 1: PowerShell
```powershell
.\scripts\dev.ps1
```

### Opción 2: NPM (desde la raíz)
```bash
npm run dev
```

### Opción 3: Python directo
```bash
python .\scripts\run_dev.py
```

### Opción 4: Doble clic en Windows
Ejecuta el archivo [dev.bat](file:///c:/Users/Usuario/Desktop/Xion/Xion-Pay/scripts/dev.bat).

* **Backend API & Swagger:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Frontend SPA:** [http://localhost:5173](http://localhost:5173)

---

## 🐳 Despliegue en Producción (Con Docker)

Para entornos de staging o producción:
```bash
docker compose up -d --build
```

