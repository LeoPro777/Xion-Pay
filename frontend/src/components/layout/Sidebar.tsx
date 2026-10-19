import React from 'react';
import { LayoutDashboard, CheckSquare, Users, Layers, Sliders } from 'lucide-react';

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
    <aside className="hidden md:flex flex-col w-60 bg-white dark:bg-[#121215] border-r border-slate-100 dark:border-zinc-800/80 p-4 shrink-0 min-h-[calc(100vh-4rem)] transition-colors">
      <div className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-3 mb-3">
        Navegación Principal
      </div>

      <nav className="space-y-1 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/60 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
