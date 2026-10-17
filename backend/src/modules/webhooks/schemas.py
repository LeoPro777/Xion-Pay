import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class WebhookPayload(BaseModel):
    event: str
    timestamp: str
    tenant_id: str
    data: Dict[str, Any]


class WebhookLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    event_type: str
    payload: Dict[str, Any]
    response_code: Optional[int] = None
    response_body: Optional[str] = None
    attempt_count: int
    dispatched_at: datetime

