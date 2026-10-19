import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { api } from '../../services/api';
import type { TenantListItem, PaymentReport } from '../../types';
import {
  Bell,
  Wifi,
  Settings,
  LogOut,
  CheckCircle2,
  ShieldCheck,
  Palette,
  Sliders,
  ChevronDown,
  Search,
  Command,
  Building2,
  Receipt,
  ArrowRight,
  RefreshCw,
  X,
  Radio,
} from 'lucide-react';

interface HeaderProps {
  currentRate?: number;
  onOpenSettings?: () => void;
  onOpenPreferences?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenPreferences,
  onNavigateTab,
}) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, clearNotifications } = useNotifications();
  const { bcvRate, bcvUpdatedAt, refreshBcvRate } = usePreferences();

  const [showNotificationPopover, setShowNotificationPopover] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showRateTooltip, setShowRateTooltip] = useState(false);
  const [syncingRate, setSyncingRate] = useState(false);

  // Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTenants, setSearchTenants] = useState<TenantListItem[]>([]);
  const [searchPayments, setSearchPayments] = useState<PaymentReport[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const rateMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus input when Command Palette opens
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      setSearchTenants([]);
      setSearchPayments([]);
    }
  }, [isCommandPaletteOpen]);

  // Execute quick search across Tenants and Payments
  useEffect(() => {
    if (!isCommandPaletteOpen || !searchQuery.trim()) {
      setSearchTenants([]);
      setSearchPayments([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [tenantsRes, paymentsRes] = await Promise.all([
          api.get<TenantListItem[]>('/tenants', { params: { search: searchQuery.trim() } }),
          api.get<PaymentReport[]>('/payments/inbox', { params: { status: 'all', limit: 8 } }),
        ]);

        setSearchTenants(tenantsRes.data.slice(0, 5));

        const q = searchQuery.toLowerCase().trim();
        const filteredPayments = paymentsRes.data.filter(
          (p) =>
            p.reference_number?.toLowerCase().includes(q) ||
            p.origin_bank?.toLowerCase().includes(q) ||
            p.tenant_commercial_name?.toLowerCase().includes(q) ||
            String(p.amount).includes(q)
        );
        setSearchPayments(filteredPayments.slice(0, 5));
      } catch (err) {
        console.error('Error en búsqueda global:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, isCommandPaletteOpen]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsDropdown(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target as Node)) {
        setShowNotificationPopover(false);
      }
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target as Node)) {
        setShowRateTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleManualSyncRate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingRate(true);
    await refreshBcvRate();
    setTimeout(() => setSyncingRate(false), 500);
  };

  const formattedSyncTime = bcvUpdatedAt
    ? new Date(bcvUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Reciente';

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'CD';

  return (
    <header className="h-16 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121215] px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors shadow-xs">
      {/* Brand & Subtitle */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-slate-900 dark:text-white" />
          <span className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-white uppercase">
            Xion-Pay <span className="text-slate-400 font-mono font-normal text-[10px]">v1.0</span>
          </span>
        </div>
        <span className="hidden lg:inline-block text-xs font-medium text-slate-500 dark:text-zinc-400 border-l border-slate-200 dark:border-zinc-800 pl-3">
          Autoridad Certificadora & Conciliación SaaS
        </span>
      </div>

      {/* Global Quick Search (Ctrl+K) Trigger */}
      <div className="flex-1 max-w-xs mx-4 hidden md:block">
        <button
          type="button"
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between bg-slate-100/80 dark:bg-zinc-850 hover:bg-slate-200/70 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 rounded-xl px-3 h-8 text-xs text-slate-400 dark:text-zinc-400 transition-colors cursor-pointer shadow-2xs"
          title="Búsqueda rápida en el sistema (Ctrl+K)"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px] truncate">Buscar inquilinos, pagos...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-zinc-400 shadow-2xs">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Header Right Action Bar */}
      <div className="flex items-center space-x-2.5">
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={() => setIsCommandPaletteOpen(true)}
          className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-850 text-slate-600 dark:text-zinc-300 cursor-pointer"
          title="Búsqueda rápida"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Exchange Rate Pill with Sync Metadata */}
        <div className="relative" ref={rateMenuRef}>
          <button
            onClick={() => setShowRateTooltip(!showRateTooltip)}
            className="hidden sm:inline-flex items-center h-8 px-3 rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50 dark:bg-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer shadow-xs gap-1.5"
            title="Detalle y sincronización de Tasa Oficial BCV"
          >
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">Tasa BCV:</span>
            <span className="font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {bcvRate.toFixed(2)} Bs
            </span>
            <button
              onClick={handleManualSyncRate}
              className="p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer rounded"
              title="Sincronizar tasa de cambio en vivo"
            >
              <RefreshCw className={`w-3 h-3 ${syncingRate ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          </button>

          {/* Rate Dropdown Tooltip */}
          {showRateTooltip && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Tasa Oficial de Cambio</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">BCV Activa</span>
              </div>
              <div className="py-2.5 space-y-1 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500 dark:text-zinc-400">Valor actual:</span>
                  <span className="font-mono font-extrabold text-slate-900 dark:text-white">{bcvRate.toFixed(2)} VES/USD</span>
                </div>
                <div className="flex justify-between items-baseline text-[11px]">
                  <span className="text-slate-500 dark:text-zinc-400">Última sinc:</span>
                  <span className="font-mono text-slate-600 dark:text-zinc-300">{formattedSyncTime}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={handleManualSyncRate}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingRate ? 'animate-spin' : ''}`} />
                  <span>Sincronizar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRateTooltip(false);
                    if (onOpenSettings) onOpenSettings();
                  }}
                  className="py-1.5 px-3 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Modificar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Connected Status Pill */}
        <div className="hidden md:inline-flex items-center h-8 px-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium shadow-xs gap-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold text-xs">Conectado</span>
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notificationMenuRef}>
          <button
            onClick={() => {
              setShowNotificationPopover(!showNotificationPopover);
              if (unreadCount > 0) clearNotifications();
            }}
            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 relative transition-colors shadow-xs cursor-pointer"
            title="Centro de notificaciones en tiempo real"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotificationPopover && (
            <div className="absolute right-0 mt-2 w-84 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 z-50 text-slate-900 dark:text-white animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    Centro de Notificaciones
                  </span>
                  {notifications.length > 0 && (
                    <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                      {notifications.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> En Vivo
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto mt-2 space-y-2 pr-0.5">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No hay alertas o eventos recientes.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="text-xs bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 flex items-start space-x-2.5 hover:bg-slate-100/50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {n.type === 'WEBHOOK_DISPATCHED' ? (
                        <Radio className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 dark:text-zinc-200 font-medium leading-relaxed m-0 text-xs">
                          {n.message}
                        </p>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                          <span>{n.timestamp}</span>
                          {n.type === 'NEW_PAYMENT_REPORTED' && onNavigateTab && (
                            <button
                              onClick={() => {
                                setShowNotificationPopover(false);
                                onNavigateTab('reconciliation');
                              }}
                              className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                            >
                              Ver conciliación →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                  <button
                    onClick={clearNotifications}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    Marcar todas como leídas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Avatar Circle */}
        {user && (
          <div
            className="w-8 h-8 rounded-full bg-accent font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer select-none"
            title={`${user.full_name} (${user.role})`}
          >
            {initials}
          </div>
        )}

        {/* SETTINGS GEAR DROPDOWN MENU */}
        {user && (
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center space-x-1 ${
                showSettingsDropdown
                  ? 'bg-accent border-[var(--accent)]'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
              title="Menú de Configuración y Preferencias"
            >
              <Settings className="w-4 h-4" />
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Dropdown Menu Box */}
            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-900 dark:text-white">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-zinc-800/80 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                    Ajustes de Plataforma
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 block truncate">
                    {user.email}
                  </span>
                </div>

                {/* Option 1: Configuración del Sistema */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsDropdown(false);
                    if (onOpenSettings) onOpenSettings();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left"
                >
                  <Sliders className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  <div>
                    <span className="block font-semibold">Módulo de Configuración</span>
                    <span className="block text-[10px] text-slate-400 dark:text-zinc-500">
                      Tasa BCV, cuentas, whitelist y cripto
                    </span>
                  </div>
                </button>

                {/* Option 2: Preferencias de Interfaz */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsDropdown(false);
                    if (onOpenPreferences) onOpenPreferences();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left"
                >
                  <Palette className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                  <div>
                    <span className="block font-semibold">Preferencias de Interfaz</span>
                    <span className="block text-[10px] text-slate-400 dark:text-zinc-500">
                      Temas, fuentes y alto contraste
                    </span>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-zinc-800/80" />

                {/* Option 4: Logout */}
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-semibold">Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* COMMAND PALETTE MODAL (Ctrl+K) */}
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-xl bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-100"
            role="dialog"
            aria-modal="true"
          >
            {/* Search Input Bar */}
            <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por inquilino, RIF, correo o referencia de pago..."
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              {searchLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results Section */}
            <div className="overflow-y-auto p-3 space-y-4">
              {!searchQuery.trim() ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <div className="inline-flex p-3 rounded-2xl bg-slate-100 dark:bg-zinc-850 text-slate-500">
                    <Command className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-slate-600 dark:text-zinc-300">Centro de Búsqueda Global</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Escribe para filtrar clientes por nombre comercial o pagos por banco y número de referencia.
                  </p>
                </div>
              ) : (
                <>
                  {/* Tenants Group */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-2 block mb-1.5">
                      Inquilinos / Comercios ({searchTenants.length})
                    </span>
                    {searchTenants.length === 0 ? (
                      <p className="text-[11px] text-slate-400 px-2 italic">No se encontraron comercios coincidentes.</p>
                    ) : (
                      <div className="space-y-1">
                        {searchTenants.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              setIsCommandPaletteOpen(false);
                              if (onNavigateTab) onNavigateTab('tenants');
                            }}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-850 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                              <div className="truncate">
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block truncate">
                                  {t.commercial_name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {t.tax_id} · {t.owner_email}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                                {t.status}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payments Group */}
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-2 block mb-1.5">
                      Reportes de Pago ({searchPayments.length})
                    </span>
                    {searchPayments.length === 0 ? (
                      <p className="text-[11px] text-slate-400 px-2 italic">No se encontraron pagos coincidentes.</p>
                    ) : (
                      <div className="space-y-1">
                        {searchPayments.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setIsCommandPaletteOpen(false);
                              if (onNavigateTab) onNavigateTab('reconciliation');
                            }}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-850 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <Receipt className="w-4 h-4 text-emerald-500 shrink-0" />
                              <div className="truncate">
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block truncate">
                                  {p.origin_bank} #{p.reference_number} ({p.tenant_commercial_name || 'Comercio'})
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {p.amount} {p.currency} · {new Date(p.reported_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                                  p.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : p.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {p.status}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                Presiona <kbd className="bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border border-slate-200 dark:border-zinc-700">ESC</kbd> para salir
              </span>
              <span>Filtrado en tiempo real</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
