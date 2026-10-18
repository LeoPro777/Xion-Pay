import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { PreferencesModal } from './components/PreferencesModal';
import { SettingsModal } from './components/SettingsModal';
import { DashboardPage } from './pages/DashboardPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { TenantsPage } from './pages/TenantsPage';
import { PlansPage } from './pages/PlansPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { api } from './services/api';
import type { SystemSettings } from './types';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const { lastEventTimestamp } = useNotifications();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [currentRate, setCurrentRate] = useState<number>(36.50);
  const [rateUpdatedTrigger, setRateUpdatedTrigger] = useState<number>(0);

  useEffect(() => {
    const fetchRate = () => {
      api.get<SystemSettings>('/settings')
        .then((res) => {
          if (res.data && typeof res.data.usd_ves_rate === 'number') {
            setCurrentRate(res.data.usd_ves_rate);
          }
        })
        .catch((err) => console.error('Error fetching settings from BDD:', err));
    };

    fetchRate();
  }, [user, lastEventTimestamp, rateUpdatedTrigger]);

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
      />

      <div className="flex flex-1">
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigateToReconciliation={() => setCurrentTab('reconciliation')}
              lastEventTimestamp={rateUpdatedTrigger || lastEventTimestamp}
            />
          )}

          {currentTab === 'reconciliation' && (
            <ReconciliationPage lastEventTimestamp={lastEventTimestamp} />
          )}

          {currentTab === 'tenants' && <TenantsPage />}

          {currentTab === 'plans' && <PlansPage />}

          {currentTab === 'settings' && (
            <SettingsPage
              onRateUpdated={handleRateUpdated}
              onOpenPreferences={() => setIsPreferencesOpen(true)}
            />
          )}
        </main>
      </div>

      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

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
    <PreferencesProvider>
      <AuthProvider>
        <NotificationProvider>
          <MainLayout />
        </NotificationProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}

export default App;
