import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { DialogProvider } from './context/DialogContext';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { PreferencesModal } from './components/PreferencesModal';
import { SettingsModal } from './components/SettingsModal';
import { DashboardPage } from './pages/DashboardPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { TenantsPage } from './pages/TenantsPage';
import { PlansPage } from './pages/PlansPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const { lastEventTimestamp } = useNotifications();
  const { isPreloaded, preloadingProgress, pendingPayments, settings } = useAppData();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [currentRate, setCurrentRate] = useState<number>(36.50);
  const [rateUpdatedTrigger, setRateUpdatedTrigger] = useState<number>(0);

  useEffect(() => {
    if (settings && typeof settings.usd_ves_rate === 'number') {
      setCurrentRate(settings.usd_ves_rate);
    }
  }, [settings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#09090b] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleRateUpdated = (newRate: number) => {
    setCurrentRate(newRate);
    setRateUpdatedTrigger(Date.now());
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex flex-col transition-colors">
      <Header
        currentRate={currentRate}
        onOpenSettings={() => setCurrentTab('settings')}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onNavigateTab={(tab) => setCurrentTab(tab)}
      />

      {/* SPA Real-Time Preloading Bar (fast micro-indicator) */}
      {!isPreloaded && (
        <div className="w-full bg-purple-100 dark:bg-purple-950/40 h-1 overflow-hidden">
          <div
            className="bg-purple-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(15, preloadingProgress)}%` }}
          />
        </div>
      )}

      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          pendingCount={pendingPayments.length}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
          {/* HIGH PERFORMANCE SPA PERSISTENT TAB CONTAINERS */}
          <div className={currentTab === 'dashboard' ? 'block' : 'hidden'}>
            <DashboardPage
              onNavigateToReconciliation={() => setCurrentTab('reconciliation')}
              onNavigateToTenants={() => setCurrentTab('tenants')}
              lastEventTimestamp={rateUpdatedTrigger || lastEventTimestamp}
            />
          </div>

          <div className={currentTab === 'reconciliation' ? 'block' : 'hidden'}>
            <ReconciliationPage lastEventTimestamp={lastEventTimestamp} />
          </div>

          <div className={currentTab === 'tenants' ? 'block' : 'hidden'}>
            <TenantsPage />
          </div>

          <div className={currentTab === 'plans' ? 'block' : 'hidden'}>
            <PlansPage />
          </div>

          <div className={currentTab === 'invoices' ? 'block' : 'hidden'}>
            <InvoicesPage onNavigateToTenants={() => setCurrentTab('tenants')} />
          </div>

          <div className={currentTab === 'settings' ? 'block' : 'hidden'}>
            <SettingsPage
              onRateUpdated={handleRateUpdated}
              onOpenPreferences={() => setIsPreferencesOpen(true)}
            />
          </div>
        </main>
      </div>

      <BottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingCount={pendingPayments.length}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRateUpdated={handleRateUpdated}
      />

      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <DialogProvider>
      <PreferencesProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppDataProvider>
              <MainLayout />
            </AppDataProvider>
          </NotificationProvider>
        </AuthProvider>
      </PreferencesProvider>
    </DialogProvider>
  );
}

export default App;
