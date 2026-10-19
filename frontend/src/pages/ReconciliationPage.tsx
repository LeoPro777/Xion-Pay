import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import type { PaymentReport, TenantListItem } from '../types';
import {
  CheckCircle,
  XCircle,
  Download,
  AlertCircle,
  Building,
  ShieldCheck,
  PlusCircle,
  Search,
  ShieldAlert,
} from 'lucide-react';

interface ReconciliationPageProps {
  lastEventTimestamp: number;
}

export const ReconciliationPage: React.FC<ReconciliationPageProps> = ({ lastEventTimestamp }) => {
  const { confirm, showToast } = useDialog();
  const [payments, setPayments] = useState<PaymentReport[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Reject Modal State
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Simulation Modal State (Test incoming payment from Xion-Manager instance)
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [tenantsList, setTenantsList] = useState<TenantListItem[]>([]);
  const [simTenantId, setSimTenantId] = useState<string>('');
  const [simBank, setSimBank] = useState<string>('Banesco');
  const [simRef, setSimRef] = useState<string>('');
  const [simAmount, setSimAmount] = useState<number>(50.0);
  const [simCurrency, setSimCurrency] = useState<string>('USD');
  const [simRate, setSimRate] = useState<number>(36.50);
  const [simError, setSimError] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      const res = await api.get<PaymentReport[]>('/payments/inbox', {
        params: { status: statusFilter },
      });
      setPayments(res.data);
      if (res.data.length > 0) {
        setSelectedPayment((prev) => {
          if (!prev) return res.data[0];
          const exists = res.data.find((p) => p.id === prev.id);
          return exists || res.data[0];
        });
      } else {
        setSelectedPayment(null);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantsList = async () => {
    try {
      const [tenantsRes, settingsRes] = await Promise.all([
        api.get<TenantListItem[]>('/tenants'),
        api.get<{ usd_ves_rate: number }>('/settings').catch(() => ({ data: { usd_ves_rate: 36.50 } })),
      ]);
      setTenantsList(tenantsRes.data);
      if (tenantsRes.data.length > 0) {
        setSimTenantId(tenantsRes.data[0].id);
      }
      if (settingsRes.data?.usd_ves_rate) {
        setSimRate(settingsRes.data.usd_ves_rate);
      }
    } catch (e) {
      console.error('Error fetching tenants list:', e);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, lastEventTimestamp]);

  const handleApprove = async () => {
    if (!selectedPayment) return;
    const ok = await confirm({
      title: '¿Aprobar y Conciliar Pago?',
      message: `¿Desea aprobar el reporte de pago #${selectedPayment.reference_number} de ${selectedPayment.origin_bank} por ${selectedPayment.amount} ${selectedPayment.currency} para "${selectedPayment.tenant_commercial_name || 'el comercio'}"?\n\nSe activará automáticamente su suscripción.`,
      confirmText: 'Sí, aprobar pago',
      variant: 'info',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      await api.post(`/payments/${selectedPayment.id}/approve`);
      showToast('Pago aprobado y conciliado exitosamente.', 'success');
      await fetchPayments();
    } catch (err: any) {
      showToast(`Error al aprobar pago: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await api.post(`/payments/${selectedPayment.id}/reject`, {
        rejection_reason: rejectReason.trim(),
      });
      setShowRejectModal(false);
      setRejectReason('');
      showToast('Pago rechazado y notificado al comercio.', 'info');
      await fetchPayments();
    } catch (err: any) {
      showToast(`Error al rechazar pago: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async (paymentId: string) => {
    try {
      const res = await api.get(`/payments/${paymentId}/invoice-pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `factura-${paymentId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Comprobante PDF descargado exitosamente.', 'success');
    } catch (err) {
      showToast('Error descargando el comprobante PDF.', 'error');
    }
  };

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimError(null);
    setActionLoading(true);
    try {
      await api.post('/payments/report', {
        tenant_id: simTenantId,
        origin_bank: simBank,
        reference_number: simRef,
        amount: simAmount,
        currency: simCurrency,
        exchange_rate: simRate,
        proof_attachment_url: `https://placehold.co/800x1000/0f172a/ffffff.png?text=Comprobante+${simBank}+${simRef}`,
      });
      setShowSimulateModal(false);
      setSimRef('');
      await fetchPayments();
    } catch (err: any) {
      if (err.response && err.response.status === 409) {
        setSimError(
          `⛔ RESTRICCIÓN ANTIFRAUDE [409 Conflict]: La referencia '${simRef}' para el banco '${simBank}' con monto $${simAmount} ya fue registrada previamente.`
        );
      } else {
        setSimError(err.response?.data?.message || 'Error registrando reporte de pago.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      p.reference_number.toLowerCase().includes(term) ||
      p.origin_bank.toLowerCase().includes(term) ||
      (p.tenant_commercial_name && p.tenant_commercial_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top filter tabs & Simulation button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white m-0">
            Bandeja de Conciliación de Pagos
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Validación y aprobación en 1 clic de abonos manuales multimoneda con emisión de licencias.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start">
          <button
            onClick={() => {
              fetchTenantsList();
              setShowSimulateModal(true);
            }}
            className="px-3.5 py-1.5 bg-accent-subtle text-accent border border-[var(--accent)]/30 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer hover:opacity-90"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Simular Reporte Cliente</span>
          </button>

          <div className="flex bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-accent shadow-xs font-bold'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Aprobados
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'rejected'
                  ? 'bg-white text-rose-700 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Rechazados
            </button>
          </div>
        </div>
      </div>

      {/* Split View Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Panel: Payment List (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-xs">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
              Transacciones ({filteredPayments.length})
            </span>
            <div className="relative w-40">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar ref..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:border-slate-800"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 max-h-[680px]">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Cargando pagos...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay transacciones que coincidan en esta bandeja.
              </div>
            ) : (
              filteredPayments.map((p) => {
                const isSelected = selectedPayment?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPayment(p)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-100/80 border-l-4 border-slate-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {p.tenant_commercial_name || 'Comercio'}
                      </span>
                      <div className="text-right">
                        <span className="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block">
                          ${(p.amount_usd ?? (p.currency === 'USD' ? p.amount : p.amount / (p.exchange_rate || 1))).toFixed(2)} USD
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 block">
                          Bs. {(p.amount_ves ?? (p.currency === 'VES' ? p.amount : p.amount * (p.exchange_rate || 1))).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-mono text-[10px] text-slate-700 dark:text-zinc-300">
                          {p.origin_bank}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-zinc-400">Ref: {p.reference_number}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                        {p.exchange_rate ? (
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            Tasa: {p.exchange_rate.toFixed(2)}
                          </span>
                        ) : null}
                        <span>
                          {new Date(p.reported_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Expanded Proof Viewer & 1-Click Actions (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-xs">
          {selectedPayment ? (
            <>
              {/* Top details bar */}
              <div className="p-4 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Building className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>{selectedPayment.tenant_commercial_name}</span>
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 space-y-0.5">
                      <p className="font-mono">
                        RIF: {selectedPayment.tenant_tax_id} · <span className="font-semibold text-slate-700 dark:text-slate-200">Plan: {selectedPayment.plan_name || 'Estándar'}</span>
                        {selectedPayment.plan_price ? ` ($${selectedPayment.plan_price.toFixed(2)} USD)` : ''}
                      </p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-600 dark:text-slate-300">
                        {selectedPayment.tenant_contact_name && (
                          <span>👤 {selectedPayment.tenant_contact_name}</span>
                        )}
                        {selectedPayment.tenant_phone && (
                          <a
                            href={`https://wa.me/${selectedPayment.tenant_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center space-x-0.5"
                          >
                            <span>📱 WhatsApp: {selectedPayment.tenant_phone}</span>
                          </a>
                        )}
                        {selectedPayment.tenant_email && (
                          <span className="font-mono">✉️ {selectedPayment.tenant_email}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end space-y-1">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        selectedPayment.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : selectedPayment.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {selectedPayment.status}
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                      ⏱️ Prórroga 48h activa
                    </span>
                  </div>
                </div>

                {/* Key metadata chips with multi-currency & rate */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="bg-slate-100 dark:bg-[#121929] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Tipo de Pago</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block truncate">
                      {selectedPayment.payment_method_type ? selectedPayment.payment_method_type.replace('_', ' ') : 'Pago Móvil'}
                    </span>
                  </div>
                  <div className="bg-slate-100 dark:bg-[#121929] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Banco / Ref</span>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block truncate" title={selectedPayment.origin_bank}>
                      {selectedPayment.origin_bank}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                      Ref: {selectedPayment.reference_number}
                    </span>
                  </div>
                  <div className="bg-slate-100 dark:bg-[#121929] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Tasa de Cambio</span>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                      {(selectedPayment.exchange_rate || 1.0).toFixed(2)} Bs/$
                    </span>
                  </div>
                  <div className="bg-slate-100 dark:bg-[#121929] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Monto en $ (USD)</span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                      ${(selectedPayment.amount_usd ?? (selectedPayment.currency === 'USD' ? selectedPayment.amount : selectedPayment.amount / (selectedPayment.exchange_rate || 1))).toFixed(2)} USD
                    </span>
                  </div>
                  <div className="bg-slate-100 dark:bg-[#121929] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Monto en Bs (VES)</span>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 block">
                      Bs. {(selectedPayment.amount_ves ?? (selectedPayment.currency === 'VES' ? selectedPayment.amount : selectedPayment.amount * (selectedPayment.exchange_rate || 1))).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-slate-100 dark:bg-[#121929] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Saldo Billetera</span>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 block">
                      ${(selectedPayment.tenant_wallet_balance ?? 0).toFixed(2)} USD
                    </span>
                  </div>
                </div>

                {selectedPayment.rejection_reason && (
                  <div className="mt-3 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-xs text-rose-600 dark:text-rose-300">
                    <strong>Motivo de Rechazo:</strong> {selectedPayment.rejection_reason}
                  </div>
                )}
              </div>

              {/* Proof Viewer */}
              <div className="flex-1 p-4 bg-slate-100 dark:bg-[#090d16] flex items-center justify-center min-h-[300px] max-h-[440px] overflow-auto border-b border-slate-200 dark:border-slate-800">
                {selectedPayment.proof_attachment_url ? (
                  <img
                    src={selectedPayment.proof_attachment_url}
                    alt="Comprobante Bancario"
                    className="max-h-full max-w-full object-contain rounded-lg border border-slate-300 dark:border-slate-800 shadow-md"
                  />
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">No se adjuntó vista previa del comprobante.</div>
                )}
              </div>

              {/* Action buttons footer */}
              <div className="p-4 bg-slate-50 dark:bg-[#0e1424] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Antifraude verificado · Firma RS256</span>
                </div>

                <div className="flex items-center space-x-3">
                  {selectedPayment.status === 'approved' && (
                    <button
                      onClick={() => handleDownloadPdf(selectedPayment.id)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Factura PDF</span>
                    </button>
                  )}

                  {selectedPayment.status === 'pending' && (
                    <>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Rechazar Pago</span>
                      </button>

                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-md shadow-emerald-900/20 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{actionLoading ? 'Firmando Licencia...' : 'Aprobar Pago en 1 Clic'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 my-auto">
              Selecciona una transacción en la lista izquierda para visualizar el comprobante.
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 transition-colors">
            <div className="flex items-center space-x-2 text-rose-500 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0">Motivo de Rechazo de Pago</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Indica la razón técnica o financiera del rechazo. Este motivo quedará sellado de forma inmutable y se transmitirá a la instancia cliente de Xion-Manager.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-700 dark:text-slate-300 uppercase font-semibold">
                Razones Rápidas:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Comprobante ilegible',
                  'Referencia no encontrada en extracto bancario',
                  'Monto insuficiente',
                  'Banco emisor no coincide',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md border dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-700 dark:text-slate-300 uppercase font-semibold block mb-1">
                Detalle del motivo:
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Escribe el motivo del rechazo..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Modal (Test Client Payment Report) */}
      {showSimulateModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-zinc-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-900 dark:text-slate-100 transition-colors">
            <div className="flex items-center space-x-2 text-accent">
              <PlusCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0">
                Simular Reporte de Pago (Cliente Xion-Manager)
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Prueba la recepción de un pago reportado remotamente. Puedes testear la validación Antifraude intentando enviar la misma referencia 2 veces.
            </p>

            {simError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs p-3 rounded-lg flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">{simError}</span>
              </div>
            )}

            <form onSubmit={handleSimulatePayment} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  Comercio Emisor (Tenant):
                </label>
                <select
                  value={simTenantId}
                  onChange={(e) => setSimTenantId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {tenantsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.commercial_name} ({t.tax_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Banco de Origen:
                  </label>
                  <select
                    value={simBank}
                    onChange={(e) => setSimBank(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="Banesco">Banesco</option>
                    <option value="Mercantil">Mercantil</option>
                    <option value="Pago Movil">Pago Móvil</option>
                    <option value="Zelle">Zelle</option>
                    <option value="BBVA Provincial">BBVA Provincial</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    N° de Referencia Bancaria:
                  </label>
                  <input
                    type="text"
                    required
                    value={simRef}
                    onChange={(e) => setSimRef(e.target.value)}
                    placeholder="Ej: REF-998877"
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Monto:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={simAmount}
                    onChange={(e) => setSimAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Moneda:
                  </label>
                  <select
                    value={simCurrency}
                    onChange={(e) => setSimCurrency(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                    Tasa (Bs/$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={simRate}
                    onChange={(e) => setSimRate(parseFloat(e.target.value) || 1.0)}
                    className="w-full bg-slate-50 dark:bg-[#0d121f] border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Conversion Preview Box */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Conversión automática:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {simCurrency === 'USD'
                    ? `Bs. ${(simAmount * simRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES`
                    : `$${(simAmount / (simRate || 1)).toFixed(2)} USD`}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !simRef.trim()}
                  className="px-4 py-1.5 bg-accent hover:opacity-90 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Enviar Reporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
