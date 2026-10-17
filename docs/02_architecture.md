# 2. Arquitectura y Estructura (Architecture)

## 2.1. Patrón Arquitectónico

El sistema adopta una **Arquitectura en Capas Limpias (Clean Layered Architecture)** con separación total entre Backend (API REST asíncrona) y Frontend (Single Page Application responsiva).

```
[ Frontend: React + TypeScript (Vite) ]
               │  ▲  HTTP REST / WebSocket
               ▼  │
[ API Layer: FastAPI Routers + Middlewares (Auth / CORS) ]
               │
[ Service / Use Case Layer: Lógica de Negocio + Antifraude + Criptografía ]
               │
[ Data Access Layer: Repositorios SQLAlchemy 2.0 (Async) ]
               │
[ Persistence: PostgreSQL Database Engine ]
```

## 2.2. Árbol de Directorios Objetivo

```text
xion-pay/
├── backend/
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   ├── src/
│   │   ├── core/
│   │   │   ├── config.py             # Configuración central (Pydantic Settings)
│   │   │   ├── database.py           # Engine asíncrono y sesión de PostgreSQL
│   │   │   ├── security.py           # Hashing, JWT, verificación Google OAuth2
│   │   │   └── crypto_licensing.py   # Firma de tokens de licencia (claves asimétricas)
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   ├── metrics/
│   │   │   │   ├── router.py
│   │   │   │   └── service.py
│   │   │   ├── tenants/
│   │   │   │   ├── models.py
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── service.py
│   │   │   ├── plans/
│   │   │   │   ├── models.py
│   │   │   │   ├── router.py
│   │   │   │   ├── schemas.py
│   │   │   └── payments/
│   │   │       ├── models.py
│   │   │       ├── router.py
│   │   │       ├── schemas.py
│   │   │       └── service.py
│   │   ├── modules/webhooks/
│   │   │   ├── dispatcher.py         # Envío de webhooks salientes con HMAC
│   │   │   └── schemas.py
│   │   ├── modules/notifications/
│   │   │   ├── router.py             # Endpoints y WebSockets de alertas admin
│   │   │   └── manager.py            # ConnectionManager para WebSockets en vivo
│   │   ├── utils/
│   │   │   ├── pdf_generator.py      # Generador de facturas PDF (ReportLab/WeasyPrint)
│   │   │   └── exceptions.py         # Clases de excepción personalizadas
│   │   └── main.py                   # Inicialización de FastAPI y montaje de rutas
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic.ini
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/               # Botones, modales, badges, data tables
│   │   │   ├── layout/               # Header, Sidebar, BottomNav para móviles
│   │   │   ├── metrics/              # Tarjetas KPI, gráficos de ingresos
│   │   │   ├── payments/             # Visor de comprobantes, modal de rechazo
│   │   │   └── tenants/              # Ficha de cliente, switch de estado
│   │   ├── context/
│   │   │   ├── AuthContext.tsx       # Estado de sesión de Google + JWT
│   │   │   └── NotificationContext.tsx # Conexión a WebSocket para alertas en vivo
│   │   ├── hooks/
│   │   │   ├── usePayments.ts
│   │   │   └── useResponsive.ts
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── TenantsPage.tsx
│   │   │   ├── PlansPage.tsx
│   │   │   ├── ReconciliationPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── services/
│   │   │   ├── api.ts                # Instancia Axios con interceptores de Auth
│   │   │   └── endpoints.ts
│   │   ├── types/                    # Interfaces y contratos TypeScript estrictos
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## 2.3. Responsabilidad de Componentes

* `routers / controllers`: Reciben peticiones HTTP/WS, validan esquemas con Pydantic y devuelven respuestas HTTP tipadas. No contienen lógica de negocio directa.
* `services`: Orquestan la lógica de negocio (validación antifraude, cómputo de MRR, activación de licencias, emisión de eventos).
* `repositories / models`: Definen el esquema de persistencia y ejecutan consultas directas a PostgreSQL mediante SQLAlchemy.
* `crypto_licensing`: Módulo aislado responsable de la firma asimétrica de tokens mediante clave privada RSA/ECDSA.
* `webhooks/dispatcher`: Gestiona el envío seguro de eventos HTTP a los clientes con reintentos y firma HMAC SHA-256.

## 2.4. Protocolos y Canales de Comunicación

* **REST HTTP/JSON (TLS Obligatorio):** Comunicación estándar para operaciones CRUD, consultas y autenticación.
* **WebSockets (`ws://` / `wss://`):** Canal bidireccional entre FastAPI y el frontend para notificar al administrador en tiempo real sobre nuevos pagos reportados.
* **Webhooks HTTP POST (Salientes con HMAC):** Disparados desde Xion-Pay hacia las URLs públicas de las instancias de Xion-Manager de cada cliente tras eventos de ciclo de vida (`payment.approved`, `plan.updated`, `account.suspended`).
