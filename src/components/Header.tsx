import React from 'react';
import { User, Tenant } from '../types';
import { User as UserIcon, KeyRound, LogOut, ShieldCheck, Building2 } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  tenant: Tenant;
  onChangePassword: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  tenant,
  onChangePassword,
  onLogout,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & System Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center shadow-inner font-black text-xl tracking-wider text-white">
              مـ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-xl tracking-wide text-white">مِعاف | MEAAF</h1>
                <span className="text-xs bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded font-mono">
                  v0.1.0 Web
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{tenant.name}</span>
              </div>
            </div>
          </div>

          {/* User profile & actions */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-sky-300">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-100">{user.displayName}</p>
                  <p className="text-[10px] text-sky-400 flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {user.roleName}
                  </p>
                </div>
              </div>

              <button
                onClick={onChangePassword}
                title="تغيير كلمة المرور"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">كلمة المرور</span>
              </button>

              <button
                onClick={onLogout}
                title="تسجيل الخروج"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
