import React, { useState } from 'react';
import { Api } from '../services/api';
import { X, AlertCircle } from 'lucide-react';

export type InvoiceAction = 'pay' | 'refund' | 'cancel';

const METHODS = [
  { value: 'Cash', label: 'نقداً' },
  { value: 'Card', label: 'بطاقة' },
  { value: 'Bank Transfer', label: 'تحويل بنكي' },
  { value: 'Insurance', label: 'تأمين' },
];

const TITLES: Record<InvoiceAction, string> = {
  pay: 'تحصيل دفعة',
  refund: 'استرداد مبلغ',
  cancel: 'إلغاء الفاتورة',
};

const inputCls = 'w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none';

interface Props {
  kind: InvoiceAction;
  invoice: any;
  onClose: () => void;
  onDone: () => void;
}

// Collect, refund or cancel an invoice. Amounts are validated by the server (balance and precision).
export const InvoiceActionDialog: React.FC<Props> = ({ kind, invoice, onClose, onDone }) => {
  const [amount, setAmount] = useState<string>(
    kind === 'pay' ? (invoice.balanceCents / 100).toFixed(2) : kind === 'refund' ? (invoice.netPaidCents / 100).toFixed(2) : ''
  );
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      if (kind === 'pay') await Api.payInvoice(invoice.id, { amount: Number(amount), method, reference: reference || undefined });
      else if (kind === 'refund') await Api.refundInvoice(invoice.id, { amount: Number(amount), reason });
      else await Api.cancelInvoice(invoice.id, { reason });
      onDone();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'حدث خطأ غير متوقع.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 px-5 py-3 flex items-center justify-between text-white">
          <span className="font-bold text-sm">{TITLES[kind]} — <span className="font-mono">{invoice.invoiceNo}</span></span>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 text-xs text-slate-700">
          <div className="grid grid-cols-3 gap-2 text-center font-mono bg-slate-50 rounded-lg p-3">
            <div><div className="text-[10px] text-slate-500">الإجمالي</div>{(invoice.totalCents / 100).toFixed(2)}</div>
            <div><div className="text-[10px] text-slate-500">الصافي المدفوع</div>{(invoice.netPaidCents / 100).toFixed(2)}</div>
            <div><div className="text-[10px] text-slate-500">المتبقي</div>{(invoice.balanceCents / 100).toFixed(2)}</div>
          </div>

          {kind !== 'cancel' && (
            <label className="block">
              <span className="block font-semibold mb-1">المبلغ (ر.س)</span>
              <input dir="ltr" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className={`${inputCls} font-mono`} />
            </label>
          )}

          {kind === 'pay' && (
            <>
              <label className="block">
                <span className="block font-semibold mb-1">طريقة الدفع</span>
                <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block font-semibold mb-1">المرجع (اختياري)</span>
                <input value={reference} onChange={e => setReference(e.target.value)} maxLength={80} className={inputCls} />
              </label>
            </>
          )}

          {kind !== 'pay' && (
            <label className="block">
              <span className="block font-semibold mb-1">السبب (5 أحرف على الأقل)</span>
              <textarea value={reason} onChange={e => setReason(e.target.value)} required minLength={5} rows={3} className={inputCls} />
            </label>
          )}

          {kind === 'cancel' && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              سيُنشأ قيد عكسي مسودة بانتظار الاعتماد. لا يمكن إلغاء فاتورة عليها مدفوعات صافية.
            </p>
          )}

          {err && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">إلغاء</button>
            <button type="submit" disabled={saving} className="px-4 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 cursor-pointer">
              {saving ? 'جارٍ التنفيذ...' : 'تأكيد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
