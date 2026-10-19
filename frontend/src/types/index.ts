export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'superadmin' | 'operator' | 'auditor';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AdminUser;
}

export interface OperationalAlert {
  id: string;
  type: 'pending_payment' | 'expiring_soon' | 'in_grace_period' | 'suspended';
  severity: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  target_id: string;
  created_at: string;
}

export interface TenantCounts {
  total: number;
  active: number;
  trial: number;
  grace_period: number;
  suspended: number;
  frozen: number;
}

export interface CryptoHealthInfo {
  public_key_loaded: boolean;
  public_key_fingerprint: string;
  algorithm: string;
  active_licenses_count: number;
  expiring_soon_count: number;
  in_grace_period_count: number;
}

export interface RevenueByPlanItem {
  plan_name: string;
  plan_code: string;
  count: number;
  revenue_usd: number;
  percentage: number;
}

export interface RevenueByMethodItem {
  method: string;
  count: number;
  amount_usd: number;
  percentage: number;
}

export interface DashboardMetrics {
  mrr_usd: number;
  mrr_ves: number;
  exchange_rate_usd_ves: number;
  tenant_counts: TenantCounts;
  retention_rate_pct: number;
  churn_rate_pct: number;
  pending_audit_count: number;
  expiring_soon_count: number;
  alerts: OperationalAlert[];
  monthly_retention_history: Array<{
    month: string;
    retention: number;
    churn: number;
  }>;
  crypto_health?: CryptoHealthInfo;
  revenue_by_plan?: RevenueByPlanItem[];
  revenue_by_method?: RevenueByMethodItem[];
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  max_branches: number;
  max_pos_registers: number;
  features: {
    inventory_transfers?: boolean;
    advanced_audit?: boolean;
    external_api?: boolean;
    [key: string]: boolean | undefined;
  };
  price_usd: number;
  quarterly_discount_pct: number;
  annual_discount_pct: number;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'quarterly' | 'annual';
  status: 'active' | 'grace_period' | 'expired' | 'canceled';
  current_period_start: string;
  current_period_end: string;
  tolerance_expires_at?: string;
  plan?: Plan;
}

export interface LicenseToken {
  id: string;
  tenant_id: string;
  issued_at: string;
  expires_at: string;
  payload_snapshot: Record<string, any>;
}

export interface FiscalProfile {
  id?: string;
  tenant_id?: string;
  activo_seniat: boolean;
  tipo_documento_fiscal?: string;
  numero_rif?: string;
  razon_social?: string;
  es_contribuyente_especial: boolean;
  estado?: string;
  municipio?: string;
  parroquia?: string;
  ciudad?: string;
  direccion_detallada?: string;
  telefono_fiscal?: string;
  email_fiscal?: string;
  updated_at?: string;
}

export interface ComprobanteItem {
  id: string;
  tenant_id: string;
  subscription_id?: string;
  tipo_documento: string;
  numero_comprobante: string;
  numero_control?: string;
  moneda_base: string;
  monto_usd: number;
  tasa_bcv: number;
  base_imponible_ves: number;
  porcentaje_iva: number;
  monto_iva_ves: number;
  aplica_igtf: boolean;
  monto_igtf_ves: number;
  total_ves: number;
  datos_fiscales_snapshot?: Record<string, any>;
  estado: string;
  created_at: string;
}

export interface TenantListItem {
  id: string;
  commercial_name: string;
  contact_name?: string;
  id_doc_type?: string;
  id_doc_number?: string;
  tax_id: string;
  owner_email: string;
  owner_phone: string;
  status: 'trial' | 'active' | 'frozen' | 'suspended';
  wallet_balance?: number;
  delivery_channel?: 'email' | 'whatsapp' | 'telegram' | 'all' | string;
  telegram_chat_id?: string;
  trial_days_remaining?: number;
  courtesy_days_granted: number;
  crm_lead_source?: string;
  activo_seniat?: boolean;
  created_at: string;
  active_plan_name?: string;
  active_plan_price?: number;
  subscription_status?: string;
  subscription_expires_at?: string;
  next_billing_date?: string;
  countdown_seconds?: number;
  countdown_days?: number;
  countdown_hours?: number;
  is_due?: boolean;
  in_grace_period?: boolean;
}

export interface TenantDetail extends TenantListItem {
  webhook_url?: string;
  webhook_secret?: string;
  trial_ends_at?: string;
  crm_notes?: string;
  updated_at: string;
  active_subscription?: Subscription;
  latest_license?: LicenseToken;
  fiscal_profile?: FiscalProfile;
  recent_comprobantes?: ComprobanteItem[];
}

export interface WebhookLogItem {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: Record<string, any>;
  response_code?: number;
  response_body?: string;
  attempt_count: number;
  dispatched_at: string;
}

export interface PaymentReport {
  id: string;
  tenant_id: string;
  subscription_id: string;
  origin_bank: string;
  destination_bank?: string;
  payment_method_type?: string;
  reference_number: string;
  amount: number;
  currency: string;
  exchange_rate?: number;
  amount_usd?: number;
  amount_ves?: number;
  proof_attachment_url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reported_at: string;
  metadata_info?: Record<string, any>;
  tenant_commercial_name?: string;
  tenant_tax_id?: string;
  tenant_phone?: string;
  tenant_email?: string;
  tenant_contact_name?: string;
  plan_name?: string;
  plan_price?: number;
  tenant_wallet_balance?: number;
}

export interface SystemSettings {
  usd_ves_rate: number;
  updated_at?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt?: (momentListener?: (notification: any) => void) => void;
        };
      };
    };
  }
}

