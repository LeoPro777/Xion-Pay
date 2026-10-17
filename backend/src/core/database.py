from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from src.core.config import settings

# Engine configuration
engine_kwargs = {
    "echo": settings.ENVIRONMENT == "development",
    "future": True,
}

if "sqlite" in settings.DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True
    connect_args = {}

    is_pooler = (
        ":6543" in settings.DATABASE_URL
        or "pooler.supabase.com" in settings.DATABASE_URL
        or "pgbouncer=true" in settings.DATABASE_URL
    )
    if is_pooler:
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 10
    else:
        engine_kwargs["pool_size"] = 10
        engine_kwargs["max_overflow"] = 20

    if connect_args:
        engine_kwargs["connect_args"] = connect_args

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables for initial setup / testing."""
    # Ensure all models are loaded into declarative Base registry
    import src.modules.auth.models  # noqa: F401
    import src.modules.plans.models  # noqa: F401
    import src.modules.tenants.models  # noqa: F401
    import src.modules.payments.models  # noqa: F401
    import src.modules.webhooks.models  # noqa: F401
    import src.modules.settings.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _migrate_columns_sync(connection):
            from sqlalchemy import inspect, text
            inspector = inspect(connection)
            table_names = inspector.get_table_names()
            if "tenants" in table_names:
                existing_cols = {c["name"] for c in inspector.get_columns("tenants")}
                new_cols = [
                    ("contact_name", "VARCHAR(150)"),
                    ("id_doc_type", "VARCHAR(10) DEFAULT 'V'"),
                    ("id_doc_number", "VARCHAR(50)"),
                    ("crm_lead_source", "VARCHAR(100) DEFAULT 'manual'"),
                    ("crm_notes", "TEXT"),
                    ("wallet_balance", "NUMERIC(12, 2) DEFAULT 0.00"),
                    ("delivery_channel", "VARCHAR(50) DEFAULT 'email'"),
                    ("telegram_chat_id", "VARCHAR(100)"),
                ]
                for col_name, col_def in new_cols:
                    if col_name not in existing_cols:
                        try:
                            connection.execute(text(f"ALTER TABLE tenants ADD COLUMN {col_name} {col_def}"))
                        except Exception:
                            pass

            if "payment_reports" in table_names:
                existing_pay_cols = {c["name"] for c in inspector.get_columns("payment_reports")}
                new_pay_cols = [
                    ("destination_bank", "VARCHAR(150)"),
                    ("payment_method_type", "VARCHAR(50) DEFAULT 'pago_movil'"),
                    ("exchange_rate", "NUMERIC(12, 4) DEFAULT 1.0"),
                    ("amount_usd", "NUMERIC(14, 2) DEFAULT 0.00"),
                    ("amount_ves", "NUMERIC(14, 2) DEFAULT 0.00"),
                ]
                for col_name, col_def in new_pay_cols:
                    if col_name not in existing_pay_cols:
                        try:
                            connection.execute(text(f"ALTER TABLE payment_reports ADD COLUMN {col_name} {col_def}"))
                        except Exception:
                            pass

        await conn.run_sync(_migrate_columns_sync)
