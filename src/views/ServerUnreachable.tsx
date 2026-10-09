import React from 'react';
import { ServerCrash, RefreshCw, Terminal } from 'lucide-react';

interface ServerUnreachableProps {
  message: string;
  onRetry: () => void;
}

/**
 * Shown only when the API server itself cannot be reached. This is a real failure state,
 * not a login screen: in open mode there is nothing for the operator to type, so the honest
 * answer is "the server is not running" plus how to start it.
 */
export const ServerUnreachable: React.FC<ServerUnreachableProps> = ({ message, onRetry }) => {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-200"
    >
      <div className="w-full max-w-lg bg-slate-800/60 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-700/40 flex items-center justify-center">
            <ServerCrash className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">تعذر الاتصال بخادم مِعاف</h1>
            <p className="text-xs text-slate-400">الواجهة تعمل، لكن خدمة البيانات لا تستجيب.</p>
          </div>
        </div>

        <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl p-3.5 text-xs text-rose-200 mb-5">
          <b className="block mb-1">الخطأ الوارد من النظام:</b>
          <span className="font-mono break-words">{message}</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 text-xs space-y-2 mb-6">
          <p className="font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            خطوات التشغيل على جهازك
          </p>
          <ol className="list-decimal pr-5 space-y-1.5 text-slate-300">
            <li>
              افتح مجلد المشروع وشغّل الخادم:
              <code className="block mt-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-emerald-300" dir="ltr">
                npm run dev
              </code>
            </li>
            <li>انتظر رسالة <span className="font-mono text-slate-100">Server running on http://0.0.0.0:3000</span>.</li>
            <li>أعد فتح العنوان نفسه في المتصفح، أو اضغط «إعادة المحاولة» أدناه.</li>
          </ol>
          <p className="text-slate-400 pt-1">
            لا حاجة لأي كلمة مرور: الدخول يتم تلقائياً كمدير النظام بمجرد تشغيل الخادم.
          </p>
        </div>

        <button
          onClick={onRetry}
          className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة محاولة الاتصال
        </button>
      </div>
    </div>
  );
};

export default ServerUnreachable;
