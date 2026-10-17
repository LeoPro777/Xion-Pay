import React from 'react';
import { LayoutDashboard, CheckSquare, Users, Layers, ShieldCheck, Sliders } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, pendingCount = 0 }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Panel & Métricas', icon: LayoutDashboard },
    { id: 'reconciliation', label: 'Bandeja Conciliación', icon: CheckSquare, badge: pendingCount },
    { id: 'tenants', label: 'Clientes (CRM)', icon: Users },
    { id: 'plans', label: 'Planes & Parámetros', icon: Layers },
    { id: 'settings', label: 'Configuración Sistema', icon: Sliders },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#121215] border-r border-slate-200 dark:border-zinc-800 p-4 shrink-0 min-h-[calc(100vh-4rem)] shadow-xs transition-colors">
      {/* Sidebar Header Brand */}
      <div className="flex items-center space-x-2.5 pb-4 mb-3 border-b border-slate-100 dark:border-zinc-800">
        <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-xs">
          <ShieldCheck className="w-4 h-4 text-[var(--accent-fg)]" />
        </div>
        <div>
          <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white block">
            XION-PAY
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono font-medium block">
            v1.0 SaaS Admin
          </span>
        </div>
      </div>

      <div className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2 mb-2">
        Navegación Principal
      </div>

      <nav className="space-y-1.5 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--accent-fg)]' : 'text-slate-500 dark:text-zinc-400'}`} />
                <span className={isActive ? 'text-[var(--accent-fg)]' : ''}>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Security Footer */}
      <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 text-[11px] text-slate-600 dark:text-zinc-300">
        <p className="font-semibold text-slate-800 dark:text-zinc-200 mb-1 flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping mr-1"></span>
          Seguridad Criptográfica
        </p>
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-normal">
          Licencias firmadas digitalmente RS256 y webhooks HMAC SHA-256.
        </p>
      </div>
    </aside>
  );
};
