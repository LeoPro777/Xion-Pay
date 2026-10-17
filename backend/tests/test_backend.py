import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from src.main import app
from src.core.database import Base, get_db
from src.core.crypto_licensing import generate_license_token, verify_license_token
from src.modules.auth.models import AdminUser
from src.modules.plans.models import Plan
from src.modules.tenants.models import Tenant, Subscription
from src.modules.payments.models import PaymentReport
from src.core.security import create_access_token

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(test_db: AsyncSession):
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_crypto_licensing_rs256():
    """Verify RS256 token generation and asymmetric signature verification."""
    tenant_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=30)
    features = {"inventory_transfers": True, "advanced_audit": False}

    token = generate_license_token(
        tenant_id=tenant_id,
        plan_code="advanced",
        max_branches=2,
        max_pos_registers=4,
        enabled_features=features,
        issued_at=now,
        expires_at=exp,
    )

    assert isinstance(token, str)
    assert len(token) > 50

    # Verify signature
    decoded = verify_license_token(token)
    assert decoded["tenant_id"] == tenant_id
    assert decoded["plan_code"] == "advanced"
    assert decoded["max_branches"] == 2
    assert decoded["max_pos_registers"] == 4
    assert decoded["enabled_features"] == features


@pytest.mark.asyncio
async def test_antifraud_duplicate_payment_rejection(client: AsyncClient, test_db: AsyncSession):
    """Verify that submitting an identical (origin_bank, reference_number, amount) is strictly rejected with 409."""
    now = datetime.now(timezone.utc)

    # Setup Plan & Tenant
    plan = Plan(
        code="basic",
        name="Plan Basico",
        max_branches=1,
        max_pos_registers=1,
        price_usd=25.0,
        is_active=True,
    )
    test_db.add(plan)
    await test_db.flush()

    tenant = Tenant(
        commercial_name="Test Store",
        tax_id="J-99999999",
        owner_email="test@store.com",
        owner_phone="12345",
        status="active",
    )
    test_db.add(tenant)
    await test_db.flush()

    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    test_db.add(sub)
    await test_db.commit()

    payload = {
        "tenant_id": str(tenant.id),
        "origin_bank": "Banesco",
        "reference_number": "REF-UNIQUE-001",
        "amount": 50.00,
        "currency": "USD",
        "proof_attachment_url": "https://proofs.xionpay.test/001.jpg",
    }

    # First report -> 201 Created
    res1 = await client.post("/api/v1/payments/report", json=payload)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["status"] == "success"

    # Second report (duplicate) -> 409 Conflict
    res2 = await client.post("/api/v1/payments/report", json=payload)
    assert res2.status_code == 409
    data2 = res2.json()
    assert data2["error_code"] == "DUPLICATE_PAYMENT_REFERENCE"
    assert data2["details"]["reference_number"] == "REF-UNIQUE-001"


@pytest.mark.asyncio
async def test_one_click_approval_flow(client: AsyncClient, test_db: AsyncSession):
    """Verify 1-click payment approval issuing RS256 token and renewing subscription."""
    now = datetime.now(timezone.utc)

    # Create admin
    admin = AdminUser(
        email="superadmin@xionpay.internal",
        full_name="Super Admin",
        google_sub="sub-test-1",
        role="superadmin",
        is_active=True,
    )
    test_db.add(admin)

    plan = Plan(
        code="advanced",
        name="Plan Avanzado",
        max_branches=2,
        max_pos_registers=4,
        price_usd=50.0,
        is_active=True,
    )
    test_db.add(plan)
    await test_db.flush()

    tenant = Tenant(
        commercial_name="Approval Store",
        tax_id="J-88888888",
        owner_email="approv@store.com",
        owner_phone="55555",
        status="trial",
    )
    test_db.add(tenant)
    await test_db.flush()

    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=2),
    )
    test_db.add(sub)
    await test_db.flush()

    payment = PaymentReport(
        tenant_id=tenant.id,
        subscription_id=sub.id,
        origin_bank="Mercantil",
        reference_number="REF-MERC-999",
        amount=50.00,
        currency="USD",
        proof_attachment_url="https://proofs.xionpay.test/merc.jpg",
        status="pending",
    )
    test_db.add(payment)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Approve
    res = await client.post(f"/api/v1/payments/{payment.id}/approve", headers=headers)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "success"
    assert "license_token" in res_data

    # Verify emitted license token
    license_decoded = verify_license_token(res_data["license_token"])
    assert license_decoded["tenant_id"] == str(tenant.id)
    assert license_decoded["plan_code"] == "advanced"

    # Verify payment cannot be approved twice (inviolable audit state)
    res_repeat = await client.post(f"/api/v1/payments/{payment.id}/approve", headers=headers)
    assert res_repeat.status_code == 400


