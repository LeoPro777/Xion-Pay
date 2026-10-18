import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("xionpay.tenants")


from src.core.crypto_licensing import generate_license_token, compute_token_hash
from src.modules.tenants.models import Tenant, Subscription, LicenseToken, FiscalProfile, ComprobantePago
from src.modules.plans.models import Plan
from src.modules.settings.service import SettingsService
from src.modules.tenants.schemas import (
    TenantCreate,
    TenantUpdate,
    TenantStatusUpdate,
    CourtesyDaysRequest,
    TenantDetailResponse,
    TenantListItemResponse,
    SubscriptionResponse,
    LicenseTokenResponse,
    FiscalProfileUpdate,
    FiscalProfileResponse,
    ComprobanteCreateRequest,
    ComprobanteResponse,
    XionManagerLeadCreate,
    XionManagerLeadResponse,
    TenantBalanceRecharge,
    TenantBalanceResponse,
)
from src.modules.plans.schemas import PlanResponse
from src.modules.webhooks.dispatcher import WebhookDispatcher
from src.modules.notifications.delivery_service import DeliveryNoteService
from src.utils.exceptions import ResourceNotFoundError, XionPayBaseException


class TenantService:
    @staticmethod
    def _calculate_trial_days_remaining(tenant: Tenant) -> Optional[int]:
        if tenant.status == "trial" and tenant.trial_ends_at:
            end_date = tenant.trial_ends_at
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            delta = end_date - now
            return max(0, delta.days)
        return None

    @staticmethod
    def _calculate_countdown(sub: Optional[Subscription]) -> dict:
        if not sub or not sub.current_period_end:
            return {
                "next_billing_date": None,
                "countdown_seconds": None,
                "countdown_days": None,
                "countdown_hours": None,
                "is_due": False,
                "in_grace_period": False,
            }

        now = datetime.now(timezone.utc)
        period_end = sub.current_period_end
        if period_end.tzinfo is None:
            period_end = period_end.replace(tzinfo=timezone.utc)

        diff_seconds = int((period_end - now).total_seconds())
        in_grace = False
        if sub.status == "grace_period":
            in_grace = True
        elif sub.tolerance_expires_at:
            tol_exp = sub.tolerance_expires_at
            if tol_exp.tzinfo is None:
                tol_exp = tol_exp.replace(tzinfo=timezone.utc)
            if tol_exp > now:
                in_grace = True

        is_due = diff_seconds <= 0
        days = max(0, diff_seconds // 86400) if diff_seconds > 0 else 0
        hours = max(0, (diff_seconds % 86400) // 3600) if diff_seconds > 0 else 0

        return {
            "next_billing_date": period_end,
            "countdown_seconds": max(0, diff_seconds),
            "countdown_days": days,
            "countdown_hours": hours,
            "is_due": is_due,
            "in_grace_period": in_grace,
        }

    @staticmethod
    async def list_tenants(
        db: AsyncSession,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[TenantListItemResponse]:
        query = select(Tenant).options(
            selectinload(Tenant.subscriptions).selectinload(Subscription.plan),
            selectinload(Tenant.fiscal_profile),
        ).order_by(Tenant.created_at.desc())

        if search:
            pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Tenant.commercial_name.ilike(pattern),
                    Tenant.contact_name.ilike(pattern),
                    Tenant.tax_id.ilike(pattern),
                    Tenant.owner_email.ilike(pattern),
                    Tenant.owner_phone.ilike(pattern),
                )
            )

        if status_filter:
            query = query.where(Tenant.status == status_filter)

        result = await db.execute(query)
        tenants = result.scalars().all()

        items = []
        for t in tenants:
            active_sub = next((s for s in t.subscriptions if s.status in ("active", "grace_period")), None)
            if not active_sub and t.subscriptions:
                active_sub = t.subscriptions[0]

            activo_seniat = t.fiscal_profile.activo_seniat if t.fiscal_profile else False
            countdown_data = TenantService._calculate_countdown(active_sub)

            items.append(
                TenantListItemResponse(
                    id=t.id,
                    commercial_name=t.commercial_name,
                    contact_name=t.contact_name,
                    tax_id=t.tax_id,
                    id_doc_type=t.id_doc_type or "V",
                    id_doc_number=t.id_doc_number,
                    owner_email=t.owner_email,
                    owner_phone=t.owner_phone,
                    status=t.status,
                    trial_days_remaining=TenantService._calculate_trial_days_remaining(t),
                    courtesy_days_granted=t.courtesy_days_granted,
                    crm_lead_source=t.crm_lead_source or "manual",
                    activo_seniat=activo_seniat,
                    wallet_balance=float(t.wallet_balance or 0.0),
                    delivery_channel=t.delivery_channel or "email",
                    telegram_chat_id=t.telegram_chat_id,
                    created_at=t.created_at,
                    active_plan_name=active_sub.plan.name if active_sub and active_sub.plan else None,
                    active_plan_price=float(active_sub.plan.price_usd) if active_sub and active_sub.plan else None,
                    subscription_status=active_sub.status if active_sub else None,
                    subscription_expires_at=active_sub.current_period_end if active_sub else None,
                    **countdown_data,
                )
            )
        return items

    @staticmethod
    async def get_tenant_detail(db: AsyncSession, tenant_id: uuid.UUID) -> TenantDetailResponse:
        query = (
            select(Tenant)
            .where(Tenant.id == tenant_id)
            .options(
                selectinload(Tenant.subscriptions).selectinload(Subscription.plan),
                selectinload(Tenant.license_tokens),
                selectinload(Tenant.fiscal_profile),
                selectinload(Tenant.comprobantes),
            )
        )
        result = await db.execute(query)
        tenant = result.scalar_one_or_none()

        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        active_sub = next((s for s in tenant.subscriptions if s.status in ("active", "grace_period")), None)
        latest_license = None
        if tenant.license_tokens:
            latest_license = max(tenant.license_tokens, key=lambda l: l.issued_at)

        sub_resp = None
        if active_sub:
            sub_resp = SubscriptionResponse(
                id=active_sub.id,
                tenant_id=active_sub.tenant_id,
                plan_id=active_sub.plan_id,
                billing_cycle=active_sub.billing_cycle,
                status=active_sub.status,
                current_period_start=active_sub.current_period_start,
                current_period_end=active_sub.current_period_end,
                tolerance_expires_at=active_sub.tolerance_expires_at,
                plan=PlanResponse.model_validate(active_sub.plan) if active_sub.plan else None,
            )

        lic_resp = None
        if latest_license:
            lic_resp = LicenseTokenResponse(
                id=latest_license.id,
                tenant_id=latest_license.tenant_id,
                issued_at=latest_license.issued_at,
                expires_at=latest_license.expires_at,
                payload_snapshot=latest_license.payload_snapshot,
            )

        fiscal_resp = None
        if tenant.fiscal_profile:
            fiscal_resp = FiscalProfileResponse.model_validate(tenant.fiscal_profile)

        comprobantes_resp = []
        if tenant.comprobantes:
            # Sort newest first
            sorted_comps = sorted(tenant.comprobantes, key=lambda c: c.created_at, reverse=True)
            for c in sorted_comps[:20]:
                comprobantes_resp.append(
                    ComprobanteResponse(
                        id=c.id,
                        tenant_id=c.tenant_id,
                        subscription_id=c.subscription_id,
                        tipo_documento=c.tipo_documento,
                        numero_comprobante=c.numero_comprobante,
                        numero_control=c.numero_control,
                        moneda_base=c.moneda_base,
                        monto_usd=float(c.monto_usd),
                        tasa_bcv=float(c.tasa_bcv),
                        base_imponible_ves=float(c.base_imponible_ves),
                        porcentaje_iva=float(c.porcentaje_iva),
                        monto_iva_ves=float(c.monto_iva_ves),
                        aplica_igtf=c.aplica_igtf,
                        monto_igtf_ves=float(c.monto_igtf_ves),
                        total_ves=float(c.total_ves),
                        datos_fiscales_snapshot=c.datos_fiscales_snapshot,
                        estado=c.estado,
                        created_at=c.created_at,
                    )
                )

        countdown_data = TenantService._calculate_countdown(active_sub)

        return TenantDetailResponse(
            id=tenant.id,
            commercial_name=tenant.commercial_name,
            contact_name=tenant.contact_name,
            id_doc_type=tenant.id_doc_type or "V",
            id_doc_number=tenant.id_doc_number,
            tax_id=tenant.tax_id,
            owner_email=tenant.owner_email,
            owner_phone=tenant.owner_phone,
            webhook_url=tenant.webhook_url,
            webhook_secret=tenant.webhook_secret,
            status=tenant.status,
            wallet_balance=float(tenant.wallet_balance or 0.0),
            delivery_channel=tenant.delivery_channel or "email",
            telegram_chat_id=tenant.telegram_chat_id,
            trial_ends_at=tenant.trial_ends_at,
            trial_days_remaining=TenantService._calculate_trial_days_remaining(tenant),
            courtesy_days_granted=tenant.courtesy_days_granted,
            crm_lead_source=tenant.crm_lead_source or "manual",
            crm_notes=tenant.crm_notes,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
            **countdown_data,
            active_subscription=sub_resp,
            latest_license=lic_resp,
            fiscal_profile=fiscal_resp,
            recent_comprobantes=comprobantes_resp,
        )

    @staticmethod
    async def create_tenant(db: AsyncSession, req: TenantCreate) -> TenantDetailResponse:
        # Determine tax_id if not provided
        tax_id = req.tax_id.strip() if req.tax_id else None
        if not tax_id:
            doc_num = req.id_doc_number.strip() if req.id_doc_number else None
            doc_type = (req.id_doc_type or "V").strip().upper()
            if doc_num:
                tax_id = f"{doc_type}-{doc_num}"
            else:
                tax_id = f"CLI-{uuid.uuid4().hex[:8].upper()}"

        # Check unique tax_id; if duplicate, append short hex to prevent collision in MVP
        res_tax = await db.execute(select(Tenant).where(Tenant.tax_id == tax_id))
        if res_tax.scalar_one_or_none():
            tax_id = f"{tax_id}-{uuid.uuid4().hex[:4].upper()}"

        # Resolve plan
        plan = None
        if req.initial_plan_id:
            res_plan = await db.execute(select(Plan).where(Plan.id == req.initial_plan_id))
            plan = res_plan.scalar_one_or_none()

        if not plan:
            res_plan = await db.execute(select(Plan).where(Plan.is_active == True).order_by(Plan.price_usd.asc()))
            plan = res_plan.scalars().first()

        if not plan:
            plan = Plan(
                code="starter_trial",
                name="Plan Prueba 30 Días",
                max_branches=1,
                max_pos_registers=2,
                price_usd=0.00,
                is_active=True,
            )
            db.add(plan)
            await db.flush()

        now = datetime.now(timezone.utc)
        trial_end = now + timedelta(days=req.trial_days)

        tenant = Tenant(
            commercial_name=req.commercial_name,
            contact_name=req.contact_name,
            id_doc_type=req.id_doc_type or "V",
            id_doc_number=req.id_doc_number,
            tax_id=tax_id,
            owner_email=req.owner_email,
            owner_phone=req.owner_phone,
            webhook_url=req.webhook_url,
            webhook_secret=req.webhook_secret or str(uuid.uuid4()),
            status=req.status,
            wallet_balance=req.wallet_balance or 0.00,
            delivery_channel=req.delivery_channel or "email",
            telegram_chat_id=req.telegram_chat_id,
            trial_ends_at=trial_end if req.trial_days > 0 else None,
            courtesy_days_granted=0,
            crm_lead_source="manual",
        )
        db.add(tenant)
        await db.flush()

        # Create dormant fiscal profile (SENIAT inactive by default)
        fiscal_profile = FiscalProfile(
            tenant_id=tenant.id,
            activo_seniat=False,
            tipo_documento_fiscal=f"RIF_{req.id_doc_type}" if req.id_doc_type in ("V", "E", "J", "G") else "RIF_J",
            numero_rif=tax_id,
            razon_social=req.commercial_name,
            es_contribuyente_especial=False,
        )
        db.add(fiscal_profile)

        subscription = Subscription(
            tenant_id=tenant.id,
            plan_id=plan.id,
            billing_cycle=req.billing_cycle,
            status="active" if req.status == "active" else "active",
            current_period_start=now,
            current_period_end=trial_end,
        )
        db.add(subscription)

        # Generate initial license token
        token_str = generate_license_token(
            tenant_id=str(tenant.id),
            plan_code=plan.code,
            max_branches=plan.max_branches,
            max_pos_registers=plan.max_pos_registers,
            enabled_features=plan.features,
            issued_at=now,
            expires_at=trial_end,
        )
        license_record = LicenseToken(
            tenant_id=tenant.id,
            token_signature=compute_token_hash(token_str),
            payload_snapshot={
                "plan_code": plan.code,
                "max_branches": plan.max_branches,
                "max_pos_registers": plan.max_pos_registers,
                "enabled_features": plan.features,
                "license_jwt": token_str,
            },
            issued_at=now,
            expires_at=trial_end,
        )
        db.add(license_record)

        await db.commit()

        # Dispatch initial webhook if webhook_url configured
        if tenant.webhook_url:
            await WebhookDispatcher.dispatch_event(
                db=db,
                tenant_id=tenant.id,
                webhook_url=tenant.webhook_url,
                webhook_secret=tenant.webhook_secret,
                event_type="tenant.created",
                data={
                    "license_token": token_str,
                    "expires_at": trial_end.isoformat(),
                    "limits": {
                        "max_branches": plan.max_branches,
                        "max_pos_registers": plan.max_pos_registers,
                        "features": plan.features,
                    },
                },
            )

        return await TenantService.get_tenant_detail(db, tenant.id)

    @staticmethod
    async def onboard_xion_manager_lead(
        db: AsyncSession,
        req: XionManagerLeadCreate,
    ) -> XionManagerLeadResponse:
        """Endpoint receptor de formularios de Xion-Manager con prueba gratuita de 30 días."""
        # Check if tenant with this email already exists
        res_email = await db.execute(select(Tenant).where(Tenant.owner_email == req.email))
        existing_tenant = res_email.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        trial_end = now + timedelta(days=30)

        # Get default plan (first active plan or basic)
        res_plan = await db.execute(select(Plan).where(Plan.is_active == True).order_by(Plan.price_usd.asc()))
        plan = res_plan.scalars().first()
        if not plan:
            # Fallback plan if DB is empty
            plan = Plan(
                code="starter_trial",
                name="Plan Prueba 30 Días",
                max_branches=1,
                max_pos_registers=2,
                price_usd=0.00,
                is_active=True,
            )
            db.add(plan)
            await db.flush()

        if existing_tenant:
            # Reissue fresh trial token if requested again
            end_t = existing_tenant.trial_ends_at or trial_end
            if end_t.tzinfo is None:
                end_t = end_t.replace(tzinfo=timezone.utc)
            token_str = generate_license_token(
                tenant_id=str(existing_tenant.id),
                plan_code=plan.code,
                max_branches=plan.max_branches,
                max_pos_registers=plan.max_pos_registers,
                enabled_features=plan.features,
                issued_at=now,
                expires_at=end_t,
            )
            days_rem = max(0, (end_t - now).days)
            return XionManagerLeadResponse(
                client_id=existing_tenant.id,
                commercial_name=existing_tenant.commercial_name,
                contact_name=existing_tenant.contact_name,
                email=existing_tenant.owner_email,
                phone=existing_tenant.owner_phone,
                status=existing_tenant.status,
                trial_days_granted=30,
                trial_ends_at=end_t,
                trial_days_remaining=days_rem,
                license_token=token_str,
                message="Cuenta existente reconocida. Licencia de prueba sincronizada exitosamente.",
            )

        # Build clean tax_id
        doc_num = req.documento_identidad_numero.strip() if req.documento_identidad_numero else None
        doc_type = (req.documento_identidad_tipo or "V").strip().upper()
        if doc_num:
            proposed_tax_id = f"{doc_type}-{doc_num}"
        else:
            proposed_tax_id = f"TRIAL-{uuid.uuid4().hex[:8].upper()}"

        # Ensure tax_id uniqueness
        res_check_tax = await db.execute(select(Tenant).where(Tenant.tax_id == proposed_tax_id))
        if res_check_tax.scalar_one_or_none():
            proposed_tax_id = f"{proposed_tax_id}-{uuid.uuid4().hex[:4].upper()}"

        tenant = Tenant(
            commercial_name=req.nombre_comercial,
            contact_name=req.nombre_contacto,
            id_doc_type=doc_type,
            id_doc_number=doc_num,
            tax_id=proposed_tax_id,
            owner_email=req.email,
            owner_phone=req.telefono_contacto,
            webhook_url=req.webhook_url,
            webhook_secret=str(uuid.uuid4()),
            status="trial",
            trial_ends_at=trial_end,
            courtesy_days_granted=0,
            crm_lead_source=req.source or "xion-manager",
            crm_notes=req.notes or "Ingreso automático vía formulario Xion-Manager con prueba gratuita de 30 días",
        )
        db.add(tenant)
        await db.flush()

        # Initialize dormant FiscalProfile (SENIAT inactive by default)
        fiscal_profile = FiscalProfile(
            tenant_id=tenant.id,
            activo_seniat=False,
            tipo_documento_fiscal=f"RIF_{doc_type}" if doc_type in ("V", "E", "J", "G") else "RIF_J",
            numero_rif=proposed_tax_id,
            razon_social=req.nombre_comercial,
            es_contribuyente_especial=False,
        )
        db.add(fiscal_profile)

        subscription = Subscription(
            tenant_id=tenant.id,
            plan_id=plan.id,
            billing_cycle="monthly",
            status="active",
            current_period_start=now,
            current_period_end=trial_end,
        )
        db.add(subscription)

        # Generate 30-day cryptographic license token
        token_str = generate_license_token(
            tenant_id=str(tenant.id),
            plan_code=plan.code,
            max_branches=plan.max_branches,
            max_pos_registers=plan.max_pos_registers,
            enabled_features=plan.features,
            issued_at=now,
            expires_at=trial_end,
        )
        lic_record = LicenseToken(
            tenant_id=tenant.id,
            token_signature=compute_token_hash(token_str),
            payload_snapshot={
                "plan_code": plan.code,
                "max_branches": plan.max_branches,
                "max_pos_registers": plan.max_pos_registers,
                "enabled_features": plan.features,
                "license_jwt": token_str,
                "trial_days": 30,
                "origin": "xion-manager",
            },
            issued_at=now,
            expires_at=trial_end,
        )
        db.add(lic_record)

        # Issue initial MVP Proforma / Recibo de Cobro
        current_rate = await SettingsService.get_usd_ves_rate(db)
        recibo_num = f"REC-{now.year}-{uuid.uuid4().hex[:6].upper()}"
        recibo = ComprobantePago(
            tenant_id=tenant.id,
            subscription_id=subscription.id,
            tipo_documento="RECIBO_COBRO",
            numero_comprobante=recibo_num,
            numero_control=None,
            moneda_base="USD",
            monto_usd=0.00,
            tasa_bcv=current_rate,
            base_imponible_ves=0.00,
            porcentaje_iva=0.00,
            monto_iva_ves=0.00,
            aplica_igtf=False,
            monto_igtf_ves=0.00,
            total_ves=0.00,
            datos_fiscales_snapshot={"concepto": "Prueba Gratuita 30 Días Xion-Manager"},
            estado="PAGADO",
        )
        db.add(recibo)

        await db.commit()

        return XionManagerLeadResponse(
            client_id=tenant.id,
            commercial_name=tenant.commercial_name,
            contact_name=tenant.contact_name,
            email=tenant.owner_email,
            phone=tenant.owner_phone,
            status=tenant.status,
            trial_days_granted=30,
            trial_ends_at=trial_end,
            trial_days_remaining=30,
            license_token=token_str,
            message="Prueba gratuita de 30 días activada con éxito.",
        )

    @staticmethod
    async def update_fiscal_profile(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        req: FiscalProfileUpdate,
    ) -> FiscalProfileResponse:
        """Actualiza el perfil fiscal del suscriptor, validando datos SENIAT si activo_seniat = True."""
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id).options(selectinload(Tenant.fiscal_profile)))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        if req.activo_seniat:
            if not req.numero_rif or len(req.numero_rif.strip()) < 5:
                raise XionPayBaseException(
                    message="Para activar la facturación fiscal SENIAT, el RIF con formato canónico es estrictamente obligatorio.",
                    error_code="SENIAT_RIF_REQUIRED",
                    status_code=400,
                )
            if not req.razon_social or len(req.razon_social.strip()) < 3:
                raise XionPayBaseException(
                    message="Para activar la facturación fiscal SENIAT, la Razón Social mercantil es estrictamente obligatoria.",
                    error_code="SENIAT_RAZON_SOCIAL_REQUIRED",
                    status_code=400,
                )

        fiscal = tenant.fiscal_profile
        if not fiscal:
            fiscal = FiscalProfile(tenant_id=tenant.id)
            db.add(fiscal)

        fiscal.activo_seniat = req.activo_seniat
        fiscal.tipo_documento_fiscal = req.tipo_documento_fiscal
        fiscal.numero_rif = req.numero_rif.strip() if req.numero_rif else None
        fiscal.razon_social = req.razon_social.strip() if req.razon_social else None
        fiscal.es_contribuyente_especial = req.es_contribuyente_especial
        fiscal.estado = req.estado
        fiscal.municipio = req.municipio
        fiscal.parroquia = req.parroquia
        fiscal.ciudad = req.ciudad
        fiscal.direccion_detallada = req.direccion_detallada
        fiscal.telefono_fiscal = req.telefono_fiscal
        fiscal.email_fiscal = req.email_fiscal
        fiscal.updated_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(fiscal)
        return FiscalProfileResponse.model_validate(fiscal)

    @staticmethod
    async def generate_comprobante(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        req: ComprobanteCreateRequest,
    ) -> ComprobanteResponse:
        """Genera Nota de Cobro / Recibo Interno en MVP, o Factura Fiscal si SENIAT está activo."""
        query = select(Tenant).where(Tenant.id == tenant_id).options(
            selectinload(Tenant.fiscal_profile),
            selectinload(Tenant.subscriptions),
        )
        res = await db.execute(query)
        tenant = res.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        active_sub = next((s for s in tenant.subscriptions if s.status in ("active", "grace_period")), None)

        now = datetime.now(timezone.utc)
        base_imponible_ves = round(req.monto_usd * req.tasa_bcv, 2)
        activo_seniat = bool(tenant.fiscal_profile and tenant.fiscal_profile.activo_seniat)

        if activo_seniat:
            tipo_documento = req.tipo_documento or "FACTURA_FISCAL"
            porcentaje_iva = 16.00
            monto_iva_ves = round(base_imponible_ves * 0.16, 2)
            aplica_igtf = req.aplica_igtf
            monto_igtf_ves = round(base_imponible_ves * 0.03, 2) if aplica_igtf else 0.00
            total_ves = round(base_imponible_ves + monto_iva_ves + monto_igtf_ves, 2)
            numero_control = f"CTRL-{now.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
            numero_comprobante = f"FAC-{now.year}-{uuid.uuid4().hex[:6].upper()}"
            datos_snapshot = {
                "rif": tenant.fiscal_profile.numero_rif,
                "razon_social": tenant.fiscal_profile.razon_social,
                "es_contribuyente_especial": tenant.fiscal_profile.es_contribuyente_especial,
                "direccion_fiscal": tenant.fiscal_profile.direccion_detallada,
                "tasa_bcv": req.tasa_bcv,
            }
        else:
            tipo_documento = req.tipo_documento or "RECIBO_COBRO"
            porcentaje_iva = 0.00
            monto_iva_ves = 0.00
            aplica_igtf = False
            monto_igtf_ves = 0.00
            total_ves = base_imponible_ves
            numero_control = None
            numero_comprobante = f"REC-{now.year}-{uuid.uuid4().hex[:6].upper()}"
            datos_snapshot = {
                "nombre_comercial": tenant.commercial_name,
                "contacto": tenant.contact_name,
                "tasa_bcv": req.tasa_bcv,
                "modo": "MVP Recibo Interno",
            }

        comprobante = ComprobantePago(
            tenant_id=tenant.id,
            subscription_id=active_sub.id if active_sub else None,
            tipo_documento=tipo_documento,
            numero_comprobante=numero_comprobante,
            numero_control=numero_control,
            moneda_base="USD",
            monto_usd=req.monto_usd,
            tasa_bcv=req.tasa_bcv,
            base_imponible_ves=base_imponible_ves,
            porcentaje_iva=porcentaje_iva,
            monto_iva_ves=monto_iva_ves,
            aplica_igtf=aplica_igtf,
            monto_igtf_ves=monto_igtf_ves,
            total_ves=total_ves,
            datos_fiscales_snapshot=datos_snapshot,
            estado="EMITIDO",
        )
        db.add(comprobante)
        await db.commit()
        await db.refresh(comprobante)

        return ComprobanteResponse(
            id=comprobante.id,
            tenant_id=comprobante.tenant_id,
            subscription_id=comprobante.subscription_id,
            tipo_documento=comprobante.tipo_documento,
            numero_comprobante=comprobante.numero_comprobante,
            numero_control=comprobante.numero_control,
            moneda_base=comprobante.moneda_base,
            monto_usd=float(comprobante.monto_usd),
            tasa_bcv=float(comprobante.tasa_bcv),
            base_imponible_ves=float(comprobante.base_imponible_ves),
            porcentaje_iva=float(comprobante.porcentaje_iva),
            monto_iva_ves=float(comprobante.monto_iva_ves),
            aplica_igtf=comprobante.aplica_igtf,
            monto_igtf_ves=float(comprobante.monto_igtf_ves),
            total_ves=float(comprobante.total_ves),
            datos_fiscales_snapshot=comprobante.datos_fiscales_snapshot,
            estado=comprobante.estado,
            created_at=comprobante.created_at,
        )

    @staticmethod
    async def list_comprobantes(
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> List[ComprobanteResponse]:
        query = select(ComprobantePago).where(ComprobantePago.tenant_id == tenant_id).order_by(ComprobantePago.created_at.desc())
        res = await db.execute(query)
        items = res.scalars().all()
        return [
            ComprobanteResponse(
                id=c.id,
                tenant_id=c.tenant_id,
                subscription_id=c.subscription_id,
                tipo_documento=c.tipo_documento,
                numero_comprobante=c.numero_comprobante,
                numero_control=c.numero_control,
                moneda_base=c.moneda_base,
                monto_usd=float(c.monto_usd),
                tasa_bcv=float(c.tasa_bcv),
                base_imponible_ves=float(c.base_imponible_ves),
                porcentaje_iva=float(c.porcentaje_iva),
                monto_iva_ves=float(c.monto_iva_ves),
                aplica_igtf=c.aplica_igtf,
                monto_igtf_ves=float(c.monto_igtf_ves),
                total_ves=float(c.total_ves),
                datos_fiscales_snapshot=c.datos_fiscales_snapshot,
                estado=c.estado,
                created_at=c.created_at,
            )
            for c in items
        ]

    @staticmethod
    async def update_status(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        req: TenantStatusUpdate,
    ) -> TenantDetailResponse:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        previous_status = tenant.status
        tenant.status = req.status
        await db.commit()

        event = "account.suspended" if req.status in ("frozen", "suspended") else "account.activated"
        if tenant.webhook_url:
            await WebhookDispatcher.dispatch_event(
                db=db,
                tenant_id=tenant.id,
                webhook_url=tenant.webhook_url,
                webhook_secret=tenant.webhook_secret,
                event_type=event,
                data={
                    "previous_status": previous_status,
                    "new_status": req.status,
                    "reason": req.reason or "Modificación administrativa",
                },
            )

        return await TenantService.get_tenant_detail(db, tenant_id)

    @staticmethod
    async def update_tenant(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        req: TenantUpdate,
    ) -> TenantDetailResponse:
        """Actualiza datos operacionales, CRM y estado del cliente."""
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        if req.tax_id and req.tax_id.strip() != tenant.tax_id:
            res_tax = await db.execute(select(Tenant).where(Tenant.tax_id == req.tax_id.strip()))
            if res_tax.scalar_one_or_none():
                raise XionPayBaseException(
                    message=f"El identificador fiscal '{req.tax_id}' ya pertenece a otro cliente.",
                    error_code="TAX_ID_DUPLICATE",
                    status_code=400,
                )
            tenant.tax_id = req.tax_id.strip()

        if req.commercial_name is not None:
            tenant.commercial_name = req.commercial_name.strip()
        if req.contact_name is not None:
            tenant.contact_name = req.contact_name.strip() or None
        if req.id_doc_type is not None:
            tenant.id_doc_type = req.id_doc_type.strip().upper()
        if req.id_doc_number is not None:
            tenant.id_doc_number = req.id_doc_number.strip() or None
        if req.owner_email is not None:
            tenant.owner_email = req.owner_email.strip()
        if req.owner_phone is not None:
            tenant.owner_phone = req.owner_phone.strip()
        if req.webhook_url is not None:
            tenant.webhook_url = req.webhook_url.strip() or None
        if req.webhook_secret is not None:
            tenant.webhook_secret = req.webhook_secret.strip() or None
        if req.crm_notes is not None:
            tenant.crm_notes = req.crm_notes.strip() or None
        if req.wallet_balance is not None:
            tenant.wallet_balance = req.wallet_balance
        if req.delivery_channel is not None:
            tenant.delivery_channel = req.delivery_channel.strip().lower()
        if req.telegram_chat_id is not None:
            tenant.telegram_chat_id = req.telegram_chat_id.strip() or None

        status_changed = False
        prev_status = tenant.status
        if req.status is not None and req.status != tenant.status:
            tenant.status = req.status
            status_changed = True

        tenant.updated_at = datetime.now(timezone.utc)
        await db.commit()

        if status_changed and tenant.webhook_url:
            event = "account.suspended" if tenant.status in ("frozen", "suspended") else "account.activated"
            await WebhookDispatcher.dispatch_event(
                db=db,
                tenant_id=tenant.id,
                webhook_url=tenant.webhook_url,
                webhook_secret=tenant.webhook_secret,
                event_type=event,
                data={
                    "previous_status": prev_status,
                    "new_status": tenant.status,
                    "reason": "Actualización de perfil administrativo",
                },
            )

        return await TenantService.get_tenant_detail(db, tenant_id)

    @staticmethod
    async def grant_courtesy_days(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        req: CourtesyDaysRequest,
    ) -> TenantDetailResponse:
        query = (
            select(Tenant)
            .where(Tenant.id == tenant_id)
            .options(
                selectinload(Tenant.subscriptions).selectinload(Subscription.plan)
            )
        )
        result = await db.execute(query)
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        active_sub = next((s for s in tenant.subscriptions if s.status in ("active", "grace_period")), None)
        if not active_sub:
            raise XionPayBaseException(
                message="El comercio no posee una suscripción activa sobre la cual aplicar días de cortesía.",
                error_code="NO_ACTIVE_SUBSCRIPTION",
                status_code=400,
            )

        # Extend period end
        tenant.courtesy_days_granted += req.days
        now = datetime.now(timezone.utc)
        base_date = max(active_sub.current_period_end, now)
        new_expiration = base_date + timedelta(days=req.days)
        active_sub.current_period_end = new_expiration
        active_sub.status = "active"

        # Generate new license token
        plan = active_sub.plan
        token_str = generate_license_token(
            tenant_id=str(tenant.id),
            plan_code=plan.code,
            max_branches=plan.max_branches,
            max_pos_registers=plan.max_pos_registers,
            enabled_features=plan.features,
            issued_at=now,
            expires_at=new_expiration,
        )
        lic_record = LicenseToken(
            tenant_id=tenant.id,
            token_signature=compute_token_hash(token_str),
            payload_snapshot={
                "plan_code": plan.code,
                "max_branches": plan.max_branches,
                "max_pos_registers": plan.max_pos_registers,
                "enabled_features": plan.features,
                "license_jwt": token_str,
                "courtesy_days_added": req.days,
                "reason": req.reason,
            },
            issued_at=now,
            expires_at=new_expiration,
        )
        db.add(lic_record)
        await db.commit()

        # Dispatch webhook
        if tenant.webhook_url:
            await WebhookDispatcher.dispatch_event(
                db=db,
                tenant_id=tenant.id,
                webhook_url=tenant.webhook_url,
                webhook_secret=tenant.webhook_secret,
                event_type="license.renewed",
                data={
                    "license_token": token_str,
                    "expires_at": new_expiration.isoformat(),
                    "courtesy_days_granted": req.days,
                    "limits": {
                        "max_branches": plan.max_branches,
                        "max_pos_registers": plan.max_pos_registers,
                        "features": plan.features,
                    },
                },
            )

        return await TenantService.get_tenant_detail(db, tenant_id)

    @staticmethod
    async def get_tenant_license_status(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
        """Consulta directa del estado de autorización y licencia activa por parte de Xion-Manager."""
        query = select(Tenant).where(Tenant.id == tenant_id).options(
            selectinload(Tenant.subscriptions).selectinload(Subscription.plan),
            selectinload(Tenant.license_tokens),
        )
        res = await db.execute(query)
        tenant = res.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Comercio cliente no encontrado.")

        now = datetime.now(timezone.utc)
        latest_license = sorted(tenant.license_tokens, key=lambda l: l.issued_at, reverse=True)[0] if tenant.license_tokens else None

        active_sub = next((s for s in tenant.subscriptions if s.status == "active"), None)

        license_jwt = None
        if latest_license and isinstance(latest_license.payload_snapshot, dict):
            license_jwt = latest_license.payload_snapshot.get("license_jwt")

        return {
            "tenant_id": str(tenant.id),
            "commercial_name": tenant.commercial_name,
            "status": tenant.status,
            "trial_ends_at": tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
            "subscription": {
                "status": active_sub.status,
                "plan_code": active_sub.plan.code,
                "plan_name": active_sub.plan.name,
                "current_period_end": active_sub.current_period_end.isoformat(),
            } if active_sub else None,
            "license_token": license_jwt,
            "checked_at": now.isoformat(),
        }

    @staticmethod
    async def recharge_balance(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        req: TenantBalanceRecharge,
    ) -> TenantBalanceResponse:
        """Recarga saldo en la billetera del tenant e intenta renovar si la suscripción está vencida."""
        query = (
            select(Tenant)
            .where(Tenant.id == tenant_id)
            .options(selectinload(Tenant.subscriptions).selectinload(Subscription.plan))
        )
        res = await db.execute(query)
        tenant = res.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        current_balance = float(tenant.wallet_balance or 0.0)
        new_balance = round(current_balance + req.amount, 2)
        tenant.wallet_balance = new_balance
        tenant.updated_at = datetime.now(timezone.utc)

        active_sub = next(
            (s for s in tenant.subscriptions if s.status in ("active", "grace_period", "suspended")),
            None,
        )
        plan = active_sub.plan if active_sub else None
        plan_price = float(plan.price_usd) if plan else 0.0
        plan_name = plan.name if plan else ""

        is_due = False
        if active_sub:
            now = datetime.now(timezone.utc)
            sub_end = active_sub.current_period_end
            if sub_end.tzinfo is None:
                sub_end = sub_end.replace(tzinfo=timezone.utc)
            is_due = sub_end <= now or active_sub.status in ("grace_period", "suspended")

        await db.commit()

        renewed = False
        new_period_end = None
        message = f"Saldo recargado exitosamente (+${req.amount:.2f} USD). Saldo actual: ${new_balance:.2f} USD."

        if req.auto_renew and is_due and plan and new_balance >= plan_price:
            detail = await TenantService.renew_from_balance(db, tenant_id)
            new_balance = detail.wallet_balance
            renewed = True
            if detail.active_subscription:
                new_period_end = detail.active_subscription.current_period_end
            message = f"Saldo acreditado y suscripción '{plan_name}' renovada automáticamente por ${plan_price:.2f} USD. Saldo restante: ${new_balance:.2f} USD."

        return TenantBalanceResponse(
            tenant_id=tenant_id,
            previous_balance=current_balance,
            credited_amount=req.amount,
            current_balance=new_balance,
            auto_renewed=renewed,
            new_period_end=new_period_end,
            message=message,
        )

    @staticmethod
    async def renew_from_balance(
        db: AsyncSession,
        tenant_id: uuid.UUID,
    ) -> TenantDetailResponse:
        """
        Renueva la suscripción debitando el costo del plan directamente del saldo del tenant.
        Emite token criptográfico y despacha nota de entrega multicanal.
        """
        query = (
            select(Tenant)
            .where(Tenant.id == tenant_id)
            .options(
                selectinload(Tenant.subscriptions).selectinload(Subscription.plan),
                selectinload(Tenant.license_tokens),
                selectinload(Tenant.fiscal_profile),
            )
        )
        res = await db.execute(query)
        tenant = res.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(tenant_id))

        active_sub = next(
            (s for s in tenant.subscriptions if s.status in ("active", "grace_period", "suspended")),
            None,
        )
        if not active_sub or not active_sub.plan:
            raise XionPayBaseException(
                message="El cliente no cuenta con una suscripción asociada para renovar.",
                error_code="NO_ASSOCIATED_SUBSCRIPTION",
                status_code=400,
            )

        plan = active_sub.plan
        plan_price = float(plan.price_usd)
        current_balance = float(tenant.wallet_balance or 0.0)

        if current_balance < plan_price:
            raise XionPayBaseException(
                message=f"Saldo insuficiente en billetera (${current_balance:.2f} USD). Se requieren ${plan_price:.2f} USD para el plan '{plan.name}'.",
                error_code="INSUFFICIENT_WALLET_BALANCE",
                status_code=400,
            )

        # Debit balance
        new_balance = round(current_balance - plan_price, 2)
        tenant.wallet_balance = new_balance

        now = datetime.now(timezone.utc)
        sub_end = active_sub.current_period_end
        if sub_end.tzinfo is None:
            sub_end = sub_end.replace(tzinfo=timezone.utc)

        base_date = max(sub_end, now)
        period_days = 365 if active_sub.billing_cycle == "annual" else 30
        new_expiration = base_date + timedelta(days=period_days)

        active_sub.current_period_start = now
        active_sub.current_period_end = new_expiration
        active_sub.status = "active"
        active_sub.tolerance_expires_at = None
        tenant.status = "active"

        # Generate cryptographic RS256 token
        token_str = generate_license_token(
            tenant_id=str(tenant.id),
            plan_code=plan.code,
            max_branches=plan.max_branches,
            max_pos_registers=plan.max_pos_registers,
            enabled_features=plan.features,
            issued_at=now,
            expires_at=new_expiration,
        )
        lic_record = LicenseToken(
            tenant_id=tenant.id,
            token_signature=compute_token_hash(token_str),
            payload_snapshot={
                "plan_code": plan.code,
                "max_branches": plan.max_branches,
                "max_pos_registers": plan.max_pos_registers,
                "enabled_features": plan.features,
                "license_jwt": token_str,
                "renewed_via": "wallet_balance",
                "amount_debited": plan_price,
            },
            issued_at=now,
            expires_at=new_expiration,
        )
        db.add(lic_record)

        # Issue Comprobante / Recibo de Pago
        current_rate = await SettingsService.get_usd_ves_rate(db)
        recibo_num = f"REC-{now.year}-{uuid.uuid4().hex[:6].upper()}"
        recibo = ComprobantePago(
            tenant_id=tenant.id,
            subscription_id=active_sub.id,
            tipo_documento="RECIBO_COBRO",
            numero_comprobante=recibo_num,
            numero_control=None,
            moneda_base="USD",
            monto_usd=plan_price,
            tasa_bcv=current_rate,
            base_imponible_ves=round(plan_price * current_rate, 2),
            porcentaje_iva=0.00,
            monto_iva_ves=0.00,
            aplica_igtf=False,
            monto_igtf_ves=0.00,
            total_ves=round(plan_price * current_rate, 2),
            datos_fiscales_snapshot={
                "concepto": f"Renovación Plan {plan.name} vía Débito de Saldo",
                "saldo_restante": new_balance,
            },
            estado="PAGADO",
        )
        db.add(recibo)
        await db.commit()

        # Multichannel Delivery Note Dispatch
        await DeliveryNoteService.dispatch_renewal_delivery_note(
            tenant_name=tenant.commercial_name,
            owner_email=tenant.owner_email,
            owner_phone=tenant.owner_phone,
            delivery_channel=tenant.delivery_channel or "email",
            telegram_chat_id=tenant.telegram_chat_id,
            plan_name=plan.name,
            amount_paid=plan_price,
            new_period_end=new_expiration,
            deducted_from_balance=True,
        )

        # Webhook Notification
        if tenant.webhook_url:
            await WebhookDispatcher.dispatch_event(
                db=db,
                tenant_id=tenant.id,
                webhook_url=tenant.webhook_url,
                webhook_secret=tenant.webhook_secret,
                event_type="subscription.renewed",
                data={
                    "license_token": token_str,
                    "expires_at": new_expiration.isoformat(),
                    "plan_code": plan.code,
                    "plan_name": plan.name,
                    "wallet_balance": new_balance,
                    "limits": {
                        "max_branches": plan.max_branches,
                        "max_pos_registers": plan.max_pos_registers,
                        "features": plan.features,
                    },
                },
            )

        return await TenantService.get_tenant_detail(db, tenant.id)

    @staticmethod
    async def process_due_subscriptions(db: AsyncSession) -> dict:
        """
        Ciclo de facturación automático:
        - Si el plan vence y hay saldo suficiente: se renueva automáticamente.
        - Si el plan vence sin saldo y no está en prórroga: pasa a suspensión.
        - Si el plan vence pero cuenta con prórroga activa: se mantiene en prórroga.
        """
        now = datetime.now(timezone.utc)
        query = (
            select(Subscription)
            .where(Subscription.status.in_(["active", "grace_period"]))
            .options(
                selectinload(Subscription.tenant),
                selectinload(Subscription.plan),
            )
        )
        res = await db.execute(query)
        subscriptions = res.scalars().all()

        renewed_count = 0
        suspended_count = 0
        grace_period_count = 0

        for sub in subscriptions:
            period_end = sub.current_period_end
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)

            if period_end > now:
                continue

            tenant = sub.tenant
            plan = sub.plan
            if not tenant or not plan:
                continue

            wallet_balance = float(tenant.wallet_balance or 0.0)
            plan_price = float(plan.price_usd)

            if wallet_balance >= plan_price:
                # Automatic renewal from balance
                try:
                    await TenantService.renew_from_balance(db, tenant.id)
                    renewed_count += 1
                except Exception:
                    logger.exception(f"Error auto-renewing tenant {tenant.id} from balance")
            else:
                # Check if in contingency grace period / prórroga
                in_grace = False
                if sub.tolerance_expires_at:
                    tol_exp = sub.tolerance_expires_at
                    if tol_exp.tzinfo is None:
                        tol_exp = tol_exp.replace(tzinfo=timezone.utc)
                    if tol_exp > now:
                        in_grace = True

                if in_grace:
                    sub.status = "grace_period"
                    grace_period_count += 1
                else:
                    sub.status = "suspended"
                    tenant.status = "suspended"
                    suspended_count += 1
                    if tenant.webhook_url:
                        await WebhookDispatcher.dispatch_event(
                            db=db,
                            tenant_id=tenant.id,
                            webhook_url=tenant.webhook_url,
                            webhook_secret=tenant.webhook_secret,
                            event_type="account.suspended",
                            data={
                                "reason": "Vencimiento de suscripción por saldo insuficiente",
                                "plan_code": plan.code,
                                "wallet_balance": wallet_balance,
                            },
                        )

        await db.commit()
        return {
            "processed_at": now.isoformat(),
            "renewed_count": renewed_count,
            "suspended_count": suspended_count,
            "grace_period_count": grace_period_count,
        }

