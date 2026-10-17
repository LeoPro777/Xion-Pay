-- ==============================================================================
-- Xion-Pay SaaS: Esquema Integral PostgreSQL para Supabase
-- Versión compatible con PostgreSQL 16+ / Supabase SQL Editor
-- ==============================================================================

-- 1. Habilitar extensiones requeridas para UUIDs y criptografía
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Tablas Principales
-- ==============================================================================

-- 2.1. Usuarios Administradores (Whitelist de acceso con Google OAuth / JWT)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    google_sub VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'operator', -- 'superadmin', 'operator', 'auditor'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_google_sub ON admin_users(google_sub);

-- 2.2. Catálogo de Planes y Parámetros Operativos
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE, -- 'basic', 'advanced', 'enterprise'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_branches INT NOT NULL DEFAULT 1,
    max_pos_registers INT NOT NULL DEFAULT 1,
    features JSONB NOT NULL DEFAULT '{"inventory_transfers": false, "advanced_audit": false, "external_api": false}',
    price_usd NUMERIC(10, 2) NOT NULL,
    quarterly_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    annual_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);

-- 2.3. Comercios / Inquilinos (Tenants & CRM)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commercial_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(150),
    id_doc_type VARCHAR(10) DEFAULT 'V', -- 'V', 'E', 'J', 'G'
    id_doc_number VARCHAR(50),
    tax_id VARCHAR(50) NOT NULL UNIQUE,
    owner_email VARCHAR(255) NOT NULL,
    owner_phone VARCHAR(50) NOT NULL,
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'frozen', 'suspended'
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    courtesy_days_granted INT NOT NULL DEFAULT 0,
    crm_lead_source VARCHAR(100) DEFAULT 'manual',
    crm_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_tax_id ON tenants(tax_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2.4. Perfiles Fiscales (Preparación SENIAT y facturación local)
CREATE TABLE IF NOT EXISTS perfiles_fiscales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    activo_seniat BOOLEAN NOT NULL DEFAULT FALSE,
    tipo_documento_fiscal VARCHAR(10) DEFAULT 'RIF_J',
    numero_rif VARCHAR(30),
    razon_social VARCHAR(255),
    es_contribuyente_especial BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(100),
    municipio VARCHAR(100),
    parroquia VARCHAR(100),
    ciudad VARCHAR(100),
    direccion_detallada TEXT,
    telefono_fiscal VARCHAR(50),
    email_fiscal VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.5. Contratos de Suscripción
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'quarterly', 'annual'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'grace_period', 'expired', 'canceled'
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    tolerance_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 2.6. Comprobantes de Pago y Facturación
CREATE TABLE IF NOT EXISTS comprobantes_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    tipo_documento VARCHAR(30) NOT NULL DEFAULT 'RECIBO_COBRO', -- 'RECIBO_COBRO', 'FACTURA_FISCAL'
    numero_comprobante VARCHAR(50) NOT NULL,
    numero_control VARCHAR(50),
    moneda_base VARCHAR(10) NOT NULL DEFAULT 'USD',
    monto_usd NUMERIC(12, 2) NOT NULL,
    tasa_bcv NUMERIC(12, 4) NOT NULL,
    base_imponible_ves NUMERIC(15, 2) NOT NULL,
    porcentaje_iva NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    monto_iva_ves NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    aplica_igtf BOOLEAN NOT NULL DEFAULT FALSE,
    monto_igtf_ves NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_ves NUMERIC(15, 2) NOT NULL,
    datos_fiscales_snapshot JSONB,
    estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_numero ON comprobantes_pago(numero_comprobante);
CREATE INDEX IF NOT EXISTS idx_comprobantes_tenant ON comprobantes_pago(tenant_id);

-- 2.7. Bandeja de Conciliación y Reportes de Pago
CREATE TABLE IF NOT EXISTS payment_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    origin_bank VARCHAR(100) NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    proof_attachment_url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- RESTRICCIÓN CRÍTICA ANTIFRAUDE: Impide referencias duplicadas por banco y monto
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_ref 
ON payment_reports (origin_bank, reference_number, amount);

-- 2.8. Tokens Criptográficos de Licencia Emitidos (RS256)
CREATE TABLE IF NOT EXISTS license_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_signature TEXT NOT NULL,
    payload_snapshot JSONB NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_license_tokens_tenant ON license_tokens(tenant_id);

-- 2.9. Registro de Auditoría de Webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_code INT,
    response_body TEXT,
    attempt_count INT NOT NULL DEFAULT 1,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id);

-- 2.10. Parámetros Globales del Sistema (Tasa cambiaria USD/VES, etc.)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. Datos Semilla Iniciales (Idempotentes)
-- ==============================================================================

-- 3.1. Planes Estándar
INSERT INTO plans (code, name, description, max_branches, max_pos_registers, features, price_usd, quarterly_discount_pct, annual_discount_pct, is_active)
VALUES 
    ('basic', 'Plan Emprendedor Básico', 'Ideal para comercios con una sola sede y una caja registradora.', 1, 1, '{"inventory_transfers": false, "advanced_audit": false, "external_api": false}', 25.00, 5.00, 15.00, TRUE),
    ('advanced', 'Plan Comercial Avanzado', 'Pensado para negocios medianos con múltiples terminales.', 2, 4, '{"inventory_transfers": true, "advanced_audit": false, "external_api": false}', 50.00, 10.00, 20.00, TRUE),
    ('enterprise', 'Plan Corporativo Enterprise', 'Para cadenas y grandes comercios con necesidades de auditoría completa y API.', 10, 20, '{"inventory_transfers": true, "advanced_audit": true, "external_api": true}', 150.00, 15.00, 25.00, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 3.2. Usuario Administrador Maestro Inicial
INSERT INTO admin_users (email, full_name, google_sub, role, is_active)
VALUES 
    ('admin@xionpay.internal', 'Administrador Principal', 'google-oauth2|109283746519283746519', 'superadmin', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 3.3. Configuración Inicial de Tasa de Cambio
INSERT INTO system_settings (key, value, description)
VALUES 
    ('usd_ves_rate', '36.50', 'Tasa de cambio referencial oficial BCV USD a VES')
ON CONFLICT (key) DO NOTHING;
