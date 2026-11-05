import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class SystemSettingsResponse(BaseModel):
    usd_ves_rate: float = Field(..., description="Tasa de cambio oficial USD a VES")
    updated_at: Optional[datetime] = None


class ExchangeRateUpdate(BaseModel):
    usd_ves_rate: float = Field(..., gt=0.0, description="Nueva tasa de cambio USD a VES")


class PaymentMethodBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Nombre descriptivo de la cuenta o forma de pago")
    type: str = Field(default="pago_movil", description="Tipo de método (pago_movil, transferencia, zelle, binance, etc.)")
    currency: str = Field(default="VES", description="Moneda de recepción ('VES' o 'USD')")
    details: Dict[str, Any] = Field(default_factory=dict, description="Datos bancarios / receptor")
    instructions: Optional[str] = Field(default=None, description="Instrucciones o nota adicional")
    is_active: bool = Field(default=True, description="Estado de visualización para usuarios")


class PaymentMethodCreate(PaymentMethodBase):
    pass


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    type: Optional[str] = None
    currency: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None


class PaymentMethodResponse(PaymentMethodBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
