import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { Monitor, Printer, Wifi, Plus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const DevicesView: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New device form
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('Workstation');
  const [ipAddress, setIpAddress] = useState('192.168.10.75');
  const [osVersion, setOsVersion] = useState('Windows 11 Pro');
  const [assignedPrinter, setAssignedPrinter] = useState('Epson TM-T88VI Thermal');

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await Api.getDevices();
      setDevices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Api.registerDevice({
        deviceName,
        deviceType,
        ipAddress,
        osVersion,
        assignedPrinter,
      });
      setIsModalOpen(false);
      setDeviceName('');
      fetchDevices();
    } catch (err: any) {
      alert(err.message || 'فشل تسجيل الجهاز.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-slate-800">إدارة الأجهزة ومحطات العمل والطباعة</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ربط محطات العمل الطبية، نقاط البيع، أجهزة الاستقبال، وتعيين طابعات الفواتير والملصقات
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل محطة / طابعة جديدة</span>
        </button>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((dev) => (
          <div key={dev.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  {dev.deviceType}
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-1">{dev.deviceName}</h3>
                <p className="text-xs text-slate-500 font-mono">{dev.ipAddress}</p>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3 h-3" />
                متصل
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>نظام التشغيل:</span>
                <span className="font-medium text-slate-800">{dev.osVersion}</span>
              </div>
              {dev.assignedPrinter && (
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    الطابعة المعينة:
                  </span>
                  <span className="font-mono text-[11px] font-bold text-indigo-900">{dev.assignedPrinter}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Register Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm">تسجيل جهاز أو محطة عمل جديدة</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">اسم الجهاز / المحطة: *</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="مثال: CLINIC-ROOM-103"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">نوع الجهاز:</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                  >
                    <option value="Workstation">محطة عمل (Workstation)</option>
                    <option value="Tablet">جهاز لوحي (Tablet)</option>
                    <option value="Printer">طابعة شبكية (Printer)</option>
                    <option value="POS">نقطة بيع (POS)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">عنوان IP:</label>
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">الطابعة المعينة للمحطة:</label>
                <input
                  type="text"
                  value={assignedPrinter}
                  onChange={(e) => setAssignedPrinter(e.target.value)}
                  placeholder="طابعة فواتير أو ليزر"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
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
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg"
                >
                  حفظ وتسجيل الجهاز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
