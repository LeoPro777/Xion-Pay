from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SystemSettingsResponse(BaseModel):
    usd_ves_rate: float = Field(..., description="Tasa de cambio oficial USD a VES")
    updated_at: Optional[datetime] = None


class ExchangeRateUpdate(BaseModel):
    usd_ves_rate: float = Field(..., gt=0.0, description="Nueva tasa de cambio USD a VES")
