import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import get_current_admin, require_role
from src.modules.auth.models import AdminUser
from src.modules.plans.schemas import PlanCreate, PlanUpdate, PlanResponse
from src.modules.plans.service import PlanService

router = APIRouter(prefix="/plans", tags=["Planes y Tarifas"])


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
