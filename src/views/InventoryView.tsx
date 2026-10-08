import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import {
  PackageCheck,
  Plus,
  ArrowDownToLine,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New product state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('علبة');
  const [cost, setCost] = useState<number>(10);
  const [price, setPrice] = useState<number>(15);

  // Stock incoming state
  const [stockQtyToAdd, setStockQtyToAdd] = useState<number>(10);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await Api.getProducts();
      setProducts(data);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const prod = await Api.createProduct({
        sku,
        name,
        unit,
        cost,
        price,
      });

      setStatusMessage(`تمت إضافة المنتج بنجاح إلى قاعدة البيانات: ${prod.name} (${prod.sku})`);
      setSku('');
      setName('');
      fetchProducts();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إضافة المنتج.');
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!selectedProductId) {
      setErrorMessage('حدد منتجاً من الجدول أولاً.');
      return;
    }

    if (stockQtyToAdd <= 0) {
      setErrorMessage('أدخل كمية توريد صالحة.');
      return;
    }

    try {
      const res = await Api.addStock(selectedProductId, stockQtyToAdd);
      setStatusMessage(
        `تم توريد ${stockQtyToAdd} ${res.product.unit} بنجاح إلى مخزون: ${res.product.name}. الرصيد الحالي: ${res.product.stock}`
      );
      fetchProducts();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر تحديث المخزون.');
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-slate-800">إدارة المخزون والمستلزمات الطبية (Inventory Registry)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            متابعة أرصدة الأدوية والمستهلكات، إضافة الأصناف، وتسجيل الكميات الواردة في قاعدة البيانات
          </p>
        </div>

        <button
          onClick={fetchProducts}
          className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Two operational cards: Create Product & Stock Incoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Product Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            إضافة صنف / دواء جديد للمستودع
          </h3>

          <form onSubmit={handleCreateProduct} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  رمز الصنف (SKU): *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="MED-1234"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  اسم المنتج / الصنف: *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم الدواء أو المستلزم الطبي"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  الوحدة:
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="علبة، كرتون، حبة..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  التكلفة (ر.س):
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  سعر البيع (ر.س):
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                إضافة الصنف
              </button>
            </div>
          </form>
        </div>

        {/* Incoming Stock Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
              <ArrowDownToLine className="w-3.5 h-3.5 text-amber-600" />
              تسجيل كمية واردة (توريد)
            </h3>

            {selectedProduct ? (
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-3 text-xs mb-3 space-y-1">
                <span className="text-[10px] text-amber-700 font-semibold block">المنتج المحدد:</span>
                <p className="font-bold text-slate-900">{selectedProduct.name}</p>
                <div className="flex items-center justify-between text-slate-600 font-mono text-[11px]">
                  <span>رمز: {selectedProduct.sku}</span>
                  <span>الرصيد: {selectedProduct.stock} {selectedProduct.unit}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center mb-3">
                اضغط على أي صنف في الجدول لتحديده وتوريد كميات له.
              </div>
            )}

            <form onSubmit={handleAddStock} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  الكمية الواردة المراد إضافتها:
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockQtyToAdd}
                  onChange={(e) => setStockQtyToAdd(parseInt(e.target.value) || 0)}
                  disabled={!selectedProduct}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none disabled:bg-slate-100 disabled:opacity-60"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!selectedProduct}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                تأكيد التوريد وتحديث الرصيد
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم أو رمز الصنف..."
              className="w-full text-xs pr-8 pl-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
          </div>

          <span className="text-xs text-slate-500">
            إجمالي الأصناف: {filteredProducts.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="px-5 py-3">رمز الصنف (SKU)</th>
                <th className="px-5 py-3">اسم المنتج</th>
                <th className="px-5 py-3">الوحدة</th>
                <th className="px-5 py-3 font-mono">سعر التكلفة</th>
                <th className="px-5 py-3 font-mono">سعر البيع</th>
                <th className="px-5 py-3 font-mono">الكمية المتوفرة</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3 text-center">اختيار للتوريد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredProducts.map((p) => {
                const isSelected = selectedProductId === p.id;
                const isLow = p.stock < 20;

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/80 font-semibold'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">{p.sku}</td>
                    <td className="px-5 py-3 font-bold text-slate-900">{p.name}</td>
                    <td className="px-5 py-3 text-slate-500">{p.unit}</td>
                    <td className="px-5 py-3 font-mono">{(p.costCents / 100).toFixed(2)} ر.س</td>
                    <td className="px-5 py-3 font-mono font-bold text-slate-900">
                      {(p.priceCents / 100).toFixed(2)} ر.س
                    </td>
                    <td className="px-5 py-3 font-mono font-bold">
                      <span className={`inline-flex items-center gap-1 ${
                        isLow ? 'text-amber-700' : 'text-slate-900'
                      }`}>
                        {p.stock}
                        {isLow && (
                          <span title="كمية منخفضة">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        نشط
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProductId(p.id);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
                          isSelected
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'محدد حالياً' : 'تحديد'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
