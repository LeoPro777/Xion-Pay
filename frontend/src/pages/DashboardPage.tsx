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
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateToReconciliation: () => void;
  lastEventTimestamp: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToReconciliation,
  lastEventTimestamp,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');

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

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const displayedMrr =
    currency === 'USD'
      ? `$${metrics.mrr_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : `Bs. ${metrics.mrr_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Top Header with Currency Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight m-0">
            Panel de Control y Salud SaaS
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervisión financiera en tiempo real, ciclo de vida de inquilinos y auditoría de pagos.
          </p>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center space-x-2 bg-white border border-slate-200/80 p-1 rounded-xl self-start shadow-xs">
          <span className="text-[11px] text-slate-500 px-2 font-medium">Moneda:</span>
          <button
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              currency === 'USD'
                ? 'bg-[#18181b] text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            USD ($)
          </button>
          <button
            onClick={() => setCurrency('VES')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              currency === 'VES'
                ? 'bg-[#18181b] text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bolívares (Bs)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              MRR Normalizado
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-3 font-mono tracking-tight">
            {displayedMrr}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium flex items-center mt-2 space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ingresos recurrentes suscritos</span>
          </div>
        </div>

        {/* Clientes Activos */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Comercios Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-3 font-mono tracking-tight">
            {metrics.tenant_counts.active}{' '}
            <span className="text-xs text-slate-400 font-normal">
              / {metrics.tenant_counts.total} totales
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 font-medium">
            {metrics.tenant_counts.trial} en prueba · {metrics.tenant_counts.suspended} suspendidos
          </div>
        </div>

        {/* Tasa de Retención */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tasa de Retención
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-3 font-mono tracking-tight">
            {metrics.retention_rate_pct}%
          </div>
          <div className="text-[11px] text-slate-500 mt-2 font-medium">
            Churn mensual: <span className="text-rose-600 font-mono font-bold">{metrics.churn_rate_pct}%</span>
          </div>
        </div>

        {/* Pagos Pendientes Auditoria */}
        <div className="bg-white border border-amber-200 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Pagos por Conciliar
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-3 font-mono tracking-tight">
            {metrics.pending_audit_count}
          </div>
          <button
            onClick={onNavigateToReconciliation}
            className="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center space-x-1 mt-2 transition-colors cursor-pointer"
          >
            <span>Ir a bandeja de 1 clic</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Grid: Alertas Operativas & Retention History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Alerts Feed (Left 2 columns) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 m-0">
                Alertas Operativas de Misión Crítica
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {metrics.alerts.length} eventos prioritarios
            </span>
          </div>

          <div className="divide-y divide-slate-100 mt-3">
            {metrics.alerts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Todo el ecosistema se encuentra al día. No hay alertas pendientes.
              </p>
            ) : (
              metrics.alerts.map((alert) => (
                <div key={alert.id} className="py-3 flex items-start justify-between gap-4">
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
                      <h4 className="text-xs font-semibold text-slate-800">{alert.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                  {alert.type === 'pending_payment' && (
                    <button
                      onClick={onNavigateToReconciliation}
                      className="shrink-0 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full font-bold transition-colors cursor-pointer"
                    >
                      Conciliar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Monthly Retention History (Right column) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 m-0">Historial de Retención</h2>
            <span className="text-[10px] text-slate-400 font-mono">Últimos 6 meses</span>
          </div>

          <div className="mt-4 space-y-3">
            {metrics.monthly_retention_history.map((item) => (
              <div key={item.month} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-medium">{item.month}</span>
                  <span className="text-slate-900 font-bold font-mono">{item.retention}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-900 h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.retention}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

