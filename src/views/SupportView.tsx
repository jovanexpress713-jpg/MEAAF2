import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { LifeBuoy, Plus, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

export const SupportView: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('Medium');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await Api.getTickets();
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Api.createTicket({ title, description, severity });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      fetchTickets();
    } catch (err: any) {
      alert(err.message || 'فشل فتح التذكرة.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">الدعم الفني وتذاكر الصيانة (Support Center)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إدارة طلبات الصيانة، تذاكر الدعم التقني، وجلسات التدخل الفني المعتمدة
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>فتح تذكرة دعم جديدة</span>
        </button>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">سجل تذاكر المنشأة</span>
          <span className="text-slate-400">إجمالي التذاكر: {tickets.length}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {tickets.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">لا توجد تذاكر دعم مفتوحة حالياً.</p>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{t.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {t.status}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      الأهمية: {t.severity}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1">{t.description}</p>
                </div>
                <div className="text-left text-slate-400 font-mono text-[11px] shrink-0">
                  {new Date(t.createdAt).toLocaleDateString('ar-SA')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm">فتح تذكرة دعم فني جديدة</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">موضوع التذكرة: *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="وصف موجز للمشكلة"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">درجة الأهمية (Severity):</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                >
                  <option value="Low">منخفضة (Low)</option>
                  <option value="Medium">متوسطة (Medium)</option>
                  <option value="High">عالية (High)</option>
                  <option value="Critical">حرجة (Critical)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">تفاصيل المشكلة والخطوات: *</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اشرح المشكلة بالتفصيل ورسائل الخطأ إن وجدت..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg"
                >
                  إرسال التذكرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
