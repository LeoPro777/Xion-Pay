import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { usePreferences } from '../context/PreferencesContext';
import { useDialog } from '../context/DialogContext';
import { useAppData } from '../context/AppDataContext';
import type { ComprobanteItem } from '../types';
import {
  X,
  Receipt,
  Search,
  RefreshCw,
  Printer,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Coins,
  CreditCard,
  Landmark,
  Eye,
  FileCheck,
  Calendar,
  Layers,
  Check,
  Sparkles,
  Filter,
} from 'lucide-react';

interface InvoicesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTenant?: (tenantId: string) => void;
}

export const InvoicesManagementModal: React.FC<InvoicesManagementModalProps> = ({
  isOpen,
  onClose,
  onOpenTenant,
}) => {
  const { bcvRate } = usePreferences();
  const { showToast } = useDialog();
  const { invoices: preloadedInvoices, refreshInvoices } = useAppData();

  const [invoices, setInvoices] = useState<ComprobanteItem[]>(preloadedInvoices || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<ComprobanteItem | null>(null);

  // Sync with preloaded invoices when filters are clean
  useEffect(() => {
    if (preloadedInvoices && preloadedInvoices.length > 0 && !search && filterType === 'all' && filterStatus === 'all') {
      setInvoices(preloadedInvoices);
    }
  }, [preloadedInvoices, search, filterType, filterStatus]);

  // Fetch / filter invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenants/comprobantes/all', {
        params: {
          search: search.trim() || undefined,
          tipo: filterType !== 'all' ? filterType : undefined,
          estado: filterStatus !== 'all' ? filterStatus : undefined,
          limit: 200,
        },
      });
      setInvoices(res.data || []);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      showToast(err.response?.data?.message || 'Error cargando facturas del sistema', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus, showToast]);

  useEffect(() => {
    if (isOpen) {
      fetchInvoices();
      refreshInvoices();
    }
  }, [isOpen, fetchInvoices, refreshInvoices]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalUsd = 0;
    let totalVes = 0;
    let paidCount = 0;

    invoices.forEach((inv) => {
      totalUsd += Number(inv.monto_usd || 0);
      totalVes += Number(inv.total_ves || 0);
      if (inv.estado === 'PAGADO') paidCount++;
    });

    return {
      count: invoices.length,
      paidCount,
      totalUsd,
      totalVes,
    };
  }, [invoices]);

  // Printable ticket print handler
  const handlePrint = () => {
    window.print();
  };

  const handleResetFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterStatus('all');
    if (preloadedInvoices && preloadedInvoices.length > 0) {
      setInvoices(preloadedInvoices);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-7xl h-full sm:h-[95vh] bg-white dark:bg-[#121215] border-0 sm:border border-slate-200 dark:border-zinc-800 rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/70">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl shadow-xs shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-zinc-100 truncate">
                  Gestión Completa de Facturas & Comprobantes Inmutables
                </h2>
                <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                  Auditoría Inalterable
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                Emisión 100% automatizada al renovar planes o conciliar pagos • Tasa oficial BCV y sellado multimoneda.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              type="button"
              onClick={fetchInvoices}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Recargar facturas"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* AUTOMATION NOTICE BANNER */}
        <div className="px-4 sm:px-6 py-2 bg-purple-50/60 dark:bg-purple-950/25 border-b border-purple-100 dark:border-purple-900/30 flex items-center justify-between text-xs text-purple-900 dark:text-purple-300">
          <div className="flex items-center space-x-2 truncate">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="font-medium truncate text-[11px] sm:text-xs">
              <strong className="font-semibold">Emisión Automática:</strong> Las facturas y recibos son generados de forma automática cada vez que se aprueba un pago o se renueva la suscripción de un plan.
            </span>
          </div>
          <span className="hidden md:inline-flex text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-200/60 dark:bg-purple-900/50">
            RS256 Verified
          </span>
        </div>

        {/* SUMMARY STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 p-3 sm:p-4 bg-slate-100/50 dark:bg-zinc-900/30 border-b border-slate-200 dark:border-zinc-800 text-xs shrink-0">
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
              <span>Total Comprobantes</span>
              <Layers className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">
              {stats.count}{' '}
              <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                ({stats.paidCount} pagados)
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
              <span>Recaudación USD</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
              ${stats.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
              <span>Liquidación Bolívares</span>
              <Coins className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono truncate" title={`Bs. ${stats.totalVes.toFixed(2)}`}>
              Bs. {stats.totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
              <span>Tasa BCV del Día</span>
              <Landmark className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
              Bs. {(bcvRate || 36.5).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ USD</span>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white dark:bg-[#121215] shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por N° comprobante, RIF, cliente o referencia bancaria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-2 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden"
              >
                <option value="all">Todos los Tipos</option>
                <option value="RECIBO_COBRO">Recibo de Cobro</option>
                <option value="FACTURA_FISCAL">Factura Fiscal (SENIAT)</option>
                <option value="PROFORMA">Proforma</option>
              </select>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden"
            >
              <option value="all">Todos los Estados</option>
              <option value="PAGADO">Pagado</option>
              <option value="EMITIDO">Emitido</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>

            {(search || filterType !== 'all' || filterStatus !== 'all') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-xs transition-colors cursor-pointer"
                title="Limpiar filtros"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* INVOICES CONTENT LIST (RESPONSIVE TABLE + MOBILE CARDS) */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-xs text-slate-500 dark:text-zinc-400">Cargando facturas y comprobantes...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-4 bg-slate-100 dark:bg-zinc-900 text-slate-400 rounded-2xl mb-3">
                <Receipt className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                No se encontraron facturas o comprobantes
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mt-1">
                Los comprobantes se emiten automáticamente cada vez que se concilia o renueva un plan de suscripción en el sistema.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW (md+) */}
              <div className="hidden md:block">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50/80 dark:bg-zinc-900/60 sticky top-0 border-b border-slate-200 dark:border-zinc-800 z-10 text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">N° Factura / Control</th>
                      <th className="py-3 px-4">Cliente / RIF</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4 text-right">Tasa Oficial</th>
                      <th className="py-3 px-4 text-right">Monto (USD / Bs.)</th>
                      <th className="py-3 px-4">Cómo se Pagó</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {invoices.map((inv) => {
                      const snap = inv.datos_fiscales_snapshot || {};
                      const clientName = inv.commercial_name || snap.commercial_name || snap.nombre_comercial || 'Comercio General';
                      const taxId = inv.tax_id || snap.tax_id || snap.rif || 'Sin RIF';
                      const paymentMethod = inv.payment_method || snap.metodo_pago || 'Bancario / Transferencia';
                      const originBank = inv.origin_bank || snap.banco_origen;
                      const reference = inv.reference_number || snap.referencia;

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          {/* COMPROBANTE & TIPO */}
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                              {inv.numero_comprobante}
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded-md text-[9px] font-semibold uppercase ${
                                  inv.tipo_documento === 'FACTURA_FISCAL'
                                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                                }`}
                              >
                                {inv.tipo_documento === 'FACTURA_FISCAL' ? 'Factura Fiscal' : 'Recibo'}
                              </span>
                              {inv.numero_control && (
                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]" title={inv.numero_control}>
                                  Ctrl: {inv.numero_control}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* CLIENTE & RIF */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div
                              className="font-semibold text-slate-900 dark:text-zinc-200 truncate cursor-pointer hover:underline"
                              title={clientName}
                              onClick={() => onOpenTenant && onOpenTenant(inv.tenant_id)}
                            >
                              {clientName}
                            </div>
                            <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                              {taxId}
                            </div>
                          </td>

                          {/* FECHA */}
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{new Date(inv.created_at).toLocaleDateString('es-VE')}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(inv.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>

                          {/* TASA BCV */}
                          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                            <div className="font-semibold text-slate-800 dark:text-zinc-200">
                              Bs. {Number(inv.tasa_bcv || 0).toFixed(2)}
                            </div>
                            <span className="text-[10px] text-slate-400">BCV Oficial</span>
                          </td>

                          {/* MONTOS */}
                          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                              ${Number(inv.monto_usd || 0).toFixed(2)}
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Bs. {Number(inv.total_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* CÓMO SE PAGÓ */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="flex items-center space-x-1 text-slate-800 dark:text-zinc-200 font-medium capitalize truncate">
                              <CreditCard className="w-3 h-3 text-purple-500 shrink-0" />
                              <span className="truncate">{paymentMethod.replace('_', ' ')}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                              {originBank ? `${originBank}` : 'Coordenadas Directas'}
                              {reference && (
                                <span className="block font-mono text-slate-400">Ref: {reference}</span>
                              )}
                            </div>
                          </td>

                          {/* ESTADO */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                inv.estado === 'PAGADO'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{inv.estado}</span>
                            </span>
                            <div className="text-[9px] text-slate-400 uppercase tracking-tighter mt-0.5">
                              Inmutable
                            </div>
                          </td>

                          {/* ACCIONES */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                              title="Ver factura oficial e imprimir ticket"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Ticket</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS VIEW (< md) */}
              <div className="block md:hidden p-3 space-y-3">
                {invoices.map((inv) => {
                  const snap = inv.datos_fiscales_snapshot || {};
                  const clientName = inv.commercial_name || snap.commercial_name || snap.nombre_comercial || 'Comercio General';
                  const taxId = inv.tax_id || snap.tax_id || snap.rif || 'Sin RIF';
                  const paymentMethod = inv.payment_method || snap.metodo_pago || 'Bancario / Transferencia';
                  const originBank = inv.origin_bank || snap.banco_origen;
                  const reference = inv.reference_number || snap.referencia;

                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-2.5 active:bg-slate-50 dark:active:bg-zinc-850 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-mono font-bold text-xs text-slate-900 dark:text-zinc-100">
                            {inv.numero_comprobante}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded-md text-[9px] font-semibold uppercase mt-0.5 ${
                              inv.tipo_documento === 'FACTURA_FISCAL'
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                            }`}
                          >
                            {inv.tipo_documento === 'FACTURA_FISCAL' ? 'Factura Fiscal' : 'Recibo'}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.estado === 'PAGADO'
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{inv.estado}</span>
                        </span>
                      </div>

                      <div className="border-t border-slate-100 dark:border-zinc-800 pt-2 flex justify-between items-baseline">
                        <div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-zinc-200 truncate max-w-[190px]">
                            {clientName}
                          </div>
                          <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                            {taxId}
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                            ${Number(inv.monto_usd || 0).toFixed(2)}
                          </div>
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            Bs. {Number(inv.total_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-zinc-850 p-2 rounded-lg text-[10px] text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                        <div className="flex items-center space-x-1 truncate max-w-[200px]">
                          <CreditCard className="w-3 h-3 text-purple-500 shrink-0" />
                          <span className="truncate capitalize">
                            {paymentMethod.replace('_', ' ')} {originBank ? `• ${originBank}` : ''} {reference ? `• Ref: ${reference}` : ''}
                          </span>
                        </div>
                        <span className="font-mono text-slate-500 shrink-0">
                          Tasa: {Number(inv.tasa_bcv || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/70 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 shrink-0">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-purple-500 shrink-0" />
            <span className="text-[11px] sm:text-xs truncate">
              Registros fiscales sellados en base de datos. Ningún monto o tasa emitida puede alterarse.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold cursor-pointer transition-colors shrink-0"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETALLE IMPRIMIBLE: TICKET OFICIAL SENIAT / COMPROBANTE INMUTABLE */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in zoom-in-95 duration-150">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#121215] text-slate-900 dark:text-zinc-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0">
            
            {/* Header Controls (Hidden in Print) */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 print:hidden">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <Receipt className="w-4 h-4 text-purple-500" />
                <span className="truncate">Vista Oficial de Factura / Ticket Inmutable</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE TICKET BODY */}
            <div className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 text-xs font-sans print:p-4 print:text-black">
              {/* Top Banner / SENIAT & Company Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-purple-600 dark:text-purple-400 uppercase">
                    XION-PAY SAAS TECHNOLOGIES C.A.
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    RIF: J-50123456-7 • NIT: 029384920
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Av. Principal Empresarial, Torre Xion, Piso 12. Caracas, Venezuela.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Soporte: pagos@xionpay.com • Licenciamiento en Tiempo Real
                  </p>
                </div>

                <div className="sm:text-right border-l-2 sm:border-l-0 sm:border-r-2 border-purple-500 pl-3 sm:pl-0 sm:pr-3">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    {selectedInvoice.tipo_documento === 'FACTURA_FISCAL' ? 'FACTURA FISCAL SENIAT' : 'COMPROBANTE DE PAGO INMUTABLE'}
                  </div>
                  <div className="text-base font-black font-mono text-slate-900 dark:text-zinc-100">
                    {selectedInvoice.numero_comprobante}
                  </div>
                  {selectedInvoice.numero_control && (
                    <div className="text-xs font-mono text-purple-600 dark:text-purple-400 font-semibold">
                      N° CONTROL: {selectedInvoice.numero_control}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1">
                    Fecha de Emisión: {new Date(selectedInvoice.created_at).toLocaleString('es-VE')}
                  </div>
                </div>
              </div>

              {/* CLIENT DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/80">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Datos del Cliente / Adquiriente</div>
                  <div className="font-bold text-sm text-slate-900 dark:text-zinc-100 mt-0.5">
                    {selectedInvoice.commercial_name || selectedInvoice.datos_fiscales_snapshot?.commercial_name || selectedInvoice.datos_fiscales_snapshot?.nombre_comercial || 'Comercio Registrado'}
                  </div>
                  <div className="font-mono text-purple-600 dark:text-purple-400 font-semibold mt-0.5">
                    RIF / Doc: {selectedInvoice.tax_id || selectedInvoice.datos_fiscales_snapshot?.tax_id || selectedInvoice.datos_fiscales_snapshot?.rif || 'N/A'}
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Parámetros Cambiarios Oficiales</div>
                  <div className="mt-0.5 font-bold font-mono text-slate-800 dark:text-zinc-200">
                    Tasa Oficial BCV: Bs. {Number(selectedInvoice.tasa_bcv || 0).toFixed(4)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Moneda Base Operativa: {selectedInvoice.moneda_base} ($ USD)
                  </div>
                  <div className="inline-flex items-center space-x-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    <Check className="w-3 h-3" />
                    <span>ESTADO: {selectedInvoice.estado}</span>
                  </div>
                </div>
              </div>

              {/* CONCEPTO & DESGLOSE TRIBUTARIO */}
              <div>
                <table className="w-full text-left border-collapse border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 dark:bg-zinc-900 text-[10px] uppercase font-bold text-slate-600 dark:text-zinc-400">
                    <tr>
                      <th className="py-2 px-3">Descripción / Concepto</th>
                      <th className="py-2 px-3 text-right">Monto USD</th>
                      <th className="py-2 px-3 text-right">Base Imponible (Bs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                    <tr>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-zinc-100 font-sans">
                          {selectedInvoice.datos_fiscales_snapshot?.concepto || selectedInvoice.datos_fiscales_snapshot?.plan_name || 'Licenciamiento Sistema Xion-Manager & Xion-Pay'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          Emisión de Token Criptográfico RS256 con período renovado.
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-zinc-100">
                        ${Number(selectedInvoice.monto_usd || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-800 dark:text-zinc-200">
                        Bs. {Number(selectedInvoice.base_imponible_ves || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* LIQUIDACIÓN FISCAL & AUDITORÍA DE PAGO */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                {/* FORMA DE PAGO */}
                <div className="w-full sm:max-w-xs p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/80 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                    <CreditCard className="w-3 h-3 text-purple-500" />
                    <span>Cómo se Pagó (Auditoría)</span>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-zinc-100 capitalize">
                    {selectedInvoice.payment_method || selectedInvoice.datos_fiscales_snapshot?.metodo_pago || 'Transferencia Bancaria'}
                  </div>
                  <div className="text-slate-600 dark:text-zinc-400 text-[11px]">
                    Banco: {selectedInvoice.origin_bank || selectedInvoice.datos_fiscales_snapshot?.banco_origen || 'No especificado'}
                  </div>
                  <div className="font-mono text-purple-600 dark:text-purple-400 text-[11px] font-semibold">
                    Referencia: {selectedInvoice.reference_number || selectedInvoice.datos_fiscales_snapshot?.referencia || 'N/A'}
                  </div>
                </div>

                {/* TOTALES TABULADOS */}
                <div className="w-full sm:w-72 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span>Base Imponible:</span>
                    <span>Bs. {Number(selectedInvoice.base_imponible_ves || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span>IVA ({Number(selectedInvoice.porcentaje_iva || 0)}%):</span>
                    <span>Bs. {Number(selectedInvoice.monto_iva_ves || 0).toFixed(2)}</span>
                  </div>
                  {selectedInvoice.aplica_igtf && (
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>IGTF (3%):</span>
                      <span>Bs. {Number(selectedInvoice.monto_igtf_ves || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 dark:border-zinc-700 pt-1.5 flex justify-between font-black text-sm text-slate-900 dark:text-zinc-100">
                    <span>TOTAL A PAGAR (VES):</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Bs. {Number(selectedInvoice.total_ves || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between font-black text-xs text-purple-600 dark:text-purple-400">
                    <span>TOTAL EQUIVALENTE (USD):</span>
                    <span>${Number(selectedInvoice.monto_usd || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* FOOTER AUDIT SEAL */}
              <div className="border-t border-slate-200 dark:border-zinc-800 pt-4 text-center space-y-1 text-[10px] text-slate-400">
                <div className="flex items-center justify-center space-x-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="truncate">SELLO DIGITAL INMUTABLE • ID ÚNICO: {selectedInvoice.id}</span>
                </div>
                <p>
                  Comprobante generado conforme a las normativas cambiarias del Banco Central de Venezuela.
                  Documento inalterable emitido automáticamente y sellado por el sistema de conciliación Xion-Pay.
                </p>
              </div>
            </div>

            {/* Bottom Close Bar */}
            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cerrar Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
