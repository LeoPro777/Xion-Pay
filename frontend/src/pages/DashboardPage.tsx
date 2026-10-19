import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { usePreferences } from '../context/PreferencesContext';
import { useDialog } from '../context/DialogContext';
import { useNotifications } from '../context/NotificationContext';
import type { DashboardMetrics, PaymentReport, WebhookLogItem } from '../types';
import {
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Check,
  Eye,
  RefreshCw,
  ShieldCheck,
  Key,
  Copy,
  ExternalLink,
  Download,
  PieChart,
  Radio,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToReconciliation: () => void;
  onNavigateToTenants?: () => void;
  lastEventTimestamp: number;
}

interface RetentionSparklineProps {
  data: Array<{ month: string; retention: number; churn: number }>;
}

const RetentionSparkline: React.FC<RetentionSparklineProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const width = 340;
  const height = 150;
  const padTop = 16;
  const padBottom = 26;
  const padLeft = 34;
  const padRight = 14;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Truncated vertical scale: 90% to 100%
  const minY = 90;
  const maxY = 100;

  const points = data.map((d, i) => {
    const x = padLeft + (i / Math.max(data.length - 1, 1)) * plotW;
    const clampedVal = Math.max(minY, Math.min(maxY, d.retention));
    const y = padTop + ((maxY - clampedVal) / (maxY - minY)) * plotH;
    return { x, y, ...d };
  });

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpx1 = curr.x + (next.x - curr.x) / 2;
    const cpy1 = curr.y;
    const cpx2 = curr.x + (next.x - curr.x) / 2;
    const cpy2 = next.y;
    pathD += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${next.x} ${next.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`;
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
          {hoveredIndex !== null ? 'Detalle mensual:' : 'Registro más reciente:'}
        </span>
        <div className="inline-flex items-center gap-1.5 font-mono text-xs">
          <span className="font-semibold text-slate-700 dark:text-zinc-300">{hoveredPoint.month}:</span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{hoveredPoint.retention}%</span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">({hoveredPoint.churn}% churn)</span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[100, 95, 90].map((level) => {
            const y = padTop + ((maxY - level) / (maxY - minY)) * plotH;
            return (
              <g key={level}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-zinc-800"
                  strokeWidth="1"
                  strokeDasharray={level === 100 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[9px] font-mono fill-slate-400 dark:fill-zinc-500"
                >
                  {level}%
                </text>
              </g>
            );
          })}

          <path d={areaD} fill="url(#retentionGradient)" />
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hoveredIndex !== null && (
            <line
              x1={points[hoveredIndex].x}
              y1={padTop}
              x2={points[hoveredIndex].x}
              y2={padTop + plotH}
              stroke="currentColor"
              className="text-emerald-500/50"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          )}

          {points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <g key={p.month} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)}>
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? '5' : '3.5'}
                  className={`transition-all duration-150 ${
                    isHovered
                      ? 'fill-emerald-500 stroke-white dark:stroke-zinc-900 stroke-2'
                      : 'fill-white dark:fill-zinc-900 stroke-emerald-500 stroke-2'
                  }`}
                />
                <text
                  x={p.x}
                  y={padTop + plotH + 16}
                  textAnchor="middle"
                  className={`text-[10px] font-mono transition-colors ${
                    isHovered
                      ? 'fill-slate-900 dark:fill-white font-bold'
                      : 'fill-slate-400 dark:fill-zinc-500'
                  }`}
                >
                  {p.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800">
          <div className="text-[10px] text-slate-400 font-medium">Promedio</div>
          <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
            {(data.reduce((acc, curr) => acc + curr.retention, 0) / data.length).toFixed(1)}%
          </div>
        </div>
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800">
          <div className="text-[10px] text-slate-400 font-medium">Pico Máximo</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {Math.max(...data.map((d) => d.retention))}%
          </div>
        </div>
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800">
          <div className="text-[10px] text-slate-400 font-medium">Eje Truncado</div>
          <div className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5">
            90% - 100%
          </div>
        </div>
      </div>
    </div>
  );
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToReconciliation,
  onNavigateToTenants,
  lastEventTimestamp,
}) => {
  const { currency, setCurrency, bcvRate } = usePreferences();
  const { confirm, showAlert, showToast } = useDialog();
  const { addNotification } = useNotifications();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());

  // Live Activity Feed state
  const [recentPayments, setRecentPayments] = useState<PaymentReport[]>([]);
  const [recentWebhooks, setRecentWebhooks] = useState<WebhookLogItem[]>([]);
  const [feedLoading, setFeedLoading] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Analytics distribution view toggle
  const [revenueTab, setRevenueTab] = useState<'plan' | 'method'>('plan');

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get<DashboardMetrics>('/metrics/dashboard');
      setMetrics(res.data);
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeedData = useCallback(async () => {
    setFeedLoading(true);
    try {
      const [paymentsRes, webhooksRes] = await Promise.allSettled([
        api.get<PaymentReport[]>('/payments/inbox', { params: { status: 'all', limit: 8 } }),
        api.get<WebhookLogItem[]>('/webhooks/recent', { params: { limit: 8 } }),
      ]);

      if (paymentsRes.status === 'fulfilled') {
        setRecentPayments(paymentsRes.value.data);
      }
      if (webhooksRes.status === 'fulfilled') {
        setRecentWebhooks(webhooksRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching live feed data:', err);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchFeedData();
  }, [fetchMetrics, fetchFeedData, lastEventTimestamp]);

  const handleDismissAlert = (id: string) => {
    setDismissedAlertIds((prev) => new Set([...prev, id]));
  };

  const handleExtendTolerance = async (alertId: string, tenantId: string, tenantName?: string) => {
    const ok = await confirm({
      title: 'Extender Tolerancia Operativa',
      message: `¿Desea conceder 24 horas adicionales de tolerancia y regenerar automáticamente la licencia criptográfica para "${tenantName || 'este comercio'}"?\n\nAl confirmar, el sistema extenderá el periodo y reemitirá la firma RSA de contingencia.`,
      confirmText: 'Sí, extender tolerancia',
      variant: 'info',
    });
    if (!ok) return;

    try {
      await api.post(`/tenants/${tenantId}/courtesy-days`, {
        days: 1,
        reason: 'Prórroga de tolerancia aprobada desde Panel de Control',
      });
      showToast('Tolerancia extendida por 24 horas y licencia reemitida.', 'success');
      addNotification({
        type: 'success',
        message: `Licencia criptográfica reemitida con 24h de tolerancia para ${tenantName || 'el comercio'}.`,
        data: { tenant_id: tenantId },
      });
      setDismissedAlertIds((prev) => new Set([...prev, alertId]));
      fetchMetrics();
      fetchFeedData();
    } catch (err: any) {
      showToast(`Error al extender tolerancia: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleQuickReconcile = async (payment: PaymentReport) => {
    const ok = await confirm({
      title: 'Conciliar Pago en 1 Clic',
      message: `¿Confirmar conciliación para la referencia ${payment.reference_number} de ${payment.tenant_commercial_name || 'Comercio'} por ${payment.currency} ${payment.amount}?\n\nSe activará automáticamente su suscripción y se despachará el webhook correspondiente.`,
      confirmText: 'Conciliar Inmediatamente',
      variant: 'info',
    });
    if (!ok) return;

    try {
      await api.post(`/payments/${payment.id}/approve`);
      showToast(`Pago #${payment.reference_number} conciliado exitosamente.`, 'success');
      addNotification({
        type: 'payment',
        message: `Pago de ${payment.tenant_commercial_name || 'Comercio'} conciliado. Referencia: ${payment.reference_number}`,
        data: { payment_id: payment.id },
      });
      fetchMetrics();
      fetchFeedData();
    } catch (err: any) {
      showToast(`Error al conciliar pago: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleDownloadPdf = async (paymentId: string, referenceNumber: string) => {
    try {
      const res = await api.get(`/payments/${paymentId}/invoice-pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `comprobante-${referenceNumber || paymentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Comprobante PDF descargado exitosamente.', 'success');
    } catch (err: any) {
      showToast('Error al descargar comprobante PDF.', 'error');
    }
  };

  const handleCopyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    showToast(`Referencia ${ref} copiada al portapapeles.`, 'info');
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const handleViewPaymentDetail = (p: PaymentReport) => {
    showAlert(
      `Inquilino: ${p.tenant_commercial_name || 'N/A'}\nPlan: ${p.plan_name || 'Suscripción Activa'}\nBanco Origen: ${p.origin_bank || 'N/A'}\nCanal: ${p.payment_method_type || 'N/A'}\nMonto Original: ${p.amount} ${p.currency}\nEquivalente USD: $${p.amount_usd ?? 'N/A'}\nEquivalente VES: Bs. ${p.amount_ves ?? 'N/A'}\nEstado: ${p.status.toUpperCase()}\nFecha Reporte: ${new Date(p.reported_at).toLocaleString('es-VE')}`,
      `Auditoría de Pago #${p.reference_number}`,
      'info'
    );
  };

  const handleAuditCryptoKey = () => {
    if (!metrics?.crypto_health) return;
    const ch = metrics.crypto_health;
    showAlert(
      `Estado: ${ch.public_key_loaded ? 'ACTIVA Y VÁLIDA' : 'NO CARGADA'}\nAlgoritmo: ${ch.algorithm}\nHuella SHA-256:\n${ch.public_key_fingerprint}\n\nLicencias Activas: ${ch.active_licenses_count}\nEn Periodo de Tolerancia: ${ch.in_grace_period_count}\nPróximas a Expirar (<7d): ${ch.expiring_soon_count}\n\nLos tokens emitidos son validados sin conexión en terminales POS con la llave pública PEM.`,
      'Autoridad Certificadora & Llave Criptográfica',
      'info'
    );
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const hasPendingPayments = metrics.pending_audit_count > 0;
  const visibleAlerts = metrics.alerts.filter((a) => !dismissedAlertIds.has(a.id));
  const cryptoHealth = metrics.crypto_health;

  return (
    <div className="space-y-6">
      {/* Top Header with Currency Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight m-0">
            Panel de Control y Salud SaaS
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Supervisión financiera en tiempo real, ciclo de vida de inquilinos, auditoría de pagos y autoridad criptográfica.
          </p>
        </div>

        {/* Currency Switcher connected to global PreferencesContext */}
        <div className="inline-flex items-center bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs self-start">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 px-2">Moneda:</span>
          <button
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-all duration-200 cursor-pointer ${
              currency === 'USD'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            USD ($)
          </button>
          <button
            onClick={() => setCurrency('VES')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-all duration-200 cursor-pointer ${
              currency === 'VES'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
            }`}
          >
            Bolívares (Bs)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              MRR Normalizado
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3 font-mono tracking-tight tabular-nums flex items-baseline gap-1">
            <span className="text-sm font-semibold text-slate-400 dark:text-zinc-500 w-6 shrink-0 transition-opacity">
              {currency === 'USD' ? '$' : 'Bs.'}
            </span>
            <span key={currency} className="transition-all duration-200 animate-in fade-in">
              {currency === 'USD'
                ? metrics.mrr_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : metrics.mrr_ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center mt-2 space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ingresos recurrentes suscritos</span>
          </div>
        </div>

        {/* Comercios Activos */}
        <div className="bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Comercios Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2 mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {metrics.tenant_counts.active}
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
              de {metrics.tenant_counts.total} totales registrados
            </span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-2 font-normal flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
            <span>{metrics.tenant_counts.trial} en prueba</span>
            <span className="text-slate-300 dark:text-zinc-700">·</span>
            <span>{metrics.tenant_counts.suspended} suspendidos</span>
          </div>
        </div>

        {/* Tasa de Retención */}
        <div className="bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Tasa de Retención
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-3 font-mono tracking-tight">
            {metrics.retention_rate_pct}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2 font-medium">
            Churn mensual: <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">{metrics.churn_rate_pct}%</span>
          </div>
        </div>

        {/* Pagos Pendientes Auditoria */}
        <div
          className={`rounded-2xl p-5 relative overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md ${
            hasPendingPayments
              ? 'bg-amber-50/30 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/80'
              : 'bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                hasPendingPayments
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              Pagos por Conciliar
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                hasPendingPayments
                  ? 'bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-extrabold mt-3 font-mono tracking-tight ${
              hasPendingPayments
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {metrics.pending_audit_count}
          </div>

          {hasPendingPayments ? (
            <button
              onClick={onNavigateToReconciliation}
              className="text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-bold flex items-center space-x-1 mt-2 transition-colors cursor-pointer"
            >
              <span>Ir a bandeja de 1 clic</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1 mt-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Al día · Sin pagos pendientes</span>
            </div>
          )}
        </div>
      </div>

      {/* Cryptographic Licensing Authority & Health Card */}
      {cryptoHealth && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                  <Key className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold tracking-tight text-white m-0">
                  Autoridad Certificadora & Salud Criptográfica
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono uppercase tracking-wider ${
                    cryptoHealth.public_key_loaded
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cryptoHealth.public_key_loaded ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  {cryptoHealth.public_key_loaded ? 'RSA-2048 ACTIVA' : 'LLAVE NO DISPONIBLE'}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 leading-relaxed font-sans">
                Emisión criptográfica asimétrica para validación offline en terminales POS. Huella de llave pública:
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-indigo-300 w-fit">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[280px] sm:max-w-md">{cryptoHealth.public_key_fingerprint}</span>
                <button
                  onClick={() => handleCopyRef(cryptoHealth.public_key_fingerprint)}
                  className="hover:text-white transition-colors cursor-pointer text-indigo-400"
                  title="Copiar huella SHA-256"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Badges & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-center min-w-[90px]">
                <div className="text-[10px] text-indigo-200 uppercase font-semibold">Licencias Activas</div>
                <div className="text-base font-extrabold font-mono text-emerald-400 mt-0.5">
                  {cryptoHealth.active_licenses_count}
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-center min-w-[90px]">
                <div className="text-[10px] text-amber-200 uppercase font-semibold">En Tolerancia</div>
                <div className="text-base font-extrabold font-mono text-amber-400 mt-0.5">
                  {cryptoHealth.in_grace_period_count}
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-center min-w-[90px]">
                <div className="text-[10px] text-rose-200 uppercase font-semibold">Por Expirar &lt;7d</div>
                <div className="text-base font-extrabold font-mono text-rose-400 mt-0.5">
                  {cryptoHealth.expiring_soon_count}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                <button
                  onClick={handleAuditCryptoKey}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Auditar Llave PEM</span>
                </button>
                {onNavigateToTenants && (
                  <button
                    onClick={onNavigateToTenants}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-100 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver Inquilinos</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Alertas Operativas & Retention History with balanced heights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Urgent Alerts Feed (Left 2 columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                  Alertas Operativas de Misión Crítica
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                {visibleAlerts.length} eventos activos
              </span>
            </div>


            {/* Alerts list */}
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 mt-2 max-h-[340px] overflow-y-auto pr-1">
              {visibleAlerts.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                  <p className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                    Todo el ecosistema se encuentra al día
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                    No hay alertas pendientes que requieran intervención inmediata.
                  </p>
                </div>
              ) : (
                visibleAlerts.map((alertItem) => (
                  <div
                    key={alertItem.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          alertItem.severity === 'danger'
                            ? 'bg-rose-500'
                            : alertItem.severity === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div>
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200 m-0">
                          {alertItem.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                          {alertItem.description}
                        </p>
                      </div>
                    </div>

                    {/* Integrated Quick Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {alertItem.type === 'pending_payment' && (
                        <button
                          onClick={onNavigateToReconciliation}
                          className="text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Ver comprobante y conciliar pago"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Conciliar</span>
                        </button>
                      )}

                      {alertItem.type === 'expiring_soon' && (
                        <button
                          onClick={() => handleExtendTolerance(alertItem.id, alertItem.target_id, alertItem.title)}
                          className="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Extender 24h adicionales de tolerancia y reemitir licencia"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Extender tolerancia</span>
                        </button>
                      )}

                      {alertItem.type === 'in_grace_period' && (
                        <button
                          onClick={() => handleExtendTolerance(alertItem.id, alertItem.target_id, alertItem.title)}
                          className="text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Extender 24h adicionales de tolerancia y reemitir licencia"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Extender tolerancia</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDismissAlert(alertItem.id)}
                        className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Ignorar alerta temporalmente"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer status bar */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
            <span>Resolución de contingencias en 1 clic</span>
            {dismissedAlertIds.size > 0 && (
              <button
                onClick={() => setDismissedAlertIds(new Set())}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Restaurar {dismissedAlertIds.size} ignorada(s)</span>
              </button>
            )}
          </div>
        </div>

        {/* Monthly Retention History (Right column) */}
        <div className="bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white m-0">Historial de Retención</h2>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">Últimos 6 meses</span>
            </div>

            <div className="mt-4">
              <RetentionSparkline data={metrics.monthly_retention_history} />
            </div>
          </div>

          <div className="pt-3 text-[11px] text-slate-400 dark:text-zinc-500 text-center font-medium">
            Tendencia de fidelización y tasa de renovación
          </div>
        </div>
      </div>

      {/* Secondary Row: Feed en Vivo (Left 2 cols) & Revenue Breakdown by Plan/Method (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Feed en Vivo: Últimas Conciliaciones y Webhooks */}
        <div className="lg:col-span-2 bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-emerald-500 shrink-0 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                  Feed en Vivo: Últimas Conciliaciones y Despacho de Webhooks
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchFeedData}
                  disabled={feedLoading}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Refrescar feed en vivo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${feedLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onNavigateToReconciliation}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Bandeja completa</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Table Feed Content */}
            <div className="overflow-x-auto mt-3">
              {recentPayments.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                  No hay pagos reportados recientemente en la bandeja.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-zinc-800/80 text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">
                      <th className="pb-2 pl-2">Fecha/Hora</th>
                      <th className="pb-2">Inquilino & Plan</th>
                      <th className="pb-2">Método</th>
                      <th className="pb-2">Referencia</th>
                      <th className="pb-2">Monto</th>
                      <th className="pb-2">Estado / Webhook</th>
                      <th className="pb-2 text-right pr-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                    {recentPayments.map((p) => {
                      const isPending = p.status === 'pending';
                      const isApproved = p.status === 'approved';

                      // Find matching webhook status for this payment if available
                      const matchingWebhook = recentWebhooks.find(
                        (w) => w.tenant_id === p.tenant_id || w.payload?.payment_id === p.id
                      );

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/40 transition-colors"
                        >
                          {/* Date/Time */}
                          <td className="py-2.5 pl-2 text-slate-600 dark:text-zinc-400 whitespace-nowrap text-[11px] font-mono">
                            {new Date(p.reported_at).toLocaleDateString('es-VE', {
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Tenant & Plan Badge */}
                          <td className="py-2.5">
                            <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[150px]">
                              {p.tenant_commercial_name || 'Comercio'}
                            </div>
                            <div className="inline-block mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                                {p.plan_name || 'Plan Estándar'}
                              </span>
                            </div>
                          </td>

                          {/* Method / Channel */}
                          <td className="py-2.5 whitespace-nowrap">
                            <span className="font-medium text-slate-700 dark:text-zinc-300">
                              {p.payment_method_type || p.origin_bank || 'Pago Móvil'}
                            </span>
                            <div className="text-[10px] text-slate-400 truncate max-w-[100px]">
                              {p.origin_bank}
                            </div>
                          </td>

                          {/* Reference with 1-click copy */}
                          <td className="py-2.5 font-mono">
                            <button
                              onClick={() => handleCopyRef(p.reference_number)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                              title="Copiar referencia"
                            >
                              <span>{p.reference_number}</span>
                              {copiedRef === p.reference_number ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400 opacity-60" />
                              )}
                            </button>
                          </td>

                          {/* Dual Amount (USD / VES) */}
                          <td className="py-2.5 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900 dark:text-white">
                              {currency === 'USD'
                                ? `$${(p.amount_usd ?? (p.currency === 'USD' ? p.amount : p.amount / (bcvRate || 36.5))).toFixed(2)}`
                                : `Bs. ${(p.amount_ves ?? (p.currency === 'VES' ? p.amount : p.amount * (bcvRate || 36.5))).toFixed(2)}`}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {currency === 'USD'
                                ? `Bs. ${(p.amount_ves ?? (p.currency === 'VES' ? p.amount : p.amount * (bcvRate || 36.5))).toFixed(2)}`
                                : `$${(p.amount_usd ?? (p.currency === 'USD' ? p.amount : p.amount / (bcvRate || 36.5))).toFixed(2)}`}
                            </div>
                          </td>

                          {/* Status & Webhook delivery */}
                          <td className="py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  isApproved
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : isPending
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                }`}
                              >
                                {isApproved ? 'Conciliado' : isPending ? 'Pendiente' : 'Rechazado'}
                              </span>

                              {/* Webhook Dispatch Tag */}
                              {matchingWebhook ? (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                    matchingWebhook.response_code && matchingWebhook.response_code >= 200 && matchingWebhook.response_code < 300
                                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                  }`}
                                  title={`Webhook HTTP ${matchingWebhook.response_code || 'En cola'}`}
                                >
                                  WH:{matchingWebhook.response_code || 'OK'}
                                </span>
                              ) : isApproved ? (
                                <span className="text-[9px] text-slate-400 font-mono">WH:OK</span>
                              ) : null}
                            </div>
                          </td>

                          {/* Quick Actions */}
                          <td className="py-2.5 text-right pr-2 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {isPending && (
                                <button
                                  onClick={() => handleQuickReconcile(p)}
                                  className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
                                  title="Conciliar en 1 Clic"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isApproved && (
                                <button
                                  onClick={() => handleDownloadPdf(p.id, p.reference_number)}
                                  className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                  title="Descargar Comprobante PDF"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleViewPaymentDetail(p)}
                                className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                title="Ver Auditoría"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
            <span>Sincronizado con despachador de webhooks y pasarela bancaria</span>
            <span className="font-mono">Mostrando últimos {recentPayments.length} registros</span>
          </div>
        </div>

        {/* Revenue Distribution Breakdown by Plan or Method (Right column) */}
        <div className="bg-white dark:bg-[#121215] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                  Desglose de Ingresos
                </h2>
              </div>

              {/* View Selector Tabs */}
              <div className="inline-flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px]">
                <button
                  onClick={() => setRevenueTab('plan')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                    revenueTab === 'plan'
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Por Plan
                </button>
                <button
                  onClick={() => setRevenueTab('method')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                    revenueTab === 'method'
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Por Canal
                </button>
              </div>
            </div>

            {/* Breakdown Content */}
            <div className="mt-4 space-y-3.5">
              {revenueTab === 'plan' ? (
                metrics.revenue_by_plan && metrics.revenue_by_plan.length > 0 ? (
                  metrics.revenue_by_plan.map((item, idx) => {
                    const colors = [
                      'from-blue-500 to-indigo-600',
                      'from-emerald-500 to-teal-600',
                      'from-purple-500 to-pink-600',
                      'from-amber-500 to-orange-600',
                    ];
                    const grad = colors[idx % colors.length];

                    const displayAmount =
                      currency === 'USD'
                        ? `$${item.revenue_usd.toFixed(2)}`
                        : `Bs. ${(item.revenue_usd * (bcvRate || 36.5)).toFixed(2)}`;

                    return (
                      <div key={item.plan_code || item.plan_name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">
                            {item.plan_name}
                            <span className="ml-1.5 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                              ({item.count} com.)
                            </span>
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {displayAmount}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`}
                            style={{ width: `${Math.max(item.percentage, 4)}%` }}
                          />
                        </div>
                        <div className="text-right text-[10px] text-slate-400 font-mono">
                          {item.percentage}% del total
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Sin suscripciones activas registradas.
                  </div>
                )
              ) : metrics.revenue_by_method && metrics.revenue_by_method.length > 0 ? (
                metrics.revenue_by_method.map((item, idx) => {
                  const colors = [
                    'from-emerald-500 to-teal-500',
                    'from-blue-500 to-cyan-500',
                    'from-amber-500 to-yellow-500',
                    'from-purple-500 to-violet-500',
                  ];
                  const grad = colors[idx % colors.length];

                  const displayAmount =
                    currency === 'USD'
                      ? `$${item.amount_usd.toFixed(2)}`
                      : `Bs. ${(item.amount_usd * (bcvRate || 36.5)).toFixed(2)}`;

                  return (
                    <div key={item.method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {item.method}
                          <span className="ml-1.5 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                            ({item.count} ops)
                          </span>
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {displayAmount}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden flex items-center">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`}
                          style={{ width: `${Math.max(item.percentage, 4)}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-mono">
                        {item.percentage}% del volumen
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Sin operaciones de pago aprobadas.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400 dark:text-zinc-500 text-center font-medium">
            Agrupación financiera en tiempo real
          </div>
        </div>
      </div>
    </div>
  );
};
