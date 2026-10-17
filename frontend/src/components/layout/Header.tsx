import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, Wifi, Settings, LogOut, CheckCircle2, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  currentRate?: number;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentRate = 36.50, onOpenSettings }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, clearNotifications } = useNotifications();
  const [showPopover, setShowPopover] = useState(false);

  // Get initials for user avatar badge (e.g. CD)
  const initials = user?.full_name
    ? user.full_name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'CD';

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Subtitle */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs">
          <ShieldCheck className="w-4 h-4 text-slate-900" />
          <span className="font-extrabold text-xs tracking-wider text-slate-900 uppercase">
            Xion-Pay <span className="text-slate-500 font-mono font-normal text-[10px]">v1.0</span>
          </span>
        </div>
        <span className="hidden sm:inline-block text-xs font-medium text-slate-500 border-l border-slate-200 pl-3">
          Autoridad Certificadora & Conciliación SaaS
        </span>
      </div>

      {/* Header Right Action Bar (Tasa, Status, Notifications, Avatar, Settings, Logout) */}
      <div className="flex items-center space-x-3">
        {/* Exchange Rate Pill */}
        <button
          onClick={onOpenSettings}
          className="hidden sm:flex items-center bg-slate-100/90 border border-slate-200/80 hover:bg-slate-200/80 transition-colors px-4 py-1.5 rounded-2xl text-xs text-slate-700 shadow-xs cursor-pointer"
          title="Configurar Tasa de Cambio"
        >
          <span>Tasa:</span>
          <span className="font-extrabold text-slate-900 ml-1.5 text-sm">
            {currentRate.toFixed(2)} Bs
          </span>
        </button>

        {/* Connected Status Pill */}
        <div className="hidden md:flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-3.5 py-1.5 rounded-2xl text-xs font-semibold shadow-xs">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span>Conectado</span>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowPopover(!showPopover);
              if (unreadCount > 0) clearNotifications();
            }}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 relative transition-colors shadow-xs cursor-pointer"
            title="Notificaciones en tiempo real"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showPopover && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
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
                      className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-start space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-800 font-medium">{n.message}</p>
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
            className="w-8 h-8 rounded-full bg-[#18181b] text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer select-none"
            title={`${user.full_name} (${user.role})`}
          >
            {initials}
          </div>
        )}

        {/* Settings Button */}
        {user && (
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Configuración del Sistema"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {/* Logout Button */}
        {user && (
          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};


