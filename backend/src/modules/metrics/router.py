from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import get_current_admin
from src.modules.auth.models import AdminUser
from src.modules.metrics.schemas import DashboardMetricsResponse
from src.modules.metrics.service import MetricsService

router = APIRouter(prefix="/metrics", tags=["Métricas y Salud SaaS"])


@router.get("/dashboard", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """
    Get aggregated SaaS metrics, multimoneda MRR, churn rate, retention, and urgent operational alerts.
    """
    return await MetricsService.get_dashboard_metrics(db)
