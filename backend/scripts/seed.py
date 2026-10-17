import asyncio
import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from src.core.database import AsyncSessionLocal, init_db
from src.modules.auth.models import AdminUser
from src.modules.plans.models import Plan
from src.modules.tenants.models import Tenant, Subscription
from src.modules.payments.models import PaymentReport
from src.core.crypto_licensing import generate_license_token, compute_token_hash
from datetime import datetime, timedelta, timezone


async def seed():
    print("Running Xion-Pay database seed script...")
    await init_db()

    async with AsyncSessionLocal() as session:
        # 1. Master Superadmin
        admin_res = await session.execute(select(AdminUser).where(AdminUser.email == "admin@xionpay.internal"))
        admin = admin_res.scalar_one_or_none()
        if not admin:
            admin = AdminUser(
                email="admin@xionpay.internal",
                full_name="Administrador Principal",
                google_sub="google-oauth2|109283746519283746519",
                role="superadmin",
                is_active=True,
            )
            session.add(admin)
            print("[OK] Created master superadmin: admin@xionpay.internal")
        else:
            print("[INFO] Master superadmin already exists.")

        # 2. Plans
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

        plans_by_code = {}
        for p in plans_data:
            res = await session.execute(select(Plan).where(Plan.code == p["code"]))
            existing = res.scalar_one_or_none()
            if not existing:
                plan_obj = Plan(**p)
                session.add(plan_obj)
                plans_by_code[p["code"]] = plan_obj
                print(f"[OK] Created plan: {p['name']} (${p['price_usd']})")
            else:
                plans_by_code[p["code"]] = existing
                print(f"[INFO] Plan {p['code']} already exists.")

        await session.flush()

        # 3. Sample Demo Tenants & Payments (if none exist)
        tenants_res = await session.execute(select(Tenant))
        if not tenants_res.scalars().first():
            now = datetime.now(timezone.utc)
            t1 = Tenant(
                commercial_name="Supermercados El Éxito C.A.",
                tax_id="J-401928374",
                owner_email="gerencia@elexito.com",
                owner_phone="+58 414 1234567",
                webhook_url="https://elexito.xion.internal/webhooks/xion-pay",
                webhook_secret="sec_elexito_vault_token_99",
                status="active",
                courtesy_days_granted=0,
            )
            session.add(t1)
            await session.flush()

            sub1 = Subscription(
                tenant_id=t1.id,
                plan_id=plans_by_code["advanced"].id,
                billing_cycle="monthly",
                status="active",
                current_period_start=now - timedelta(days=20),
                current_period_end=now + timedelta(days=10),
            )
            session.add(sub1)

            t2 = Tenant(
                commercial_name="Farmacia La Pastora Express",
                tax_id="J-502938471",
                owner_email="administracion@lapastora.com",
                owner_phone="+58 424 9876543",
                webhook_url="https://lapastora.xion.internal/webhooks/xion-pay",
                webhook_secret="sec_pastora_key_88",
                status="trial",
                trial_ends_at=now + timedelta(days=5),
                courtesy_days_granted=0,
            )
            session.add(t2)
            await session.flush()

            sub2 = Subscription(
                tenant_id=t2.id,
                plan_id=plans_by_code["basic"].id,
                billing_cycle="monthly",
                status="active",
                current_period_start=now - timedelta(days=5),
                current_period_end=now + timedelta(days=10),
            )
            session.add(sub2)

            # Sample pending payment for testing reconciliation inbox
            payment_sample = PaymentReport(
                tenant_id=t1.id,
                subscription_id=sub1.id,
                origin_bank="Banesco",
                reference_number="98745612",
                amount=50.00,
                currency="USD",
                proof_attachment_url="https://placehold.co/800x1000/0f172a/ffffff.png?text=Comprobante+Banesco+98745612",
                status="pending",
                metadata_info={"client_ip": "190.202.10.5", "reported_by_user": "gerencia@elexito.com"},
                reported_at=now - timedelta(minutes=15),
            )
            session.add(payment_sample)

            print("[OK] Seeded demo tenants (Supermercados El Exito, Farmacia La Pastora) and sample pending payment.")

        await session.commit()
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
