from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.security import get_current_admin
from src.modules.auth.models import AdminUser
from src.modules.settings.schemas import SystemSettingsResponse, ExchangeRateUpdate
from src.modules.settings.service import SettingsService

router = APIRouter(prefix="/settings", tags=["Configuración del Sistema"])


@router.get("", response_model=SystemSettingsResponse)
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
):
    """Obtiene las configuraciones actuales del sistema (incluyendo tasa de cambio)."""
    return await SettingsService.get_settings(db)


@router.put("/exchange-rate", response_model=SystemSettingsResponse)
async def update_exchange_rate(
    payload: ExchangeRateUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
):
    """Actualiza la tasa de cambio USD a VES en la base de datos."""
    return await SettingsService.update_exchange_rate(db, payload.usd_ves_rate)
