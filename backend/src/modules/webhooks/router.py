import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import get_current_admin
from src.modules.auth.models import AdminUser
from src.modules.webhooks.models import WebhookLog
from src.modules.webhooks.schemas import WebhookLogResponse

router = APIRouter(prefix="/webhooks", tags=["Auditoría de Webhooks"])


@router.get("/logs/{tenant_id}", response_model=List[WebhookLogResponse])
async def get_tenant_webhook_logs(
    tenant_id: uuid.UUID,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Fetch recent outgoing webhook dispatch audit logs for a tenant."""
    query = (
        select(WebhookLog)
        .where(WebhookLog.tenant_id == tenant_id)
        .order_by(WebhookLog.dispatched_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    logs = result.scalars().all()
    return [WebhookLogResponse.model_validate(l) for l in logs]


@router.get("/recent", response_model=List[WebhookLogResponse])
async def get_recent_webhook_logs(
    limit: int = 15,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Fetch global recent outgoing webhook dispatch audit logs across all tenants."""
    query = (
        select(WebhookLog)
        .order_by(WebhookLog.dispatched_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    logs = result.scalars().all()
    return [WebhookLogResponse.model_validate(l) for l in logs]


@router.post("/test/{tenant_id}", response_model=WebhookLogResponse)
async def send_test_webhook(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Dispatch a test webhook event ('system.ping') to verify endpoint connectivity."""
    from src.modules.tenants.models import Tenant
    from src.modules.webhooks.dispatcher import WebhookDispatcher
    from src.utils.exceptions import ResourceNotFoundError, XionPayBaseException

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise ResourceNotFoundError("Tenant", str(tenant_id))

    if not tenant.webhook_url or not tenant.webhook_secret:
        raise XionPayBaseException("El comercio no tiene configurada URL o Secret de webhook.", status_code=400)

    log = await WebhookDispatcher.dispatch_event(
        db=db,
        tenant_id=tenant.id,
        webhook_url=tenant.webhook_url,
        webhook_secret=tenant.webhook_secret,
        event_type="system.ping",
        data={"message": "Prueba de conectividad Webhook desde Xion-Pay SaaS", "status": "ok"},
    )

    if not log:
        raise XionPayBaseException("No se pudo despachar el webhook de prueba.", status_code=400)

    return WebhookLogResponse.model_validate(log)

