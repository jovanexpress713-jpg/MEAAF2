import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WifiOff, X, AlertTriangle } from 'lucide-react';
import { flushOutbox, getIssues, getOutbox, dismissIssue, SYNC_EVENT, SyncIssue } from '../services/outbox';

// Shows offline state, pending operations and sync conflicts. Flushes automatically when the
// connection returns and periodically while operations are waiting.
export const SyncStatus: React.FC = () => {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(getOutbox().length);
  const [issues, setIssues] = useState<SyncIssue[]>(getIssues());
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshLocal = useCallback(() => {
    setPending(getOutbox().length);
    setIssues(getIssues());
  }, []);

  const sync = useCallback(async () => {
    if (getOutbox().length === 0) return;
    setSyncing(true);
    try {
      const r = await flushOutbox();
      if (r.offline) {
        setOnline(false);
        setMessage(null);
      } else {
        setOnline(true);
        setMessage(
          `تمت المزامنة: ${r.applied} مُطبَّق` +
            (r.conflicts ? `، ${r.conflicts} تعارض` : '') +
            (r.rejected ? `، ${r.rejected} مرفوض` : '')
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'تعذرت المزامنة.');
    } finally {
      setSyncing(false);
      refreshLocal();
    }
  }, [refreshLocal]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener(SYNC_EVENT, refreshLocal);
    const timer = window.setInterval(() => {
      if (navigator.onLine) sync();
    }, 20000);
    sync();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener(SYNC_EVENT, refreshLocal);
      window.clearInterval(timer);
    };
  }, [sync, refreshLocal]);

  if (online && pending === 0 && issues.length === 0 && !message) return null;

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2 text-xs" dir="rtl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
        {!online && (
          <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <WifiOff className="w-3.5 h-3.5" /> وضع عدم الاتصال
          </span>
        )}
        {pending > 0 && (
          <span className="text-slate-700">
            بانتظار المزامنة: <strong>{pending}</strong> عملية
          </span>
        )}
        {pending > 0 && (
          <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md font-semibold disabled:opacity-50 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> مزامنة الآن
          </button>
        )}
        {message && <span className="text-emerald-700">{message}</span>}
      </div>

      {issues.length > 0 && (
        <div className="max-w-7xl mx-auto mt-2 space-y-1.5">
          {issues.map(issue => (
            <div key={issue.opId} className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong>{issue.status === 'conflict' ? 'تعارض مزامنة' : 'عملية مرفوضة'}:</strong> {issue.message}
                {issue.payload?.fullName ? <span className="text-rose-600"> — {String(issue.payload.fullName)}</span> : null}
                <span className="block text-[10px] text-rose-500">لم تُطبَّق هذه العملية على السجل الموجود في الخادم؛ راجع البيانات وأعد إدخالها إن لزم.</span>
              </div>
              <button onClick={() => { dismissIssue(issue.opId); refreshLocal(); }} className="text-rose-500 hover:text-rose-800 cursor-pointer" aria-label="إخفاء">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
