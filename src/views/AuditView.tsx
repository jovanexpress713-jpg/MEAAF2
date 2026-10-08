import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { ScrollText, Search, User } from 'lucide-react';

export const AuditView: React.FC = () => {
  const [filterText, setFilterText] = useState('');
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.getAuditLogs()
      .then(setAudits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = audits.filter(
    (a) =>
      a.action?.toLowerCase().includes(filterText.toLowerCase()) ||
      a.resource?.toLowerCase().includes(filterText.toLowerCase()) ||
      a.details?.toLowerCase().includes(filterText.toLowerCase()) ||
      (a.userName && a.userName.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">سجل التدقيق والرقابة غير القابل للتلاعب (Tamper-Resistant Audit Log)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            توثيق تاريخي دائم لجميع العمليات المحاسبية، الإدارية، وتعديلات البيانات مسجل مباشرة في الخادم
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="تصفية السجل بالإجراء، المورد، أو اسم المستخدم..."
            className="w-full text-xs pr-8 pl-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
        </div>
        <span className="text-xs text-slate-500">
          عدد القيود الموثقة: {filtered.length}
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="px-5 py-3">الوقت والتاريخ</th>
                <th className="px-5 py-3">المستخدم</th>
                <th className="px-5 py-3">نوع الإجراء</th>
                <th className="px-5 py-3">المورد (Resource)</th>
                <th className="px-5 py-3">التفاصيل والبيان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    جارٍ قراءة سجل التدقيق من قاعدة البيانات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    لا توجد سجلات تدقيق مطابقة.
                  </td>
                </tr>
              ) : (
                filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-mono text-slate-500 text-[11px]">
                      {new Date(record.atUtc).toLocaleString('ar-SA')}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {record.userName || 'النظام'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        record.action === 'Create'
                          ? 'bg-sky-50 text-sky-700'
                          : record.action === 'Approve'
                          ? 'bg-emerald-50 text-emerald-700'
                          : record.action === 'PostDraft' || record.action === 'AutoDraft'
                          ? 'bg-indigo-50 text-indigo-700'
                          : record.action === 'Commit'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {record.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-600">
                      {record.resource}
                    </td>
                    <td className="px-5 py-3 text-slate-800">{record.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
