import React from 'react';
import { LayoutDashboard, CheckSquare, Users, Layers, Receipt } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'reconciliation', label: 'Conciliar', icon: CheckSquare, badge: pendingCount },
    { id: 'tenants', label: 'Clientes', icon: Users },
    { id: 'plans', label: 'Planes', icon: Layers },
    { id: 'invoices', label: 'Facturas', icon: Receipt },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex items-center justify-around px-2 z-40 pb-safe shadow-lg transition-colors select-none">
      {navItems.map((item) => {
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
            className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] relative transition-colors cursor-pointer ${isActive
                ? 'text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5 mb-0.5" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-xs">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
