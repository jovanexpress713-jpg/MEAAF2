import React, { useState } from 'react';
import { Api } from '../services/api';
import {
  HardDriveDownload,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileJson,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export const BackupView: React.FC = () => {
  const [backupPath, setBackupPath] = useState('MEAAF_Enterprise_Backup.json');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateBackup = async () => {
    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const data = await Api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupPath.endsWith('.json') ? backupPath : `${backupPath}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage(`تم تصدير نسخة احتياطية معتمدة ومطابقة لقاعدة بيانات المنشأة بنجاح: ${backupPath}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إنشاء النسخة الاحتياطية.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    if (window.confirm('تحذير: هل أنت متأكد من إعادة ضبط قاعدة البيانات إلى البيانات التأسيسية؟')) {
      try {
        await Api.resetBackup();
        setStatusMessage('تمت إعادة ضبط قاعدة البيانات بنجاح إلى الحالة التأسيسية.');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err: any) {
        setErrorMessage(err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HardDriveDownload className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">النسخ الاحتياطي والتعافي من الكوارث (Disaster Recovery)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إنشاء نسخ احتياطية شاملة ومعزولة لكل منشأة، وتدقيق التصدير عبر الخادم المركزي
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Backup Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
            <FileJson className="w-4 h-4 text-indigo-600" />
            <span>تصدير نسخة احتياطية معزولة (Export Isolated Backup)</span>
          </h3>

          <p className="text-xs text-slate-500">
            يقوم بتوليد حزمة بيانات معزولة ومتحقق منها تشمل ملفات المرضى، الفواتير، القيود، المخزون، وسجلات التدقيق للمنشأة الحالية فقط.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              اسم ملف النسخة الاحتياطية:
            </label>
            <input
              type="text"
              value={backupPath}
              onChange={(e) => setBackupPath(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>{loading ? 'جارٍ استخراج وتدقيق البيانات...' : 'تنزيل حزمة النسخة الاحتياطية الآن'}</span>
          </button>
        </div>

        {/* Danger Zone: Factory Reset */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>إعادة التهيئة والتصحيح (Factory Reset)</span>
            </h3>

            <p className="text-xs text-slate-500 mt-3">
              يعيد قاعدة البيانات المركزية إلى الحالة التأسيسية المعتمدة لبيئة التشغيل التجريبية مع الحفاظ على الأمان وكلمة المرور الأصلية.
            </p>
          </div>

          <button
            onClick={handleResetDefaults}
            className="w-full mt-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            إعادة ضبط قاعدة البيانات
          </button>
        </div>
      </div>
    </div>
  );
};
