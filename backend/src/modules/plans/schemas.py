import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, condecimal, field_validator


class PlanBase(BaseModel):
    code: str = Field(..., max_length=50, description="Código único del plan ('basic', 'advanced', 'enterprise')")
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    max_branches: int = Field(default=1, ge=1, description="Límite máximo de sucursales autorizadas")
    max_pos_registers: int = Field(default=1, ge=1, description="Límite máximo de cajas POS concurrentes")
    features: Dict[str, Any] = Field(
        default_factory=lambda: {
            "inventory_transfers": False,
            "advanced_audit": False,
            "external_api": False,
        }
    )
    price_usd: float = Field(..., ge=0.0, description="Precio mensual base en USD")
    quarterly_discount_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="Descuento trimestral %")
    annual_discount_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="Descuento anual %")
    is_active: bool = True


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_branches: Optional[int] = Field(None, ge=1)
    max_pos_registers: Optional[int] = Field(None, ge=1)
    features: Optional[Dict[str, Any]] = None
    price_usd: Optional[float] = Field(None, ge=0.0)
    quarterly_discount_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    annual_discount_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    is_active: Optional[bool] = None


class PlanResponse(PlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
