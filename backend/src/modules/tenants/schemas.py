import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from src.modules.plans.schemas import PlanResponse


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    plan_id: uuid.UUID
    billing_cycle: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    tolerance_expires_at: Optional[datetime] = None
    plan: Optional[PlanResponse] = None


class TenantBase(BaseModel):
    commercial_name: str = Field(..., max_length=200, description="Nombre comercial del cliente")
    contact_name: Optional[str] = Field(None, max_length=150, description="Nombre del contacto operativo")
    id_doc_type: Optional[str] = Field("V", max_length=10, description="'V', 'E', 'J', 'G'")
    id_doc_number: Optional[str] = Field(None, max_length=50, description="Cédula o RIF informal")
    tax_id: Optional[str] = Field(None, max_length=50, description="RIF o Identificador único fiscal/operativo")
    owner_email: EmailStr
    owner_phone: str = Field(..., max_length=50, description="Teléfono/WhatsApp para alertas")
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    status: str = Field(default="trial", description="'trial', 'active', 'frozen', 'suspended'")
    wallet_balance: float = Field(default=0.00, ge=0.0, description="Saldo prepagado / a favor en USD")
    delivery_channel: str = Field(default="email", description="Canal de entrega de notas de cobro: 'email', 'whatsapp', 'telegram', 'all'")
    telegram_chat_id: Optional[str] = Field(None, max_length=100, description="Chat ID o alias en Telegram para notas de entrega")

    @field_validator("tax_id", "contact_name", "id_doc_number", "webhook_url", "webhook_secret", "telegram_chat_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TenantCreate(TenantBase):
    initial_plan_id: Optional[uuid.UUID] = Field(None, description="Plan inicial (opcional, por defecto asigna plan activo)")
    billing_cycle: str = Field(default="monthly", description="'monthly', 'quarterly', 'annual'")
    trial_days: int = Field(default=30, ge=0, description="Días de prueba gratuita (30 días por defecto)")

    @field_validator("initial_plan_id", mode="before")
    @classmethod
    def parse_optional_plan_id(cls, v: Any) -> Optional[uuid.UUID]:
        if not v or (isinstance(v, str) and not v.strip()):
            return None
        return v


class TenantUpdate(BaseModel):
    commercial_name: Optional[str] = None
    contact_name: Optional[str] = None
    id_doc_type: Optional[str] = None
    id_doc_number: Optional[str] = None
    tax_id: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    owner_phone: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    crm_notes: Optional[str] = None
    status: Optional[str] = Field(None, description="'active', 'trial', 'frozen', 'suspended'")
    wallet_balance: Optional[float] = Field(None, ge=0.0, description="Ajuste manual de saldo en USD")
    delivery_channel: Optional[str] = Field(None, description="'email', 'whatsapp', 'telegram', 'all'")
    telegram_chat_id: Optional[str] = None

    @field_validator(
        "tax_id",
        "contact_name",
        "id_doc_number",
        "owner_email",
        "owner_phone",
        "webhook_url",
        "webhook_secret",
        "crm_notes",
        "status",
        "delivery_channel",
        "telegram_chat_id",
        mode="before",
    )
    @classmethod
    def empty_str_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class TenantBalanceRecharge(BaseModel):
    amount: float = Field(..., gt=0.0, description="Monto en USD a recargar en la billetera")
    reason: Optional[str] = Field("Abono administrativo a favor", description="Motivo de la recarga")
    auto_renew: bool = Field(default=True, description="Si tiene saldo suficiente y suscripción vencida, renueva automáticamente")


class TenantBalanceResponse(BaseModel):
    tenant_id: uuid.UUID
    previous_balance: float
    credited_amount: float
    current_balance: float
    auto_renewed: bool
    new_period_end: Optional[datetime] = None
    message: str


class TenantStatusUpdate(BaseModel):
    status: str = Field(..., description="'active', 'trial', 'frozen', 'suspended'")
    reason: Optional[str] = None


class CourtesyDaysRequest(BaseModel):
    days: int = Field(..., ge=1, le=90, description="Número de días de cortesía a otorgar")
    reason: Optional[str] = None



class LicenseTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    issued_at: datetime
    expires_at: datetime
    payload_snapshot: Dict[str, Any]


# ==============================================================================
# PERFIL FISCAL SENIAT (Dormido en MVP / Feature Flag)
# ==============================================================================

class FiscalProfileBase(BaseModel):
    activo_seniat: bool = Field(default=False, description="Flag maestro SENIAT: en MVP permanece en false")
    tipo_documento_fiscal: Optional[str] = Field(default="RIF_J", description="'RIF_V', 'RIF_E', 'RIF_J', 'RIF_G'")
    numero_rif: Optional[str] = Field(None, max_length=30, description="Formato canónico validado ej: J-12345678-9")
    razon_social: Optional[str] = Field(None, max_length=255, description="Razón Social registrada en Registro Mercantil")
    es_contribuyente_especial: bool = Field(default=False, description="Aplica retención de IVA (75% o 100%)")
    estado: Optional[str] = None
    municipio: Optional[str] = None
    parroquia: Optional[str] = None
    ciudad: Optional[str] = None
    direccion_detallada: Optional[str] = None
    telefono_fiscal: Optional[str] = None
    email_fiscal: Optional[EmailStr] = None


class FiscalProfileUpdate(FiscalProfileBase):
    pass


class FiscalProfileResponse(FiscalProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    updated_at: datetime


# ==============================================================================
# COMPROBANTES DE PAGO (Recibo interno vs Factura SENIAT)
# ==============================================================================

class ComprobanteCreateRequest(BaseModel):
    monto_usd: float = Field(..., gt=0, description="Monto del servicio en USD")
    tasa_bcv: float = Field(..., gt=0, description="Tasa oficial BCV")
    aplica_igtf: bool = Field(default=False, description="Aplica 3% IGTF si el pago es en divisas en efectivo/cripto")
    tipo_documento: Optional[str] = Field(None, description="RECIBO_COBRO o PROFORMA (MVP), o FACTURA_FISCAL (SENIAT)")


class ComprobanteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    subscription_id: Optional[uuid.UUID] = None
    tipo_documento: str
    numero_comprobante: str
    numero_control: Optional[str] = None
    moneda_base: str
    monto_usd: float
    tasa_bcv: float
    base_imponible_ves: float
    porcentaje_iva: float
    monto_iva_ves: float
    aplica_igtf: bool
    monto_igtf_ves: float
    total_ves: float
    datos_fiscales_snapshot: Optional[Dict[str, Any]] = None
    estado: str
    created_at: datetime


# ==============================================================================
# ONBOARDING DIRECTO DESDE XION-MANAGER (Lead & 30-day Free Trial)
# ==============================================================================

class XionManagerLeadCreate(BaseModel):
    nombre_contacto: str = Field(..., min_length=2, max_length=150, description="Nombre de la persona o contacto")
    nombre_comercial: str = Field(..., min_length=2, max_length=200, description="Nombre comercial del comercio")
    email: EmailStr = Field(..., description="Correo de suscripción y login")
    telefono_contacto: str = Field(..., min_length=7, max_length=50, description="Teléfono/WhatsApp para avisos")
    documento_identidad_tipo: Optional[str] = Field(default="V", description="'V', 'E', 'J', 'G'")
    documento_identidad_numero: Optional[str] = Field(default=None, max_length=50, description="Cédula o RIF informal")
    webhook_url: Optional[str] = None
    source: Optional[str] = Field(default="xion-manager", description="Origen del formulario")
    notes: Optional[str] = Field(default=None, description="Notas operativas del lead")


class XionManagerLeadResponse(BaseModel):
    client_id: uuid.UUID
    commercial_name: str
    contact_name: Optional[str] = None
    email: str
    phone: str
    status: str
    trial_days_granted: int = 30
    trial_ends_at: datetime
    trial_days_remaining: int
    license_token: str
    message: str


# ==============================================================================
# DETALLES & LISTADOS DE CLIENTES
# ==============================================================================

class TenantDetailResponse(TenantBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    trial_ends_at: Optional[datetime] = None
    trial_days_remaining: Optional[int] = None
    courtesy_days_granted: int
    crm_lead_source: Optional[str] = "manual"
    crm_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    next_billing_date: Optional[datetime] = None
    countdown_seconds: Optional[int] = None
    countdown_days: Optional[int] = None
    countdown_hours: Optional[int] = None
    is_due: bool = False
    in_grace_period: bool = False
    active_subscription: Optional[SubscriptionResponse] = None
    latest_license: Optional[LicenseTokenResponse] = None
    fiscal_profile: Optional[FiscalProfileResponse] = None
    recent_comprobantes: Optional[List[ComprobanteResponse]] = None


class TenantListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    commercial_name: str
    contact_name: Optional[str] = None
    tax_id: str
    id_doc_type: Optional[str] = "V"
    id_doc_number: Optional[str] = None
    owner_email: str
    owner_phone: str
    status: str
    trial_days_remaining: Optional[int] = None
    courtesy_days_granted: int
    crm_lead_source: Optional[str] = "manual"
    activo_seniat: bool = False
    wallet_balance: float = 0.00
    delivery_channel: str = "email"
    telegram_chat_id: Optional[str] = None
    created_at: datetime
    active_plan_name: Optional[str] = None
    active_plan_price: Optional[float] = None
    subscription_status: Optional[str] = None
    subscription_expires_at: Optional[datetime] = None
    next_billing_date: Optional[datetime] = None
    countdown_seconds: Optional[int] = None
    countdown_days: Optional[int] = None
    countdown_hours: Optional[int] = None
    is_due: bool = False
    in_grace_period: bool = False
