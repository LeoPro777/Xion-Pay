import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.core.config import settings
from src.core.database import init_db
from src.utils.exceptions import XionPayBaseException
from src.modules.auth.router import router as auth_router
from src.modules.metrics.router import router as metrics_router
from src.modules.tenants.router import router as tenants_router, clients_router
from src.modules.plans.router import router as plans_router
from src.modules.payments.router import router as payments_router
from src.modules.webhooks.router import router as webhooks_router
from src.modules.notifications.router import router as notifications_router
from src.modules.settings.router import router as settings_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("xionpay.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Xion-Pay API database schema and cryptographic subsystem...")
    try:
        await init_db()
        logger.info("Database schema initialized successfully.")
    except Exception as exc:
        logger.error(
            f"Fallo en la conexión inicial con la base de datos ({type(exc).__name__}: {exc}). "
            "Aviso Render + Supabase: Render no soporta IPv6 saliente. Si estás utilizando la URL directa "
            "(db.[REF].supabase.co), debes cambiarla por el Connection Pooler de Supabase "
            "(aws-0-[REGION].pooler.supabase.com en puerto 6543 o 5432) en DATABASE_URL.",
            exc_info=True,
        )
    yield
    logger.info("Shutting down Xion-Pay API server.")


app = FastAPI(
    title="Xion-Pay API",
    description="Plataforma SaaS de administración interna de misión crítica, licenciamiento digital y conciliación de pagos multimoneda.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers
@app.exception_handler(XionPayBaseException)
async def xion_pay_exception_handler(request: Request, exc: XionPayBaseException):
    """Handles domain exceptions with RFC-coherent structured JSON."""
    logger.warning(f"Domain exception on {request.url.path}: [{exc.error_code}] {exc.message}")
    payload = {
        "error_code": exc.error_code,
        "message": exc.message,
    }
    if exc.details:
        payload["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Sanitizes Pydantic validation errors."""
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "Los datos suministrados no cumplen con el esquema de validación requerido.",
            "details": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all unhandled exception handler that prevents stack trace leakage."""
    logger.error(f"Unhandled server error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "Ha ocurrido un error inesperado en el servidor.",
        },
    )


# Mount API Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(metrics_router, prefix="/api/v1")
app.include_router(tenants_router, prefix="/api/v1")
app.include_router(clients_router, prefix="/api/v1")
app.include_router(plans_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(notifications_router)  # includes /ws/admin/notifications


@app.get("/health", tags=["Salud del Sistema"])
async def health_check():
    return {
        "status": "healthy",
        "service": "xion-pay-core",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Salud del Sistema"])
async def root():
    return {
        "message": "Xion-Pay Licensing & Payment Reconciliation Core API",
        "documentation": "/docs",
    }
