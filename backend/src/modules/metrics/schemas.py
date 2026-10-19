from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class OperationalAlert(BaseModel):
    id: str
    type: str  # 'pending_payment', 'expiring_soon', 'in_grace_period', 'suspended'
    severity: str  # 'warning', 'danger', 'info'
    title: str
    description: str
    target_id: str
    created_at: str


class TenantCounts(BaseModel):
    total: int
    active: int
    trial: int
    grace_period: int
    suspended: int
    frozen: int


class CryptoHealthInfo(BaseModel):
    public_key_loaded: bool
    public_key_fingerprint: str
    algorithm: str = "RS256"
    active_licenses_count: int
    expiring_soon_count: int
    in_grace_period_count: int


class RevenueByPlanItem(BaseModel):
    plan_name: str
    plan_code: str
    count: int
    revenue_usd: float
    percentage: float


class RevenueByMethodItem(BaseModel):
    method: str
    count: int
    amount_usd: float
    percentage: float


class DashboardMetricsResponse(BaseModel):
    mrr_usd: float
    mrr_ves: float
    exchange_rate_usd_ves: float
    tenant_counts: TenantCounts
    retention_rate_pct: float
    churn_rate_pct: float
    pending_audit_count: int
    expiring_soon_count: int
    alerts: List[OperationalAlert]
    monthly_retention_history: List[Dict[str, Any]]
    crypto_health: Optional[CryptoHealthInfo] = None
    revenue_by_plan: Optional[List[RevenueByPlanItem]] = None
    revenue_by_method: Optional[List[RevenueByMethodItem]] = None
