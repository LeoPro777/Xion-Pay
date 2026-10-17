import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from src.core.database import Base
from src.modules.auth.models import GUID


class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    attempt_count = Column(Integer, default=1, nullable=False)
    dispatched_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    tenant = relationship("src.modules.tenants.models.Tenant", back_populates="webhook_logs")

    def __repr__(self) -> str:
        return f"<WebhookLog {self.event_type} tenant={self.tenant_id} status={self.response_code}>"
