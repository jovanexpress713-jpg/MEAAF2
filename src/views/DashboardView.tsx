import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { NavTab } from '../components/Sidebar';
import {
  Users,
  TrendingUp,
  Scale,
  Receipt,
  Package,
  PlusCircle,
  FileCheck2,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    patients: 0,
    revenue: 0,
    debit: 0,
    credit: 0,
  });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [reportData, invs, jvs, prods] = await Promise.all([
        Api.getDashboardReports(),
        Api.getInvoices(),
        Api.getJournalEntries(),
        Api.getProducts(),
      ]);

      setStats(reportData);
      setInvoices(invs);
      setJournals(jvs);
      setProducts(prods);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">
            مرحباً بك في منظومة مِعاف الطبية والمحاسبية
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مؤشرات الأداء اللحظية من خادم المنشأة، مطابقة لقواعد البيانات ونظام القيد المزدوج.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('patients')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            إضافة مريض جديد
          </button>
          <button
            onClick={() => onNavigate('billing')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5" />
            إصدار فاتورة طبية
          </button>
          <button
            onClick={() => onNavigate('accounting')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5" />
            تسجيل قيد محاسبي
          </button>
        </div>
      </div>

      {/* 4 Core KPIs — Real Server Calculations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Patients count */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المرضى المسجلين</span>
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono">
              {stats.patients.toLocaleString('ar-SA')}
            </span>
            <span className="text-xs text-slate-500 font-medium">ملف طبي نشط</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-sky-700 font-medium">
            <span className="flex items-center gap-1">
              <FileCheck2 className="w-3 h-3" /> بدون ملفات محذوفة
            </span>
            <button
              onClick={() => onNavigate('patients')}
              className="text-sky-600 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              عرض <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إيرادات الفواتير المعتمدة</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700 font-mono">
              {stats.revenue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-medium">ر.س</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-700 font-medium">
            <span className="flex items-center gap-1">
              <Receipt className="w-3 h-3" /> {invoices.length} فواتير مسجلة
            </span>
            <button
              onClick={() => onNavigate('billing')}
              className="text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              الفوترة <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Debit */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المدين (القيود المعتمدة)</span>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-900 font-mono">
              {stats.debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-medium">ر.س</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-indigo-700 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> قيود معتمدة فقط
            </span>
            <button
              onClick={() => onNavigate('accounting')}
              className="text-indigo-700 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              القيود <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Credit */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الدائن (القيود المعتمدة)</span>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-900 font-mono">
              {stats.credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-medium">ر.س</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-purple-700 font-medium">
            <span className="flex items-center gap-1">
              توازن محاسبي: {stats.debit === stats.credit ? 'متطابق ✓' : 'غير متطابق ✕'}
            </span>
            <button
              onClick={() => onNavigate('reports')}
              className="text-purple-700 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              ميزان المراجعة <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Two columns: Recent Invoices & Recent Journal Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-600" />
              <h3 className="font-bold text-sm text-slate-800">أحدث الفواتير الطبية</h3>
            </div>
            <button
              onClick={() => onNavigate('billing')}
              className="text-xs font-medium text-sky-600 hover:underline cursor-pointer"
            >
              عرض الكل
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {invoices.slice(0, 4).map((inv) => (
              <div key={inv.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{inv.invoiceNo}</span>
                    <span className="text-xs text-slate-700 font-semibold">{inv.patientName}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{inv.invoiceDate}</p>
                </div>
                <div className="text-left">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {(inv.totalCents / 100).toFixed(2)} ر.س
                  </span>
                  <span className="block text-[10px] text-emerald-600 font-medium">مرحلة ومعتمدة</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Journal Entries */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800">قيود اليومية الأخيرة</h3>
            </div>
            <button
              onClick={() => onNavigate('accounting')}
              className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
            >
              إدارة القيود
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {journals.slice(0, 4).map((je) => {
              const debitSum = je.lines.reduce((s: number, l: any) => s + l.debitCents, 0) / 100;
              return (
                <div key={je.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{je.entryNo}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        je.isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {je.isApproved ? 'معتمد' : 'مسودة'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{je.description}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <span className="font-mono font-bold text-sm text-slate-800">
                      {debitSum.toFixed(2)} ر.س
                    </span>
                    <span className="block text-[10px] text-slate-400">{je.entryDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inventory & Stock status notice */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-800">تنبيهات المخزون والأدوية</h3>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="text-xs font-medium text-amber-600 hover:underline cursor-pointer"
          >
            عرض الأصناف
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {products
            .filter((p) => p.stock < 30)
            .slice(0, 3)
            .map((p) => (
              <div key={p.id} className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">{p.name}</p>
                  <p className="text-[11px] font-mono text-slate-500">{p.sku}</p>
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-amber-700 font-mono">{p.stock}</span>
                  <span className="text-[10px] text-slate-500 block">{p.unit}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