@pytest.mark.asyncio
async def test_courtesy_days_and_license_renewal(client: AsyncClient, test_db: AsyncSession):
    """Verify granting courtesy days extends period and re-issues valid RS256 token."""
    now = datetime.now(timezone.utc)
    admin = AdminUser(
        email="operator@xionpay.internal",
        full_name="Operator User",
        google_sub="sub-test-2",
        role="operator",
        is_active=True,
    )
    test_db.add(admin)

    plan = Plan(code="basic_cd", name="Plan Test", price_usd=25.0, is_active=True)
    test_db.add(plan)
    await test_db.flush()

    tenant = Tenant(
        commercial_name="Courtesy Store",
        tax_id="J-77777777",
        owner_email="courtesy@store.com",
        owner_phone="123",
        status="active",
    )
    test_db.add(tenant)
    await test_db.flush()

    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=5),
    )
    test_db.add(sub)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.post(
        f"/api/v1/tenants/{tenant.id}/courtesy-days",
        headers=headers,
        json={"days": 7, "reason": "Soporte técnico preventivo"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["courtesy_days_granted"] == 7
    assert data["latest_license"] is not None


@pytest.mark.asyncio
async def test_metrics_and_pdf_generation(client: AsyncClient, test_db: AsyncSession):
    """Verify dashboard metrics calculation and PDF generation stream."""
    now = datetime.now(timezone.utc)
    admin = AdminUser(
        email="auditor@xionpay.internal",
        full_name="Auditor User",
        google_sub="sub-test-3",
        role="auditor",
        is_active=True,
    )
    test_db.add(admin)

    plan = Plan(code="ent_metrics", name="Enterprise", price_usd=150.0, is_active=True)
    test_db.add(plan)
    await test_db.flush()

    tenant = Tenant(
        commercial_name="Metrics Corp",
        tax_id="J-66666666",
        owner_email="metrics@corp.com",
        owner_phone="999",
        status="active",
    )
    test_db.add(tenant)
    await test_db.flush()

    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    test_db.add(sub)
    await test_db.flush()

    payment = PaymentReport(
        tenant_id=tenant.id,
        subscription_id=sub.id,
        origin_bank="Banesco",
        reference_number="REF-APPROVED-100",
        amount=150.00,
        currency="USD",
        proof_attachment_url="https://proofs.xionpay.test/100.jpg",
        status="approved",
    )
    test_db.add(payment)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Dashboard Metrics
    res_metrics = await client.get("/api/v1/metrics/dashboard", headers=headers)
    assert res_metrics.status_code == 200
    metrics_data = res_metrics.json()
    assert metrics_data["mrr_usd"] == 150.0
    assert metrics_data["tenant_counts"]["active"] >= 1

    # PDF Invoice Download
    res_pdf = await client.get(f"/api/v1/payments/{payment.id}/invoice-pdf", headers=headers)
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert len(res_pdf.content) > 500  # valid PDF binary stream


@pytest.mark.asyncio
async def test_plan_creation_and_webhook_test_dispatch(client: AsyncClient, test_db: AsyncSession):
    """Verify plan creation/update by superadmin and test webhook dispatch."""
    admin = AdminUser(
        email="superadmin_test@xionpay.internal",
        full_name="Super Admin Test",
        google_sub="sub-test-4",
        role="superadmin",
        is_active=True,
    )
    test_db.add(admin)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Plan
    plan_payload = {
        "code": "starter_test",
        "name": "Plan Starter Test",
        "description": "Plan de prueba unitaria",
        "price_usd": 29.99,
        "max_branches": 1,
        "max_pos_registers": 2,
        "quarterly_discount_pct": 5.0,
        "annual_discount_pct": 10.0,
        "features": {"inventory_transfers": True, "advanced_audit": False, "external_api": False},
    }
    res_plan = await client.post("/api/v1/plans", json=plan_payload, headers=headers)
    assert res_plan.status_code == 201
    plan_data = res_plan.json()
    assert plan_data["code"] == "starter_test"
    assert plan_data["price_usd"] == 29.99

    # 2. Register Tenant with Webhook URL
    tenant = Tenant(
        commercial_name="Webhook Test Store",
        tax_id="J-55555555",
        owner_email="webhook@teststore.com",
        owner_phone="111222",
        webhook_url="https://httpbin.org/post",
        webhook_secret="sec_test_12345",
        status="active",
    )
    test_db.add(tenant)
    await test_db.commit()

    # 3. Trigger Test Webhook Dispatch
    res_wh = await client.post(f"/api/v1/webhooks/test/{tenant.id}", headers=headers)
    assert res_wh.status_code == 200
    wh_data = res_wh.json()
    assert wh_data["event_type"] == "system.ping"
    assert wh_data["tenant_id"] == str(tenant.id)


@pytest.mark.asyncio
async def test_system_settings_and_exchange_rate_update(client: AsyncClient, test_db: AsyncSession):
    """Verify fetching default settings, updating exchange rate, and dynamic calculation in metrics."""
    admin = AdminUser(
        email="settings_admin@xionpay.internal",
        full_name="Settings Admin",
        google_sub="sub-test-settings",
        role="superadmin",
        is_active=True,
    )
    test_db.add(admin)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET default settings
    res_get = await client.get("/api/v1/settings")
    assert res_get.status_code == 200
    data_get = res_get.json()
    assert data_get["usd_ves_rate"] == 36.50

    # 2. PUT new exchange rate (e.g. 45.50)
    res_put = await client.put(
        "/api/v1/settings/exchange-rate",
        headers=headers,
        json={"usd_ves_rate": 45.50},
    )
    assert res_put.status_code == 200
    data_put = res_put.json()
    assert data_put["usd_ves_rate"] == 45.50

    # 3. GET metrics to verify dynamic database exchange rate application
    res_metrics = await client.get("/api/v1/metrics/dashboard", headers=headers)
    assert res_metrics.status_code == 200
    metrics_data = res_metrics.json()
    assert metrics_data["exchange_rate_usd_ves"] == 45.50


@pytest.mark.asyncio
async def test_xion_manager_lead_onboarding_and_crm(client: AsyncClient, test_db: AsyncSession):
    """Verify receiving Xion-Manager form grants 30-day trial, license token, and dormant fiscal profile."""
    # 1. Post lead from Xion-Manager
    payload = {
        "nombre_contacto": "Carlos Mendoza",
        "nombre_comercial": "Bodegón El Marqués",
        "email": "carlos@bodegonmarques.com",
        "telefono_contacto": "+584141234567",
        "documento_identidad_tipo": "V",
        "documento_identidad_numero": "18456789",
        "source": "xion-manager",
        "notes": "Lead interesado en 2 cajas registradoras",
    }
    res = await client.post("/api/v1/tenants/onboarding-trial", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["trial_days_granted"] == 30
    assert data["trial_days_remaining"] == 30
    assert data["status"] == "trial"
    assert "license_token" in data
    assert len(data["license_token"]) > 30

    client_id = data["client_id"]

    # 2. Login admin to inspect client in CRM
    admin = AdminUser(
        email="crm_admin@xionpay.internal",
        full_name="CRM Admin",
        google_sub="sub-crm-admin",
        role="superadmin",
        is_active=True,
    )
    test_db.add(admin)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Inspect client detail
    res_detail = await client.get(f"/api/v1/tenants/{client_id}", headers=headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["contact_name"] == "Carlos Mendoza"
    assert detail["id_doc_number"] == "18456789"
    assert detail["crm_lead_source"] == "xion-manager"
    assert detail["fiscal_profile"] is not None
    assert detail["fiscal_profile"]["activo_seniat"] is False  # Dormant by default in MVP

    # 3. Generate MVP Recibo de Cobro (IVA 0%, sin número de control fiscal)
    res_rec = await client.post(
        f"/api/v1/tenants/{client_id}/comprobantes",
        headers=headers,
        json={"monto_usd": 25.00, "tasa_bcv": 36.50, "aplica_igtf": False},
    )
    assert res_rec.status_code == 201
    rec_data = res_rec.json()
    assert rec_data["tipo_documento"] == "RECIBO_COBRO"
    assert rec_data["porcentaje_iva"] == 0.00
    assert rec_data["monto_iva_ves"] == 0.00
    assert rec_data["numero_control"] is None
    assert rec_data["total_ves"] == 912.50  # 25 * 36.50


@pytest.mark.asyncio
async def test_fiscal_profile_seniat_feature_flag_and_invoice(client: AsyncClient, test_db: AsyncSession):
    """Verify activating SENIAT feature flag enforces RIF/Razón Social validation and produces fiscal invoice."""
    # Create client
    lead_payload = {
        "nombre_contacto": "Ana Morales",
        "nombre_comercial": "Farmacia Nueva Esparta",
        "email": "ana@farmacianueva.com",
        "telefono_contacto": "+584129876543",
        "documento_identidad_tipo": "J",
        "documento_identidad_numero": "304958671",
    }
    res_lead = await client.post("/api/v1/clients/onboarding-trial", json=lead_payload)
    assert res_lead.status_code == 201
    client_id = res_lead.json()["client_id"]

    admin = AdminUser(
        email="fiscal_admin@xionpay.internal",
        full_name="Fiscal Admin",
        google_sub="sub-fiscal-admin",
        role="superadmin",
        is_active=True,
    )
    test_db.add(admin)
    await test_db.commit()
    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Attempting to activate SENIAT without canonical RIF fails with 400
    bad_activation = await client.put(
        f"/api/v1/tenants/{client_id}/fiscal-profile",
        headers=headers,
        json={"activo_seniat": True, "numero_rif": "", "razon_social": ""},
    )
    assert bad_activation.status_code == 400
    assert "SENIAT" in bad_activation.json()["message"]

    # 2. Activate with valid legal data
    good_activation = await client.put(
        f"/api/v1/tenants/{client_id}/fiscal-profile",
        headers=headers,
        json={
            "activo_seniat": True,
            "tipo_documento_fiscal": "RIF_J",
            "numero_rif": "J-30495867-1",
            "razon_social": "Farmacia Nueva Esparta C.A.",
            "es_contribuyente_especial": True,
            "estado": "Nueva Esparta",
            "municipio": "Mariño",
            "direccion_detallada": "Av. 4 de Mayo, Porlamar",
        },
    )
    assert good_activation.status_code == 200
    assert good_activation.json()["activo_seniat"] is True

    # 3. Generate Comprobante with SENIAT active -> Must produce FACTURA_FISCAL with 16% IVA and Control Number
    res_fac = await client.post(
        f"/api/v1/tenants/{client_id}/comprobantes",
        headers=headers,
        json={"monto_usd": 50.00, "tasa_bcv": 36.50, "aplica_igtf": True},
    )
    assert res_fac.status_code == 201
    fac_data = res_fac.json()
    assert fac_data["tipo_documento"] == "FACTURA_FISCAL"
    assert fac_data["porcentaje_iva"] == 16.00
    assert fac_data["monto_iva_ves"] == 292.00  # (50 * 36.50 = 1825.00) * 0.16 = 292.00
    assert fac_data["aplica_igtf"] is True
    assert fac_data["monto_igtf_ves"] == 54.75  # 1825.00 * 0.03 = 54.75
    assert fac_data["total_ves"] == 2171.75     # 1825 + 292 + 54.75
    assert fac_data["numero_control"] is not None
    assert fac_data["datos_fiscales_snapshot"]["rif"] == "J-30495867-1"


@pytest.mark.asyncio
async def test_crm_client_edit_and_deactivate(client: AsyncClient, test_db: AsyncSession):
    """Verify that CRM clients can be edited and deactivated/reactivated."""
    admin = AdminUser(
        email="crm_tester@xionpay.com",
        google_sub="google-sub-crm-tester",
        full_name="CRM Tester",
        role="superadmin",
        is_active=True,
    )
    test_db.add(admin)

    plan = Plan(
        code="crm_plan",
        name="CRM Standard",
        max_branches=1,
        max_pos_registers=2,
        price_usd=20.0,
        is_active=True,
    )
    test_db.add(plan)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create client
    create_res = await client.post(
        "/api/v1/tenants",
        headers=headers,
        json={
            "commercial_name": "Panadería El Trigo",
            "contact_name": "Carlos Mendoza",
            "id_doc_type": "V",
            "id_doc_number": "14567890",
            "owner_email": "carlos@eltrigo.com",
            "owner_phone": "+584141112233",
            "status": "trial",
        },
    )
    assert create_res.status_code == 201
    client_id = create_res.json()["id"]

    # 2. Edit client operational data and CRM notes
    edit_res = await client.patch(
        f"/api/v1/tenants/{client_id}",
        headers=headers,
        json={
            "commercial_name": "Panadería & Delicateses El Trigo",
            "contact_name": "Carlos Mendoza Jr.",
            "owner_phone": "+584149998877",
            "crm_notes": "Cliente VIP interesado en plan anual.",
        },
    )
    assert edit_res.status_code == 200
    updated_data = edit_res.json()
    assert updated_data["commercial_name"] == "Panadería & Delicateses El Trigo"
    assert updated_data["contact_name"] == "Carlos Mendoza Jr."
    assert updated_data["owner_phone"] == "+584149998877"
    assert updated_data["crm_notes"] == "Cliente VIP interesado en plan anual."

    # 3. Deactivate client
    deact_res = await client.patch(
        f"/api/v1/tenants/{client_id}/status",
        headers=headers,
        json={"status": "suspended", "reason": "Falta de pago o solicitud de baja"},
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["status"] == "suspended"

    # 4. Reactivate client
    react_res = await client.patch(
        f"/api/v1/tenants/{client_id}/status",
        headers=headers,
        json={"status": "active", "reason": "Pago recibido y cuenta regularizada"},
    )
    assert react_res.status_code == 200
    assert react_res.json()["status"] == "active"


@pytest.mark.asyncio
async def test_auth_config_endpoint(client: AsyncClient):
    """Verify public auth configuration endpoint returns google_client_id."""
    res = await client.get("/api/v1/auth/config")
    assert res.status_code == 200
    data = res.json()
    assert "google_client_id" in data


def test_database_url_supabase_normalization():
    """Verify that postgresql and supabase pooler URLs with sslmode are properly normalized."""
    from src.core.config import Settings
    s = Settings(DATABASE_URL="postgresql://postgres.abc:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require")
    assert s.DATABASE_URL.startswith("postgresql+asyncpg://")
    assert "ssl=require" in s.DATABASE_URL
    assert "sslmode=require" not in s.DATABASE_URL


@pytest.mark.asyncio
async def test_plans_catalog_endpoint(client: AsyncClient, test_db: AsyncSession):
    """Verify public plans catalog endpoint returns plans and payment methods."""
    plan = Plan(
        code="test-catalog-plan",
        name="Plan Catálogo Test",
        price_usd=40.00,
        quarterly_discount_pct=5.0,
        annual_discount_pct=10.0,
        max_branches=1,
        max_pos_registers=2,
        features={"test": True},
        is_active=True,
    )
    test_db.add(plan)
    await test_db.commit()

    res = await client.get("/api/v1/plans/catalog")
    assert res.status_code == 200
    data = res.json()
    assert "plans" in data
    assert "payment_methods" in data
    assert "exchange_rate_usd_ves" in data
    assert any(p["code"] == "test-catalog-plan" for p in data["plans"])


@pytest.mark.asyncio
async def test_tenant_license_status_endpoint(client: AsyncClient, test_db: AsyncSession):
    """Verify Xion-Manager can query its license and authorization status."""
    t_id = uuid.uuid4()
    tenant = Tenant(
        id=t_id,
        commercial_name="Cliente Consulta Status",
        tax_id="J-99988877-6",
        owner_email="status@test.com",
        owner_phone="+584149998877",
        status="trial",
    )
    test_db.add(tenant)
    await test_db.commit()

    res = await client.get(f"/api/v1/tenants/{t_id}/license-status")
    assert res.status_code == 200
    data = res.json()
    assert data["tenant_id"] == str(t_id)
    assert data["status"] == "trial"


@pytest.mark.asyncio
async def test_tenant_balance_recharge_and_auto_renew(client: AsyncClient, test_db: AsyncSession):
    """Verify tenant wallet balance recharge and automatic renewal deduction."""
    admin = AdminUser(
        id=uuid.uuid4(),
        email="super@xion.com",
        google_sub="google_superadmin_123",
        full_name="Super Admin",
        role="superadmin",
        is_active=True,
    )
    test_db.add(admin)

    plan = Plan(
        code="standard_29",
        name="Plan Estándar",
        price_usd=29.00,
        max_branches=1,
        max_pos_registers=2,
        features={"pos": True},
        is_active=True,
    )
    test_db.add(plan)
    await test_db.flush()

    now = datetime.now(timezone.utc)
    past_due = now - timedelta(days=2)
    tenant = Tenant(
        commercial_name="Inversiones AutoRenueva",
        tax_id="J-11223344-5",
        owner_email="inversiones@test.com",
        owner_phone="+584141122334",
        delivery_channel="all",
        telegram_chat_id="12345678",
        status="suspended",
        wallet_balance=0.00,
    )
    test_db.add(tenant)
    await test_db.flush()

    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        billing_cycle="monthly",
        status="suspended",
        current_period_start=past_due - timedelta(days=30),
        current_period_end=past_due,
    )
    test_db.add(sub)
    await test_db.commit()

    token = create_access_token({"sub": admin.email, "role": admin.role})
    headers = {"Authorization": f"Bearer {token}"}

    # Recharge 50.00 USD with auto_renew=True
    recharge_res = await client.post(
        f"/api/v1/tenants/{tenant.id}/balance",
        json={"amount": 50.00, "auto_renew": True, "reason": "Recarga bancaria directa"},
        headers=headers,
    )
    assert recharge_res.status_code == 200
    r_data = recharge_res.json()
    assert r_data["auto_renewed"] is True
    # 50 - 29 = 21.00 USD remaining
    assert r_data["current_balance"] == 21.00

    # Tenant detail check
    detail_res = await client.get(f"/api/v1/tenants/{tenant.id}", headers=headers)
    assert detail_res.status_code == 200
    t_data = detail_res.json()
    assert t_data["status"] == "active"
    assert t_data["wallet_balance"] == 21.00
    assert t_data["countdown_days"] >= 29


@pytest.mark.asyncio
async def test_payment_report_establishes_grace_period_and_enriches_inbox(client: AsyncClient, test_db: AsyncSession):
    """Verify that reporting a payment grants automatic 48h grace period and enriches reconciliation details."""
    admin = AdminUser(
        id=uuid.uuid4(),
        email="auditor@xion.com",
        google_sub="google_auditor_456",
        full_name="Auditor Conciliador",
        role="operator",
        is_active=True,
    )
    test_db.add(admin)

    plan = Plan(
        code="premium_59",
        name="Plan Premium Pro",
        price_usd=59.00,
        max_branches=3,
        max_pos_registers=6,
        features={"all": True},
        is_active=True,
    )
    test_db.add(plan)
    await test_db.flush()

    tenant = Tenant(
        commercial_name="Bodegón La Castellana",
        contact_name="Carlos Mendez",
        tax_id="J-55443322-1",
        owner_email="carlos@bodegon.com",
        owner_phone="+584125554433",
        delivery_channel="whatsapp",
        status="suspended",
        wallet_balance=10.00,
    )
    test_db.add(tenant)
    await test_db.flush()

    now = datetime.now(timezone.utc)
    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        billing_cycle="monthly",
        status="suspended",
        current_period_start=now - timedelta(days=32),
        current_period_end=now - timedelta(days=2),
    )
    test_db.add(sub)
    await test_db.commit()

    # Report payment
    report_res = await client.post(
        "/api/v1/payments/report",
        json={
            "tenant_id": str(tenant.id),
            "origin_bank": "Banesco",
            "destination_bank": "Banco de Venezuela",
            "payment_method_type": "pago_movil",
            "reference_number": "PM-998877",
            "amount": 59.00,
            "currency": "USD",
            "proof_attachment_url": "https://storage.xionpay.io/comprobante-pm998877.jpg",
        },
    )
    assert report_res.status_code == 201
    rep_data = report_res.json()
    assert rep_data["tolerance_granted"] is True
    assert rep_data["tolerance_expires_at"] is not None

    token = create_access_token({"sub": admin.email, "role": admin.role})
    headers = {"Authorization": f"Bearer {token}"}

    # Inspect reconciliation inbox
    inbox_res = await client.get("/api/v1/payments/inbox", headers=headers)
    assert inbox_res.status_code == 200
    inbox = inbox_res.json()
    item = next((p for p in inbox if p["reference_number"] == "PM-998877"), None)
    assert item is not None
    assert item["plan_name"] == "Plan Premium Pro"
    assert item["plan_price"] == 59.00
    assert item["tenant_phone"] == "+584125554433"
    assert item["tenant_email"] == "carlos@bodegon.com"
    assert item["tenant_contact_name"] == "Carlos Mendez"
    assert item["origin_bank"] == "Banesco"
    assert item["destination_bank"] == "Banco de Venezuela"
    assert item["payment_method_type"] == "pago_movil"
    assert item["tenant_wallet_balance"] == 10.00
    assert item["exchange_rate"] == 36.50
    assert item["amount_usd"] == 59.00
    assert item["amount_ves"] == round(59.00 * 36.50, 2)


@pytest.mark.asyncio
async def test_multicurrency_payment_and_wallet_credit_on_approval(client: AsyncClient, test_db: AsyncSession):
    """Verify reporting in VES (Bs) converts via exchange rate and approving credits tenant wallet balance."""
    now = datetime.now(timezone.utc)
    admin = AdminUser(
        id=uuid.uuid4(),
        email="operator_multi@xion.com",
        google_sub="google_multi_123",
        full_name="Operador Multimoneda",
        role="operator",
        is_active=True,
    )
    test_db.add(admin)

    plan = Plan(
        code="plan_multi",
        name="Plan Multimoneda",
        price_usd=40.00,
        max_branches=2,
        max_pos_registers=2,
        is_active=True,
    )
    test_db.add(plan)
    await test_db.flush()

    tenant = Tenant(
        commercial_name="Inversiones El Avila C.A.",
        tax_id="J-99887766-5",
        owner_email="avila@tienda.com",
        owner_phone="+584149988776",
        status="active",
        wallet_balance=15.00,
    )
    test_db.add(tenant)
    await test_db.flush()

    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=plan.id,
        billing_cycle="monthly",
        status="active",
        current_period_start=now - timedelta(days=10),
        current_period_end=now + timedelta(days=20),
    )
    test_db.add(sub)
    await test_db.commit()

    # 1. Report payment in VES (Bs. 2,000 with tasa 50.0 Bs/USD = $40.00 USD)
    report_res = await client.post(
        "/api/v1/payments/report",
        json={
            "tenant_id": str(tenant.id),
            "origin_bank": "Banco de Venezuela",
            "destination_bank": "Banesco",
            "payment_method_type": "pago_movil",
            "reference_number": "PM-VES-001122",
            "amount": 2000.00,
            "currency": "VES",
            "exchange_rate": 50.00,
            "proof_attachment_url": "https://storage.xionpay.io/proof-ves.jpg",
        },
    )
    assert report_res.status_code == 201
    rep_data = report_res.json()
    payment_id = rep_data["payment_id"]

    token = create_access_token({"sub": admin.email, "role": admin.role, "id": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check inbox reflects dual currency and tasa
    inbox_res = await client.get("/api/v1/payments/inbox", headers=headers)
    assert inbox_res.status_code == 200
    inbox_items = inbox_res.json()
    p_item = next((p for p in inbox_items if p["reference_number"] == "PM-VES-001122"), None)
    assert p_item is not None
    assert p_item["currency"] == "VES"
    assert p_item["amount"] == 2000.00
    assert p_item["exchange_rate"] == 50.00
    assert p_item["amount_usd"] == 40.00
    assert p_item["amount_ves"] == 2000.00

    # 3. Approve payment: wallet balance must be credited by approved amount ($40 USD)
    # Initial was 15.00 -> 15.00 + 40.00 = 55.00
    approve_res = await client.post(f"/api/v1/payments/{payment_id}/approve", headers=headers)
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["status"] == "success"
    assert app_data["subscription"]["wallet_balance"] == 55.00

    # 4. Verify tenant record updated
    t_res = await client.get(f"/api/v1/tenants/{tenant.id}", headers=headers)
    assert t_res.status_code == 200
    t_data = t_res.json()
    assert t_data["wallet_balance"] == 55.00


