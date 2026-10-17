import React from 'react';
import { LayoutDashboard, CheckSquare, Users, Layers, Sliders } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab, pendingCount = 0 }) => {
  const navItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'reconciliation', label: 'Conciliar', icon: CheckSquare, badge: pendingCount },
    { id: 'tenants', label: 'Clientes', icon: Users },
    { id: 'plans', label: 'Planes', icon: Layers },
    { id: 'settings', label: 'Ajustes', icon: Sliders },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex items-center justify-around px-2 z-40 pb-safe shadow-lg transition-colors">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative cursor-pointer ${
              isActive
                ? 'text-accent font-bold'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5 mb-0.5" />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

