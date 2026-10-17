import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class PaymentReportCreate(BaseModel):
    tenant_id: uuid.UUID
    origin_bank: str = Field(..., max_length=100, description="Ej: Banesco, Mercantil, Pago Móvil, Zelle")
    destination_bank: Optional[str] = Field("Banesco Xion-Pay (0134-****-1234)", max_length=150, description="Cuenta receptora o banco de destino")
    payment_method_type: Optional[str] = Field("pago_movil", max_length=50, description="'pago_movil', 'transferencia', 'zelle', 'efectivo'")
    reference_number: str = Field(..., max_length=100)
    amount: float = Field(..., gt=0.0)
    currency: str = Field(default="USD", max_length=10)
    exchange_rate: Optional[float] = Field(None, gt=0.0, description="Tasa de cambio personalizada (opcional, si se omite usa la del sistema)")
    proof_attachment_url: str = Field(..., description="URL o Data URI del comprobante de pago")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class PaymentReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    subscription_id: uuid.UUID
    origin_bank: str
    destination_bank: Optional[str] = None
    payment_method_type: Optional[str] = "pago_movil"
    reference_number: str
    amount: float
    currency: str
    exchange_rate: float = 1.0
    amount_usd: float = 0.0
    amount_ves: float = 0.0
    proof_attachment_url: str
    status: str
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    reported_at: datetime
    metadata_info: Optional[Dict[str, Any]] = None

    # Extra populated fields for UI inbox split view
    tenant_commercial_name: Optional[str] = None
    tenant_tax_id: Optional[str] = None
    tenant_phone: Optional[str] = None
    tenant_email: Optional[str] = None
    tenant_contact_name: Optional[str] = None
    plan_name: Optional[str] = None
    plan_price: Optional[float] = None
    tenant_wallet_balance: Optional[float] = None


class PaymentReportResult(BaseModel):
    status: str = "success"
    message: str
    payment_id: uuid.UUID
    tolerance_granted: bool = False
    tolerance_expires_at: Optional[datetime] = None


class PaymentRejectRequest(BaseModel):
    rejection_reason: str = Field(
        ...,
        min_length=3,
        description="Motivo del rechazo (ej: 'Comprobante ilegible', 'Referencia no encontrada')",
    )


class PaymentApproveResult(BaseModel):
    status: str = "success"
    message: str
    subscription: Dict[str, Any]
    license_token: str
