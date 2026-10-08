import React, { useState, useEffect } from 'react';
import { Api, setAuthToken } from './services/api';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { ChangePasswordModal } from './components/Dialogs/ChangePasswordModal';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { PatientsView } from './views/PatientsView';
import { BillingView } from './views/BillingView';
import { AccountingView } from './views/AccountingView';
import { InventoryView } from './views/InventoryView';
import { ReportsView } from './views/ReportsView';
import { MigrationView } from './views/MigrationView';
import { BackupView } from './views/BackupView';
import { AuditView } from './views/AuditView';
import { HealthCenterView } from './views/HealthCenterView';
import { ControlCenterView } from './views/ControlCenterView';
import { DevicesView } from './views/DevicesView';
import { SupportView } from './views/SupportView';
import { UsersView } from './views/UsersView';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [tenant, setTenant] = useState<any>({ name: 'مجموعة مِعاف للرعاية الصحية' });
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Validate session against server on startup
  useEffect(() => {
    Api.getMe()
      .then((data) => {
        setCurrentUser(data.user);
        setTenant(data.tenant);
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => {
        setLoadingInitial(false);
      });
  }, []);

  const handleLoginSuccess = () => {
    Api.getMe()
      .then((data) => {
        setCurrentUser(data.user);
        setTenant(data.tenant);
        setCurrentTab('dashboard');
      })
      .catch((err) => console.error(err));
  };

  const handleLogout = async () => {
    try {
      await Api.logout();
    } catch (e) {
      // ignore
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center font-black text-2xl mx-auto shadow-lg animate-pulse">
            مـ
          </div>
          <p className="text-xs text-slate-400">جارٍ تهيئة جلسة خادم منظومة مِعاف...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800" dir="rtl">
      {/* Top Header */}
      <Header
        user={currentUser}
        tenant={tenant}
        onChangePassword={() => setIsPasswordModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
          {currentTab === 'patients' && <PatientsView />}
          {currentTab === 'billing' && <BillingView />}
          {currentTab === 'accounting' && <AccountingView />}
          {currentTab === 'inventory' && <InventoryView />}
          {currentTab === 'reports' && <ReportsView />}
          {currentTab === 'devices' && <DevicesView />}
          {currentTab === 'migration' && <MigrationView />}
          {currentTab === 'health' && <HealthCenterView />}
          {currentTab === 'control' && <ControlCenterView />}
          {currentTab === 'support' && <SupportView />}
          {currentTab === 'backup' && <BackupView />}
          {currentTab === 'audit' && <AuditView />}
          {currentTab === 'users' && <UsersView currentUserId={currentUser.userId ?? currentUser.id} />}
        </main>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen || !!currentUser.mustChangePassword}
        forced={!!currentUser.mustChangePassword}
        onClose={() => {
          setIsPasswordModalOpen(false);
          if (currentUser.mustChangePassword) {
            // Server cleared the flag after a successful change; refresh session state.
            Api.getMe()
              .then((data) => setCurrentUser(data.user))
              .catch(() => setCurrentUser({ ...currentUser, mustChangePassword: false }));
          }
        }}
      />
    </div>
  );
};

export default App;
