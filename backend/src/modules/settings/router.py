import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.security import get_current_admin
from src.modules.auth.models import AdminUser
from src.modules.settings.schemas import (
    SystemSettingsResponse,
    ExchangeRateUpdate,
    PaymentMethodResponse,
    PaymentMethodCreate,
    PaymentMethodUpdate,
)
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


@router.get("/payment-methods", response_model=List[PaymentMethodResponse])
async def list_payment_methods(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Obtiene la lista de todas las formas y cuentas receptoras de pago."""
    return await SettingsService.list_payment_methods(db, active_only=active_only)


@router.post("/payment-methods", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_method(
    payload: PaymentMethodCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Agrega una nueva forma de pago o cuenta receptora."""
    return await SettingsService.create_payment_method(db, payload)


@router.put("/payment-methods/{method_id}", response_model=PaymentMethodResponse)
async def update_payment_method(
    method_id: uuid.UUID,
    payload: PaymentMethodUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Actualiza los datos de una forma de pago existente."""
    return await SettingsService.update_payment_method(db, method_id, payload)


@router.patch("/payment-methods/{method_id}/toggle", response_model=PaymentMethodResponse)
async def toggle_payment_method(
    method_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Alterna el estado activo/inactivo de una forma de pago."""
    return await SettingsService.toggle_payment_method(db, method_id)


@router.delete("/payment-methods/{method_id}")
async def delete_payment_method(
    method_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Elimina definitivamente una forma de pago o cuenta receptora."""
    await SettingsService.delete_payment_method(db, method_id)
    return {"status": "success", "message": "Forma de pago eliminada exitosamente."}
