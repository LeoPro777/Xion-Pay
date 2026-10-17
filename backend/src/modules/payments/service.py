import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.crypto_licensing import generate_license_token, compute_token_hash
from src.modules.payments.models import PaymentReport
from src.modules.tenants.models import Tenant, Subscription, LicenseToken
from src.modules.plans.models import Plan
from src.modules.auth.models import AdminUser
from src.modules.payments.schemas import (
    PaymentReportCreate,
    PaymentReportResult,
    PaymentReportResponse,
    PaymentRejectRequest,
    PaymentApproveResult,
)
from src.modules.webhooks.dispatcher import WebhookDispatcher
from src.modules.notifications.manager import notification_manager
from src.utils.exceptions import (
    DuplicatePaymentException,
    ResourceNotFoundError,
    XionPayBaseException,
)
from src.utils.pdf_generator import generate_subscription_invoice_pdf


class PaymentService:
    @staticmethod
    async def report_payment(db: AsyncSession, req: PaymentReportCreate) -> PaymentReportResult:
        """
        Receives payment report from Xion-Manager instance.
        Validates antifraud uniqueness on (origin_bank, reference_number, amount).
        Applies 24h contingency tolerance if due today.
        Alerts administrators in real time.
        """
        # 1. Antifraud Pre-check
        existing_res = await db.execute(
            select(PaymentReport).where(
                and_(
                    PaymentReport.origin_bank == req.origin_bank,
                    PaymentReport.reference_number == req.reference_number,
                    PaymentReport.amount == req.amount,
                )
            )
        )
        if existing_res.scalar_one_or_none():
            raise DuplicatePaymentException(
                origin_bank=req.origin_bank,
                reference_number=req.reference_number,
                amount=req.amount,
            )

        # 2. Retrieve Tenant and active subscription
        tenant_res = await db.execute(
            select(Tenant)
            .where(Tenant.id == req.tenant_id)
            .options(selectinload(Tenant.subscriptions).selectinload(Subscription.plan))
        )
        tenant = tenant_res.scalar_one_or_none()
        if not tenant:
            raise ResourceNotFoundError("Tenant", str(req.tenant_id))

        if tenant.status in ("frozen", "suspended"):
            raise XionPayBaseException(
                message="El comercio está suspendido o congelado. No es posible reportar pagos.",
                error_code="TENANT_INACTIVE",
                status_code=403,
            )

        # Find active or most recent subscription
        sub = next((s for s in tenant.subscriptions if s.status in ("active", "grace_period", "expired")), None)
        if not sub and tenant.subscriptions:
            sub = tenant.subscriptions[0]
        elif not sub:
            raise XionPayBaseException(
                message="No se encontró contrato de suscripción para asociar el pago.",
                error_code="SUBSCRIPTION_NOT_FOUND",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        tolerance_granted = False
        tolerance_expires_at = None

        # Check if due today or past due for 24h operational tolerance
        hours_diff = (sub.current_period_end - now).total_seconds() / 3600.0
        if hours_diff <= 24:
            tolerance_granted = True
            tolerance_expires_at = now + timedelta(hours=24)
            sub.tolerance_expires_at = tolerance_expires_at
            sub.status = "grace_period"

        # Create Payment record
        payment = PaymentReport(
            tenant_id=tenant.id,
            subscription_id=sub.id,
            origin_bank=req.origin_bank,
            reference_number=req.reference_number,
            amount=req.amount,
            currency=req.currency,
            proof_attachment_url=req.proof_attachment_url,
            status="pending",
            metadata_info=req.metadata or {},
            reported_at=now,
        )
        db.add(payment)

        try:
            await db.commit()
            await db.refresh(payment)
        except IntegrityError:
            await db.rollback()
            raise DuplicatePaymentException(
                origin_bank=req.origin_bank,
                reference_number=req.reference_number,
                amount=req.amount,
            )

        # Notify administrators via WebSocket
        await notification_manager.broadcast({
            "type": "NEW_PAYMENT_REPORTED",
            "payment": {
                "id": str(payment.id),
                "tenant_name": tenant.commercial_name,
                "tax_id": tenant.tax_id,
                "amount": float(payment.amount),
                "currency": payment.currency,
                "origin_bank": payment.origin_bank,
                "reference_number": payment.reference_number,
                "reported_at": payment.reported_at.isoformat(),
            },
        })

        return PaymentReportResult(
            status="success",
            message="Pago reportado exitosamente. En revisión por administración.",
            payment_id=payment.id,
            tolerance_granted=tolerance_granted,
            tolerance_expires_at=tolerance_expires_at,
        )

    @staticmethod
    async def list_inbox(
        db: AsyncSession,
        status_filter: Optional[str] = "pending",
        bank: Optional[str] = None,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> List[PaymentReportResponse]:
        query = (
            select(PaymentReport)
            .options(
                selectinload(PaymentReport.tenant),
                selectinload(PaymentReport.subscription).selectinload(Subscription.plan),
            )
            .order_by(PaymentReport.reported_at.desc())
        )

        if status_filter:
            query = query.where(PaymentReport.status == status_filter)
        if bank:
            query = query.where(PaymentReport.origin_bank == bank)
        if tenant_id:
            query = query.where(PaymentReport.tenant_id == tenant_id)

        result = await db.execute(query)
        payments = result.scalars().all()

        responses = []
        for p in payments:
            responses.append(
                PaymentReportResponse(
                    id=p.id,
                    tenant_id=p.tenant_id,
                    subscription_id=p.subscription_id,
                    origin_bank=p.origin_bank,
                    reference_number=p.reference_number,
                    amount=float(p.amount),
                    currency=p.currency,
                    proof_attachment_url=p.proof_attachment_url,
                    status=p.status,
                    rejection_reason=p.rejection_reason,
                    reviewed_by=p.reviewed_by,
                    reviewed_at=p.reviewed_at,
                    reported_at=p.reported_at,
                    metadata_info=p.metadata_info,
                    tenant_commercial_name=p.tenant.commercial_name if p.tenant else None,
                    tenant_tax_id=p.tenant.tax_id if p.tenant else None,
                    plan_name=p.subscription.plan.name if (p.subscription and p.subscription.plan) else None,
                )
            )
        return responses

    @staticmethod
    async def approve_payment(
        db: AsyncSession,
        payment_id: uuid.UUID,
        admin_user: AdminUser,
    ) -> PaymentApproveResult:
        """
        1-Click payment approval:
        Executes atomically: updates status, calculates new subscription period,
        issues RS256 cryptographic license token, and dispatches webhook.
        """
        query = (
            select(PaymentReport)
            .where(PaymentReport.id == payment_id)
            .options(
                selectinload(PaymentReport.tenant),
                selectinload(PaymentReport.subscription).selectinload(Subscription.plan),
            )
        )
        result = await db.execute(query)
        payment = result.scalar_one_or_none()

        if not payment:
            raise ResourceNotFoundError("PaymentReport", str(payment_id))

        if payment.status != "pending":
            raise XionPayBaseException(
                message=f"La transacción ya se encuentra en estado '{payment.status}' y es inmutable.",
                error_code="TRANSACTION_ALREADY_SETTLED",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        sub = payment.subscription
        plan = sub.plan
        tenant = payment.tenant

        # Calculate period duration according to billing cycle
        cycle = sub.billing_cycle.lower()
        if cycle == "annual":
            period_delta = timedelta(days=365)
        elif cycle == "quarterly":
            period_delta = timedelta(days=90)
        else:
            period_delta = timedelta(days=30)

        base_date = max(sub.current_period_end, now)
        new_period_end = base_date + period_delta

        # Atomic updates
        payment.status = "approved"
        payment.reviewed_by = admin_user.id
        payment.reviewed_at = now

        sub.status = "active"
        sub.current_period_end = new_period_end
        sub.tolerance_expires_at = None

        if tenant.status in ("trial", "frozen"):
            tenant.status = "active"

        # Generate RS256 License Token
        token_str = generate_license_token(
            tenant_id=str(tenant.id),
            plan_code=plan.code,
            max_branches=plan.max_branches,
            max_pos_registers=plan.max_pos_registers,
            enabled_features=plan.features,
            issued_at=now,
            expires_at=new_period_end,
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
                "approved_payment_id": str(payment.id),
            },
            issued_at=now,
            expires_at=new_period_end,
        )
        db.add(license_record)

        await db.commit()

        # Dispatch outgoing webhook with HMAC SHA-256
        if tenant.webhook_url:
            await WebhookDispatcher.dispatch_event(
                db=db,
                tenant_id=tenant.id,
                webhook_url=tenant.webhook_url,
                webhook_secret=tenant.webhook_secret,
                event_type="payment.approved",
                data={
                    "license_token": token_str,
                    "expires_at": new_period_end.isoformat(),
                    "limits": {
                        "max_branches": plan.max_branches,
                        "max_pos_registers": plan.max_pos_registers,
                        "modules": [k for k, v in plan.features.items() if v is True],
                    },
                },
            )

        # Notify via WebSocket
        await notification_manager.broadcast({
            "type": "PAYMENT_APPROVED",
            "payment_id": str(payment.id),
            "tenant_id": str(tenant.id),
        })

        return PaymentApproveResult(
            status="success",
            message="Pago aprobado. Licencia emitida y webhook despachado.",
            subscription={
                "status": "active",
                "new_period_end": new_period_end.isoformat(),
            },
            license_token=token_str,
        )

    @staticmethod
    async def reject_payment(
        db: AsyncSession,
        payment_id: uuid.UUID,
        req: PaymentRejectRequest,
        admin_user: AdminUser,
    ) -> Dict[str, str]:
        """Reject payment with immutable reason recorded."""
        query = (
            select(PaymentReport)
            .where(PaymentReport.id == payment_id)
            .options(selectinload(PaymentReport.tenant))
        )
        result = await db.execute(query)
        payment = result.scalar_one_or_none()

        if not payment:
            raise ResourceNotFoundError("PaymentReport", str(payment_id))

        if payment.status != "pending":
            raise XionPayBaseException(
                message=f"La transacción ya se encuentra en estado '{payment.status}' y es inmutable.",
                error_code="TRANSACTION_ALREADY_SETTLED",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        payment.status = "rejected"
        payment.rejection_reason = req.rejection_reason
        payment.reviewed_by = admin_user.id
        payment.reviewed_at = now

        await db.commit()

        tenant = payment.tenant
        if tenant and tenant.webhook_url:
            await WebhookDispatcher.dispatch_event(
                db=db,
                tenant_id=tenant.id,
                webhook_url=tenant.webhook_url,
                webhook_secret=tenant.webhook_secret,
                event_type="payment.rejected",
                data={
                    "payment_id": str(payment.id),
                    "reference_number": payment.reference_number,
                    "reason": req.rejection_reason,
                },
            )

        await notification_manager.broadcast({
            "type": "PAYMENT_REJECTED",
            "payment_id": str(payment.id),
            "tenant_id": str(payment.tenant_id),
            "reason": req.rejection_reason,
        })

        return {
            "status": "success",
            "message": "Pago rechazado exitosamente. Notificación transmitida a la instancia cliente.",
        }

    @staticmethod
    async def get_invoice_pdf(db: AsyncSession, payment_id: uuid.UUID) -> bytes:
        """Fetch payment details and compile official invoice PDF."""
        query = (
            select(PaymentReport)
            .where(PaymentReport.id == payment_id)
            .options(
                selectinload(PaymentReport.tenant),
                selectinload(PaymentReport.subscription).selectinload(Subscription.plan),
            )
        )
        result = await db.execute(query)
        payment = result.scalar_one_or_none()

        if not payment:
            raise ResourceNotFoundError("PaymentReport", str(payment_id))

        payment_data = {
            "id": payment.id,
            "origin_bank": payment.origin_bank,
            "reference_number": payment.reference_number,
            "amount": payment.amount,
            "currency": payment.currency,
            "reported_at": payment.reported_at,
            "status": payment.status,
            "tenant_name": payment.tenant.commercial_name if payment.tenant else "Desconocido",
            "tax_id": payment.tenant.tax_id if payment.tenant else "N/A",
            "plan_name": payment.subscription.plan.name if payment.subscription and payment.subscription.plan else "Suscripción Xion",
            "token_signature_hash": str(payment.id),
        }

        return generate_subscription_invoice_pdf(payment_data)
