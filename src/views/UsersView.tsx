import React, { useCallback, useEffect, useState } from 'react';
import { Api } from '../services/api';
import { UserPlus, KeyRound, Unlock, Pencil, Copy, X, ShieldCheck, Trash2, Plus, AlertCircle } from 'lucide-react';

interface UsersViewProps {
  currentUserId: string;
}

type Catalog = Record<string, string[]>;

const RESOURCE_LABELS: Record<string, string> = {
  Patients: 'المرضى',
  Billing: 'الفوترة',
  Accounting: 'المحاسبة',
  Inventory: 'المخزون',
  Reports: 'التقارير',
  Migration: 'الترحيل',
  Backup: 'النسخ الاحتياطي',
  Devices: 'الأجهزة',
  Control: 'مركز التحكم',
  Health: 'صحة النظام',
  Support: 'الدعم',
  Users: 'المستخدمون والأدوار',
};

const ACTION_LABELS: Record<string, string> = {
  View: 'عرض',
  Create: 'إنشاء',
  Edit: 'تعديل',
  Delete: 'حذف',
  Approve: 'اعتماد',
  Export: 'تصدير',
  Commit: 'تنفيذ',
  Restore: 'استعادة',
  Configure: 'إعداد',
  ResetPassword: 'إعادة تعيين كلمات المرور',
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');

export const UsersView: React.FC<UsersViewProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userModal, setUserModal] = useState<{ mode: 'create' } | { mode: 'edit'; user: any } | null>(null);
  const [roleModal, setRoleModal] = useState<{ mode: 'create' } | { mode: 'edit'; role: any } | null>(null);
  const [revealed, setRevealed] = useState<{ username: string; password: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [u, r] = await Promise.all([Api.getUsers(), Api.getRoles()]);
      setUsers(u);
      setRoles(r.roles);
      setCatalog(r.catalog);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const handleReset = (user: any) => {
    if (!window.confirm(`إعادة تعيين كلمة مرور ${user.displayName}؟ ستُفصل جلساته الحالية.`)) return;
    run(async () => {
      const res = await Api.resetUserPassword(user.id);
      setRevealed({ username: user.username, password: res.temporaryPassword, reason: 'كلمة مرور مؤقتة جديدة' });
    });
  };

  const handleToggleActive = (user: any) => {
    const next = !user.isActive;
    if (!window.confirm(next ? `تفعيل حساب ${user.username}؟` : `تعطيل حساب ${user.username}؟ ستُفصل جلساته الحالية.`)) return;
    run(async () => {
      await Api.updateUser(user.id, { isActive: next });
      setNotice(next ? 'تم تفعيل الحساب.' : 'تم تعطيل الحساب.');
    });
  };

  const handleUnlock = (user: any) =>
    run(async () => {
      await Api.unlockUser(user.id);
      setNotice('تم فك قفل الحساب.');
    });

  const handleDeleteRole = (role: any) => {
    if (!window.confirm(`حذف الدور "${role.name}"؟`)) return;
    run(async () => {
      await Api.deleteRole(role.id);
      setNotice('تم حذف الدور.');
    });
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">المستخدمون والأدوار</h1>
        <p className="text-sm text-slate-500 mt-1">
          إدارة حسابات المنشأة وصلاحياتها. كل مستخدم جديد أو مُعاد تعيين كلمته يُجبر على تغيير كلمة المرور عند الدخول.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl">{notice}</div>
      )}

      {/* Users */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">الحسابات ({users.length})</h2>
          <button
            onClick={() => setUserModal({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> مستخدم جديد
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-right px-4 py-2 font-semibold">الاسم</th>
                <th className="text-right px-4 py-2 font-semibold">اسم الدخول</th>
                <th className="text-right px-4 py-2 font-semibold">الدور</th>
                <th className="text-right px-4 py-2 font-semibold">الحالة</th>
                <th className="text-right px-4 py-2 font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{u.displayName}{isSelf && <span className="text-xs text-sky-600 mr-2">(أنت)</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono text-xs" dir="ltr">{u.username}</td>
                    <td className="px-4 py-2.5 text-slate-600">{u.roleName}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'نشط' : 'معطل'}</Badge>
                        {u.locked && <Badge tone="amber">مقفل مؤقتاً</Badge>}
                        {u.mustChangePassword && <Badge tone="sky">يلزم تغيير كلمة المرور</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <IconButton title="تعديل" onClick={() => setUserModal({ mode: 'edit', user: u })}><Pencil className="w-3.5 h-3.5" /></IconButton>
                        {!isSelf && <IconButton title="إعادة تعيين كلمة المرور" onClick={() => handleReset(u)}><KeyRound className="w-3.5 h-3.5" /></IconButton>}
                        {u.locked && <IconButton title="فك القفل" onClick={() => handleUnlock(u)}><Unlock className="w-3.5 h-3.5" /></IconButton>}
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`px-2 py-1 text-xs font-semibold rounded-md cursor-pointer ${u.isActive ? 'text-rose-700 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}`}
                          >
                            {u.isActive ? 'تعطيل' : 'تفعيل'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">لا توجد حسابات.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Roles */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">الأدوار والصلاحيات ({roles.length})</h2>
          <button
            onClick={() => setRoleModal({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" /> دور جديد
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4 p-5">
          {roles.map(r => (
            <div key={r.id} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-sky-600" />{r.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{r.userCount} مستخدم · {r.permissions.length} صلاحية</p>
                </div>
                <div className="flex gap-1">
                  <IconButton title="تعديل الدور" onClick={() => setRoleModal({ mode: 'edit', role: r })}><Pencil className="w-3.5 h-3.5" /></IconButton>
                  <IconButton title="حذف الدور" onClick={() => handleDeleteRole(r)}><Trash2 className="w-3.5 h-3.5" /></IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {userModal && (
        <UserDialog
          mode={userModal.mode}
          user={userModal.mode === 'edit' ? userModal.user : undefined}
          roles={roles}
          isSelf={userModal.mode === 'edit' && userModal.user.id === currentUserId}
          onClose={() => setUserModal(null)}
          onSaved={(result) => {
            setUserModal(null);
            if (result.temporaryPassword) {
              setRevealed({ username: result.username, password: result.temporaryPassword, reason: 'كلمة مرور مؤقتة للحساب الجديد' });
            } else {
              setNotice('تم حفظ بيانات المستخدم.');
            }
            load();
          }}
        />
      )}

      {roleModal && (
        <RoleDialog
          mode={roleModal.mode}
          role={roleModal.mode === 'edit' ? roleModal.role : undefined}
          catalog={catalog}
          onClose={() => setRoleModal(null)}
          onSaved={() => {
            setRoleModal(null);
            setNotice('تم حفظ الدور.');
            load();
          }}
        />
      )}

      {revealed && (
        <Modal title="كلمة المرور المؤقتة" onClose={() => setRevealed(null)}>
          <p className="text-sm text-slate-600 mb-3">{revealed.reason} للحساب <span dir="ltr" className="font-mono font-semibold">{revealed.username}</span>.</p>
          <div className="flex items-center gap-2 bg-slate-900 text-white rounded-lg px-4 py-3">
            <code dir="ltr" className="flex-1 font-mono text-base tracking-wider break-all">{revealed.password}</code>
            <button onClick={() => copy(revealed.password)} className="p-2 hover:bg-slate-700 rounded-md cursor-pointer" title="نسخ">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
            تظهر هذه الكلمة مرة واحدة فقط. سلّمها للمستخدم بطريقة آمنة؛ سيُطلب منه تغييرها عند أول دخول.
          </p>
          <div className="flex justify-end mt-5">
            <button onClick={() => setRevealed(null)} className="px-4 py-2 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg cursor-pointer">تم</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------- Dialogs ----------

const UserDialog: React.FC<{
  mode: 'create' | 'edit';
  user?: any;
  roles: any[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: (result: { username: string; temporaryPassword?: string }) => void;
}> = ({ mode, user, roles, isSelf, onClose, onSaved }) => {
  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [roleId, setRoleId] = useState(user?.roleId ?? roles[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await Api.createUser({ username, displayName, roleId });
        onSaved({ username: res.user.username, temporaryPassword: res.temporaryPassword });
      } else {
        await Api.updateUser(user.id, { displayName, ...(isSelf ? {} : { roleId }) });
        onSaved({ username: user.username });
      }
    } catch (ex) {
      setErr(errorText(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === 'create' ? 'مستخدم جديد' : `تعديل: ${user.displayName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'create' && (
          <Field label="اسم الدخول (إنجليزي، 3-32 حرفاً)">
            <input dir="ltr" value={username} onChange={e => setUsername(e.target.value)} required className={inputCls} placeholder="nurse.sara" />
          </Field>
        )}
        <Field label="الاسم المعروض">
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="الدور">
          <select value={roleId} onChange={e => setRoleId(e.target.value)} disabled={isSelf} className={inputCls}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {isSelf && <p className="text-xs text-slate-500 mt-1">لا يمكنك تغيير دورك بنفسك.</p>}
        </Field>
        {err && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">إلغاء</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50 cursor-pointer">
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const RoleDialog: React.FC<{
  mode: 'create' | 'edit';
  role?: any;
  catalog: Catalog;
  onClose: () => void;
  onSaved: () => void;
}> = ({ mode, role, catalog, onClose, onSaved }) => {
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (perm: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const permissions = Array.from(selected);
      if (mode === 'create') await Api.createRole({ name, permissions });
      else await Api.updateRole(role.id, { name, permissions });
      onSaved();
    } catch (ex) {
      setErr(errorText(ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={mode === 'create' ? 'دور جديد' : `تعديل الدور: ${role.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم الدور">
          <input value={name} onChange={e => setName(e.target.value)} required className={inputCls} />
        </Field>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {Object.entries(catalog).map(([resource, actions]) => (
            <div key={resource} className="border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-bold text-slate-700 mb-2">{RESOURCE_LABELS[resource] ?? resource}</p>
              <div className="flex flex-wrap gap-3">
                {actions.map(action => {
                  const key = `${resource}:${action}`;
                  return (
                    <label key={key} className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="accent-sky-600" />
                      {ACTION_LABELS[action] ?? action}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {err && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">إلغاء</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50 cursor-pointer">
            {saving ? 'جارٍ الحفظ...' : 'حفظ الدور'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ---------- Small helpers ----------

const inputCls = 'w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-700 mb-1">{label}</span>
    {children}
  </label>
);

const Modal: React.FC<{ title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, onClose, wide, children }) => (
  <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
    <div className={`bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-hidden`}>
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
        <h2 className="font-bold text-base">{title}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إغلاق"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const Badge: React.FC<{ tone: 'green' | 'red' | 'amber' | 'sky'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
  }[tone];
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
};

const IconButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button title={title} aria-label={title} onClick={onClick} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer">
    {children}
  </button>
);

export default UsersView;
