import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Text, Boolean, Numeric
from sqlalchemy.orm import relationship
from src.core.database import Base
from src.modules.auth.models import GUID


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    commercial_name = Column(String(200), nullable=False)
    contact_name = Column(String(150), nullable=True)  # Nombre de contacto operativo
    id_doc_type = Column(String(10), nullable=True, default="V")  # V, E, J, G
    id_doc_number = Column(String(50), nullable=True)  # Cédula o RIF informal
    tax_id = Column(String(50), unique=True, nullable=False, index=True)  # Identificador fiscal/operativo
    owner_email = Column(String(255), nullable=False)
    owner_phone = Column(String(50), nullable=False)
    webhook_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="trial")  # 'trial', 'active', 'frozen', 'suspended'
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    courtesy_days_granted = Column(Integer, default=0, nullable=False)
    crm_lead_source = Column(String(100), nullable=True, default="manual")  # 'xion-manager', 'manual', 'landing'
    crm_notes = Column(Text, nullable=True)
    wallet_balance = Column(Numeric(12, 2), default=0.00, nullable=False)  # Saldo en USD disponible para débitos automáticos
    delivery_channel = Column(String(50), default="email", nullable=False)  # 'email', 'whatsapp', 'telegram', 'all'
    telegram_chat_id = Column(String(100), nullable=True)  # Chat ID o alias para despacho por Telegram
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    subscriptions = relationship("Subscription", back_populates="tenant", cascade="all, delete-orphan")
    payment_reports = relationship("PaymentReport", back_populates="tenant", cascade="all, delete-orphan")
    license_tokens = relationship("LicenseToken", back_populates="tenant", cascade="all, delete-orphan")
    webhook_logs = relationship("WebhookLog", back_populates="tenant", cascade="all, delete-orphan")
    fiscal_profile = relationship("FiscalProfile", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    comprobantes = relationship("ComprobantePago", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Tenant {self.commercial_name} ({self.tax_id})>"


class FiscalProfile(Base):
    __tablename__ = "perfiles_fiscales"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Flag maestro: en MVP permanece en false
    activo_seniat = Column(Boolean, default=False, nullable=False)

    tipo_documento_fiscal = Column(String(10), nullable=True, default="RIF_J")  # RIF_V, RIF_E, RIF_J, RIF_G
    numero_rif = Column(String(30), nullable=True)  # Ej: J-12345678-9
    razon_social = Column(String(255), nullable=True)
    es_contribuyente_especial = Column(Boolean, default=False, nullable=False)

    # Ubicación fiscal
    estado = Column(String(100), nullable=True)
    municipio = Column(String(100), nullable=True)
    parroquia = Column(String(100), nullable=True)
    ciudad = Column(String(100), nullable=True)
    direccion_detallada = Column(Text, nullable=True)

    telefono_fiscal = Column(String(50), nullable=True)
    email_fiscal = Column(String(255), nullable=True)

    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    tenant = relationship("Tenant", back_populates="fiscal_profile")

    def __repr__(self) -> str:
        return f"<FiscalProfile {self.numero_rif} - active={self.activo_seniat}>"


class ComprobantePago(Base):
    __tablename__ = "comprobantes_pago"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    subscription_id = Column(GUID(), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True, index=True)

    # Control de tipo: 'RECIBO_COBRO' / 'PROFORMA' en MVP, 'FACTURA_FISCAL' cuando se active SENIAT
    tipo_documento = Column(String(30), nullable=False, default="RECIBO_COBRO")
    numero_comprobante = Column(String(50), nullable=False, index=True)  # Ej: "REC-2026-000123"
    numero_control = Column(String(50), nullable=True)  # NULL durante el MVP

    # Moneda y tasa
    moneda_base = Column(String(10), nullable=False, default="USD")
    monto_usd = Column(Numeric(12, 2), nullable=False)
    tasa_bcv = Column(Numeric(12, 4), nullable=False)

    # Desglose tributario (0 en MVP)
    base_imponible_ves = Column(Numeric(15, 2), nullable=False)
    porcentaje_iva = Column(Numeric(5, 2), nullable=False, default=0.00)
    monto_iva_ves = Column(Numeric(15, 2), nullable=False, default=0.00)
    aplica_igtf = Column(Boolean, nullable=False, default=False)
    monto_igtf_ves = Column(Numeric(15, 2), nullable=False, default=0.00)
    total_ves = Column(Numeric(15, 2), nullable=False)

    datos_fiscales_snapshot = Column(JSON, nullable=True)
    estado = Column(String(20), nullable=False, default="EMITIDO")  # PENDIENTE, EMITIDO, PAGADO, ANULADO
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="comprobantes")
    subscription = relationship("Subscription")

    def __repr__(self) -> str:
        return f"<ComprobantePago {self.numero_comprobante} - {self.tipo_documento} (${self.monto_usd})>"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False)
    plan_id = Column(GUID(), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    billing_cycle = Column(String(20), nullable=False, default="monthly")  # 'monthly', 'quarterly', 'annual'
    status = Column(String(50), nullable=False, default="active")  # 'active', 'grace_period', 'expired', 'canceled'
    current_period_start = Column(DateTime(timezone=True), nullable=False)
    current_period_end = Column(DateTime(timezone=True), nullable=False)
    tolerance_expires_at = Column(DateTime(timezone=True), nullable=True)  # Tolerancia operativa de 24h
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="subscriptions")
    plan = relationship("src.modules.plans.models.Plan")
    payment_reports = relationship("PaymentReport", back_populates="subscription")

    def __repr__(self) -> str:
        return f"<Subscription {self.tenant_id} - {self.status}>"


class LicenseToken(Base):
    __tablename__ = "license_tokens"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    token_signature = Column(Text, nullable=False)
    payload_snapshot = Column(JSON, nullable=False)
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    tenant = relationship("Tenant", back_populates="license_tokens")

    def __repr__(self) -> str:
        return f"<LicenseToken {self.tenant_id} exp={self.expires_at}>"
