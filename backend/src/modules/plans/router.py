import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import get_current_admin, require_role
from src.modules.auth.models import AdminUser
from src.modules.plans.schemas import PlanCreate, PlanUpdate, PlanResponse
from src.modules.plans.service import PlanService
from src.modules.settings.service import SettingsService

router = APIRouter(prefix="/plans", tags=["Planes y Tarifas"])


@router.get("/catalog")
async def get_plans_catalog(
    db: AsyncSession = Depends(get_db),
):
    """
    Catálogo público de planes y coordenadas de pago para Xion-Manager.
    Retorna precios calculados en USD y VES (tasa BCV) junto a las cuentas receptoras.
    """
    plans = await PlanService.list_plans(db, active_only=True)
    settings_data = await SettingsService.get_settings(db)
    rate = settings_data.usd_ves_rate

    payment_methods = {
        "pago_movil": {
            "banco": "0102 - Banco de Venezuela",
            "telefono": "+584141234567",
            "documento_identidad": "J-50123456-7",
            "titular": "Xion Technologies C.A.",
        },
        "transferencia_ves": {
            "banco": "0134 - Banesco Banco Universal",
            "numero_cuenta": "0134-1092-23-0001234567",
            "documento_identidad": "J-50123456-7",
            "titular": "Xion Technologies C.A.",
        },
        "zelle": {
            "correo": "pagos@xionpay.com",
            "titular": "Xion Global LLC",
        },
    }

    catalog = []
    for p in plans:
        price_usd = float(p.price_usd)
        price_ves = round(price_usd * rate, 2)
        catalog.append({
            "id": str(p.id),
            "code": p.code,
            "name": p.name,
            "description": p.description,
            "price_usd": price_usd,
            "price_ves": price_ves,
            "quarterly_discount_pct": float(p.quarterly_discount_pct),
            "annual_discount_pct": float(p.annual_discount_pct),
            "max_branches": p.max_branches,
            "max_pos_registers": p.max_pos_registers,
            "features": p.features,
        })

    return {
        "status": "success",
        "exchange_rate_usd_ves": rate,
        "plans": catalog,
        "payment_methods": payment_methods,
    }


@router.get("", response_model=List[PlanResponse])
async def list_plans(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """List subscription plans (accessible to all authenticated admins)."""
    plans = await PlanService.list_plans(db, active_only=active_only)
    return [PlanResponse.model_validate(p) for p in plans]


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Get single plan details."""
    plan = await PlanService.get_by_id(db, plan_id)
    return PlanResponse.model_validate(plan)


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin")),
):
    """Create new subscription plan (Superadmin only)."""
    plan = await PlanService.create_plan(db, payload)
    return PlanResponse.model_validate(plan)


@router.patch("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: uuid.UUID,
    payload: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin")),
):
    """Update subscription plan parameters and limits (Superadmin only)."""
    plan = await PlanService.update_plan(db, plan_id, payload)
    return PlanResponse.model_validate(plan)
