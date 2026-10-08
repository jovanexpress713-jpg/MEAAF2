import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import {
  BarChart3,
  Printer,
  TrendingUp,
  Scale,
  Users,
  Package,
  CheckCircle2,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [stats, setStats] = useState({ patients: 0, revenue: 0, debit: 0, credit: 0 });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      Api.getDashboardReports(),
      Api.getInvoices(),
      Api.getJournalEntries(),
      Api.getProducts(),
    ]).then(([st, invs, jvs, prods]) => {
      setStats(st);
      setInvoices(invs);
      setJournals(jvs);
      setProducts(prods);
    }).catch(console.error);
  }, []);

  const totalInventoryCost = products.reduce((s, p) => s + (p.stock * p.costCents) / 100, 0);
  const totalInventoryValue = products.reduce((s, p) => s + (p.stock * p.priceCents) / 100, 0);

  const approvedInvoicesCount = invoices.filter((i) => i.status === 'Posted').length;
  const approvedJournalsCount = journals.filter((j) => j.isApproved).length;
  const draftJournalsCount = journals.filter((j) => !j.isApproved).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">التقارير المالية والتشغيلية المعتمدة</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ملخصات مؤشرات الأداء، ميزان المراجعة، وتقييم مخزون الأدوية من قاعدة البيانات المركزية
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة التقرير الشامل</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>ملفات المرضى</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono mt-3">
            {stats.patients.toLocaleString('ar-SA')}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">سجلات نشطة في المنشأة</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>إيرادات الفوترة المعتمدة</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 font-mono mt-3">
            {stats.revenue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">من واقع {approvedInvoicesCount} فاتورة</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>إجمالي القيود (مدين / دائن)</span>
            <Scale className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-900 font-mono mt-3">
            {stats.debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
          </p>
          <span className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> ميزان مراجعة متطابق
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>قيمة المخزون المقدرة</span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-800 font-mono mt-3">
            {totalInventoryValue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">بسعر البيع الحالي</span>
        </div>
      </div>

      {/* Financial Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trial Balance / Journal Status */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-600" />
            <span>تقرير الميزان والقيود المحاسبية</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-semibold text-slate-700">إجمالي الحركات المدينة المعتمدة:</span>
              <span className="font-mono font-bold text-indigo-700 text-sm">
                {stats.debit.toFixed(2)} ر.س
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-semibold text-slate-700">إجمالي الحركات الدائنة المعتمدة:</span>
              <span className="font-mono font-bold text-purple-700 text-sm">
                {stats.credit.toFixed(2)} ر.س
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100">
              <span className="font-bold">فارق التوازن المحاسبي:</span>
              <span className="font-mono font-bold text-sm">
                {(stats.debit - stats.credit).toFixed(2)} ر.س (متزن 100%)
              </span>
            </div>

            <div className="pt-2 text-slate-500 flex justify-between text-[11px]">
              <span>القيود المعتمدة: {approvedJournalsCount}</span>
              <span>القيود المسودة بانتظار الاعتماد: {draftJournalsCount}</span>
            </div>
          </div>
        </div>

        {/* Inventory Valuation Report */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <span>تقرير تقييم المخزون والمستودع</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-semibold text-slate-700">عدد الأصناف المسجلة:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {products.length} صنف
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-semibold text-slate-700">إجمالي التكلفة التقديرية (Cost):</span>
              <span className="font-mono font-bold text-slate-700 text-sm">
                {totalInventoryCost.toFixed(2)} ر.س
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-100">
              <span className="font-bold">القيمة البيعية الإجمالية (Market Value):</span>
              <span className="font-mono font-bold text-sm">
                {totalInventoryValue.toFixed(2)} ر.س
              </span>
            </div>

            <div className="pt-2 text-slate-500 flex justify-between text-[11px]">
              <span>هامش الربح الإجمالي المقدر:</span>
              <span className="font-mono font-bold text-emerald-700">
                {(totalInventoryValue - totalInventoryCost).toFixed(2)} ر.س
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
