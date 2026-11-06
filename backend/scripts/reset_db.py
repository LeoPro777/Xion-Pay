import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from src.core.config import settings
from src.core.database import engine, AsyncSessionLocal, init_db
from src.modules.auth.models import AdminUser
from src.modules.plans.models import Plan
from src.modules.settings.models import SystemSetting, PaymentMethod
from src.modules.settings.service import DEFAULT_PAYMENT_METHODS


async def reset_database():
    print("================================================================")
    print("INICIANDO REINICIO COMPLETO DE BASE DE DATOS (ESTADO 0)")
    print("================================================================")

    # 1. Drop all tables in public schema with CASCADE
    async with engine.begin() as conn:
        print("[1/4] Eliminando todas las tablas existentes en esquema public...")
        drop_query = text("""
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        """)
        await conn.execute(drop_query)
        print("[OK] Todas las tablas han sido eliminadas exitosamente.")

    # 2. Recreate schema via init_db
    print("[2/4] Creando estructura de tablas limpias...")
    await init_db()
    print("[OK] Tablas recreadas correctamente con metadata de SQLAlchemy.")

    # 3. Seed minimal clean operational data
    print("[3/4] Aprovisionando datos base iniciales...")
    target_admin_email = (
        getattr(settings, "INITIAL_ADMIN_EMAIL", "") or os.getenv("INITIAL_ADMIN_EMAIL", "") or "Leodfernandez@gmail.com"
    ).strip()

    async with AsyncSessionLocal() as session:
        # A) Superadmin único autorizado
        superadmin = AdminUser(
            email=target_admin_email,
            full_name="Leonard Fernández",
            google_sub=f"pending-google-link-{uuid.uuid4()}",
            role="superadmin",
            is_active=True,
        )
        session.add(superadmin)
        print(f"[OK] Creado Superadmin inicial único: {target_admin_email}")

        # B) Catálogo de Planes
        plans_data = [
            {
                "code": "basic",
                "name": "Plan Emprendedor Básico",
                "description": "Ideal para comercios con una sola sede y una caja registradora.",
                "max_branches": 1,
                "max_pos_registers": 1,
                "features": {"inventory_transfers": False, "advanced_audit": False, "external_api": False},
                "price_usd": 25.00,
                "quarterly_discount_pct": 5.00,
                "annual_discount_pct": 15.00,
            },
            {
                "code": "advanced",
                "name": "Plan Comercial Avanzado",
                "description": "Pensado para negocios medianos con múltiples terminales.",
                "max_branches": 2,
                "max_pos_registers": 4,
                "features": {"inventory_transfers": True, "advanced_audit": False, "external_api": False},
                "price_usd": 50.00,
                "quarterly_discount_pct": 10.00,
                "annual_discount_pct": 20.00,
            },
            {
                "code": "enterprise",
                "name": "Plan Corporativo Enterprise",
                "description": "Para cadenas y grandes comercios con necesidades de auditoría completa y API.",
                "max_branches": 10,
                "max_pos_registers": 20,
                "features": {"inventory_transfers": True, "advanced_audit": True, "external_api": True},
                "price_usd": 150.00,
                "quarterly_discount_pct": 15.00,
                "annual_discount_pct": 25.00,
            },
        ]
        for p in plans_data:
            session.add(Plan(**p))
        print("[OK] Catálogo de planes estándar creado (basic, advanced, enterprise).")

        # C) Tasa BCV Oficial por defecto
        rate_setting = SystemSetting(
            key="usd_ves_rate",
            value=os.getenv("DEFAULT_USD_VES_RATE", "36.50"),
            description="Tasa de cambio referencial oficial BCV USD a VES",
            updated_at=datetime.now(timezone.utc),
        )
        session.add(rate_setting)
        print(f"[OK] Tasa de cambio oficial BCV inicial establecida: {rate_setting.value} Bs/USD.")

        # D) Coordenadas Oficiales de Pago (Pago Móvil, Transferencia, Zelle)
        for method_data in DEFAULT_PAYMENT_METHODS:
            method_obj = PaymentMethod(
                name=method_data["name"],
                type=method_data["type"],
                currency=method_data["currency"],
                details=method_data["details"],
                instructions=method_data.get("instructions"),
                is_active=method_data.get("is_active", True),
            )
            session.add(method_obj)
        print("[OK] Métodos oficiales receptores de pago creados.")

        await session.commit()

    # 4. Verification check
    print("[4/4] Verificando estado final limpio de la base de datos...")
    async with AsyncSessionLocal() as session:
        admin_count = (await session.execute(text("SELECT count(*) FROM admin_users;"))).scalar()
        tenant_count = (await session.execute(text("SELECT count(*) FROM tenants;"))).scalar()
        payment_count = (await session.execute(text("SELECT count(*) FROM payment_reports;"))).scalar()
        invoice_count = (await session.execute(text("SELECT count(*) FROM comprobantes_pago;"))).scalar()
        plan_count = (await session.execute(text("SELECT count(*) FROM plans;"))).scalar()

        print("----------------------------------------------------------------")
        print(f"  * Administradores registrados: {admin_count} (Únicamente: {target_admin_email})")
        print(f"  * Comercios / Inquilinos:      {tenant_count} (Limpio en 0)")
        print(f"  * Reportes de pago recibidos:  {payment_count} (Limpio en 0)")
        print(f"  * Comprobantes / Facturas:     {invoice_count} (Limpio en 0)")
        print(f"  * Planes configurados:         {plan_count}")
        print("----------------------------------------------------------------")
        print("[LISTO] Base de datos reiniciada exitosamente desde 0.")


if __name__ == "__main__":
    asyncio.run(reset_database())

