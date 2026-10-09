import React, { useState } from 'react';
import { Api } from '../../services/api';
import { Lock, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true the dialog cannot be dismissed until the password is changed. */
  forced?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  forced = false,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('أدخل كلمة المرور الحالية.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    if (newPassword.length < 12) {
      setError('كلمة المرور الجديدة يجب أن تتكون من 12 حرفاً على الأقل.');
      return;
    }

    setLoading(true);
    try {
      await Api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تغيير كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base">تغيير كلمة المرور</h2>
          </div>
          {!forced && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>تم تغيير كلمة المرور بنجاح في قاعدة البيانات.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              كلمة المرور الحالية:
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              placeholder="••••••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              كلمة المرور الجديدة (12 حرفاً على الأقل):
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              placeholder="••••••••••••"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              وفقاً لمعايير أمان MEAAF، يُشترط أن تتكون كلمة المرور من 12 رمزاً أو أكثر.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              تأكيد كلمة المرور الجديدة:
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              placeholder="••••••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            {!forced && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            )}
            <button
              type="submit"
              disabled={success || loading}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'جارٍ التحديث...' : 'حفظ كلمة المرور في الخادم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
