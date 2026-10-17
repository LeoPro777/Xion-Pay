import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.modules.plans.models import Plan
from src.modules.plans.schemas import PlanCreate, PlanUpdate
from src.utils.exceptions import ResourceNotFoundError, XionPayBaseException


class PlanService:
    @staticmethod
    async def list_plans(db: AsyncSession, active_only: bool = False) -> List[Plan]:
        query = select(Plan).order_by(Plan.price_usd.asc())
        if active_only:
            query = query.where(Plan.is_active == True)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, plan_id: uuid.UUID) -> Plan:
        result = await db.execute(select(Plan).where(Plan.id == plan_id))
        plan = result.scalar_one_or_none()
        if not plan:
            raise ResourceNotFoundError("Plan", str(plan_id))
        return plan

    @staticmethod
    async def get_by_code(db: AsyncSession, code: str) -> Optional[Plan]:
        result = await db.execute(select(Plan).where(Plan.code == code))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_plan(db: AsyncSession, req: PlanCreate) -> Plan:
        existing = await PlanService.get_by_code(db, req.code)
        if existing:
            raise XionPayBaseException(
                message=f"El código de plan '{req.code}' ya existe.",
                error_code="PLAN_CODE_EXISTS",
                status_code=400,
            )

        plan = Plan(
            code=req.code,
            name=req.name,
            description=req.description,
            max_branches=req.max_branches,
            max_pos_registers=req.max_pos_registers,
            features=req.features,
            price_usd=req.price_usd,
            quarterly_discount_pct=req.quarterly_discount_pct,
            annual_discount_pct=req.annual_discount_pct,
            is_active=req.is_active,
        )
        db.add(plan)
        await db.commit()
        await db.refresh(plan)
        return plan

    @staticmethod
    async def update_plan(db: AsyncSession, plan_id: uuid.UUID, req: PlanUpdate) -> Plan:
        plan = await PlanService.get_by_id(db, plan_id)

        update_data = req.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)

        await db.commit()
        await db.refresh(plan)
        return plan
