import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import {
  SlidersHorizontal,
  Building2,
  Building,
  Layers,
  DoorOpen,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const ControlCenterView: React.FC = () => {
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.getHierarchy()
      .then(setHierarchy)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">مركز التحكم المؤسسي (MEAAF Control Center)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الهيكل التنظيمي للمؤسسة، المنشآت، الفروع، الأقسام الطبية، ومحددات الرخص
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">جارٍ تحميل بيانات الهيكل التنظيمي...</div>
      ) : hierarchy ? (
        <div className="space-y-6">
          {/* Tenant & License Summary */}
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-sky-400 font-bold uppercase tracking-wider block">
                المنشأة الحالية (Active Tenant)
              </span>
              <h3 className="text-xl font-bold mt-1">{hierarchy.tenant?.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-1">معرّف المنشأة: {hierarchy.tenant?.id}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-lg text-right">
                <span className="text-[10px] text-slate-400 block">باقة الترخيص</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Enterprise Full License
                </span>
              </div>
              <div className="bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-lg text-right">
                <span className="text-[10px] text-slate-400 block">حالة العزل</span>
                <span className="text-xs font-bold text-sky-400">Multi-Tenant Isolated</span>
              </div>
            </div>
          </div>

          {/* 8-Tier Hierarchy Interactive View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Organizations */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-sky-600" />
                <h4 className="font-bold text-xs text-slate-800">الإدارة المركزية (Organizations)</h4>
              </div>
              <div className="space-y-2">
                {hierarchy.organizations?.map((org: any) => (
                  <div key={org.id} className="p-2.5 bg-slate-50 rounded-lg text-xs">
                    <p className="font-bold text-slate-900">{org.name}</p>
                    <span className="text-[10px] text-slate-500 font-mono">الرمز: {org.code}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Branches */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-xs text-slate-800">الفروع والمستشفيات (Branches)</h4>
              </div>
              <div className="space-y-2">
                {hierarchy.branches?.map((b: any) => (
                  <div key={b.id} className="p-2.5 bg-slate-50 rounded-lg text-xs">
                    <p className="font-bold text-slate-900">{b.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">المدينة: {b.city} | {b.phone}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Departments */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Layers className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-xs text-slate-800">الأقسام الطبية (Departments)</h4>
              </div>
              <div className="space-y-2">
                {hierarchy.departments?.map((d: any) => (
                  <div key={d.id} className="p-2.5 bg-slate-50 rounded-lg text-xs">
                    <p className="font-bold text-slate-900">{d.name}</p>
                    <span className="text-[10px] text-slate-500 font-mono">كود: {d.code}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Offices & Clinics */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <DoorOpen className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-xs text-slate-800">العيادات والمكاتب (Offices)</h4>
              </div>
              <div className="space-y-2">
                {hierarchy.offices?.map((off: any) => (
                  <div key={off.id} className="p-2.5 bg-slate-50 rounded-lg text-xs">
                    <p className="font-bold text-slate-900">{off.name}</p>
                    <span className="text-[10px] text-slate-500 font-mono">رقم الغرفة: {off.roomNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
