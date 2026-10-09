import React from 'react';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Scale,
  PackageCheck,
  BarChart3,
  Monitor,
  DatabaseZap,
  HeartPulse,
  SlidersHorizontal,
  LifeBuoy,
  HardDriveDownload,
  ScrollText,
  UserCog,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'patients'
  | 'billing'
  | 'accounting'
  | 'inventory'
  | 'reports'
  | 'devices'
  | 'migration'
  | 'health'
  | 'control'
  | 'support'
  | 'backup'
  | 'audit'
  | 'users';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const coreItems = [
    { id: 'dashboard' as NavTab, label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'patients' as NavTab, label: 'سجلات المرضى', icon: Users },
    { id: 'billing' as NavTab, label: 'الفوترة الطبية', icon: Receipt },
    { id: 'accounting' as NavTab, label: 'المحاسبة والقيود', icon: Scale },
    { id: 'inventory' as NavTab, label: 'المستودع والمخزون', icon: PackageCheck },
    { id: 'reports' as NavTab, label: 'التقارير والميزان', icon: BarChart3 },
  ];

  const enterpriseItems = [
    { id: 'users' as NavTab, label: 'المستخدمون والأدوار', icon: UserCog },
    { id: 'devices' as NavTab, label: 'محطات العمل والطباعة', icon: Monitor },
    { id: 'migration' as NavTab, label: 'ترحيل البيانات والمطابقة', icon: DatabaseZap },
    { id: 'health' as NavTab, label: 'مركز صحة النظام', icon: HeartPulse },
    { id: 'control' as NavTab, label: 'مركز التحكم المؤسسي', icon: SlidersHorizontal },
    { id: 'support' as NavTab, label: 'الدعم الفني والتذاكر', icon: LifeBuoy },
    { id: 'backup' as NavTab, label: 'النسخ والتعافي', icon: HardDriveDownload },
    { id: 'audit' as NavTab, label: 'سجل التدقيق الرقابي', icon: ScrollText },
  ];

  return (
    <aside className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] shadow-sm overflow-y-auto">
      <div className="p-3 border-b border-slate-100">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          الوحدات السريرية والمالية
        </p>
      </div>

      <nav className="p-2 space-y-1">
        {coreItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-right cursor-pointer ${
                isActive
                  ? 'bg-sky-50 text-sky-700 shadow-xs border-r-4 border-sky-600 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-sky-600' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-b border-slate-100 mt-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          إدارة المؤسسة والرقابة
        </p>
      </div>

      <nav className="p-2 space-y-1 flex-1">
        {enterpriseItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-right cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-xs border-r-4 border-indigo-600 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 space-y-0.5">
        <p className="font-bold text-slate-800 text-[11px]">MEAAF Enterprise v1.0.0</p>
        <p className="text-[10px] text-slate-400">
          محرك علائقي معتمد ونظام عزل متعدد المنشآت
        </p>
      </div>
    </aside>
  );
};
