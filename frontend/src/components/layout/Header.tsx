import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
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
} from 'lucide-react';

interface HeaderProps {
  currentRate?: number;
  onOpenSettings?: () => void;
  onOpenPreferences?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRate = 36.5,
  onOpenSettings,
  onOpenPreferences,
}) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, clearNotifications } = useNotifications();

  const [showNotificationPopover, setShowNotificationPopover] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsDropdown(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target as Node)) {
        setShowNotificationPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
        <span className="hidden sm:inline-block text-xs font-medium text-slate-500 dark:text-zinc-400 border-l border-slate-200 dark:border-zinc-800 pl-3">
          Autoridad Certificadora & Conciliación SaaS
        </span>
      </div>

      {/* Header Right Action Bar */}
      <div className="flex items-center space-x-2.5">
        {/* Exchange Rate Pill */}
        <button
          onClick={onOpenSettings}
          className="hidden sm:flex items-center bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500 transition-colors px-3.5 py-1.5 rounded-xl text-xs text-slate-700 dark:text-zinc-300 cursor-pointer shadow-xs"
          title="Configurar Tasa de Cambio"
        >
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 mr-1.5">Tasa BCV:</span>
          <span className="font-extrabold text-slate-900 dark:text-white text-xs font-mono">
            {currentRate.toFixed(2)} Bs
          </span>
        </button>

        {/* Connected Status Pill */}
        <div className="hidden md:flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs">
          <Wifi className="w-3.5 h-3.5 text-emerald-500" />
          <span>Conectado</span>
        </div>


        {/* Notifications Bell */}
        <div className="relative" ref={notificationMenuRef}>
          <button
            onClick={() => {
              setShowNotificationPopover(!showNotificationPopover);
              if (unreadCount > 0) clearNotifications();
            }}
            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 relative transition-colors shadow-xs cursor-pointer"
            title="Notificaciones en tiempo real"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotificationPopover && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 z-50 text-slate-900 dark:text-white">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Alertas en Vivo
                </span>
                <span className="text-[10px] text-slate-400 font-mono">WebSocket Conectado</span>
              </div>
              <div className="max-h-60 overflow-y-auto mt-2 space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No hay alertas recientes.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="text-xs bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-start space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-800 dark:text-zinc-200 font-medium">{n.message}</p>
                        <span className="text-[10px] text-slate-400">{n.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
    </header>
  );
};
