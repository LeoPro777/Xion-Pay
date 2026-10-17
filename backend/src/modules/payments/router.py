import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import get_current_admin, require_role
from src.modules.auth.models import AdminUser
from src.modules.payments.schemas import (
    PaymentReportCreate,
    PaymentReportResult,
    PaymentReportResponse,
    PaymentRejectRequest,
    PaymentApproveResult,
)
from src.modules.payments.service import PaymentService

router = APIRouter(prefix="/payments", tags=["Conciliación y Pagos"])


@router.post("/report", response_model=PaymentReportResult, status_code=status.HTTP_201_CREATED)
async def report_payment(
    payload: PaymentReportCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Report a payment transaction (invoked by Xion-Manager client instances).
    Enforces strict antifraud uniqueness and 24h contingency grace period.
    """
    return await PaymentService.report_payment(db, payload)


@router.get("/inbox", response_model=List[PaymentReportResponse])
async def list_inbox_payments(
    status: Optional[str] = Query("pending", description="pending, approved, rejected"),
    bank: Optional[str] = Query(None, description="Filtro por banco de origen"),
    tenant_id: Optional[uuid.UUID] = Query(None, description="Filtro por comercio"),
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """
    Reconciliation Inbox endpoint for administrators.
    Provides split-view data with attached proofs and fiscal details.
    """
    return await PaymentService.list_inbox(db, status_filter=status, bank=bank, tenant_id=tenant_id)


@router.post("/{payment_id}/approve", response_model=PaymentApproveResult)
async def approve_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """
    1-Click Payment Approval:
    Atomically reconciles payment, issues RS256 license token, and dispatches webhook.
    """
    return await PaymentService.approve_payment(db, payment_id, admin)


@router.post("/{payment_id}/reject")
async def reject_payment(
    payment_id: uuid.UUID,
    payload: PaymentRejectRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """
    1-Click Payment Rejection:
    Requires structured or free-text reason and notifies client instance.
    """
    return await PaymentService.reject_payment(db, payment_id, payload, admin)


@router.get("/{payment_id}/invoice-pdf")
async def download_invoice_pdf(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """
    Stream official PDF subscription invoice for approved payment.
    """
    pdf_bytes = await PaymentService.get_invoice_pdf(db, payment_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice-{payment_id}.pdf"},
    )
