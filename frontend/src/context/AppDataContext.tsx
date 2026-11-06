import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import type {
  TenantListItem,
  Plan,
  PaymentReport,
  SystemSettings,
  ComprobanteItem,
  DashboardMetrics,
} from '../types';

interface AppDataContextType {
  tenants: TenantListItem[];
  plans: Plan[];
  pendingPayments: PaymentReport[];
  paymentHistory: PaymentReport[];
  settings: SystemSettings | null;
  invoices: ComprobanteItem[];
  metrics: DashboardMetrics | null;
  isPreloaded: boolean;
  preloadingProgress: number;
  preloadAll: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshPlans: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshInvoices: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
  updateTenantInCache: (tenantId: string, partial: Partial<TenantListItem>) => void;
  updatePaymentInCache: (paymentId: string, partial: Partial<PaymentReport>) => void;
  addInvoiceInCache: (invoice: ComprobanteItem) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const { subscribeToSocket } = useNotifications();

  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentReport[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentReport[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [invoices, setInvoices] = useState<ComprobanteItem[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  const [isPreloaded, setIsPreloaded] = useState<boolean>(false);
  const [preloadingProgress, setPreloadingProgress] = useState<number>(0);
  const isPreloadingRef = useRef<boolean>(false);

  // Parallel preloader on user authentication
  const preloadAll = useCallback(async () => {
    if (!token || isPreloadingRef.current) return;
    isPreloadingRef.current = true;
    setPreloadingProgress(10);

    try {
      const [
        tenantsRes,
        plansRes,
        pendingRes,
        historyRes,
        settingsRes,
        invoicesRes,
        metricsRes,
      ] = await Promise.allSettled([
        api.get<TenantListItem[]>('/tenants'),
        api.get<Plan[]>('/plans'),
        api.get<PaymentReport[]>('/payments/pending'),
        api.get<PaymentReport[]>('/payments/history', { params: { limit: 50 } }),
        api.get<SystemSettings>('/settings'),
        api.get<ComprobanteItem[]>('/tenants/comprobantes/all', { params: { limit: 100 } }),
        api.get<DashboardMetrics>('/metrics/dashboard'),
      ]);

      setPreloadingProgress(60);

      if (tenantsRes.status === 'fulfilled') setTenants(tenantsRes.value.data || []);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data || []);
      if (pendingRes.status === 'fulfilled') setPendingPayments(pendingRes.value.data || []);
      if (historyRes.status === 'fulfilled') setPaymentHistory(historyRes.value.data || []);
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data);
      if (invoicesRes.status === 'fulfilled') setInvoices(invoicesRes.value.data || []);
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data);

      setPreloadingProgress(100);
      setIsPreloaded(true);
      console.log('[SPA] Precarga completada exitosamente. Datos sincronizados en memoria.');
    } catch (err) {
      console.error('[SPA] Error en precarga inicial:', err);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [token]);

  // Initial preload trigger
  useEffect(() => {
    if (token) {
      preloadAll();
    } else {
      setIsPreloaded(false);
      setTenants([]);
      setPlans([]);
      setPendingPayments([]);
      setPaymentHistory([]);
      setInvoices([]);
      setMetrics(null);
    }
  }, [token, preloadAll]);

  // Granular refresh functions
  const refreshTenants = useCallback(async () => {
    try {
      const res = await api.get<TenantListItem[]>('/tenants');
      setTenants(res.data || []);
    } catch (err) {
      console.error('[SPA] Error refreshing tenants:', err);
    }
  }, []);

  const refreshPayments = useCallback(async () => {
    try {
      const [pending, history] = await Promise.all([
        api.get<PaymentReport[]>('/payments/pending'),
        api.get<PaymentReport[]>('/payments/history', { params: { limit: 50 } }),
      ]);
      setPendingPayments(pending.data || []);
      setPaymentHistory(history.data || []);
    } catch (err) {
      console.error('[SPA] Error refreshing payments:', err);
    }
  }, []);

  const refreshPlans = useCallback(async () => {
    try {
      const res = await api.get<Plan[]>('/plans');
      setPlans(res.data || []);
    } catch (err) {
      console.error('[SPA] Error refreshing plans:', err);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await api.get<SystemSettings>('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error('[SPA] Error refreshing settings:', err);
    }
  }, []);

  const refreshInvoices = useCallback(async () => {
    try {
      const res = await api.get<ComprobanteItem[]>('/tenants/comprobantes/all', { params: { limit: 100 } });
      setInvoices(res.data || []);
    } catch (err) {
      console.error('[SPA] Error refreshing invoices:', err);
    }
  }, []);

  const refreshMetrics = useCallback(async () => {
    try {
      const res = await api.get<DashboardMetrics>('/metrics/dashboard');
      setMetrics(res.data);
    } catch (err) {
      console.error('[SPA] Error refreshing metrics:', err);
    }
  }, []);

  // In-memory cache mutators
  const updateTenantInCache = useCallback((tenantId: string, partial: Partial<TenantListItem>) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId || t.tax_id === tenantId ? { ...t, ...partial } : t))
    );
  }, []);

  const updatePaymentInCache = useCallback((paymentId: string, partial: Partial<PaymentReport>) => {
    setPendingPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, ...partial } : p))
    );
    setPaymentHistory((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, ...partial } : p))
    );
  }, []);

  const addInvoiceInCache = useCallback((invoice: ComprobanteItem) => {
    setInvoices((prev) => [invoice, ...prev]);
  }, []);

  // Real-time WebSocket event listener
  useEffect(() => {
    const unsubscribe = subscribeToSocket((msg: any) => {
      if (!msg || !msg.type) return;

      console.log('[SPA RealTime WSS Event]', msg.type, msg);

      switch (msg.type) {
        case 'TENANT_STATUS_CHANGED':
          setTenants((prev) =>
            prev.map((t) =>
              t.id === msg.tenant_id || t.tax_id === msg.tax_id
                ? { ...t, status: msg.status }
                : t
            )
          );
          refreshMetrics();
          break;

        case 'TENANT_UPDATED':
          setTenants((prev) =>
            prev.map((t) =>
              t.id === msg.tenant_id || t.tax_id === msg.tax_id
                ? {
                    ...t,
                    status: msg.status || t.status,
                    wallet_balance:
                      msg.wallet_balance !== undefined ? msg.wallet_balance : t.wallet_balance,
                  }
                : t
            )
          );
          break;

        case 'TENANT_CREATED':
          refreshTenants();
          refreshMetrics();
          break;

        case 'NEW_PAYMENT_REPORTED':
          if (msg.payment) {
            setPendingPayments((prev) => {
              if (prev.some((p) => p.id === msg.payment.id)) return prev;
              return [msg.payment, ...prev];
            });
            refreshMetrics();
          }
          break;

        case 'PAYMENT_APPROVED':
          setPendingPayments((prev) => prev.filter((p) => p.id !== msg.payment_id));
          if (msg.tenant_id) {
            setTenants((prev) =>
              prev.map((t) =>
                t.id === msg.tenant_id ? { ...t, status: 'active', wallet_balance: msg.wallet_balance ?? t.wallet_balance } : t
              )
            );
          }
          refreshPayments();
          refreshInvoices();
          refreshMetrics();
          break;

        case 'PAYMENT_REJECTED':
          setPendingPayments((prev) => prev.filter((p) => p.id !== msg.payment_id));
          refreshPayments();
          refreshMetrics();
          break;

        case 'EXCHANGE_RATE_UPDATED':
          setSettings((prev) =>
            prev ? { ...prev, usd_ves_rate: Number(msg.rate), updated_at: msg.timestamp } : prev
          );
          break;

        case 'INVOICE_ISSUED':
          refreshInvoices();
          break;

        case 'PAYMENT_METHODS_UPDATED':
          refreshSettings();
          break;

        case 'PLANS_UPDATED':
          refreshPlans();
          break;

        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    subscribeToSocket,
    refreshTenants,
    refreshPayments,
    refreshInvoices,
    refreshMetrics,
    refreshPlans,
    refreshSettings,
  ]);

  return (
    <AppDataContext.Provider
      value={{
        tenants,
        plans,
        pendingPayments,
        paymentHistory,
        settings,
        invoices,
        metrics,
        isPreloaded,
        preloadingProgress,
        preloadAll,
        refreshTenants,
        refreshPayments,
        refreshPlans,
        refreshSettings,
        refreshInvoices,
        refreshMetrics,
        updateTenantInCache,
        updatePaymentInCache,
        addInvoiceInCache,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
