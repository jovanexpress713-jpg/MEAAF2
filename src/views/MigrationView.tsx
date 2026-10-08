import React, { useEffect, useMemo, useState } from 'react';
import { Api } from '../services/api';
import { Upload, CheckCircle2, AlertTriangle, Trash2, FileSpreadsheet } from 'lucide-react';

// File-based migration: pick an entity, upload CSV or JSON, map columns to fields, stage (validate
// without writing), review errors, then commit atomically. Nothing is written until commit.

interface FieldSpec {
  name: string;
  label: string;
  required: boolean;
}
interface EntitySpec {
  name: string;
  label: string;
  key: string;
  fields: FieldSpec[];
}
interface JobRow {
  id: string;
  entity: string;
  status: string;
  sourceName: string;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  importedRows?: number;
  createdAt: string;
  errors?: Array<{ row: number; field?: string; message: string }>;
}

type Row = Record<string, unknown>;

const MAX_ROWS = 10000;

// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF).
export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
  if (!header) return [];
  const names = header.map(h => h.trim());
  return body.map(r => Object.fromEntries(names.map((n, i) => [n, (r[i] ?? '').trim()])));
}

function parseFile(name: string, text: string): Row[] {
  if (name.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('ملف JSON يجب أن يحتوي على مصفوفة من الكائنات.');
    return data as Row[];
  }
  return parseCsv(text);
}

// Guess a source column for each field from its name or Arabic label.
function guessColumn(field: FieldSpec, columns: string[]): string {
  const norm = (v: string) => v.toLowerCase().replace(/[\s_\-()]/g, '');
  const target = norm(field.name);
  const hit = columns.find(c => norm(c) === target) ?? columns.find(c => norm(c).includes(target));
  return hit ?? '';
}

