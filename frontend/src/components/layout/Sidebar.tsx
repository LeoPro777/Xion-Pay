import React, { useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Layers,
  Receipt,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount = 0,
}) => {
  // Independent retractable sidebar state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('xion_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('xion_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const menuItems = [
    { id: 'dashboard', label: 'Panel & Métricas', icon: LayoutDashboard },
    { id: 'reconciliation', label: 'Bandeja Conciliación', icon: CheckSquare, badge: pendingCount },
    { id: 'tenants', label: 'Clientes (CRM)', icon: Users },
    { id: 'plans', label: 'Planes & Parámetros', icon: Layers },
    { id: 'invoices', label: 'Facturas & Recibos', icon: Receipt },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col bg-white dark:bg-[#121215] border-r border-slate-100 dark:border-zinc-800/80 p-3 shrink-0 min-h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out select-none ${isCollapsed ? 'w-20' : 'w-60'
        }`}
    >
      {/* Top Header / Collapse Toggle */}
      <div className={`flex items-center mb-3 px-1.5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider truncate">
            Navegación
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapse}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expandir barra lateral' : 'Retraer barra lateral'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1.5 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          const handleClick = () => {
            setCurrentTab(item.id);
          };

          return (
            <button
              key={item.id}
              type="button"
              onClick={handleClick}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl text-xs transition-all cursor-pointer group relative ${isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
                } ${isActive
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/60 font-medium'
                }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-zinc-500'
                      }`}
                  />
                  {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <span className="truncate transition-opacity duration-200">
                    {item.label}
                  </span>
                )}
              </div>

              {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive
                      ? 'bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                >
                  {item.badge}
                </span>
              )}

              {/* Floating Tooltip when collapsed */}
              {isCollapsed && (
                <div className="hidden group-hover:block absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in duration-100">
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1.5 text-amber-400 font-bold">({item.badge})</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Retract Quick Toggle */}
      <div className="pt-2 mt-auto border-t border-slate-100 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={toggleCollapse}
          className={`w-full flex items-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-850 text-xs transition-colors cursor-pointer ${isCollapsed ? 'justify-center p-2' : 'space-x-2 px-3 py-2'
            }`}
          title={isCollapsed ? 'Expandir barra lateral' : 'Retraer barra lateral'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="text-[11px] font-medium">Retraer barra</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
