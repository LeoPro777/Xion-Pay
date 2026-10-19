import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import type { SystemSettings, AdminUser } from '../types';
import {
  DollarSign,
  ShieldCheck,
  KeyRound,
  Users,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Plus,
  UserCheck,
  UserX,
  CreditCard,
  Check,
  Sliders,
} from 'lucide-react';

interface SettingsPageProps {
  onRateUpdated?: (newRate: number) => void;
  onOpenPreferences?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onRateUpdated, onOpenPreferences }) => {
  const { user } = useAuth();
  const { confirm, showToast } = useDialog();
  const [activeSection, setActiveSection] = useState<'rate' | 'accounts' | 'crypto' | 'admins'>('rate');

  // Rate state
  const [currentRate, setCurrentRate] = useState<number>(36.5);
  const [newRateInput, setNewRateInput] = useState<string>('36.50');
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState<boolean>(false);
  const [rateSuccess, setRateSuccess] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  // Admin users state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState<boolean>(false);
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminRole, setNewAdminRole] = useState<'superadmin' | 'operator' | 'auditor'>('operator');
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [savingAdmin, setSavingAdmin] = useState<boolean>(false);

  useEffect(() => {
    fetchSettings();
    if (user?.role === 'superadmin') {
      fetchAdmins();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await api.get<SystemSettings>('/settings');
      if (res.data?.usd_ves_rate) {
        setCurrentRate(res.data.usd_ves_rate);
        setNewRateInput(res.data.usd_ves_rate.toString());
        setRateUpdatedAt(res.data.updated_at || null);
      }
    } catch (err) {
      console.error('Error al obtener configuraciones:', err);
    }
  };

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await api.get<AdminUser[]>('/auth/admins');
      setAdmins(res.data || []);
    } catch (err) {
      console.warn('No se pudieron cargar administradores (requiere rol superadmin):', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newRateInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      setRateError('Ingresa un valor de tasa numérico válido mayor a 0.');
      return;
    }

    setSavingRate(true);
    setRateError(null);
    setRateSuccess(null);

    try {
      const res = await api.put<SystemSettings>('/settings/exchange-rate', { usd_ves_rate: parsed });
      setCurrentRate(res.data.usd_ves_rate);
      setRateUpdatedAt(res.data.updated_at || null);
      setRateSuccess(`Tasa actualizada a ${res.data.usd_ves_rate.toFixed(2)} Bs/USD con éxito.`);
      if (onRateUpdated) {
        onRateUpdated(res.data.usd_ves_rate);
      }
    } catch (err: any) {
      setRateError(err.response?.data?.message || 'Error al actualizar la tasa de cambio.');
    } finally {
      setSavingRate(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminName.trim()) return;

    setSavingAdmin(true);
    setAdminError(null);
    setAdminSuccess(null);

    try {
      await api.post('/auth/admins', {
        email: newAdminEmail.trim(),
        full_name: newAdminName.trim(),
        role: newAdminRole,
      });
      setAdminSuccess(`Administrador ${newAdminEmail} agregado a la lista blanca exitosamente.`);
      setNewAdminEmail('');
      setNewAdminName('');
      fetchAdmins();
    } catch (err: any) {
      setAdminError(err.response?.data?.message || 'Error agregando nuevo administrador.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleToggleAdminStatus = async (adminId: string, currentStatus: boolean, adminName?: string) => {
    const willDeactivate = currentStatus;
    const ok = await confirm({
      title: willDeactivate ? '¿Desactivar administrador?' : '¿Activar administrador?',
      message: willDeactivate
        ? `¿Desea revocar el acceso administrativo a "${adminName || 'este usuario'}"?`
        : `¿Desea restaurar el acceso administrativo a "${adminName || 'este usuario'}"?`,
      confirmText: willDeactivate ? 'Sí, desactivar' : 'Sí, activar',
      variant: willDeactivate ? 'danger' : 'info',
    });
    if (!ok) return;

    try {
      await api.patch(`/auth/admins/${adminId}/status?is_active=${!currentStatus}`);
      showToast(`Administrador ${willDeactivate ? 'desactivado' : 'activado'} exitosamente.`, 'success');
      fetchAdmins();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error cambiando estado del administrador.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Title & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800 gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Módulo de Configuración del Sistema
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 m-0 mt-0.5">
            Parámetros financieros oficiales, cuentas bancarias para Xion-Manager y lista blanca de administradores
          </p>
        </div>

        {onOpenPreferences && (
          <button
            type="button"
            onClick={onOpenPreferences}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Preferencias Visuales</span>
          </button>
        )}
      </div>

      {/* Top Section Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-zinc-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveSection('rate')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'rate'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Tasa Oficial BCV</span>
        </button>

        <button
          onClick={() => setActiveSection('accounts')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'accounts'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cuentas Receptoras</span>
        </button>

        <button
          onClick={() => setActiveSection('crypto')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'crypto'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Criptografía RS256</span>
        </button>

        {user?.role === 'superadmin' && (
          <button
            onClick={() => setActiveSection('admins')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'admins'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Administradores ({admins.length})</span>
          </button>
        )}
      </div>

      {/* SECTION 1: Tasa de Cambio Oficial */}
      {activeSection === 'rate' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                Ajuste de Tasa de Cambio Oficial (BCV)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                La tasa configurada se aplica en tiempo real para todos los cálculos multimoneda,
                planes tarifarios y conciliaciones de Pago Móvil en Xion-Manager y Xion-Pay.
              </p>
            </div>

            {rateSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{rateSuccess}</span>
              </div>
            )}

            {rateError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rateError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Tasa de Cambio Oficial USD a VES:
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="text"
                    required
                    value={newRateInput}
                    onChange={(e) => setNewRateInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white font-mono"
                    placeholder="36.50"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">
                    Bs / USD
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={savingRate}
                  className="px-5 py-2.5 bg-accent font-bold text-xs rounded-xl flex items-center space-x-2 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingRate ? 'Actualizando...' : 'Guardar y Publicar Tasa'}</span>
                </button>
              </div>
            </form>

            {rateUpdatedAt && (
              <div className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-zinc-800/80 pt-3 flex items-center space-x-1.5">
                <RefreshCw className="w-3 h-3" />
                <span>Última actualización registrada: {new Date(rateUpdatedAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Quick Calculator Card */}
          <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 m-0">
              Cálculo de Planes al Día
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">Plan Básico ($25 USD)</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  {(25 * currentRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">Plan Avanzado ($50 USD)</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  {(50 * currentRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-xl">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">Plan Enterprise ($150 USD)</span>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  {(150 * currentRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Cuentas Receptoras */}
      {activeSection === 'accounts' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                  Coordenadas Oficiales de Recepción de Pagos
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Estas coordenadas se suministran a las instancias de Xion-Manager vía{' '}
                  <code className="text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">
                    GET /api/v1/plans/catalog
                  </code>
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Público para Xion-Manager
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {/* Card 1: Pago Móvil */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Pago Móvil (VES)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-xs space-y-1 text-slate-600 dark:text-zinc-300 font-mono text-[11px]">
                  <p><span className="text-slate-400">Banco:</span> 0102 - Banco de Venezuela</p>
                  <p><span className="text-slate-400">Teléfono:</span> 0414-1234567</p>
                  <p><span className="text-slate-400">RIF:</span> J-50123456-7</p>
                  <p><span className="text-slate-400">Beneficiario:</span> Xion Technologies C.A.</p>
                </div>
              </div>

              {/* Card 2: Transferencia Banesco */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Transferencia Bancaria (VES)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-xs space-y-1 text-slate-600 dark:text-zinc-300 font-mono text-[11px]">
                  <p><span className="text-slate-400">Banco:</span> 0134 - Banesco</p>
                  <p><span className="text-slate-400">Cuenta:</span> 0134-1092-23-0001234567</p>
                  <p><span className="text-slate-400">RIF:</span> J-50123456-7</p>
                  <p><span className="text-slate-400">Beneficiario:</span> Xion Technologies C.A.</p>
                </div>
              </div>

              {/* Card 3: Zelle */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Zelle (USD)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-xs space-y-1 text-slate-600 dark:text-zinc-300 font-mono text-[11px]">
                  <p><span className="text-slate-400">Correo:</span> pagos@xionpay.com</p>
                  <p><span className="text-slate-400">Titular:</span> Xion Global LLC</p>
                  <p><span className="text-slate-400">Nota:</span> Indicar RIF de comercio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Criptografía y Licenciamiento */}
      {activeSection === 'crypto' && (
        <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-900 dark:text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                Autoridad Certificadora Criptográfica (RS256)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 m-0">
                Firma asimétrica RSA de 2048 bits para emisión y revocación de tokens de licencia
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Llave Privada de Firma (/app/certs/license_private.pem)</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 m-0">
                Protegida en el servidor. Nunca se expone fuera de Xion-Pay. Se utiliza para firmar los
                tokens que garantizan los límites de terminales y sucursales.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Llave Pública (/app/certs/license_public.pem)</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 m-0">
                Distribuida a las instancias cliente de Xion-Manager para verificar localmente la validez
                sin requerir conexión continua.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Gestión de Administradores */}
      {activeSection === 'admins' && user?.role === 'superadmin' && (
        <div className="space-y-6">
          {/* New Admin Form */}
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0">
              Registrar Nuevo Administrador en la Lista Blanca
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 m-0">
              El usuario podrá autenticarse a través de Google Workspace / Gmail con este correo.
            </p>

            {adminSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{adminSuccess}</span>
              </div>
            )}

            {adminError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adminError}</span>
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="email"
                required
                placeholder="correo@empresa.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <input
                type="text"
                required
                placeholder="Nombre Completo"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                className="bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <div className="flex space-x-2">
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as any)}
                  className="bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none flex-1"
                >
                  <option value="operator">Operador</option>
                  <option value="auditor">Auditor</option>
                  <option value="superadmin">Superadmin</option>
                </select>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-xs rounded-xl flex items-center space-x-1.5 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>
            </form>
          </div>

          {/* Admins Table */}
          <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 m-0">
                Lista Blanca Activa ({admins.length})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-6 font-semibold">Usuario</th>
                    <th className="py-3 px-6 font-semibold">Rol</th>
                    <th className="py-3 px-6 font-semibold">Estado</th>
                    <th className="py-3 px-6 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {loadingAdmins ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                        Cargando administradores autorizados...
                      </td>
                    </tr>
                  ) : admins.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                        No hay administradores registrados en la lista blanca.
                      </td>
                    </tr>
                  ) : (
                    admins.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/40">
                      <td className="py-3.5 px-6">
                        <span className="font-bold text-slate-900 dark:text-white block">{a.full_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{a.email}</span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300 uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                          {a.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            a.is_active
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {a.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {a.email !== user?.email && (
                          <button
                            onClick={() => handleToggleAdminStatus(a.id, a.is_active, a.full_name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title={a.is_active ? 'Desactivar cuenta' : 'Activar cuenta'}
                          >
                            {a.is_active ? <UserX className="w-4 h-4 text-rose-500" /> : <UserCheck className="w-4 h-4 text-emerald-500" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