export const MigrationView: React.FC = () => {
  const [entities, setEntities] = useState<EntitySpec[]>([]);
  const [entity, setEntity] = useState('patients');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [sourceRows, setSourceRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [staged, setStaged] = useState<JobRow | null>(null);

  const spec = entities.find(e => e.name === entity);
  const columns = useMemo(() => Array.from(new Set(sourceRows.flatMap(r => Object.keys(r)))), [sourceRows]);

  const loadJobs = async () => setJobs(await Api.getMigrationJobs());

  useEffect(() => {
    Api.getMigrationEntities().then(setEntities).catch(e => setMessage({ kind: 'err', text: e.message }));
    loadJobs().catch(() => undefined);
  }, []);

  // Reset the mapping whenever the entity or the source columns change.
  useEffect(() => {
    if (!spec) return;
    setMapping(Object.fromEntries(spec.fields.map(f => [f.name, guessColumn(f, columns)])));
  }, [entity, spec, columns]);

  const onFile = async (file: File) => {
    setMessage(null);
    setStaged(null);
    try {
      const text = await file.text();
      const rows = parseFile(file.name, text);
      if (rows.length === 0) throw new Error('الملف لا يحتوي على صفوف بيانات.');
      if (rows.length > MAX_ROWS) throw new Error(`الحد الأقصى ${MAX_ROWS} صف في الملف الواحد؛ قسّم الملف.`);
      setSourceName(file.name);
      setSourceRows(rows);
    } catch (err) {
      setSourceRows([]);
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'تعذر قراءة الملف.' });
    }
  };

  const mappedRows = (): Row[] =>
    sourceRows.map(src => {
      const out: Row = {};
      for (const f of spec?.fields ?? []) {
        const col = mapping[f.name];
        if (col && src[col] !== undefined && src[col] !== '') out[f.name] = src[col];
      }
      return out;
    });

  const missingRequired = (spec?.fields ?? []).filter(f => f.required && !mapping[f.name]);

  const stage = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const job = await Api.stageMigration({ entity, rows: mappedRows(), sourceName, sourceType: sourceName.toLowerCase().endsWith('.json') ? 'JSON' : 'CSV' });
      setStaged(job);
      loadJobs();
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'تعذر التحضير.' });
    } finally {
      setBusy(false);
    }
  };

  const commit = async (id: string) => {
    if (!window.confirm('سيتم ترحيل الصفوف الصالحة دفعة واحدة. هل تريد المتابعة؟')) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await Api.commitMigration(id);
      setMessage({ kind: 'ok', text: `تم الترحيل: ${res.importedRows} صف.` });
      setStaged(null);
      setSourceRows([]);
      setSourceName('');
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'فشل الترحيل.' });
    } finally {
      setBusy(false);
      loadJobs();
    }
  };

  const discard = async (id: string) => {
    await Api.discardMigration(id);
    if (staged?.id === id) setStaged(null);
    loadJobs();
  };

  const canStage = sourceRows.length > 0 && missingRequired.length === 0 && !busy;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-800">ترحيل البيانات من ملفات</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          ارفع ملف CSV أو JSON، وطابق الأعمدة مع الحقول، ثم راجع نتيجة التحقق قبل الترحيل. لا تُكتب أي بيانات إلا عند الاعتماد، وتُرحَّل كل الصفوف الصالحة في عملية واحدة.
        </p>
      </div>

      {message && (
        <div className={`text-sm rounded-lg p-3 border ${message.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">نوع البيانات</span>
            <select value={entity} onChange={e => { setEntity(e.target.value); setStaged(null); }} className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white">
              {entities.map(e => (
                <option key={e.name} value={e.name}>{e.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">الملف (CSV أو JSON، حتى {MAX_ROWS} صف)</span>
            <div className="mt-1 flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4 text-slate-500" />
              <input type="file" accept=".csv,.json,text/csv,application/json" className="text-xs" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
            </div>
          </label>
        </div>

        {sourceRows.length > 0 && spec && (
          <>
            <div className="text-xs text-slate-600">
              {sourceName}: <strong>{sourceRows.length}</strong> صف، <strong>{columns.length}</strong> عمود.
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {spec.fields.map(f => (
                <label key={f.name} className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    {f.label} {f.required && <span className="text-rose-600">*</span>}
                  </span>
                  <select
                    value={mapping[f.name] ?? ''}
                    onChange={e => setMapping({ ...mapping, [f.name]: e.target.value })}
                    className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">— غير مرتبط —</option>
                    {columns.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {missingRequired.length > 0 && (
              <div className="text-xs text-amber-700">اربط الحقول الإلزامية أولاً: {missingRequired.map(f => f.label).join('، ')}</div>
            )}
            <button onClick={stage} disabled={!canStage} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 cursor-pointer">
              {busy ? 'جارٍ التحقق…' : 'تحقق من البيانات (بدون كتابة)'}
            </button>
          </>
        )}
      </div>

      {staged && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> صالح: {staged.validRows}</span>
            <span className="text-slate-600">مكرر (يُتجاهل): {staged.duplicateRows}</span>
            <span className="inline-flex items-center gap-1 text-rose-700"><AlertTriangle className="w-4 h-4" /> خطأ: {staged.invalidRows}</span>
          </div>
          {staged.errors && staged.errors.length > 0 && (
            <div className="max-h-56 overflow-auto border border-rose-200 rounded-lg">
              <table className="w-full text-xs text-right">
                <thead className="bg-rose-50 text-rose-800"><tr><th className="px-3 py-2">الصف</th><th className="px-3 py-2">الحقل</th><th className="px-3 py-2">الخطأ</th></tr></thead>
                <tbody>
                  {staged.errors.map((e, i) => (
                    <tr key={i} className="border-t border-rose-100"><td className="px-3 py-1.5">{e.row}</td><td className="px-3 py-1.5">{e.field ?? '—'}</td><td className="px-3 py-1.5">{e.message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => commit(staged.id)} disabled={busy || staged.status !== 'Validated'} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 cursor-pointer">
              اعتماد الترحيل ({staged.validRows} صف)
            </button>
            <button onClick={() => discard(staged.id)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer">إلغاء</button>
          </div>
          {staged.status !== 'Validated' && <p className="text-xs text-amber-700">لا يمكن الاعتماد: صلّح الأخطاء أو ارفع ملفاً آخر.</p>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 text-sm font-bold text-slate-700">سجل مهام الترحيل</div>
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-2">التاريخ</th><th className="px-4 py-2">النوع</th><th className="px-4 py-2">المصدر</th><th className="px-4 py-2">الحالة</th><th className="px-4 py-2">صالح/مكرر/خطأ</th><th className="px-4 py-2">مرحَّل</th><th className="px-4 py-2" /></tr></thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">لا توجد مهام بعد.</td></tr>}
            {jobs.map(j => (
              <tr key={j.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{new Date(j.createdAt).toLocaleString('ar')}</td>
                <td className="px-4 py-2">{entities.find(e => e.name === j.entity)?.label ?? j.entity}</td>
                <td className="px-4 py-2">{j.sourceName}</td>
                <td className="px-4 py-2">{j.status}</td>
                <td className="px-4 py-2">{j.validRows} / {j.duplicateRows} / {j.invalidRows}</td>
                <td className="px-4 py-2">{j.importedRows ?? 0}</td>
                <td className="px-4 py-2">
                  {j.status === 'Staged' || j.status === 'Validated' ? (
                    <button onClick={() => discard(j.id)} className="text-slate-500 hover:text-rose-700 cursor-pointer" aria-label="إلغاء المهمة"><Trash2 className="w-4 h-4" /></button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
