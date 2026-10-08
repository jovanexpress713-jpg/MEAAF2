import React, { useCallback, useEffect, useState } from 'react';
import { Api } from '../services/api';
import { Lock, Unlock, Plus, AlertCircle, CheckCircle2, Scale } from 'lucide-react';

// Administration panels for the accounting module: chart of accounts, period close, trial balance.

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  Asset: 'أصل',
  Liability: 'التزام',
  Equity: 'حقوق ملكية',
  Revenue: 'إيراد',
  Expense: 'مصروف',
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
const money = (cents: number) => (cents / 100).toFixed(2);
const inputCls = 'text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none';

const Notice: React.FC<{ kind: 'ok' | 'err'; text: string }> = ({ kind, text }) => (
  <div className={`flex items-start gap-2 p-3 rounded-lg text-xs border ${kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
    {kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
    <span>{text}</span>
  </div>
);

// ---------- Chart of accounts ----------

export const ChartOfAccountsPanel: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Asset');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setAccounts(await Api.getAccounts());
    } catch (err) {
      setMsg({ kind: 'err', text: errorText(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await Api.createAccount({ code, name, type });
      setCode('');
      setName('');
      setMsg({ kind: 'ok', text: 'تمت إضافة الحساب.' });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: errorText(err) });
    }
  };

  const toggle = async (acc: any) => {
    setMsg(null);
    try {
      await Api.updateAccount(acc.code, { isActive: !acc.isActive });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: errorText(err) });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="font-bold text-sm text-slate-800">دليل الحسابات</h3>
        <p className="text-[11px] text-slate-500 mt-1">القيود لا تُقبل إلا على حسابات نشطة من هذا الدليل. الحسابات النظامية (1000، 1100، 2100، 4000) لا يمكن تعطيلها.</p>
      </div>
      <form onSubmit={add} className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50">
        <input dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder="الرمز (4 أرقام)" required className={`${inputCls} sm:col-span-2 font-mono`} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الحساب" required className={`${inputCls} sm:col-span-5`} />
        <select value={type} onChange={e => setType(e.target.value)} className={`${inputCls} sm:col-span-3`}>
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="submit" className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> إضافة
        </button>
      </form>
      {msg && <div className="p-3"><Notice kind={msg.kind} text={msg.text} /></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
            <tr>
              <th className="px-4 py-2">الرمز</th>
              <th className="px-4 py-2">الاسم</th>
              <th className="px-4 py-2">النوع</th>
              <th className="px-4 py-2">الحالة</th>
              <th className="px-4 py-2 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map(a => (
              <tr key={a.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2 font-mono font-bold text-indigo-700">{a.code}</td>
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2 text-slate-600">{ACCOUNT_TYPE_LABELS[a.type] ?? a.type}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${a.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {a.isActive ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => toggle(a)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer">
                    {a.isActive ? 'تعطيل' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------- Periods ----------

export const PeriodsPanel: React.FC = () => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [newPeriod, setNewPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [reopenReasons, setReopenReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setPeriods(await Api.getPeriods());
    } catch (err) {
      setMsg({ kind: 'err', text: errorText(err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, okText: string) => {
    setMsg(null);
    try {
      await action();
      setMsg({ kind: 'ok', text: okText });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: errorText(err) });
    }
  };

  const close = (period: string) => {
    if (!window.confirm(`إقفال الفترة ${period}؟ لن يُسمح بأي ترحيل فيها حتى إعادة فتحها.`)) return;
    run(() => Api.closePeriod(period), `تم إقفال الفترة ${period}.`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-slate-800">الفترات المحاسبية</h3>
          <p className="text-[11px] text-slate-500 mt-1">الفترة المقفلة تمنع إصدار الفواتير والقيود والمدفوعات فيها. لا يُقفل الشهر وبه مسودات غير معتمدة.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className={inputCls} />
          <button onClick={() => run(() => Api.closePeriod(newPeriod), `تم إقفال الفترة ${newPeriod}.`)} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg cursor-pointer inline-flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> إقفال
          </button>
        </div>
      </div>
      {msg && <div className="p-3"><Notice kind={msg.kind} text={msg.text} /></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
            <tr>
              <th className="px-4 py-2">الفترة</th>
              <th className="px-4 py-2">الحالة</th>
              <th className="px-4 py-2">مسودات غير معتمدة</th>
              <th className="px-4 py-2">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periods.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500">لا توجد فترات مقفلة بعد. الفترات المفتوحة تُنشأ تلقائياً عند الترحيل.</td></tr>
            )}
            {periods.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2 font-mono font-bold">{p.period}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${p.status === 'Closed' ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {p.status === 'Closed' ? 'مقفلة' : 'مفتوحة'}
                  </span>
                </td>
                <td className="px-4 py-2">{p.draftEntries}</td>
                <td className="px-4 py-2">
                  {p.status === 'Closed' ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={reopenReasons[p.period] ?? ''}
                        onChange={e => setReopenReasons({ ...reopenReasons, [p.period]: e.target.value })}
                        placeholder="سبب إعادة الفتح (10 أحرف+)"
                        className={`${inputCls} w-56`}
                      />
                      <button
                        onClick={() => run(() => Api.reopenPeriod(p.period, reopenReasons[p.period] ?? ''), `أُعيد فتح الفترة ${p.period}.`)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Unlock className="w-3 h-3" /> إعادة فتح
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => close(p.period)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer">
                      إقفال
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------- Trial balance ----------

export const TrialBalancePanel: React.FC = () => {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const run = async () => {
    setMsg(null);
    try {
      setReport(await Api.getTrialBalance(asOf));
    } catch (err) {
      setMsg({ kind: 'err', text: errorText(err) });
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-800">ميزان المراجعة (القيود المعتمدة فقط)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">حتى تاريخ:</span>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className={inputCls} />
          <button onClick={run} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer">عرض</button>
        </div>
      </div>
      {msg && <div className="p-3"><Notice kind={msg.kind} text={msg.text} /></div>}
      {report && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="px-4 py-2">الرمز</th>
                  <th className="px-4 py-2">الحساب</th>
                  <th className="px-4 py-2">النوع</th>
                  <th className="px-4 py-2 text-left">مدين</th>
                  <th className="px-4 py-2 text-left">دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-500">لا توجد أرصدة معتمدة حتى هذا التاريخ.</td></tr>
                )}
                {report.rows.map((r: any) => (
                  <tr key={r.code} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2 font-mono font-bold">{r.code}</td>
                    <td className="px-4 py-2">{r.name}{!r.isActive && <span className="text-[10px] text-slate-400 mr-2">(معطل)</span>}</td>
                    <td className="px-4 py-2 text-slate-600">{ACCOUNT_TYPE_LABELS[r.type] ?? r.type}</td>
                    <td className="px-4 py-2 font-mono text-left">{r.debitCents ? money(r.debitCents) : '—'}</td>
                    <td className="px-4 py-2 font-mono text-left">{r.creditCents ? money(r.creditCents) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2">الإجمالي</td>
                  <td className="px-4 py-2 font-mono text-left">{money(report.totals.debitCents)}</td>
                  <td className="px-4 py-2 font-mono text-left">{money(report.totals.creditCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="p-3">
            <Notice kind={report.balanced ? 'ok' : 'err'} text={report.balanced ? 'ميزان المراجعة متوازن: إجمالي المدين يساوي إجمالي الدائن.' : 'تحذير: ميزان المراجعة غير متوازن. راجع القيود المعتمدة.'} />
          </div>
        </>
      )}
    </div>
  );
};

export const AccountingAdminPanels: React.FC = () => (
  <div className="space-y-6 pt-6">
    <TrialBalancePanel />
    <PeriodsPanel />
    <ChartOfAccountsPanel />
  </div>
);
