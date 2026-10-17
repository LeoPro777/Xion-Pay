import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Numeric, Boolean, DateTime, JSON
from src.core.database import Base
from src.modules.auth.models import GUID


class Plan(Base):
    __tablename__ = "plans"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)  # 'basic', 'advanced', 'enterprise'
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    max_branches = Column(Integer, nullable=False, default=1)
    max_pos_registers = Column(Integer, nullable=False, default=1)
    features = Column(JSON, nullable=False, default=lambda: {
        "inventory_transfers": False,
        "advanced_audit": False,
        "external_api": False,
    })
    price_usd = Column(Numeric(10, 2), nullable=False)
    quarterly_discount_pct = Column(Numeric(5, 2), nullable=False, default=0.00)
    annual_discount_pct = Column(Numeric(5, 2), nullable=False, default=0.00)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self) -> str:
        return f"<Plan {self.code} - ${self.price_usd}>"
