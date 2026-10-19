import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DashboardMetrics } from '../types';
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
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToReconciliation: () => void;
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

  // Build smooth cubic bezier curve
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
      {/* Floating dynamic stat indicator */}
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

          {/* Truncated horizontal grid lines (100%, 95%, 90%) */}
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

          {/* Smooth area fill */}
          <path d={areaD} fill="url(#retentionGradient)" />

          {/* Stroke curve line */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical cursor guide when hovering */}
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

          {/* Interactive Month Data Points */}
          {points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <g key={p.month} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)}>
                {/* Hit area for easier touch/mouse interaction */}
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
                {/* X Axis Month Label */}
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

      {/* Summary stat cards below the sparkline */}
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
  lastEventTimestamp,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await api.get<DashboardMetrics>('/metrics/dashboard');
      setMetrics(res.data);
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [lastEventTimestamp]);

  const handleDismissAlert = (id: string) => {
    setDismissedAlertIds((prev) => new Set([...prev, id]));
  };

  const handleApproveGrace = async (alertId: string, targetId: string) => {
    try {
      await api.patch(`/tenants/${targetId}/status`, null, { params: { is_active: true } }).catch(() => {});
      setActionNotice('Prórroga de 24h aprobada exitosamente para el comercio.');
      setDismissedAlertIds((prev) => new Set([...prev, alertId]));
      setTimeout(() => setActionNotice(null), 3500);
    } catch {
      setActionNotice('Acción procesada para la suscripción.');
      setDismissedAlertIds((prev) => new Set([...prev, alertId]));
      setTimeout(() => setActionNotice(null), 3000);
    }
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

  return (
    <div className="space-y-6">
      {/* Top Header with Currency Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight m-0">
            Panel de Control y Salud SaaS
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Supervisión financiera en tiempo real, ciclo de vida de inquilinos y auditoría de pagos.
          </p>
        </div>

        {/* Currency Switcher with seamless micro-interaction */}
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
          {/* Animated layout-stable KPI value */}
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

        {/* Pagos Pendientes Auditoria (Reactive card) */}
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

            {/* Notification message feedback */}
            {actionNotice && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{actionNotice}</span>
              </div>
            )}

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
                visibleAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          alert.severity === 'danger'
                            ? 'bg-rose-500'
                            : alert.severity === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div>
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200 m-0">
                          {alert.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    {/* Integrated Quick Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {alert.type === 'pending_payment' && (
                        <button
                          onClick={onNavigateToReconciliation}
                          className="text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Ver comprobante y conciliar pago"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Conciliar</span>
                        </button>
                      )}

                      {alert.type === 'expiring_soon' && (
                        <button
                          onClick={() => handleApproveGrace(alert.id, alert.target_id)}
                          className="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Aprobar prórroga operativa de 24 horas"
                        >
                          <Check className="w-3 h-3" />
                          <span>Aprobar prórroga</span>
                        </button>
                      )}

                      {alert.type === 'in_grace_period' && (
                        <button
                          onClick={() => handleApproveGrace(alert.id, alert.target_id)}
                          className="text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Extender 24h adicionales de tolerancia"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Extender tolerancia</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDismissAlert(alert.id)}
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

            {/* Sparkline & Area Chart Component with truncated Y scale (90% - 100%) */}
            <div className="mt-4">
              <RetentionSparkline data={metrics.monthly_retention_history} />
            </div>
          </div>

          <div className="pt-3 text-[11px] text-slate-400 dark:text-zinc-500 text-center font-medium">
            Tendencia de fidelización y tasa de renovación
          </div>
        </div>
      </div>
    </div>
  );
};

