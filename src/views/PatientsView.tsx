import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { cachePatients, getCachedPatients, enqueuePatient, getOutbox, isNetworkError, SYNC_EVENT } from '../services/outbox';
import { Search, UserPlus, Users, Phone, AlertCircle, RefreshCw } from 'lucide-react';

export const PatientsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New patient form fields
  const [medicalNo, setMedicalNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('ذكر');
  const [address, setAddress] = useState('');

  const [offlineInfo, setOfflineInfo] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Pending offline creations are shown alongside server records until they are synced.
  const pendingRows = () =>
    getOutbox()
      .filter(o => o.type === 'patient.create')
      .map(o => ({
        id: `pending-${o.opId}`,
        medicalNo: String(o.payload.medicalNo ?? ''),
        fullName: String(o.payload.fullName ?? ''),
        phone: String(o.payload.phone ?? ''),
        birthDate: o.payload.birthDate ? String(o.payload.birthDate) : '',
        gender: String(o.payload.gender ?? ''),
        pending: true,
      }));

  const fetchPatients = async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getPatients(query);
      if (!query) cachePatients(data);
      const q = query.trim().toLowerCase();
      const pending = pendingRows().filter(p => !q || [p.fullName, p.medicalNo, p.phone].some(v => v.toLowerCase().includes(q)));
      setPatients([...pending, ...data]);
      setOfflineInfo(null);
    } catch (err: any) {
      if (isNetworkError(err)) {
        // Offline: serve the last synced list (filtered locally) plus pending local creations.
        const cached = getCachedPatients();
        const q = query.trim().toLowerCase();
        const matches = (p: any) =>
          !q || [p.fullName, p.medicalNo, p.phone].some((v: unknown) => String(v ?? '').toLowerCase().includes(q));
        const rows = [...pendingRows(), ...cached.patients].filter(matches);
        setPatients(rows);
        setOfflineInfo(
          cached.savedAt
            ? `أنت غير متصل. البيانات من آخر مزامنة (${new Date(cached.savedAt).toLocaleString('ar')}).`
            : 'أنت غير متصل ولا توجد بيانات محفوظة بعد.'
        );
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Re-render when the outbox changes (sync finished, new offline record).
  const [, setOutboxVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setOutboxVersion(v => v + 1);
    window.addEventListener(SYNC_EVENT, refresh);
    return () => window.removeEventListener(SYNC_EVENT, refresh);
  }, []);

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients(searchTerm);
  };

  const handleOpenNewModal = () => {
    // Count pending offline creations too, so the suggested number is less likely to collide.
    setMedicalNo(`MED-${1000 + patients.length + pendingRows().length + 1}`);
    setFullName('');
    setPhone('');
    setBirthDate('');
    setGender('ذكر');
    setAddress('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      medicalNo,
      fullName,
      phone,
      birthDate: birthDate || undefined,
      gender,
      address: address || undefined,
    };

    try {
      await Api.createPatient(payload);
      setIsModalOpen(false);
      fetchPatients(searchTerm);
    } catch (err: any) {
      if (isNetworkError(err)) {
        // Keep the record on this device; it is pushed to the server when the connection returns.
        enqueuePatient(payload);
        setIsModalOpen(false);
        setNotice('تم حفظ المريض على هذا الجهاز وسيُرفع إلى الخادم عند عودة الاتصال.');
        fetchPatients(searchTerm);
        return;
      }
      setError(err.message || 'حدث خطأ أثناء إضافة المريض.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-slate-800">سجلات المرضى (Patients Registry)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الملفات الطبية المعزولة للمنشأة، والبحث بالرقم أو الاسم أو رقم الهاتف
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة ملف مريض جديد</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم الملف الطبي، اسم المريض، أو رقم الهاتف..."
              className="w-full text-sm pr-10 pl-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            بحث
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                fetchPatients('');
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              إلغاء التصفية
            </button>
          )}
        </form>
      </div>

      {offlineInfo && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-3">{offlineInfo}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg p-3 flex justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="cursor-pointer font-bold">×</button>
        </div>
      )}

      {/* Patients Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold">
              <tr>
                <th className="px-5 py-3">رقم الملف (Medical No)</th>
                <th className="px-5 py-3">اسم المريض الكامل</th>
                <th className="px-5 py-3">الهاتف</th>
                <th className="px-5 py-3">الجنس</th>
                <th className="px-5 py-3">تاريخ الميلاد</th>
                <th className="px-5 py-3">العنوان</th>
                <th className="px-5 py-3">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs">
                    جارٍ استرداد السجلات من خادم المنشأة...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs">
                    لا توجد ملفات مرضى مطابقة للبحث في قاعدة بيانات المنشأة.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-sky-700 text-xs">
                      {patient.medicalNo}
                      {patient.pending && (
                        <span className="ms-2 font-sans font-semibold text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">بانتظار المزامنة</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {patient.fullName}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                      {patient.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {patient.phone}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        patient.gender === 'أنثى' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {patient.gender || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                      {patient.birthDate || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {patient.address || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                      {patient.createdAt.slice(0, 10)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>عدد السجلات: {patients.length}</span>
          <span className="text-[11px] font-mono">عزل المنشآت (Tenant Scoped) مفعل وموثق بالخادم</span>
        </div>
      </div>

      {/* New Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-base">إنشاء ملف مريض جديد</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    رقم الملف الطبي (Medical No): *
                  </label>
                  <input
                    type="text"
                    value={medicalNo}
                    onChange={(e) => setMedicalNo(e.target.value)}
                    className="w-full text-sm font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="MED-1005"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اسم المريض الكامل: *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="الاسم الثلاثي أو الرباعي"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    رقم الهاتف:
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                    placeholder="05XXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الجنس:
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                  >
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاريخ الميلاد:
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    العنوان:
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="المدينة والحي"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  حفظ السجل في قاعدة البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
