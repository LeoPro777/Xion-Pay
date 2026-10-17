# 4. Modelo y Estado de Datos (Data Model)

## 4.1. Motor de Base de Datos

PostgreSQL versión 16+ con soporte para extensiones `pgcrypto` (para UUIDs nativos) y tipos de datos `JSONB`.

## 4.2. Esquema Detallado (Tablas DDL)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Usuarios Administradores de Xion-Pay
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    google_sub VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'operator', -- 'superadmin', 'operator', 'auditor'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Planes y Tiers Paramétricos
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE, -- 'basic', 'advanced', 'enterprise'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_branches INT NOT NULL DEFAULT 1,
    max_pos_registers INT NOT NULL DEFAULT 1,
    features JSONB NOT NULL DEFAULT '{"inventory_transfers": false, "advanced_audit": false, "external_api": false}',
    price_usd NUMERIC(10, 2) NOT NULL,
    quarterly_discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    annual_discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Comercios / Inquilinos (Tenants)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commercial_name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(50) NOT NULL UNIQUE, -- RIF o Cédula
    owner_email VARCHAR(255) NOT NULL,
    owner_phone VARCHAR(50) NOT NULL,
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'frozen', 'suspended'
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    courtesy_days_granted INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Contratos de Suscripción
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'quarterly', 'annual'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'grace_period', 'expired', 'canceled'
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    tolerance_expires_at TIMESTAMP WITH TIME ZONE, -- Tolerancia operativa de 24h
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bandeja de Conciliación y Reporte de Pagos
CREATE TABLE payment_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
    origin_bank VARCHAR(100) NOT NULL, -- Ej: 'Banesco', 'Mercantil', 'Pago Movil', 'Zelle'
    reference_number VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD', -- 'USD' o 'VES'
    proof_attachment_url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES admin_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- RESTRICCIÓN CRÍTICA ANTIFRAUDE
CREATE UNIQUE INDEX idx_unique_payment_ref 
ON payment_reports (origin_bank, reference_number, amount);

-- 6. Histórico de Licencias Emitidas
CREATE TABLE license_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_signature TEXT NOT NULL,
    payload_snapshot JSONB NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 7. Registro de Auditoría de Webhooks
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_code INT,
    response_body TEXT,
    attempt_count INT DEFAULT 1,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 4.3. Relaciones y Cardinalidad

* `tenants` 1 : N `subscriptions` (Un comercio tiene un histórico de suscripciones; solo una activa a la vez).
* `plans` 1 : N `subscriptions` (Un plan es adoptado por múltiples suscripciones).
* `tenants` 1 : N `payment_reports` (Un comercio registra múltiples pagos a lo largo del tiempo).
* `subscriptions` 1 : N `payment_reports` (Cada pago reportado apunta a una suscripción específica).
* `admin_users` 1 : N `payment_reports` (Un administrador revisa y audita múltiples transacciones).
* `tenants` 1 : N `license_tokens` (Un comercio acumula tokens históricos generados en cada renovación).
* `tenants` 1 : N `webhook_logs` (Trazabilidad 1 a muchos de eventos despachados).

## 4.4. Seeders (Datos Iniciales)

```sql
-- Planes Iniciales
INSERT INTO plans (code, name, description, max_branches, max_pos_registers, features, price_usd, quarterly_discount_pct, annual_discount_pct) 
VALUES 
('basic', 'Plan Emprendedor Básico', 'Ideal para comercios con una sola sede y una caja registradora.', 1, 1, '{"inventory_transfers": false, "advanced_audit": false, "external_api": false}', 25.00, 5.00, 15.00),
('advanced', 'Plan Comercial Avanzado', 'Pensado para negocios medianos con múltiples terminales.', 2, 4, '{"inventory_transfers": true, "advanced_audit": false, "external_api": false}', 50.00, 10.00, 20.00),
('enterprise', 'Plan Corporativo Enterprise', 'Para cadenas y grandes comercios con necesidades de auditoría completa y API.', 10, 20, '{"inventory_transfers": true, "advanced_audit": true, "external_api": true}', 150.00, 15.00, 25.00);

-- Usuario Administrador Maestro Inicial (Placeholder Google Sub)
INSERT INTO admin_users (email, full_name, google_sub, role, is_active)
VALUES ('admin@xionpay.internal', 'Administrador Principal', 'google-oauth2|109283746519283746519', 'superadmin', TRUE);
```
