import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import type { TenantListItem, TenantDetail, WebhookLogItem, Plan, FiscalProfile } from '../types';
import {
  Search,
  Building2,
  Calendar,
  Key,
  Radio,
  PlusCircle,
  X,
  Save,
  MessageCircle,
  FileText,
  Clock,
  Receipt,
  ChevronDown,
  ChevronUp,
  User,
  CheckCircle2,
  RefreshCw,
  Edit3,
  PowerOff,
  Wallet,
  Zap,
  Pencil,
  Ban,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';

export const TenantsPage: React.FC = () => {
  const { confirm, showToast, showAlert } = useDialog();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Drawer & Modals
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'profile' | 'fiscal' | 'comprobantes' | 'webhooks'>('profile');
  const [showCourtesyModal, setShowCourtesyModal] = useState<boolean>(false);
  const [courtesyDays, setCourtesyDays] = useState<number>(7);
  const [courtesyReason, setCourtesyReason] = useState<string>('Soporte técnico preventivo');

  // Recharge Balance Modal State
  const [showRechargeModal, setShowRechargeModal] = useState<boolean>(false);
  const [rechargeTenant, setRechargeTenant] = useState<TenantListItem | TenantDetail | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<number>(29.0);
  const [rechargeReason, setRechargeReason] = useState<string>('Abono en billetera cliente');
  const [rechargeAutoRenew, setRechargeAutoRenew] = useState<boolean>(true);
  const [recharging, setRecharging] = useState<boolean>(false);
  const [processingCycle, setProcessingCycle] = useState<boolean>(false);

  // Fiscal Profile Form State
  const [fiscalData, setFiscalData] = useState<Partial<FiscalProfile>>({
    activo_seniat: false,
    tipo_documento_fiscal: 'RIF_J',
    numero_rif: '',
    razon_social: '',
    es_contribuyente_especial: false,
    estado: '',
    municipio: '',
    parroquia: '',
    ciudad: '',
    direccion_detallada: '',
    telefono_fiscal: '',
    email_fiscal: '',
  });
  const [savingFiscal, setSavingFiscal] = useState<boolean>(false);

  // Comprobante / Recibo Modal State
  const [showComprobanteModal, setShowComprobanteModal] = useState<boolean>(false);
  const [comprobanteMontoUsd, setComprobanteMontoUsd] = useState<number>(25.00);
  const [comprobanteTasaBcv, setComprobanteTasaBcv] = useState<number>(36.50);
  const [comprobanteAplicaIgtf, setComprobanteAplicaIgtf] = useState<boolean>(false);
  const [generatingComprobante, setGeneratingComprobante] = useState<boolean>(false);

  // Create Client Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [contactName, setContactName] = useState<string>('');
  const [commName, setCommName] = useState<string>('');
  const [idDocType, setIdDocType] = useState<string>('V');
  const [idDocNumber, setIdDocNumber] = useState<string>('');
  const [ownerEmail, setOwnerEmail] = useState<string>('');
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [grant30DayTrial, setGrant30DayTrial] = useState<boolean>(true);
  const [walletBalance, setWalletBalance] = useState<number>(0.0);
  const [deliveryChannel, setDeliveryChannel] = useState<string>('email');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [showFiscalAccordion, setShowFiscalAccordion] = useState<boolean>(false);

  // Edit Client Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingTenant, setEditingTenant] = useState<TenantListItem | TenantDetail | null>(null);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    commercial_name: '',
    contact_name: '',
    id_doc_type: 'V',
    id_doc_number: '',
    tax_id: '',
    owner_email: '',
    owner_phone: '',
    crm_notes: '',
    webhook_url: '',
    status: 'active',
    wallet_balance: 0.0,
    delivery_channel: 'email',
    telegram_chat_id: '',
  });


  const fetchTenants = async () => {
    try {
      const res = await api.get<TenantListItem[]>('/tenants', {
        params: { search: search || undefined, status: statusFilter || undefined },
      });
      setTenants(res.data);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get<Plan[]>('/plans');
      setPlans(res.data);
      if (res.data.length > 0) {
        setSelectedPlanId(res.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchPlans();
  }, [search, statusFilter]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const planId = selectedPlanId || (plans.length > 0 ? plans[0].id : undefined);

    const docNum = idDocNumber.trim();
    const generatedTaxId = docNum ? `${idDocType}-${docNum}` : `CLI-${Date.now().toString().slice(-6)}`;

    try {
      await api.post('/tenants', {
        commercial_name: commName.trim(),
        contact_name: contactName.trim() || undefined,
        id_doc_type: idDocType,
        id_doc_number: docNum || undefined,
        tax_id: generatedTaxId,
        owner_email: ownerEmail.trim(),
        owner_phone: ownerPhone.trim(),
        webhook_url: webhookUrl.trim() || undefined,
        initial_plan_id: planId || undefined,
        billing_cycle: billingCycle,
        trial_days: grant30DayTrial ? 30 : 0,
        status: grant30DayTrial ? 'trial' : 'active',
        wallet_balance: walletBalance,
        delivery_channel: deliveryChannel,
        telegram_chat_id: telegramChatId.trim() || undefined,
      });
      setShowCreateModal(false);
      setContactName('');
      setCommName('');
      setIdDocNumber('');
      setOwnerEmail('');
      setOwnerPhone('');
      setWebhookUrl('');
      setWalletBalance(0.0);
      setTelegramChatId('');
      await fetchTenants();
    } catch (err: any) {
      console.error('Error creating client:', err.response?.data || err);
      let msg = err.response?.data?.message || err.message;
      if (err.response?.data?.details) {
        if (Array.isArray(err.response.data.details)) {
          msg += '\n' + err.response.data.details
            .map((d: any) => `${d.loc ? d.loc.join('.') : 'Campo'}: ${d.msg}`)
            .join('\n');
        } else if (typeof err.response.data.details === 'object') {
          msg += '\n' + JSON.stringify(err.response.data.details);
        }
      }
      showToast(`Error al registrar el cliente:\n${msg}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const openTenantDetail = async (tenantId: string) => {
    try {
      const res = await api.get<TenantDetail>(`/tenants/${tenantId}`);
      setSelectedTenant(res.data);
      if (res.data.fiscal_profile) {
        setFiscalData(res.data.fiscal_profile);
      } else {
        setFiscalData({
          activo_seniat: false,
          tipo_documento_fiscal: 'RIF_J',
          numero_rif: res.data.tax_id || '',
          razon_social: res.data.commercial_name || '',
          es_contribuyente_especial: false,
        });
      }

      // Fetch webhook logs
      const logsRes = await api.get<WebhookLogItem[]>(`/webhooks/logs/${tenantId}`);
      setWebhookLogs(logsRes.data);
    } catch (err) {
      showToast('Error cargando la ficha del cliente.', 'error');
    }
  };

  const handleSaveFiscalProfile = async () => {
    if (!selectedTenant) return;
    setSavingFiscal(true);
    try {
      const res = await api.put<FiscalProfile>(`/tenants/${selectedTenant.id}/fiscal-profile`, fiscalData);
      setFiscalData(res.data);
      showToast('Perfil fiscal actualizado exitosamente.', 'success');
      await fetchTenants();
      openTenantDetail(selectedTenant.id);
    } catch (err: any) {
      showToast(`Error al guardar datos fiscales: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setSavingFiscal(false);
    }
  };

  const handleGenerateComprobante = async () => {
    if (!selectedTenant) return;
    setGeneratingComprobante(true);
    try {
      await api.post(`/tenants/${selectedTenant.id}/comprobantes`, {
        monto_usd: comprobanteMontoUsd,
        tasa_bcv: comprobanteTasaBcv,
        aplica_igtf: comprobanteAplicaIgtf,
      });
      setShowComprobanteModal(false);
      openTenantDetail(selectedTenant.id);
      showToast('Comprobante emitido con éxito.', 'success');
    } catch (err: any) {
      showToast(`Error emitiendo comprobante: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setGeneratingComprobante(false);
    }
  };

  const openEditModal = (t: TenantListItem | TenantDetail) => {
    setEditingTenant(t);
    setEditForm({
      commercial_name: t.commercial_name || '',
      contact_name: t.contact_name || '',
      id_doc_type: t.id_doc_type || 'V',
      id_doc_number: t.id_doc_number || '',
      tax_id: t.tax_id || '',
      owner_email: t.owner_email || '',
      owner_phone: t.owner_phone || '',
      crm_notes: (t as TenantDetail).crm_notes || '',
      webhook_url: (t as TenantDetail).webhook_url || '',
      status: t.status || 'active',
      wallet_balance: t.wallet_balance ?? 0.0,
      delivery_channel: t.delivery_channel || 'email',
      telegram_chat_id: t.telegram_chat_id || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setSavingEdit(true);
    try {
      await api.patch(`/tenants/${editingTenant.id}`, {
        commercial_name: editForm.commercial_name.trim(),
        contact_name: editForm.contact_name.trim() || undefined,
        id_doc_type: editForm.id_doc_type,
        id_doc_number: editForm.id_doc_number.trim() || undefined,
        tax_id: editForm.tax_id.trim() || undefined,
        owner_email: editForm.owner_email.trim(),
        owner_phone: editForm.owner_phone.trim(),
        crm_notes: editForm.crm_notes.trim() || undefined,
        webhook_url: editForm.webhook_url.trim() || undefined,
        status: editForm.status,
        wallet_balance: editForm.wallet_balance,
        delivery_channel: editForm.delivery_channel,
        telegram_chat_id: editForm.telegram_chat_id.trim() || undefined,
      });
      setShowEditModal(false);
      await fetchTenants();
      if (selectedTenant && selectedTenant.id === editingTenant.id) {
        await openTenantDetail(editingTenant.id);
      }
      showToast('Datos del cliente actualizados exitosamente.', 'success');
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message;
      if (err.response?.data?.details) {
        if (Array.isArray(err.response.data.details)) {
          msg += '\n' + err.response.data.details.map((d: any) => `${d.loc ? d.loc.join('.') : 'Campo'}: ${d.msg}`).join('\n');
        } else if (typeof err.response.data.details === 'object') {
          msg += '\n' + JSON.stringify(err.response.data.details);
        }
      }
      showToast(`Error al actualizar cliente:\n${msg}`, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const openRechargeModal = (t: TenantListItem | TenantDetail) => {
    setRechargeTenant(t);
    setRechargeAmount(t.active_plan_price && t.active_plan_price > 0 ? t.active_plan_price : 29.0);
    setRechargeReason(`Recarga de saldo para ${t.commercial_name}`);
    setRechargeAutoRenew(true);
    setShowRechargeModal(true);
  };

  const handleRechargeBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeTenant) return;
    setRecharging(true);
    try {
      const res = await api.post(`/tenants/${rechargeTenant.id}/balance`, {
        amount: rechargeAmount,
        reason: rechargeReason,
        auto_renew: rechargeAutoRenew,
      });
      showToast(res.data.message || 'Saldo recargado exitosamente.', 'success');
      setShowRechargeModal(false);
      await fetchTenants();
      if (selectedTenant && selectedTenant.id === rechargeTenant.id) {
        await openTenantDetail(rechargeTenant.id);
      }
    } catch (err: any) {
      showToast(`Error al recargar saldo: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setRecharging(false);
    }
  };

  const handleRenewFromBalance = async (tenantId: string, clientName?: string) => {
    const ok = await confirm({
      title: '¿Renovar suscripción desde saldo?',
      message: `¿Desea debitar el costo del plan directamente de la billetera de "${clientName || 'este cliente'}" para renovar inmediatamente su suscripción y emitir su licencia criptográfica RS256?`,
      confirmText: 'Sí, renovar suscripción',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      await api.post(`/tenants/${tenantId}/renew-from-balance`);
      showToast('¡Suscripción renovada exitosamente! Licencia emitida y nota de entrega despachada.', 'success');
      await fetchTenants();
      if (selectedTenant && selectedTenant.id === tenantId) {
        await openTenantDetail(tenantId);
      }
    } catch (err: any) {
      showToast(`Error al renovar suscripción desde saldo: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  const handleProcessCycle = async () => {
    const ok = await confirm({
      title: '¿Ejecutar ciclo de facturación y cobro automático?',
      message: '¿Desea procesar el ciclo de facturación y cobro automático ahora?\n\n• Si el cliente tiene saldo suficiente, su suscripción se renueva y se debita el monto.\n• Si reportó un pago o está en prórroga, se mantiene activo.\n• Si está vencido sin saldo, se suspende automáticamente.',
      confirmText: 'Sí, procesar ciclo',
      variant: 'warning',
    });
    if (!ok) return;

    setProcessingCycle(true);
    try {
      const res = await api.post('/tenants/billing/process-cycle');
      await showAlert(
        `Resultados del ciclo:\n\n✅ Renovados automáticamente con saldo: ${res.data.renewed_count}\n⏱️ Comercios mantenidos en prórroga: ${res.data.grace_period_count}\n🚫 Suspendidos por saldo insuficiente: ${res.data.suspended_count}`,
        'Ciclo de Facturación Completado',
        'success'
      );
      await fetchTenants();
    } catch (err: any) {
      showToast(`Error ejecutando ciclo: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setProcessingCycle(false);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string, clientName?: string) => {
    const isSuspended = currentStatus === 'suspended' || currentStatus === 'frozen';
    const newStatus = isSuspended ? 'active' : 'suspended';
    const actionText = isSuspended ? 'reactivar' : 'desactivar (suspender)';
    const confirmMessage = isSuspended
      ? `¿Desea reactivar al cliente "${clientName || 'seleccionado'}"?\nEl cliente volverá a tener acceso y se activarán sus licencias.`
      : `¿Está seguro de desactivar al cliente "${clientName || 'seleccionado'}"?\nEl acceso será revocado y se emitirá el evento de suspensión a sus sistemas asociados.`;

    const ok = await confirm({
      title: isSuspended ? '¿Reactivar cliente?' : '¿Suspender cliente?',
      message: confirmMessage,
      confirmText: isSuspended ? 'Sí, reactivar' : 'Sí, suspender',
      variant: isSuspended ? 'info' : 'danger',
    });
    if (!ok) return;

    try {
      await api.patch(`/tenants/${tenantId}/status`, {
        status: newStatus,
        reason: isSuspended ? 'Reactivación administrativa desde CRM' : 'Desactivación administrativa desde CRM',
      });
      showToast(`Cliente ${isSuspended ? 'reactivado' : 'suspendido'} con éxito.`, 'success');
      await fetchTenants();
      if (selectedTenant && selectedTenant.id === tenantId) {
        await openTenantDetail(tenantId);
      }
    } catch (err: any) {
      showToast(`Error al ${actionText} cliente: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  const handleGrantCourtesyDays = async () => {
    if (!selectedTenant) return;
    try {
      await api.post(`/tenants/${selectedTenant.id}/courtesy-days`, {
        days: courtesyDays,
        reason: courtesyReason,
      });
      setShowCourtesyModal(false);
      await fetchTenants();
      openTenantDetail(selectedTenant.id);
      showToast(`Se otorgaron exitosamente ${courtesyDays} días de cortesía.`, 'success');
    } catch (err: any) {
      showToast(`Error al otorgar cortesía: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  const handleTestWebhook = async () => {
    if (!selectedTenant) return;
    try {
      await api.post(`/webhooks/test/${selectedTenant.id}`);
      const logsRes = await api.get<WebhookLogItem[]>(`/webhooks/logs/${selectedTenant.id}`);
      setWebhookLogs(logsRes.data);
      showToast('Webhook de prueba despachado con firma HMAC SHA-256.', 'success');
    } catch (err: any) {
      showToast(`Error al enviar webhook de prueba: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  // CRM KPI calculations
  const totalClients = tenants.length;
  const trialClients = tenants.filter((t) => t.status === 'trial').length;
  const activeClients = tenants.filter((t) => t.status === 'active').length;
  const seniatActiveCount = tenants.filter((t) => t.activo_seniat).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight m-0">
              Gestión de Clientes (CRM)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              SaaS multiusuario
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Control integral de suscriptores, monitoreo de pruebas de 30 días procedentes de Xion-Manager y metadatos fiscales desacoplados del SENIAT.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={handleProcessCycle}
            disabled={processingCycle}
            className="px-3.5 py-1.5 bg-white dark:bg-[#121215] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer border border-slate-200/70 dark:border-zinc-800 disabled:opacity-50"
            title="Ejecutar ciclo de cobro automático"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${processingCycle ? 'animate-spin text-purple-600' : 'text-slate-400'}`} />
            <span>{processingCycle ? 'Procesando...' : 'Ciclo de Cobro'}</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-medium rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer shadow-none"
          >
            <PlusCircle className="w-3.5 h-3.5 text-white" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* CRM Metric Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#121215] border border-slate-100 dark:border-zinc-800/80 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Clientes Totales</span>
            <User className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{totalClients}</p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">En base de datos</span>
        </div>

        <div className="bg-white dark:bg-[#121215] border border-slate-100 dark:border-zinc-800/80 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Pruebas 30 Días</span>
            <Clock className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{trialClients}</p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">Incorporación a Xion-Manager</span>
        </div>

        <div className="bg-white dark:bg-[#121215] border border-slate-100 dark:border-zinc-800/80 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Suscripciones Activas</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{activeClients}</p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">Pagos al día</span>
        </div>

        <div className="bg-white dark:bg-[#121215] border border-slate-100 dark:border-zinc-800/80 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Fiscal del SENIAT</span>
            <FileText className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{seniatActiveCount}</p>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
            {seniatActiveCount > 0 ? 'Con Facturación Activa' : 'Modo MVP (Dormido)'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, contacto, WhatsApp, RIF o email..."
            className="w-full bg-white dark:bg-[#121215] border border-slate-200/60 dark:border-zinc-800/80 rounded-full pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-600 transition-colors shadow-none"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: '', label: 'Todos' },
            { id: 'trial', label: 'Prueba (Trial)' },
            { id: 'active', label: 'Activos' },
            { id: 'suspended', label: 'Desactivados (Suspendidos)' },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-none'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-zinc-800/50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white dark:bg-[#121215] border border-slate-100 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
            <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80 bg-transparent">
              <tr>
                <th className="py-3.5 px-6 min-w-[200px] whitespace-nowrap font-medium">Cliente / Suscriptor</th>
                <th className="py-3.5 px-6 min-w-[130px] whitespace-nowrap font-medium">Identificación</th>
                <th className="py-3.5 px-6 min-w-[100px] whitespace-nowrap font-medium">Saldo</th>
                <th className="py-3.5 px-6 min-w-[170px] whitespace-nowrap font-medium">Plan y Conteo Regresivo</th>
                <th className="py-3.5 px-6 min-w-[120px] whitespace-nowrap font-medium">Estado</th>
                <th className="py-3.5 px-6 min-w-[100px] whitespace-nowrap font-medium">Canal</th>
                <th className="py-3.5 px-6 min-w-[110px] whitespace-nowrap font-medium">Régimen</th>
                <th className="py-3.5 px-6 min-w-[130px] text-right whitespace-nowrap font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-slate-400 dark:text-zinc-500">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-800 dark:border-zinc-700 dark:border-t-white mb-2"></div>
                    <p className="text-xs font-medium">Cargando directorio de clientes...</p>
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 dark:text-zinc-500">
                    <Building2 className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
                    <p className="font-semibold text-slate-800 dark:text-zinc-200 text-sm">No se encontraron clientes registrados</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      Los clientes ingresados desde Xion-Manager aparecerán automáticamente aquí.
                    </p>
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const isTrial = t.status === 'trial';
                  const daysRem = t.trial_days_remaining ?? 0;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                      {/* Cliente / Suscriptor */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center text-xs font-semibold shrink-0">
                            {t.commercial_name ? t.commercial_name.trim().charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => openTenantDetail(t.id)}
                              className="font-semibold text-slate-800 dark:text-zinc-100 text-xs hover:text-purple-600 transition-colors block text-left truncate cursor-pointer"
                              title={t.commercial_name}
                            >
                              {t.commercial_name}
                            </button>
                            <span className="text-[11px] text-slate-400 dark:text-zinc-500 block truncate">
                              {t.contact_name || 'Sin contacto'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Identificación - Texto plano */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-600 dark:text-zinc-400">
                          {t.id_doc_number ? `${t.id_doc_type || 'V'}-${t.id_doc_number}` : (t.tax_id || '—')}
                        </span>
                      </td>

                      {/* Saldo - Texto plano */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="text-xs font-mono text-slate-800 dark:text-zinc-200">
                          <span className="font-medium">${(t.wallet_balance ?? 0).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 font-sans block">USD</span>
                        </div>
                      </td>

                      {/* Plan y Conteo Regresivo */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-800 dark:text-zinc-200 font-medium block">
                            {t.active_plan_name || 'Xion'} {t.active_plan_price !== undefined ? `$ ${t.active_plan_price.toFixed(2)} USD` : '$ 29,00 USD'}
                          </span>

                          {t.in_grace_period ? (
                            <span className="text-[11px] text-amber-600 dark:text-amber-500 font-medium block">
                              Prorroga activa
                            </span>
                          ) : t.is_due ? (
                            <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium block">
                              Cobro vencido
                            </span>
                          ) : t.countdown_days !== undefined ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium block">
                              Cobro en: {t.countdown_days}d {t.countdown_hours ?? 0}h
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 block">Sin ciclo</span>
                          )}
                        </div>
                      </td>

                      {/* Estado CRM - Texto plano en color sutil */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isTrial ? (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
                            Prueba ({daysRem > 0 ? `${daysRem} días` : 'finalizada'})
                          </span>
                        ) : t.status === 'active' ? (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500">
                            Activo
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-rose-500 dark:text-rose-400">
                            Suspendido
                          </span>
                        )}
                      </td>

                      {/* Canal - Texto plano */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 uppercase">
                          {t.delivery_channel === 'whatsapp' ? 'WhatsApp' : t.delivery_channel === 'telegram' ? 'Telegram' : t.delivery_channel === 'all' ? 'Todos' : 'Correo'}
                        </span>
                      </td>

                      {/* Régimen SENIAT - Texto plano */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-800 dark:text-zinc-200">SENIAT</div>
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500">{t.activo_seniat ? 'Activo' : 'MVP'}</div>
                      </td>

                      {/* Acciones Compactas - Iconos delgados outline */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            title="Editar datos del cliente"
                          >
                            <Pencil className="w-4 h-4 stroke-[1.5]" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(t.id, t.status, t.commercial_name)}
                            className={`p-1 transition-colors cursor-pointer ${
                              t.status === 'suspended' || t.status === 'frozen'
                                ? 'text-emerald-500 hover:text-emerald-700'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
                            }`}
                            title={t.status === 'suspended' || t.status === 'frozen' ? 'Reactivar Cliente' : 'Bloquear / Suspender'}
                          >
                            <Ban className="w-4 h-4 stroke-[1.5]" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(t.id, t.status, t.commercial_name)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Desactivar / Suspender"
                          >
                            <Trash2 className="w-4 h-4 stroke-[1.5]" />
                          </button>
                          <button
                            onClick={() => openTenantDetail(t.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                            title="Ver ficha CRM completa"
                          >
                            <MoreHorizontal className="w-4 h-4 stroke-[1.5]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Drawer / Ficha Completa del Cliente */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white dark:bg-[#121215] border-l border-slate-200 dark:border-zinc-800 w-full max-w-xl h-full p-6 overflow-y-auto space-y-6 shadow-2xl flex flex-col justify-between text-slate-900 dark:text-white transition-colors">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{selectedTenant.commercial_name}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {selectedTenant.id_doc_type || 'V'}-{selectedTenant.id_doc_number || selectedTenant.tax_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center space-x-2">
                    <span>Contacto: <strong>{selectedTenant.contact_name || 'No especificado'}</strong></span>
                    <span>•</span>
                    <span>Origen: <strong>{selectedTenant.crm_lead_source || 'manual'}</strong></span>
                  </p>
                </div>

                <button
                  onClick={() => setSelectedTenant(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-100 dark:border-zinc-800 space-x-4 text-xs font-semibold">
                <button
                  onClick={() => setActiveDrawerTab('profile')}
                  className={`pb-2.5 transition-colors cursor-pointer ${
                    activeDrawerTab === 'profile'
                      ? 'text-accent border-b-2 border-accent font-bold'
                      : 'text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-200'
                  }`}
                >
                  Operativo & CRM
                </button>

                <button
                  onClick={() => setActiveDrawerTab('fiscal')}
                  className={`pb-2.5 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    activeDrawerTab === 'fiscal'
                      ? 'text-accent border-b-2 border-accent font-bold'
                      : 'text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Perfil Fiscal SENIAT</span>
                  {fiscalData.activo_seniat && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  )}
                </button>

                <button
                  onClick={() => setActiveDrawerTab('comprobantes')}
                  className={`pb-2.5 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    activeDrawerTab === 'comprobantes'
                      ? 'text-accent border-b-2 border-accent font-bold'
                      : 'text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Comprobantes & Cobros</span>
                </button>

                <button
                  onClick={() => setActiveDrawerTab('webhooks')}
                  className={`pb-2.5 transition-colors cursor-pointer flex items-center space-x-1.5 ${
                    activeDrawerTab === 'webhooks'
                      ? 'text-accent border-b-2 border-accent font-bold'
                      : 'text-slate-400 dark:text-zinc-400 hover:text-slate-600 dark:hover:text-zinc-200'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Licencia & Webhooks</span>
                </button>
              </div>

              {/* TAB 1: OPERATIVO & CRM */}
              {activeDrawerTab === 'profile' && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Estado de Suscripción
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-900 text-white">
                        {selectedTenant.status}
                      </span>
                    </div>

                    {selectedTenant.status === 'trial' && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-amber-700">Prueba Gratuita de 30 Días</span>
                          <span className="font-mono text-amber-700 font-bold">
                            {selectedTenant.trial_days_remaining ?? 0} días restantes
                          </span>
                        </div>
                        <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, ((selectedTenant.trial_days_remaining ?? 0) / 30) * 100))}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Operational Data Cards */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2 text-xs text-slate-700">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                      <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                        Datos Operativos del Suscriptor
                      </h4>
                      <button
                        onClick={() => openEditModal(selectedTenant)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Modificar datos operacionales"
                      >
                        <Edit3 className="w-3 h-3 text-slate-500" />
                        <span>Editar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Persona de Contacto:</span>
                        <strong className="text-slate-800">{selectedTenant.contact_name || 'No registrada'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Cédula / Identidad:</span>
                        <strong className="text-slate-800">
                          {selectedTenant.id_doc_type}-{selectedTenant.id_doc_number || selectedTenant.tax_id || 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Email de Aviso:</span>
                        <strong className="text-slate-800 font-mono">{selectedTenant.owner_email}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">WhatsApp Directo:</span>
                        <a
                          href={`https://wa.me/${selectedTenant.owner_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-emerald-600 hover:underline flex items-center space-x-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>{selectedTenant.owner_phone}</span>
                        </a>
                      </div>
                    </div>

                    {selectedTenant.crm_notes && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <span className="text-slate-400 block text-[10px] mb-1">Notas Internas CRM:</span>
                        <p className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 text-slate-700 text-xs italic">
                          {selectedTenant.crm_notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Wallet Balance & Automated Renewal Card */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                          Billetera del Cliente & Débito Automático
                        </h4>
                      </div>
                      <span className="font-mono font-extrabold text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                        ${(selectedTenant.wallet_balance ?? 0).toFixed(2)} USD
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Canal de Nota de Entrega:</span>
                        <strong className="text-slate-800 uppercase flex items-center space-x-1">
                          <span>
                            {selectedTenant.delivery_channel === 'whatsapp' ? '💬 WhatsApp' : selectedTenant.delivery_channel === 'telegram' ? '✈️ Telegram' : selectedTenant.delivery_channel === 'all' ? '🌐 Todos los Canales' : '📧 Correo Electrónico'}
                          </span>
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Chat ID Telegram:</span>
                        <strong className="text-slate-800 font-mono">
                          {selectedTenant.telegram_chat_id || 'No configurado'}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        onClick={() => openRechargeModal(selectedTenant)}
                        className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-1"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Abonar Saldo</span>
                      </button>

                      {((selectedTenant.is_due || selectedTenant.status === 'suspended') && (selectedTenant.wallet_balance ?? 0) >= (selectedTenant.active_plan_price ?? 29.0)) && (
                        <button
                          onClick={() => handleRenewFromBalance(selectedTenant.id, selectedTenant.commercial_name)}
                          className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center space-x-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Renovar con Saldo</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Subscription Contract & Countdown */}
                  {selectedTenant.active_subscription && (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>Suscripción & Conteo Regresivo</span>
                        </h4>
                        {selectedTenant.in_grace_period ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                            ⏱️ Prórroga 48h activa
                          </span>
                        ) : selectedTenant.is_due ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                            🚨 Cobro Vencido
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ⏳ {selectedTenant.countdown_days ?? 0}d {selectedTenant.countdown_hours ?? 0}h restantes
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Plan Actual:</span>
                          <strong>
                            {selectedTenant.active_subscription.plan?.name}
                            {selectedTenant.active_subscription.plan?.price_usd ? ` ($${selectedTenant.active_subscription.plan.price_usd} USD)` : ''}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Ciclo:</span>
                          <strong className="capitalize">{selectedTenant.active_subscription.billing_cycle}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Próximo Cobro:</span>
                          <strong className="text-emerald-600 font-mono">
                            {new Date(selectedTenant.active_subscription.current_period_end).toLocaleDateString()}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Cortesías concedidas:</span>
                          <strong className="text-amber-600">{selectedTenant.courtesy_days_granted} días</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      onClick={() => openEditModal(selectedTenant)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Editar Ficha</span>
                    </button>
                    <button
                      onClick={() => setShowCourtesyModal(true)}
                      className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                    >
                      + Prórroga
                    </button>
                    <button
                      onClick={() => handleToggleStatus(selectedTenant.id, selectedTenant.status, selectedTenant.commercial_name)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-1 ${
                        selectedTenant.status === 'suspended' || selectedTenant.status === 'frozen'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>
                        {selectedTenant.status === 'suspended' || selectedTenant.status === 'frozen'
                          ? 'Reactivar'
                          : 'Desactivar'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PERFIL FISCAL SENIAT (FEATURE FLAG) */}
              {activeDrawerTab === 'fiscal' && (
                <div className="space-y-4">
                  {/* Master Feature Flag Banner */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      fiscalData.activo_seniat
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>Módulo de Facturación Fiscal SENIAT</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {fiscalData.activo_seniat
                            ? 'ACTIVO: El sistema exige validación formal de RIF y emite facturas legales con IVA 16%.'
                            : 'MODO MVP (DORMIDO): Facturación formal apagada. El sistema genera recibos internos sin fricción.'}
                        </p>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fiscalData.activo_seniat || false}
                          onChange={(e) => setFiscalData({ ...fiscalData, activo_seniat: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Fiscal Form */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                      Metadatos Tributarios del Contribuyente
                    </h5>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Tipo RIF:</label>
                        <select
                          value={fiscalData.tipo_documento_fiscal || 'RIF_J'}
                          onChange={(e) => setFiscalData({ ...fiscalData, tipo_documento_fiscal: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 font-semibold"
                        >
                          <option value="RIF_J">RIF J (Jurídico)</option>
                          <option value="RIF_V">RIF V (Natural)</option>
                          <option value="RIF_E">RIF E (Extranjero)</option>
                          <option value="RIF_G">RIF G (Gubernamental)</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Número RIF Canónico:
                        </label>
                        <input
                          type="text"
                          value={fiscalData.numero_rif || ''}
                          onChange={(e) => setFiscalData({ ...fiscalData, numero_rif: e.target.value })}
                          placeholder="ej: J-12345678-9"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        Razón Social Mercantil Registrada:
                      </label>
                      <input
                        type="text"
                        value={fiscalData.razon_social || ''}
                        onChange={(e) => setFiscalData({ ...fiscalData, razon_social: e.target.value })}
                        placeholder="ej: Inversiones Los Andes C.A."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                      />
                    </div>

                    <div className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        id="es_contribuyente_especial"
                        checked={fiscalData.es_contribuyente_especial || false}
                        onChange={(e) =>
                          setFiscalData({ ...fiscalData, es_contribuyente_especial: e.target.checked })
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="es_contribuyente_especial" className="text-xs text-slate-700 font-medium">
                        Contribuyente Especial (Sujeto a retención de IVA 75% o 100%)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Estado:</label>
                        <input
                          type="text"
                          value={fiscalData.estado || ''}
                          onChange={(e) => setFiscalData({ ...fiscalData, estado: e.target.value })}
                          placeholder="ej: Miranda"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Municipio:</label>
                        <input
                          type="text"
                          value={fiscalData.municipio || ''}
                          onChange={(e) => setFiscalData({ ...fiscalData, municipio: e.target.value })}
                          placeholder="ej: Sucre"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        Dirección Fiscal Detallada:
                      </label>
                      <textarea
                        rows={2}
                        value={fiscalData.direccion_detallada || ''}
                        onChange={(e) => setFiscalData({ ...fiscalData, direccion_detallada: e.target.value })}
                        placeholder="Calle, avenida, edificio, piso, oficina o local..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                      ></textarea>
                    </div>

                    <button
                      onClick={handleSaveFiscalProfile}
                      disabled={savingFiscal}
                      className="w-full py-2.5 bg-[#18181b] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer disabled:opacity-50 mt-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingFiscal ? 'Guardando Metadatos...' : 'Guardar Perfil Fiscal'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: COMPROBANTES & COBROS */}
              {activeDrawerTab === 'comprobantes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Histórico de Comprobantes</h4>
                      <p className="text-[11px] text-slate-500">
                        {fiscalData.activo_seniat
                          ? 'Régimen SENIAT Activo: Se emiten Facturas Fiscales.'
                          : 'Modo MVP: Se emiten Recibos de Cobro y Proformas internas.'}
                      </p>
                    </div>

                    <button
                      onClick={() => setShowComprobanteModal(true)}
                      className="px-3 py-1.5 bg-[#18181b] text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {fiscalData.activo_seniat ? 'Emitir Factura Fiscal' : 'Emitir Recibo de Cobro'}
                      </span>
                    </button>
                  </div>

                  {(!selectedTenant.recent_comprobantes || selectedTenant.recent_comprobantes.length === 0) ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200/80">
                      <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-slate-600">No hay comprobantes emitidos aún</p>
                      <p className="text-[10px] text-slate-400">
                        Puedes generar un recibo de cobro o proforma interna con un clic.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTenant.recent_comprobantes.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white border border-slate-200/80 rounded-2xl p-3.5 text-xs space-y-1.5 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">{c.numero_comprobante}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.tipo_documento === 'FACTURA_FISCAL'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {c.tipo_documento}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 text-slate-600">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Monto Base:</span>
                              <strong>${c.monto_usd.toFixed(2)} USD</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">IVA ({c.porcentaje_iva}%):</span>
                              <span>Bs. {c.monto_iva_ves.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Total en VES:</span>
                              <strong className="text-slate-900 font-mono">Bs. {c.total_ves.toFixed(2)}</strong>
                            </div>
                          </div>

                          {c.numero_control && (
                            <div className="text-[10px] font-mono text-indigo-600 pt-1">
                              N° Control Fiscal SENIAT: {c.numero_control}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LICENCIA & WEBHOOKS */}
              {activeDrawerTab === 'webhooks' && (
                <div className="space-y-4">
                  {/* Cryptographic License */}
                  {selectedTenant.latest_license && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                        <Key className="w-4 h-4 text-slate-700" />
                        <span>Licencia Criptográfica Emitida (RS256)</span>
                      </h4>
                      <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                        <p>
                          <strong>Emitida:</strong> {new Date(selectedTenant.latest_license.issued_at).toLocaleDateString()}
                        </p>
                        <p>
                          <strong>Expira:</strong> {new Date(selectedTenant.latest_license.expires_at).toLocaleDateString()}
                        </p>
                        <div className="p-2 bg-white rounded border border-slate-200 text-[10px] truncate text-slate-500">
                          Signature: {selectedTenant.latest_license.id}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Webhook Configuration & Dispatch Ping */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate pr-2">
                        Endpoint: <span className="font-mono text-slate-500">{selectedTenant.webhook_url || 'No configurado'}</span>
                      </span>
                      <button
                        onClick={handleTestWebhook}
                        disabled={!selectedTenant.webhook_url}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold rounded-lg shrink-0 disabled:opacity-40 cursor-pointer"
                      >
                        Probar Ping
                      </button>
                    </div>
                  </div>

                  {/* Webhook Logs */}
                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Historial de Despachos</h5>
                    {webhookLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No hay eventos de webhook registrados.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {webhookLogs.map((log) => (
                          <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900">{log.event_type}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  log.response_code && log.response_code >= 200 && log.response_code < 300
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                HTTP {log.response_code || 'Err'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {new Date(log.dispatched_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Emit Comprobante Modal */}
      {showComprobanteModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-slate-900 dark:text-white transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-accent" />
                <span>
                  {fiscalData.activo_seniat ? 'Generar Factura Fiscal SENIAT' : 'Generar Recibo de Cobro (MVP)'}
                </span>
              </h3>
              <button
                onClick={() => setShowComprobanteModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">Monto en Divisa (USD):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={comprobanteMontoUsd}
                  onChange={(e) => setComprobanteMontoUsd(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">Tasa Oficial BCV (VES/USD):</label>
                <input
                  type="number"
                  step="0.01"
                  value={comprobanteTasaBcv}
                  onChange={(e) => setComprobanteTasaBcv(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="aplica_igtf_modal"
                  checked={comprobanteAplicaIgtf}
                  onChange={(e) => setComprobanteAplicaIgtf(e.target.checked)}
                  className="rounded border-slate-300 dark:border-zinc-700 text-accent focus:ring-accent"
                />
                <label htmlFor="aplica_igtf_modal" className="text-slate-700 dark:text-zinc-300 text-xs cursor-pointer">
                  Aplica 3% IGTF (Cobro en divisas en efectivo/cripto)
                </label>
              </div>

              {/* Calculations Preview */}
              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3 space-y-1 text-slate-600 dark:text-zinc-300">
                <div className="flex justify-between">
                  <span>Base Imponible:</span>
                  <span className="font-mono">Bs. {(comprobanteMontoUsd * comprobanteTasaBcv).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA ({fiscalData.activo_seniat ? '16%' : '0% MVP'}):</span>
                  <span className="font-mono">
                    Bs. {fiscalData.activo_seniat ? ((comprobanteMontoUsd * comprobanteTasaBcv) * 0.16).toFixed(2) : '0.00'}
                  </span>
                </div>
                {comprobanteAplicaIgtf && (
                  <div className="flex justify-between">
                    <span>IGTF (3%):</span>
                    <span className="font-mono">
                      Bs. {((comprobanteMontoUsd * comprobanteTasaBcv) * 0.03).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-zinc-800 pt-1 mt-1">
                  <span>Total en Bolívares:</span>
                  <span className="font-mono">
                    Bs.{' '}
                    {(
                      comprobanteMontoUsd * comprobanteTasaBcv +
                      (fiscalData.activo_seniat ? (comprobanteMontoUsd * comprobanteTasaBcv) * 0.16 : 0) +
                      (comprobanteAplicaIgtf ? (comprobanteMontoUsd * comprobanteTasaBcv) * 0.03 : 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComprobanteModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerateComprobante}
                  disabled={generatingComprobante || comprobanteMontoUsd <= 0}
                  className="px-4 py-2 bg-accent hover:opacity-90 text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {generatingComprobante ? 'Emitiendo...' : 'Emitir Comprobante'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Courtesy Days Modal */}
      {showCourtesyModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl text-slate-900 dark:text-white transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Otorgar Días de Prórroga</h3>
              <button
                onClick={() => setShowCourtesyModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">Días a otorgar:</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={courtesyDays}
                  onChange={(e) => setCourtesyDays(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">Motivo administrativo:</label>
                <input
                  type="text"
                  value={courtesyReason}
                  onChange={(e) => setCourtesyReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourtesyModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGrantCourtesyDays}
                  className="px-4 py-2 bg-accent hover:opacity-90 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Confirmar Prórroga
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <User className="w-4 h-4 text-accent" />
                  <span>Nuevo Cliente (Registro sin Fricción)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Alta ágil en MVP con soporte para otorgar 30 días de prueba gratuita automática.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Nombre Comercial / Negocio:</label>
                  <input
                    type="text"
                    required
                    value={commName}
                    onChange={(e) => setCommName(e.target.value)}
                    placeholder="ej: Bodegón Los Samanes"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Nombre de Contacto:</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="ej: José Rodríguez"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Email (Login & Avisos):</label>
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="contacto@bodegon.com"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">WhatsApp de Alertas:</label>
                  <input
                    type="text"
                    required
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="+58 412 1234567"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Document Identity */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Tipo Documento:</label>
                  <select
                    value={idDocType}
                    onChange={(e) => setIdDocType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="V">V (Cédula)</option>
                    <option value="J">J (RIF)</option>
                    <option value="E">E (Extranjero)</option>
                    <option value="G">G (Gobierno)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cédula o RIF Informal:</label>
                  <input
                    type="text"
                    value={idDocNumber}
                    onChange={(e) => setIdDocNumber(e.target.value)}
                    placeholder="ej: 18456789 (Opcional en MVP)"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Plan Inicial:</label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.price_usd})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Ciclo de Facturación:</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
              </div>

              {/* Billetera Inicial y Canal de Notificación / Nota de Entrega */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Saldo Inicial Billetera ($ USD):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={walletBalance}
                    onChange={(e) => setWalletBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Canal de Nota de Entrega:</label>
                  <select
                    value={deliveryChannel}
                    onChange={(e) => setDeliveryChannel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="email">📧 Correo Electrónico</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="telegram">✈️ Telegram</option>
                    <option value="all">🌐 Todos los canales</option>
                  </select>
                </div>
              </div>

              {(deliveryChannel === 'telegram' || deliveryChannel === 'all') && (
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Chat ID de Telegram:</label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="ej: 987654321 o @usuario"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              )}

              {/* 30 Day Free Trial Toggle */}
              <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-900 dark:text-amber-300 block text-xs">
                    Otorgar Prueba Gratuita de 30 Días
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    Genera la licencia criptográfica RS256 válida por 30 días para CRM & Monitoreo.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={grant30DayTrial}
                  onChange={(e) => setGrant30DayTrial(e.target.checked)}
                  className="rounded border-amber-300 dark:border-amber-700 text-accent focus:ring-accent w-4 h-4"
                />
              </div>

              {/* Collapsed Optional SENIAT section */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFiscalAccordion(!showFiscalAccordion)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="font-semibold text-xs flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                    <span>Datos Fiscales SENIAT (Opcional - Permanecen Inactivos en MVP)</span>
                  </span>
                  {showFiscalAccordion ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFiscalAccordion && (
                  <div className="p-3 bg-white dark:bg-zinc-900 space-y-2 text-xs border-t border-slate-100 dark:border-zinc-800">
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      En el MVP, los datos fiscales no son necesarios para operar. Podrán completarse o activarse en cualquier momento desde la ficha del cliente.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !commName || !ownerEmail || !ownerPhone}
                  className="px-4 py-2 bg-accent hover:opacity-90 text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {creating ? 'Registrando...' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && editingTenant && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Edit3 className="w-4 h-4 text-accent" />
                  <span>Editar Cliente (CRM)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Modificación de datos operativos, información de contacto y estado de la cuenta.
                </p>
              </div>

              <button
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Nombre Comercial / Negocio:</label>
                  <input
                    type="text"
                    required
                    value={editForm.commercial_name}
                    onChange={(e) => setEditForm({ ...editForm, commercial_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Nombre de Contacto:</label>
                  <input
                    type="text"
                    value={editForm.contact_name}
                    onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                    placeholder="Persona responsable"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Email de Avisos:</label>
                  <input
                    type="email"
                    required
                    value={editForm.owner_email}
                    onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">WhatsApp / Teléfono:</label>
                  <input
                    type="text"
                    required
                    value={editForm.owner_phone}
                    onChange={(e) => setEditForm({ ...editForm, owner_phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Document Identity and Tax ID */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Tipo Doc.:</label>
                  <select
                    value={editForm.id_doc_type}
                    onChange={(e) => setEditForm({ ...editForm, id_doc_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="V">V (Cédula)</option>
                    <option value="J">J (RIF)</option>
                    <option value="E">E (Extranjero)</option>
                    <option value="G">G (Gobierno)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cédula o Doc.:</label>
                  <input
                    type="text"
                    value={editForm.id_doc_number}
                    onChange={(e) => setEditForm({ ...editForm, id_doc_number: e.target.value })}
                    placeholder="12345678"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">ID Fiscal / RIF:</label>
                  <input
                    type="text"
                    value={editForm.tax_id}
                    onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
                    placeholder="J-12345678-0"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Estado de la Cuenta:</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="active">Activo (Suscrito y habilitado)</option>
                  <option value="trial">Prueba (Trial 30 Días)</option>
                  <option value="suspended">Desactivado / Suspendido (Sin acceso)</option>
                  <option value="frozen">Congelado (Temporalmente inactivo)</option>
                </select>
              </div>

              {/* CRM Internal Notes */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Notas Internas CRM:</label>
                <textarea
                  rows={3}
                  value={editForm.crm_notes}
                  onChange={(e) => setEditForm({ ...editForm, crm_notes: e.target.value })}
                  placeholder="Acuerdos comerciales, seguimiento, preferencias de contacto o soporte..."
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                ></textarea>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Webhook URL (Opcional):</label>
                <input
                  type="url"
                  value={editForm.webhook_url}
                  onChange={(e) => setEditForm({ ...editForm, webhook_url: e.target.value })}
                  placeholder="https://cliente.com/api/xion-webhook"
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Billetera y Canal de Entrega */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Saldo en Billetera ($ USD):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.wallet_balance}
                    onChange={(e) => setEditForm({ ...editForm, wallet_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Canal de Nota de Entrega:</label>
                  <select
                    value={editForm.delivery_channel}
                    onChange={(e) => setEditForm({ ...editForm, delivery_channel: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="email">📧 Correo Electrónico</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="telegram">✈️ Telegram</option>
                    <option value="all">🌐 Todos los canales</option>
                  </select>
                </div>
              </div>

              {(editForm.delivery_channel === 'telegram' || editForm.delivery_channel === 'all') && (
                <div>
                  <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Chat ID de Telegram:</label>
                  <input
                    type="text"
                    value={editForm.telegram_chat_id}
                    onChange={(e) => setEditForm({ ...editForm, telegram_chat_id: e.target.value })}
                    placeholder="ej: 987654321 o @usuario"
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editForm.commercial_name || !editForm.owner_email || !editForm.owner_phone}
                  className="px-4 py-2 bg-accent hover:opacity-90 text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recharge Wallet Balance Modal */}
      {showRechargeModal && rechargeTenant && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-slate-900 dark:text-white transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Abonar Saldo a Billetera</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Cliente: <strong>{rechargeTenant.commercial_name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRechargeModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRechargeBalance} className="space-y-3.5 text-xs">
              <div className="bg-slate-50 dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400">Saldo actual disponible:</span>
                <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  ${(rechargeTenant.wallet_balance ?? 0).toFixed(2)} USD
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Monto a Acreditar ($ USD):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-sm font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Motivo / Concepto del Abono:</label>
                <input
                  type="text"
                  required
                  value={rechargeReason}
                  onChange={(e) => setRechargeReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Auto renew toggle */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 block text-xs">
                    Renovación Automática Inmediata
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Si la cuenta está vencida o en prórroga y el saldo cubre el plan, se debita y reactiva al instante.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={rechargeAutoRenew}
                  onChange={(e) => setRechargeAutoRenew(e.target.checked)}
                  className="rounded border-emerald-300 dark:border-emerald-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRechargeModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={recharging || rechargeAmount <= 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>{recharging ? 'Acreditando...' : 'Acreditar Saldo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
