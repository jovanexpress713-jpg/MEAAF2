import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { InvoiceActionDialog, InvoiceAction } from './InvoiceActionDialog';
import {
  Receipt,
  Search,
  Plus,
  AlertCircle,
  CheckCircle2,
  Printer,
  X,
} from 'lucide-react';

export const BillingView: React.FC = () => {
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [description, setDescription] = useState('كشف واستشارة طبية عامة');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(150);
  const [discount, setDiscount] = useState<number>(0);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activeInvoiceModal, setActiveInvoiceModal] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{ kind: InvoiceAction; invoice: any } | null>(null);

  const fetchInitial = async () => {
    try {
      const [pts, invs] = await Promise.all([
        Api.getPatients(),
        Api.getInvoices(),
      ]);
      setPatients(pts);
      setInvoices(invs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  const filteredPatients = patientSearch.trim()
    ? patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || p.medicalNo.toLowerCase().includes(patientSearch.toLowerCase()))
    : patients;

  const subtotal = Math.max(0, quantity * unitPrice);
  const netAmount = Math.max(0, subtotal - discount);
  const tax = Math.round(netAmount * 0.15 * 100) / 100;
  const total = Math.round((netAmount + tax) * 100) / 100;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setLoading(true);

    if (!selectedPatientId) {
      setErrorMessage('اختر المريض قبل إصدار الفاتورة.');
      setLoading(false);
      return;
    }

    try {
      const res = await Api.createInvoice({
        patientId: selectedPatientId,
        description,
        quantity,
        unitPrice,
        discount,
      });

      setStatusMessage(res.message || `تم إنشاء الفاتورة بنجاح.`);
      setDiscount(0);
      const invs = await Api.getInvoices();
      setInvoices(invs);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إصدار الفاتورة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">الفوترة الطبية والخدمات (Medical Billing)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إصدار الفواتير مع إنشاء قيود اليومية آلياً كمسودة وسجل تدقيق متكامل ضمن معاملة ذرية
          </p>
        </div>
      </div>

      {/* Invoice Generator Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <span>نموذج إصدار فاتورة جديدة</span>
        </h3>

        {statusMessage && (
          <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {/* Patient Selection with search */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تصفية قائمة المرضى بالاسم أو الرقم:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="ابحث عن مريض..."
                  className="w-full text-xs pr-8 pl-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                اختر المريض: *
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
              >
                <option value="">-- اضغط لاختيار المريض --</option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.medicalNo}) - {p.phone || 'بدون هاتف'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Details */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                بيان الخدمة أو الصنف الطبي:
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثال: فحص سريري، علاج، أدوية..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الكمية:
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                سعر الوحدة (ر.س):
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                الخصم (ر.س):
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Totals Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
              <div>
                <span>المجموع الفرعي: </span>
                <span className="font-mono font-bold text-slate-900">{subtotal.toFixed(2)} ر.س</span>
              </div>
              <div>
                <span>الخصم: </span>
                <span className="font-mono font-bold text-rose-600">{discount.toFixed(2)} ر.س</span>
              </div>
              <div>
                <span>ضريبة القيمة المضافة (15%): </span>
                <span className="font-mono font-bold text-slate-900">{tax.toFixed(2)} ر.س</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-left">
                <span className="text-xs text-slate-500 block">الإجمالي الصافي:</span>
                <span className="text-lg font-mono font-black text-indigo-700">
                  {total.toFixed(2)} ر.س
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{loading ? 'جارٍ الحفظ والمعاملة الذرية...' : 'إصدار الفاتورة وترحيل القيد'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Invoices History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">سجل الفواتير الصادرة</h3>
          <span className="text-xs text-slate-400">إجمالي الفواتير: {invoices.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="px-5 py-3">رقم الفاتورة</th>
                <th className="px-5 py-3">المريض</th>
                <th className="px-5 py-3">التاريخ</th>
                <th className="px-5 py-3">المجموع الفرعي</th>
                <th className="px-5 py-3">الضريبة</th>
                <th className="px-5 py-3">الإجمالي</th>
                <th className="px-5 py-3">المتبقي</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-indigo-700">
                    {inv.invoiceNo}
                  </td>
                  <td className="px-5 py-3 font-bold text-slate-900">{inv.patientName}</td>
                  <td className="px-5 py-3 font-mono text-slate-500">{inv.invoiceDate}</td>
                  <td className="px-5 py-3 font-mono">{(inv.subtotalCents / 100).toFixed(2)} ر.س</td>
                  <td className="px-5 py-3 font-mono text-slate-500">{(inv.taxCents / 100).toFixed(2)} ر.س</td>
                  <td className="px-5 py-3 font-mono font-bold text-slate-900">
                    {(inv.totalCents / 100).toFixed(2)} ر.س
                  </td>
                  <td className="px-5 py-3 font-mono font-bold text-amber-700">
                    {inv.status === 'Cancelled' ? '—' : `${(inv.balanceCents / 100).toFixed(2)} ر.س`}
                  </td>
                  <td className="px-5 py-3">
                    {inv.status === 'Cancelled' ? (
                      <span className="bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                        ملغاة
                      </span>
                    ) : inv.balanceCents === 0 ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                        مسددة بالكامل
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                        {inv.netPaidCents > 0 ? 'مسددة جزئياً' : 'مُرحّلة (Posted)'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <button
                        onClick={() => setActiveInvoiceModal(inv)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3 h-3 text-slate-600" />
                        معاينة / طباعة
                      </button>
                      {inv.status === 'Posted' && inv.balanceCents > 0 && (
                        <button onClick={() => setAction({ kind: 'pay', invoice: inv })} className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold cursor-pointer">
                          تحصيل
                        </button>
                      )}
                      {inv.status === 'Posted' && inv.netPaidCents > 0 && (
                        <button onClick={() => setAction({ kind: 'refund', invoice: inv })} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold cursor-pointer">
                          استرداد
                        </button>
                      )}
                      {inv.status === 'Posted' && inv.netPaidCents === 0 && (
                        <button onClick={() => setAction({ kind: 'cancel', invoice: inv })} className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-semibold cursor-pointer">
                          إلغاء
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {action && (
        <InvoiceActionDialog
          kind={action.kind}
          invoice={action.invoice}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            setStatusMessage('تم تنفيذ العملية وترحيل القيد المرافق كمسودة بانتظار الاعتماد.');
            fetchInitial();
          }}
        />
      )}

      {/* Invoice Printable View Modal */}
      {activeInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-4 flex items-center justify-between text-white print:hidden">
              <span className="font-bold text-sm">معاينة الفاتورة الضريبية</span>
              <button
                onClick={() => setActiveInvoiceModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="text-center pb-4 border-b border-slate-200">
                <h4 className="text-base font-extrabold text-slate-900">مِعاف | المنشأة الطبية</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">فاتورة ضريبية مبسطة</p>
                <p className="text-sm font-mono font-bold text-indigo-700 mt-2">
                  {activeInvoiceModal.invoiceNo}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">اسم المريض: </span>
                  <span className="font-bold text-slate-900">{activeInvoiceModal.patientName}</span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-slate-500">التاريخ: </span>
                  <span>{activeInvoiceModal.invoiceDate}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2">البيان</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2">السعر</th>
                      <th className="p-2">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeInvoiceModal.lines.map((l: any) => (
                      <tr key={l.id}>
                        <td className="p-2 font-medium">{l.description}</td>
                        <td className="p-2 text-center font-mono">{l.quantity}</td>
                        <td className="p-2 font-mono">{(l.unitPriceCents / 100).toFixed(2)}</td>
                        <td className="p-2 font-mono font-bold">{(l.totalCents / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{(activeInvoiceModal.subtotalCents / 100).toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span>{(activeInvoiceModal.discountCents / 100).toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span>ضريبة القيمة المضافة (15%):</span>
                  <span>{(activeInvoiceModal.taxCents / 100).toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-xs pt-1 border-t border-slate-200">
                  <span>المبلغ الإجمالي المستحق:</span>
                  <span>{(activeInvoiceModal.totalCents / 100).toFixed(2)} ر.س</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
