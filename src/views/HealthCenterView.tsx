import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  HardDrive,
  Scale,
  ShieldCheck,
  Monitor,
} from 'lucide-react';

export const HealthCenterView: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getHealth();
      setHealthData(data);
    } catch (err: any) {
      setError(err.message || 'تعذر الاتصال بمركز صحة النظام.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-800">مركز صحة النظام والجاهزية (MEAAF Health Center)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مراقبة حية لصحة الخادم، قاعدة البيانات، الرخص، الأجهزة، وتوازن القيود المحاسبية
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>فحص شامل الآن</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {healthData && (
        <>
          {/* Main Status Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-900">
                  الحالة التشغيلية العامة: {healthData.status}
                </h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  جميع الخدمات الرئيسية والتحققات الأمنية تعمل بكفاءة تامة ودون أعطال حرجة.
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] text-emerald-800">
              آخر فحص: {new Date(healthData.timestamp).toLocaleTimeString('ar-SA')}
            </span>
          </div>

          {/* Checks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Application Check */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-sky-600" />
                  محرك التطبيق (Node.js API)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {healthData.checks.application.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{healthData.checks.application.message}</p>
            </div>

            {/* Database Check */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-indigo-600" />
                  قاعدة البيانات والمعاملات الذرية
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {healthData.checks.database.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{healthData.checks.database.message}</p>
            </div>

            {/* Accounting Invariants */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  التوازن المحاسبي (Debit == Credit)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {healthData.checks.accounting.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{healthData.checks.accounting.message}</p>
            </div>

            {/* Storage Check */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-amber-600" />
                  نظام التخزين المحلي
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {healthData.checks.storage.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{healthData.checks.storage.message}</p>
            </div>

            {/* License Check */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  الترخيص المؤسسي (Enterprise License)
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {healthData.checks.license.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{healthData.checks.license.message}</p>
            </div>

            {/* Devices Check */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  أجهزة العيادات ونقاط البيع
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {healthData.checks.devices.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{healthData.checks.devices.message}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
