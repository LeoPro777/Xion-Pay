import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from src.modules.webhooks.models import WebhookLog

logger = logging.getLogger("xionpay.webhooks")


def sign_payload(secret: str, payload_bytes: bytes) -> str:
    """Compute HMAC SHA-256 signature for outgoing webhook payload."""
    mac = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


class WebhookDispatcher:
    """
    Handles secure dispatching of webhooks with HMAC signature and exponential backoff retry logic.
    """

    RETRY_DELAYS = [0, 30, 300, 1800]  # Delays in seconds for attempts 1, 2, 3, 4

    @staticmethod
    async def dispatch_event(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        webhook_url: Optional[str],
        webhook_secret: Optional[str],
        event_type: str,
        data: Dict[str, Any],
    ) -> Optional[WebhookLog]:
        if not webhook_url or not webhook_secret:
            logger.warning(f"Tenant {tenant_id} has no webhook URL or secret configured. Skipping dispatch.")
            return None

        payload_dict = {
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tenant_id": str(tenant_id),
            "data": data,
        }

        payload_json = json.dumps(payload_dict)
        signature = sign_payload(webhook_secret, payload_json.encode("utf-8"))

        headers = {
            "Content-Type": "application/json",
            "X-Xion-Signature": signature,
            "User-Agent": "Xion-Pay-Webhook-Dispatcher/1.0",
        }

        # Initial attempt
        attempt = 1
        response_code: Optional[int] = None
        response_body: Optional[str] = None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(webhook_url, content=payload_json, headers=headers)
                response_code = res.status_code
                response_body = res.text[:1000]  # truncate long responses
        except Exception as ex:
            response_code = 500
            response_body = f"Connection error: {str(ex)}"
            logger.error(f"Webhook dispatch failed on attempt {attempt}: {str(ex)}")

        log_entry = WebhookLog(
            tenant_id=tenant_id,
            event_type=event_type,
            payload=payload_dict,
            response_code=response_code,
            response_body=response_body,
            attempt_count=attempt,
            dispatched_at=datetime.now(timezone.utc),
        )

        db.add(log_entry)
        await db.commit()
        await db.refresh(log_entry)

        # If failed and not 2xx, launch background retry task
        if response_code is None or response_code < 200 or response_code >= 300:
            asyncio.create_task(
                WebhookDispatcher._retry_delivery(
                    log_id=log_entry.id,
                    webhook_url=webhook_url,
                    payload_json=payload_json,
                    headers=headers,
                )
            )

        return log_entry

    @staticmethod
    async def _retry_delivery(
        log_id: uuid.UUID,
        webhook_url: str,
        payload_json: str,
        headers: Dict[str, str],
    ) -> None:
        """Background exponential backoff retrier."""
        from src.core.database import AsyncSessionLocal
        from sqlalchemy import select

        delays = WebhookDispatcher.RETRY_DELAYS[1:]  # remaining retries: 30s, 300s, 1800s
        for idx, delay in enumerate(delays, start=2):
            await asyncio.sleep(delay)
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(webhook_url, content=payload_json, headers=headers)
                    code = res.status_code
                    body = res.text[:1000]
            except Exception as e:
                code = 500
                body = f"Connection error: {str(e)}"

            async with AsyncSessionLocal() as session:
                result = await session.execute(select(WebhookLog).where(WebhookLog.id == log_id))
                entry = result.scalar_one_or_none()
                if entry:
                    entry.attempt_count = idx
                    entry.response_code = code
                    entry.response_body = body
                    entry.dispatched_at = datetime.now(timezone.utc)
                    await session.commit()

            if code and 200 <= code < 300:
                logger.info(f"Webhook {log_id} delivered successfully on attempt {idx}.")
                break
