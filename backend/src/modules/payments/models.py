import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, JSON, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from src.core.database import Base
from src.modules.auth.models import GUID


class PaymentReport(Base):
    __tablename__ = "payment_reports"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    subscription_id = Column(GUID(), ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=False, index=True)
    origin_bank = Column(String(100), nullable=False)  # Ej: 'Banesco', 'Mercantil', 'Pago Movil', 'Zelle'
    destination_bank = Column(String(150), nullable=True)  # Cuenta/banco receptor (ej: 'Banesco Xion-Pay 0134...')
    payment_method_type = Column(String(50), nullable=True, default="pago_movil")  # 'pago_movil', 'transferencia', 'zelle', 'efectivo'
    reference_number = Column(String(100), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="USD")  # 'USD' o 'VES'
    exchange_rate = Column(Numeric(12, 4), nullable=False, default=1.0)  # Tasa oficial/BCV al momento del reporte
    amount_usd = Column(Numeric(14, 2), nullable=False, default=0.0)  # Monto equivalente en USD ($)
    amount_ves = Column(Numeric(14, 2), nullable=False, default=0.0)  # Monto equivalente en VES (Bs)
    proof_attachment_url = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # 'pending', 'approved', 'rejected'
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(GUID(), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reported_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    metadata_info = Column("metadata", JSON, nullable=True, default=dict)

    # Relationships
    tenant = relationship("src.modules.tenants.models.Tenant", back_populates="payment_reports")
    subscription = relationship("src.modules.tenants.models.Subscription", back_populates="payment_reports")
    reviewer = relationship("src.modules.auth.models.AdminUser")

    # CRITICAL INVIOLABLE ANTIFRAUD CONSTRAINT
    __table_args__ = (
        UniqueConstraint("origin_bank", "reference_number", "amount", name="idx_unique_payment_ref"),
    )

    def __repr__(self) -> str:
        return f"<PaymentReport {self.origin_bank} #{self.reference_number} ${self.amount} ({self.status})>"
