import React, { useState } from 'react';
import { Api, setAuthToken } from '../services/api';
import { User, Lock, AlertCircle, ShieldCheck, HeartPulse, RefreshCw } from 'lucide-react';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  // Seed credentials are prefilled only in development builds; never in production.
  const isDev = import.meta.env.DEV;
  const [username, setUsername] = useState(isDev ? 'admin' : '');
  const [password, setPassword] = useState(isDev ? 'Admin@123456' : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await Api.login(username, password);
      if (result.token) {
        setAuthToken(result.token);
        onSuccess();
      } else {
        setError('تعذر الحصول على رمز الجلسة.');
      }
    } catch (err: any) {
      setError(err.message || 'بيانات الدخول غير صحيحة.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      await Api.resetBackup();
      setUsername('admin');
      setPassword('Admin@123456');
      setError(null);
      alert('تمت إعادة ضبط بيانات الخادم إلى الحالة التأسيسية.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative background grid and gradients */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-600 text-white shadow-xl shadow-sky-600/30 mb-4 font-black text-2xl">
            <HeartPulse className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">مِعاف | MEAAF Enterprise</h1>
          <p className="text-sm text-slate-400 mt-2 font-normal">
            منظومة إدارة الرعاية الصحية والمحاسبية المزدوجة
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800">تسجيل الدخول للنظام</h2>
              <p className="text-xs text-slate-500">مصادقة آمنة عبر خادم المؤسسة</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              BCrypt Auth
            </span>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                اسم المستخدم:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-sm pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                  placeholder="admin"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                كلمة المرور:
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                  placeholder="••••••••••••"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-800 space-y-1">
              <p className="font-semibold text-sky-900">بيانات الاعتماد التأسيسية:</p>
              <p>المستخدم: <span className="font-mono font-bold">admin</span></p>
              <p>كلمة المرور: <span className="font-mono font-bold">Admin@123456</span></p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'جارٍ التحقق في الخادم...' : 'دخول المنظومة'}
            </button>
          </form>

          {isDev && (
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              استعادة بيانات الخادم التأسيسية (تطوير فقط)
            </button>
          </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          مِعاف المؤسسي © 2026 — نظام إدارة السجلات الصحية والمالية
        </p>
      </div>
    </div>
  );
};
