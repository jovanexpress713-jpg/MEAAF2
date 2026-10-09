import React, { useCallback, useEffect, useState } from 'react';
import { Api, setAuthToken, AuthMode } from './services/api';
import { Header } from './components/Header';
import { SyncStatus } from './components/SyncStatus';
import { Sidebar, NavTab } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
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
import { ServerUnreachable } from './views/ServerUnreachable';

/**
 * Session bootstrap.
 *
 * Open mode (default): the operator is signed in automatically as the system
 * administrator. There is no login screen and no password prompt.
 * Password mode (MEAAF_AUTH_MODE=password): the classic login form is shown.
 *
 * A server that cannot be reached is reported honestly instead of falling back to a
 * login screen that could never succeed.
 */
async function bootstrapSession(): Promise<{
  user: any;
  tenant: any;
  mode: AuthMode;
}> {
  // 1. An existing session token may still be valid.
  try {
    const data = await Api.getMe();
    const modeInfo = await Api.getAuthMode().catch(() => ({ mode: 'open' as AuthMode }));
    return { user: data.user, tenant: data.tenant, mode: modeInfo.mode };
  } catch {
    // fall through to mode detection
  }

  // 2. Ask the server which authentication mode this installation runs in.
  const modeInfo = await Api.getAuthMode();

  if (modeInfo.mode === 'open') {
    const result = await Api.autoLogin();
    setAuthToken(result.token);
    return { user: result.user, tenant: result.tenant, mode: 'open' };
  }

  // 3. Password mode: no session yet, so the login form is the correct next screen.
  return { user: null, tenant: null, mode: 'password' };
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [tenant, setTenant] = useState<any>({ name: 'مجموعة مِعاف للرعاية الصحية' });
  const [authMode, setAuthMode] = useState<AuthMode>('open');
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    setLoadingInitial(true);
    setStartupError(null);
    try {
      const result = await bootstrapSession();
      setAuthMode(result.mode);
      setCurrentUser(result.user);
      if (result.tenant) setTenant(result.tenant);
      if (result.user) setCurrentTab('dashboard');
    } catch (err: any) {
      setCurrentUser(null);
      setStartupError(err?.message || 'تعذر الاتصال بخادم منظومة مِعاف.');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    startSession();
  }, [startSession]);

  const handleLoginSuccess = () => {
    Api.getMe()
      .then((data) => {
        setCurrentUser(data.user);
        setTenant(data.tenant);
        setCurrentTab('dashboard');
      })
      .catch((err) => setStartupError(err?.message || 'تعذر إتمام تسجيل الدخول.'));
  };

  const handleLogout = async () => {
    try {
      await Api.logout();
    } catch (e) {
      // ignore
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
      // In open mode signing out immediately signs back in, so re-bootstrap instead of
      // leaving the operator on a login screen that this installation does not use.
      if (authMode === 'open') {
        startSession();
      }
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

  if (startupError) {
    return <ServerUnreachable message={startupError} onRetry={startSession} />;
  }

  if (!currentUser) {
    // Only reachable in password mode; open mode always produces a session above.
    return <LoginView onSuccess={handleLoginSuccess} />;
  }

  // A forced password change only makes sense when passwords are actually in use.
  const forcePasswordChange = authMode === 'password' && !!currentUser.mustChangePassword;

  return (
    <div className="h-screen bg-slate-50 flex flex-col text-slate-800 overflow-hidden" dir="rtl">
      {/* Top Header */}
      <Header
        user={currentUser}
        tenant={tenant}
        authMode={authMode}
        onChangePassword={() => setIsPasswordModalOpen(true)}
        onLogout={handleLogout}
      />

      <SyncStatus />

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

      {/* Desktop-style status bar */}
      <StatusBar user={currentUser} tenant={tenant} authMode={authMode} />

      {/* Change Password Dialog */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen || forcePasswordChange}
        forced={forcePasswordChange}
        onClose={() => {
          setIsPasswordModalOpen(false);
          if (forcePasswordChange) {
            // Views loaded while the password change was pending were refused (403) and would stay
            // empty. Reload so every view fetches its data with the now-unrestricted session.
            window.location.reload();
          }
        }}
      />
    </div>
  );
};

export default App;
