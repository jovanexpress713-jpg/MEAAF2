import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { AccountingAdminPanels } from './AccountingAdmin';
import {
  Scale,
  CheckCircle,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const AccountingView: React.FC = () => {
  const [description, setDescription] = useState('قيد إيراد أو تسوية مالية');
  const [debitAmount, setDebitAmount] = useState<number>(500);
  const [creditAmount, setCreditAmount] = useState<number>(500);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastPostedId, setLastPostedId] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJournals = async () => {
    try {
      const data = await Api.getJournalEntries();
      setJournals(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setLoading(true);

    if (debitAmount <= 0 || creditAmount <= 0) {
      setErrorMessage('أدخل مبالغ موجبة وصالحة.');
      setLoading(false);
      return;
    }

    if (Math.abs(debitAmount - creditAmount) > 0.001) {
      setErrorMessage(
        `القيد غير متوازن! المدين (${debitAmount}) يجب أن يساوي الدائن (${creditAmount}).`
      );
      setLoading(false);
      return;
    }

    try {
      const entry = await Api.postJournalEntry({
        description,
        entryDate,
        lines: [
          { accountCode: '1000', accountName: 'الصندوق والبنك', debit: debitAmount, credit: 0 },
          { accountCode: '4000', accountName: 'الإيرادات', debit: 0, credit: creditAmount },
        ],
      });

      setLastPostedId(entry.id);
      setStatusMessage(`حُفظ القيد كمسودة بنجاح: رقم ${entry.entryNo} في قاعدة البيانات.`);
      fetchJournals();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر حفظ القيد المحاسبي.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await Api.approveJournalEntry(id);
      setStatusMessage(`تم اعتماد القيد بنجاح: رقم ${res.entry.entryNo}. دخلت القيم في حسابات الإيرادات والتقارير الرسمية.`);
      fetchJournals();
      if (lastPostedId === id) setLastPostedId(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر اعتماد القيد.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">المحاسبة والقيود اليومية المزدوجة (Double-Entry Accounting)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل قيود اليومية، التحقق الصارم من التوازن المالي، واعتماد القيود للميزان عبر الخادم
          </p>
        </div>
      </div>

      {/* New Journal Entry Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
          إنشاء قيد يومية جديد (مسودة أولية)
        </h3>

        {statusMessage && (
          <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handlePost} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                بيان القيد / الوصف المحاسبي: *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="أدخل سبب أو موضوع القيد..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تاريخ القيد:
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-700 block">أطراف القيد المزدوج:</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">الطرف المدين (Debit)</span>
                  <span className="text-[10px] bg-slate-100 font-mono text-slate-600 px-2 py-0.5 rounded">
                    حـ/ 1000 الصندوق
                  </span>
                </div>
                <label className="block text-[11px] text-slate-500 mb-1">المبلغ المدين (ر.س):</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={debitAmount}
                  onChange={(e) => setDebitAmount(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm font-mono font-bold px-3 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">الطرف الدائن (Credit)</span>
                  <span className="text-[10px] bg-slate-100 font-mono text-slate-600 px-2 py-0.5 rounded">
                    حـ/ 4000 الإيرادات
                  </span>
                </div>
                <label className="block text-[11px] text-slate-500 mb-1">المبلغ الدائن (ر.س):</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm font-mono font-bold px-3 py-1.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className={`font-semibold ${
                Math.abs(debitAmount - creditAmount) < 0.001 ? 'text-emerald-700' : 'text-rose-600'
              }`}>
                {Math.abs(debitAmount - creditAmount) < 0.001
                  ? '✓ القيد متوازن تماماً'
                  : `✕ فارق عدم التوازن: ${(debitAmount - creditAmount).toFixed(2)} ر.س`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  حفظ القيد كمسودة (Post)
                </button>

                {lastPostedId && (
                  <button
                    type="button"
                    onClick={() => handleApprove(lastPostedId)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    اعتماد القيد الأخير (Approve)
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Journal Entries List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">دليل قيود اليومية في قاعدة البيانات</h3>
          </div>
          <span className="text-xs text-slate-500">إجمالي القيود: {journals.length}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {journals.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;
            const totalDebit = entry.lines.reduce((s: number, l: any) => s + l.debitCents, 0) / 100;

            return (
              <div key={entry.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                        {entry.entryNo}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        entry.isApproved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {entry.isApproved ? 'معتمد (Approved)' : 'مسودة (Draft)'}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{entry.entryDate}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{entry.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left font-mono">
                      <span className="text-xs font-bold text-slate-900 block">
                        {totalDebit.toFixed(2)} ر.س
                      </span>
                      <span className="text-[10px] text-slate-400">إجمالي القيد</span>
                    </div>

                    {!entry.isApproved && (
                      <button
                        onClick={() => handleApprove(entry.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        اعتماد
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title="عرض تفاصيل الأسطر"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Lines View */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/70 p-3 rounded-lg">
                    <table className="w-full text-right text-xs">
                      <thead className="text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="pb-1.5">السطر</th>
                          <th className="pb-1.5">رقم الحساب</th>
                          <th className="pb-1.5">اسم الحساب</th>
                          <th className="pb-1.5 font-mono">مدين</th>
                          <th className="pb-1.5 font-mono">دائن</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {entry.lines.map((l: any) => (
                          <tr key={l.id}>
                            <td className="py-1.5 font-mono text-slate-400">{l.lineNo}</td>
                            <td className="py-1.5 font-mono font-bold text-slate-700">{l.accountCode}</td>
                            <td className="py-1.5 font-medium text-slate-800">{l.accountName}</td>
                            <td className="py-1.5 font-mono font-bold text-indigo-700">
                              {l.debitCents > 0 ? (l.debitCents / 100).toFixed(2) : '-'}
                            </td>
                            <td className="py-1.5 font-mono font-bold text-purple-700">
                              {l.creditCents > 0 ? (l.creditCents / 100).toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <AccountingAdminPanels />
    </div>
  );
};
