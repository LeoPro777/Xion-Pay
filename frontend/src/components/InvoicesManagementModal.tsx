import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { usePreferences } from '../context/PreferencesContext';
import { useDialog } from '../context/DialogContext';
import type { ComprobanteItem, TenantListItem } from '../types';
import {
  X,
  Receipt,
  Search,
  RefreshCw,
  Printer,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Plus,
  Coins,
  CreditCard,
  Landmark,
  Eye,
  FileCheck,
  Calendar,
  Layers,
  Check,
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

  const [invoices, setInvoices] = useState<ComprobanteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<ComprobanteItem | null>(null);

  // New Invoice Emission Sub-form state
  const [showEmitModal, setShowEmitModal] = useState<boolean>(false);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState<boolean>(false);
  const [emitTenantId, setEmitTenantId] = useState<string>('');
  const [emitMontoUsd, setEmitMontoUsd] = useState<number>(25.0);
  const [emitTasaBcv, setEmitTasaBcv] = useState<number>(bcvRate || 36.5);
  const [emitTipoDoc, setEmitTipoDoc] = useState<string>('RECIBO_COBRO');
  const [emitAplicaIgtf, setEmitAplicaIgtf] = useState<boolean>(false);
  const [emitPaymentMethod, setEmitPaymentMethod] = useState<string>('pago_movil');
  const [emitOriginBank, setEmitOriginBank] = useState<string>('Banco de Venezuela (0102)');
  const [emitDestBank, setEmitDestBank] = useState<string>('Banesco Xion-Pay (0134)');
  const [emitReference, setEmitReference] = useState<string>('');
  const [emitNotes, setEmitNotes] = useState<string>('Suscripción mensual Xion-Manager');
  const [emitting, setEmitting] = useState<boolean>(false);

  // Update default rate when bcvRate is loaded
  useEffect(() => {
    if (bcvRate && bcvRate > 0) {
      setEmitTasaBcv(bcvRate);
    }
  }, [bcvRate]);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenants/comprobantes/all', {
        params: {
          search: search.trim() || undefined,
          tipo: filterType !== 'all' ? filterType : undefined,
          estado: filterStatus !== 'all' ? filterStatus : undefined,
          limit: 150,
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

  // Fetch tenants for emission dropdown
  const fetchTenants = useCallback(async () => {
    setLoadingTenants(true);
    try {
      const res = await api.get('/tenants');
      setTenants(res.data || []);
      if (res.data?.length > 0 && !emitTenantId) {
        setEmitTenantId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error loading tenants for invoice emission:', err);
    } finally {
      setLoadingTenants(false);
    }
  }, [emitTenantId]);

  useEffect(() => {
    if (isOpen) {
      fetchInvoices();
    }
  }, [isOpen, fetchInvoices]);

  useEffect(() => {
    if (showEmitModal) {
      fetchTenants();
    }
  }, [showEmitModal, fetchTenants]);

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

  // Handle Manual Emission
  const handleEmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emitTenantId) {
      showToast('Selecciona un comercio o cliente para emitir la factura.', 'warning');
      return;
    }
    if (emitMontoUsd <= 0) {
      showToast('El monto en USD debe ser mayor a cero.', 'warning');
      return;
    }
    if (emitTasaBcv <= 0) {
      showToast('La tasa BCV oficial debe ser válida.', 'warning');
      return;
    }

    setEmitting(true);
    try {
      const payload = {
        monto_usd: emitMontoUsd,
        tasa_bcv: emitTasaBcv,
        aplica_igtf: emitAplicaIgtf,
        tipo_documento: emitTipoDoc,
        payment_method: emitPaymentMethod,
        origin_bank: emitOriginBank,
        destination_bank: emitDestBank,
        reference_number: emitReference.trim() || undefined,
        notes: emitNotes.trim() || undefined,
      };

      const res = await api.post(`/tenants/${emitTenantId}/comprobantes`, payload);
      showToast(`Factura ${res.data.numero_comprobante} emitida e inmutable.`, 'success');
      setShowEmitModal(false);
      // Select the emitted invoice to show ticket
      setSelectedInvoice(res.data);
      fetchInvoices();
    } catch (err: any) {
      console.error('Error emitting invoice:', err);
      showToast(err.response?.data?.message || 'Error al emitir factura inmutable.', 'error');
    } finally {
      setEmitting(false);
    }
  };

  // Printable ticket print handler
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-6xl bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">
                  Gestión de Facturas & Comprobantes Inmutables
                </h2>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                  Auditoría Permanente
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Facturación con tasa BCV del día, desgloses multimoneda (USD / Bs.) y coordenadas de pago.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEmitModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Emitir nuevo comprobante de pago"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Emitir Factura</span>
            </button>

            <button
              onClick={fetchInvoices}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Recargar facturas"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUMMARY STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-100/50 dark:bg-zinc-900/30 border-b border-slate-200 dark:border-zinc-800 text-xs">
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
              <span>Total Comprobantes</span>
              <Layers className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100">
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
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
              ${stats.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
              <span>Equivalente en Bolívares</span>
              <Coins className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono truncate" title={`Bs. ${stats.totalVes.toFixed(2)}`}>
              Bs. {stats.totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1">
              <span>Tasa BCV Referencial</span>
              <Landmark className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
              Bs. {(bcvRate || 36.5).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ USD</span>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-white dark:bg-[#121215]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por N° comprobante, RIF, cliente o referencia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden"
            >
              <option value="all">Todos los Tipos</option>
              <option value="RECIBO_COBRO">Recibo de Cobro</option>
              <option value="FACTURA_FISCAL">Factura Fiscal (SENIAT)</option>
              <option value="PROFORMA">Proforma</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden"
            >
              <option value="all">Todos los Estados</option>
              <option value="PAGADO">Pagado</option>
              <option value="EMITIDO">Emitido</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
          </div>
        </div>

        {/* INVOICES TABLE LIST */}
        <div className="flex-1 overflow-y-auto">
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
                Los comprobantes se emiten automáticamente al aprobar pagos de suscripción o manualmente desde el botón superior.
              </p>
              <button
                onClick={() => setShowEmitModal(true)}
                className="mt-4 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Emitir Primer Comprobante
              </button>
            </div>
          ) : (
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
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]" title={inv.numero_control}>
                              Ctrl: {inv.numero_control}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CLIENTE & RIF */}
                      <td className="py-3 px-4 max-w-[180px]">
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
                      <td className="py-3 px-4 max-w-[190px]">
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
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          title="Ver factura oficial e imprimir ticket"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ticket</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-purple-500" />
            <span>
              Registros fiscales sellados en base de datos. Ningún monto o tasa emitida puede alterarse.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-MODAL 1: FACTURA INMUTABLE TICKET VIEW (DETALLE IMPRIMIBLE) */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in zoom-in-95 duration-150">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#121215] text-slate-900 dark:text-zinc-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0">
            
            {/* Header Dialog Controls (Hidden in Print) */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 print:hidden">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <Receipt className="w-4 h-4 text-purple-500" />
                <span>Vista Previa de Factura Oficial / Comprobante Inmutable</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE TICKET BODY */}
            <div className="p-6 md:p-8 space-y-6 text-xs font-sans print:p-4 print:text-black">
              {/* Top Banner / SENIAT & Company Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-purple-600 dark:text-purple-400 uppercase">
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

              {/* LIQUIDACIÓN FISCAL */}
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
                  <span>SELLO DIGITAL INMUTABLE • ID ÚNICO: {selectedInvoice.id}</span>
                </div>
                <p>
                  Comprobante generado conforme a las normativas cambiarias del Banco Central de Venezuela.
                  Documento inalterable sellado por el sistema de conciliación Xion-Pay.
                </p>
              </div>
            </div>

            {/* Bottom Close Bar */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex justify-end print:hidden">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cerrar Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL 2: FORMULARIO DE EMISIÓN DE FACTURA INMUTABLE */}
      {/* ========================================================================= */}
      {showEmitModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in zoom-in-95 duration-150">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#121215] text-slate-900 dark:text-zinc-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 rounded-xl">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Emitir Factura / Comprobante Inmutable
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Calcula automáticamente con la tasa oficial BCV y genera registro de auditoría permanente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmitModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmitInvoice} className="p-6 space-y-4 text-xs">
              {/* CLIENT SELECTION */}
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  Cliente / Comercio Receptor *
                </label>
                {loadingTenants ? (
                  <div className="py-2 text-slate-400">Cargando clientes...</div>
                ) : (
                  <select
                    value={emitTenantId}
                    onChange={(e) => setEmitTenantId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.commercial_name} ({t.tax_id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* AMOUNTS & RATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                    Monto en USD ($) *
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={emitMontoUsd}
                      onChange={(e) => setEmitMontoUsd(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                    Tasa Oficial BCV del Día (Bs./USD) *
                  </label>
                  <div className="relative">
                    <Coins className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={emitTasaBcv}
                      onChange={(e) => setEmitTasaBcv(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* TIPO DE DOCUMENTO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                    Tipo de Comprobante
                  </label>
                  <select
                    value={emitTipoDoc}
                    onChange={(e) => setEmitTipoDoc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="RECIBO_COBRO">Recibo de Cobro Interno</option>
                    <option value="FACTURA_FISCAL">Factura Fiscal (SENIAT)</option>
                    <option value="PROFORMA">Proforma</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="emitAplicaIgtf"
                    checked={emitAplicaIgtf}
                    onChange={(e) => setEmitAplicaIgtf(e.target.checked)}
                    className="w-4 h-4 rounded-md text-purple-600 focus:ring-purple-500 border-slate-300"
                  />
                  <label htmlFor="emitAplicaIgtf" className="text-slate-700 dark:text-zinc-300 cursor-pointer">
                    Aplica 3% IGTF (Divisa en Efectivo)
                  </label>
                </div>
              </div>

              {/* CÓMO SE PAGÓ (COORDENADAS) */}
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40 space-y-3">
                <div className="font-semibold text-purple-900 dark:text-purple-300 flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4" />
                  <span>Cómo se Pagó (Coordenadas de Recepción)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 text-[11px] mb-1">
                      Método de Pago
                    </label>
                    <select
                      value={emitPaymentMethod}
                      onChange={(e) => setEmitPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs"
                    >
                      <option value="pago_movil">Pago Móvil (VES)</option>
                      <option value="transferencia">Transferencia Bancaria (VES)</option>
                      <option value="zelle">Zelle (USD)</option>
                      <option value="billetera">Débito de Saldo en Billetera</option>
                      <option value="efectivo">Efectivo Divisas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 text-[11px] mb-1">
                      Banco Emisor / Origen
                    </label>
                    <input
                      type="text"
                      value={emitOriginBank}
                      onChange={(e) => setEmitOriginBank(e.target.value)}
                      placeholder="Ej: Banesco, Mercantil, BDV..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 text-[11px] mb-1">
                      Número de Referencia Bancaria
                    </label>
                    <input
                      type="text"
                      value={emitReference}
                      onChange={(e) => setEmitReference(e.target.value)}
                      placeholder="Ej: 0482910394"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 text-[11px] mb-1">
                      Banco Receptor Xion-Pay
                    </label>
                    <input
                      type="text"
                      value={emitDestBank}
                      onChange={(e) => setEmitDestBank(e.target.value)}
                      placeholder="Ej: Banesco Xion-Pay 0134..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* CALCULATION PREVIEW */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Base Imponible VES:</span>
                  <span>Bs. {(emitMontoUsd * emitTasaBcv).toFixed(2)}</span>
                </div>
                {emitTipoDoc === 'FACTURA_FISCAL' && (
                  <div className="flex justify-between text-slate-500">
                    <span>IVA 16%:</span>
                    <span>Bs. {(emitMontoUsd * emitTasaBcv * 0.16).toFixed(2)}</span>
                  </div>
                )}
                {emitAplicaIgtf && (
                  <div className="flex justify-between text-slate-500">
                    <span>IGTF 3%:</span>
                    <span>Bs. {(emitMontoUsd * emitTasaBcv * 0.03).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-zinc-700 pt-1 flex justify-between font-bold text-xs text-slate-900 dark:text-zinc-100">
                  <span>Total Liquidado (VES):</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Bs.{' '}
                    {(
                      emitMontoUsd * emitTasaBcv +
                      (emitTipoDoc === 'FACTURA_FISCAL' ? emitMontoUsd * emitTasaBcv * 0.16 : 0) +
                      (emitAplicaIgtf ? emitMontoUsd * emitTasaBcv * 0.03 : 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* NOTAS */}
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  Concepto / Observaciones
                </label>
                <input
                  type="text"
                  value={emitNotes}
                  onChange={(e) => setEmitNotes(e.target.value)}
                  placeholder="Ej: Renovación mensual de licencia..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs"
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmitModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={emitting || emitMontoUsd <= 0}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  {emitting ? 'Emitiendo Registro Inmutable...' : 'Confirmar Emisión Inmutable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
