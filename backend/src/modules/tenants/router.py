import uuid
from typing import List, Optional
from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.security import get_current_admin, require_role
from src.modules.auth.models import AdminUser
from src.modules.tenants.schemas import (
    TenantCreate,
    TenantUpdate,
    TenantDetailResponse,
    TenantListItemResponse,
    TenantStatusUpdate,
    CourtesyDaysRequest,
    FiscalProfileUpdate,
    FiscalProfileResponse,
    ComprobanteCreateRequest,
    ComprobanteResponse,
    XionManagerLeadCreate,
    XionManagerLeadResponse,
    TenantBalanceRecharge,
    TenantBalanceResponse,
)
from src.modules.tenants.service import TenantService

router = APIRouter(prefix="/tenants", tags=["Clientes & Facturación SENIAT"])
clients_router = APIRouter(prefix="/clients", tags=["Clientes & Facturación SENIAT"])



# ==============================================================================
# INTEGRACIÓN EXTERNA / ONBOARDING DIRECTO DESDE XION-MANAGER (30 DÍAS TRIAL)
# ==============================================================================

@router.post("/onboarding-trial", response_model=XionManagerLeadResponse, status_code=status.HTTP_201_CREATED)
@clients_router.post("/onboarding-trial", response_model=XionManagerLeadResponse, status_code=status.HTTP_201_CREATED)
async def onboard_xion_manager_lead(
    payload: XionManagerLeadCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Recibe formularios directamente desde Xion-Manager.
    Otorga automáticamente una prueba gratuita de 30 días, emite la licencia criptográfica
    RS256 y crea el registro en el CRM de Clientes.
    """
    return await TenantService.onboard_xion_manager_lead(db, payload)


# ==============================================================================
# GESTIÓN DE CLIENTES / CRM
# ==============================================================================

@router.get("", response_model=List[TenantListItemResponse])
@router.get("/", response_model=List[TenantListItemResponse], include_in_schema=False)
@clients_router.get("", response_model=List[TenantListItemResponse])
@clients_router.get("/", response_model=List[TenantListItemResponse], include_in_schema=False)
async def list_tenants(
    search: Optional[str] = Query(None, description="Buscar por RIF, Razón social, Contacto o Email"),
    status: Optional[str] = Query(None, description="Filtrar por estado: active, trial, frozen, suspended"),
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """List and search clients (tenants) with operational & CRM details."""
    return await TenantService.list_tenants(db, search=search, status_filter=status)


@router.get("/{tenant_id}", response_model=TenantDetailResponse)
@clients_router.get("/{tenant_id}", response_model=TenantDetailResponse)
async def get_tenant_detail(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Get complete client profile including active subscription, fiscal profile and receipts."""
    return await TenantService.get_tenant_detail(db, tenant_id)


@router.post("", response_model=TenantDetailResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TenantDetailResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@clients_router.post("", response_model=TenantDetailResponse, status_code=status.HTTP_201_CREATED)
@clients_router.post("/", response_model=TenantDetailResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_tenant(
    payload: TenantCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """Register new client with operational MVP data and dormant SENIAT profile."""
    return await TenantService.create_tenant(db, payload)


@router.patch("/{tenant_id}", response_model=TenantDetailResponse)
@clients_router.patch("/{tenant_id}", response_model=TenantDetailResponse)
@router.put("/{tenant_id}", response_model=TenantDetailResponse, include_in_schema=False)
@clients_router.put("/{tenant_id}", response_model=TenantDetailResponse, include_in_schema=False)
async def update_tenant(
    tenant_id: uuid.UUID,
    payload: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """Actualiza datos operacionales, información de contacto o estado del cliente."""
    return await TenantService.update_tenant(db, tenant_id, payload)


@router.patch("/{tenant_id}/status", response_model=TenantDetailResponse)
@clients_router.patch("/{tenant_id}/status", response_model=TenantDetailResponse)
async def update_tenant_status(
    tenant_id: uuid.UUID,
    payload: TenantStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """Update tenant status (active, trial, frozen, suspended) and dispatch webhook."""
    return await TenantService.update_status(db, tenant_id, payload)


@router.post("/{tenant_id}/courtesy-days", response_model=TenantDetailResponse)
@clients_router.post("/{tenant_id}/courtesy-days", response_model=TenantDetailResponse)
async def grant_courtesy_days(
    tenant_id: uuid.UUID,
    payload: CourtesyDaysRequest,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """Grant courtesy days, automatically reissuing cryptographic license token."""
    return await TenantService.grant_courtesy_days(db, tenant_id, payload)


# ==============================================================================
# PERFIL FISCAL SENIAT (FEATURE FLAG)
# ==============================================================================

@router.put("/{tenant_id}/fiscal-profile", response_model=FiscalProfileResponse)
@clients_router.put("/{tenant_id}/fiscal-profile", response_model=FiscalProfileResponse)
async def update_fiscal_profile(
    tenant_id: uuid.UUID,
    payload: FiscalProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """
    Actualiza metadatos fiscales del cliente.
    Si activo_seniat = True, valida RIF y Razón Social mercantil obligatoriamente.
    """
    return await TenantService.update_fiscal_profile(db, tenant_id, payload)


# ==============================================================================
# COMPROBANTES DE COBRO (RECIBO vs FACTURA FISCAL)
# ==============================================================================

@router.post("/{tenant_id}/comprobantes", response_model=ComprobanteResponse, status_code=status.HTTP_201_CREATED)
@clients_router.post("/{tenant_id}/comprobantes", response_model=ComprobanteResponse, status_code=status.HTTP_201_CREATED)
async def create_comprobante(
    tenant_id: uuid.UUID,
    payload: ComprobanteCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """
    Emite un comprobante para el cliente:
    - En MVP (activo_seniat=False): Genera Recibo de Cobro / Proforma interno (IVA 0%, sin número de control).
    - Con SENIAT activo (activo_seniat=True): Genera Factura Fiscal formal con IVA 16%, control y snapshot inmutable.
    """
    return await TenantService.generate_comprobante(db, tenant_id, payload)


@router.get("/{tenant_id}/comprobantes", response_model=List[ComprobanteResponse])
@clients_router.get("/{tenant_id}/comprobantes", response_model=List[ComprobanteResponse])
async def list_comprobantes(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    """Lista historial de recibos de cobro y comprobantes del cliente."""
    return await TenantService.list_comprobantes(db, tenant_id)


@router.get("/{tenant_id}/license-status")
@clients_router.get("/{tenant_id}/license-status")
async def get_tenant_license_status(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Consulta directa de autorización y token de licencia criptográfico para Xion-Manager.
    Permite a la instancia cliente validar su estatus y plan activo en cualquier momento.
    """
    return await TenantService.get_tenant_license_status(db, tenant_id)


# ==============================================================================
# BILLETERA / SALDO Y RENOVACIÓN AUTOMÁTICA
# ==============================================================================

@router.post("/{tenant_id}/balance", response_model=TenantBalanceResponse)
@clients_router.post("/{tenant_id}/balance", response_model=TenantBalanceResponse)
async def recharge_tenant_balance(
    tenant_id: uuid.UUID,
    payload: TenantBalanceRecharge,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """
    Acredita saldo a la billetera del cliente.
    Si auto_renew_if_due es True y el plan está por vencer/vencido, procesa la renovación automáticamente.
    """
    return await TenantService.recharge_balance(db, tenant_id, payload)


@router.post("/{tenant_id}/renew-from-balance", response_model=TenantDetailResponse)
@clients_router.post("/{tenant_id}/renew-from-balance", response_model=TenantDetailResponse)
async def renew_from_balance(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """
    Debita el costo del plan del saldo del tenant y renueva inmediatamente su suscripción y licencia RS256,
    despachando la nota de entrega por el canal seleccionado por el comercio (email, whatsapp o telegram).
    """
    return await TenantService.renew_from_balance(db, tenant_id)


@router.post("/billing/process-cycle")
@clients_router.post("/billing/process-cycle")
async def process_billing_cycle(
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(require_role("superadmin", "operator")),
):
    """
    Ejecuta el ciclo de cobro y conciliación periódica de planes:
    - Renueva automáticamente los comercios con saldo suficiente.
    - Mantiene en prórroga los que reportaron pago o están dentro del período de tolerancia.
    - Suspende aquellos vencidos sin saldo ni prórroga activa.
    """
    return await TenantService.process_due_subscriptions(db)

