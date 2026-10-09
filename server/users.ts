import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, UserRecord, RoleRecord } from './db';
import {
  AuthenticatedRequest,
  authenticate,
  requirePermission,
  logAudit,
  revokeSessionsForUser,
} from './auth';
import { PERMISSION_CATALOG, isKnownPermission } from './permissions';

// User & role administration. Every handler is tenant-scoped and permission-gated.
export const usersRouter = Router();

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/i;
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTemporaryPassword(): string {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (const b of bytes) out += TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length];
  return out;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function publicUser(u: UserRecord) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    roleId: u.roleId,
    roleName: u.roleName,
    isActive: u.isActive,
    mustChangePassword: !!u.mustChangePassword,
    locked: !!(u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now()),
    createdAt: u.createdAt,
  };
}

function validateDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 80 ? trimmed : null;
}

function validatePermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const unique = Array.from(new Set(value.map(String)));
  return unique.every(isKnownPermission) ? unique : null;
}

function tenantOf(req: AuthenticatedRequest): string {
  return req.user!.tenantId;
}

// ---------- Catalog & roles ----------

usersRouter.get('/roles', authenticate, requirePermission('Users', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const roles = raw.roles
    .filter(r => r.tenantId === tenantId)
    .map(r => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions,
      userCount: raw.users.filter(u => u.roleId === r.id && u.tenantId === tenantId && !u.isDeleted).length,
    }));
  res.json({ roles, catalog: PERMISSION_CATALOG });
});

usersRouter.post('/roles', authenticate, requirePermission('Users', 'Edit'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const permissions = validatePermissions(req.body?.permissions ?? []);

  if (name.length < 3 || name.length > 80) {
    res.status(400).json({ error: 'اسم الدور يجب أن يكون بين 3 و80 حرفاً.' });
    return;
  }
  if (!permissions) {
    res.status(400).json({ error: 'قائمة الصلاحيات تحتوي على صلاحية غير معروفة.' });
    return;
  }
  if (raw.roles.some(r => r.tenantId === tenantId && r.name.toLowerCase() === name.toLowerCase())) {
    res.status(409).json({ error: 'يوجد دور بهذا الاسم بالفعل.' });
    return;
  }

  const role: RoleRecord = { id: newId('role'), tenantId, name, permissions };
  raw.roles.push(role);
  db.save();
  logAudit(tenantId, req.user!.userId, 'Create', 'Core.Roles', role.id, `إنشاء دور: ${name}`);
  res.status(201).json({ role: { ...role, userCount: 0 } });
});

usersRouter.patch('/roles/:id', authenticate, requirePermission('Users', 'Edit'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const role = raw.roles.find(r => r.id === req.params.id && r.tenantId === tenantId);
  if (!role) {
    res.status(404).json({ error: 'الدور غير موجود.' });
    return;
  }

  const self = raw.users.find(u => u.id === req.user!.userId);
  if (self && self.roleId === role.id) {
    res.status(400).json({ error: 'لا يمكن تعديل الدور الذي تنتمي إليه بنفسك؛ استخدم حساباً آخر.' });
    return;
  }

  const changes: string[] = [];
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 3 || name.length > 80) {
      res.status(400).json({ error: 'اسم الدور يجب أن يكون بين 3 و80 حرفاً.' });
      return;
    }
    if (raw.roles.some(r => r.id !== role.id && r.tenantId === tenantId && r.name.toLowerCase() === name.toLowerCase())) {
      res.status(409).json({ error: 'يوجد دور بهذا الاسم بالفعل.' });
      return;
    }
    if (name !== role.name) {
      role.name = name;
      raw.users.filter(u => u.roleId === role.id && u.tenantId === tenantId).forEach(u => (u.roleName = name));
      changes.push('الاسم');
    }
  }
  if (req.body?.permissions !== undefined) {
    const permissions = validatePermissions(req.body.permissions);
    if (!permissions) {
      res.status(400).json({ error: 'قائمة الصلاحيات تحتوي على صلاحية غير معروفة.' });
      return;
    }
    role.permissions = permissions;
    changes.push('الصلاحيات');
    // Permissions are snapshotted into sessions at login; force affected users to sign in again.
    raw.users.filter(u => u.roleId === role.id && u.tenantId === tenantId).forEach(u => revokeSessionsForUser(u.id));
  }

  db.save();
  logAudit(tenantId, req.user!.userId, 'Update', 'Core.Roles', role.id, `تعديل الدور ${role.name}: ${changes.join('، ') || 'لا تغيير'}`);
  res.json({ role });
});

usersRouter.delete('/roles/:id', authenticate, requirePermission('Users', 'Edit'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const role = raw.roles.find(r => r.id === req.params.id && r.tenantId === tenantId);
  if (!role) {
    res.status(404).json({ error: 'الدور غير موجود.' });
    return;
  }
  if (raw.users.some(u => u.roleId === role.id && u.tenantId === tenantId && !u.isDeleted)) {
    res.status(409).json({ error: 'لا يمكن حذف دور مرتبط بمستخدمين. انقلهم إلى دور آخر أولاً.' });
    return;
  }
  raw.roles = raw.roles.filter(r => r.id !== role.id);
  db.save();
  logAudit(tenantId, req.user!.userId, 'Delete', 'Core.Roles', role.id, `حذف الدور: ${role.name}`);
  res.json({ success: true });
});

// ---------- Users ----------

usersRouter.get('/users', authenticate, requirePermission('Users', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  res.json(raw.users.filter(u => u.tenantId === tenantId && !u.isDeleted).map(publicUser));
});

usersRouter.post('/users', authenticate, requirePermission('Users', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const displayName = validateDisplayName(req.body?.displayName);
  const role = raw.roles.find(r => r.id === req.body?.roleId && r.tenantId === tenantId);

  if (!USERNAME_PATTERN.test(username)) {
    res.status(400).json({ error: 'اسم المستخدم يجب أن يكون من 3 إلى 32 حرفاً إنجليزياً أو أرقاماً أو . _ -' });
    return;
  }
  if (!displayName) {
    res.status(400).json({ error: 'الاسم المعروض يجب أن يكون بين 2 و80 حرفاً.' });
    return;
  }
  if (!role) {
    res.status(400).json({ error: 'الدور المحدد غير موجود في هذه المنشأة.' });
    return;
  }
  // Login resolves usernames globally, so they must be unique across all tenants.
  if (raw.users.some(u => u.username.toLowerCase() === username.toLowerCase() && !u.isDeleted)) {
    res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل.' });
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const user: UserRecord = {
    id: newId('user'),
    tenantId,
    username,
    displayName,
    passwordHash: bcrypt.hashSync(temporaryPassword, bcrypt.genSaltSync(12)),
    roleId: role.id,
    roleName: role.name,
    isActive: true,
    isDeleted: false,
    failedLoginAttempts: 0,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };
  raw.users.push(user);
  db.save();
  logAudit(tenantId, req.user!.userId, 'Create', 'Core.Users', user.id, `إنشاء مستخدم: ${username} بدور ${role.name}`);
  // The temporary password is returned once and never stored in plain text or logged.
  res.status(201).json({ user: publicUser(user), temporaryPassword });
});

usersRouter.patch('/users/:id', authenticate, requirePermission('Users', 'Edit'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const user = raw.users.find(u => u.id === req.params.id && u.tenantId === tenantId && !u.isDeleted);
  if (!user) {
    res.status(404).json({ error: 'المستخدم غير موجود.' });
    return;
  }

  const isSelf = user.id === req.user!.userId;
  const body = req.body ?? {};
  const changes: string[] = [];

  if (body.displayName !== undefined) {
    const displayName = validateDisplayName(body.displayName);
    if (!displayName) {
      res.status(400).json({ error: 'الاسم المعروض يجب أن يكون بين 2 و80 حرفاً.' });
      return;
    }
    if (displayName !== user.displayName) {
      user.displayName = displayName;
      changes.push('الاسم');
    }
  }

  if (body.roleId !== undefined && body.roleId !== user.roleId) {
    if (isSelf) {
      res.status(400).json({ error: 'لا يمكنك تغيير دورك بنفسك.' });
      return;
    }
    const role = raw.roles.find(r => r.id === body.roleId && r.tenantId === tenantId);
    if (!role) {
      res.status(400).json({ error: 'الدور المحدد غير موجود في هذه المنشأة.' });
      return;
    }
    user.roleId = role.id;
    user.roleName = role.name;
    changes.push(`الدور → ${role.name}`);
    revokeSessionsForUser(user.id);
  }

  if (body.isActive !== undefined && Boolean(body.isActive) !== user.isActive) {
    if (isSelf) {
      res.status(400).json({ error: 'لا يمكنك تعطيل حسابك بنفسك.' });
      return;
    }
    user.isActive = Boolean(body.isActive);
    changes.push(user.isActive ? 'تفعيل الحساب' : 'تعطيل الحساب');
    if (!user.isActive) revokeSessionsForUser(user.id);
  }

  db.save();
  if (changes.length > 0) {
    logAudit(tenantId, req.user!.userId, 'Update', 'Core.Users', user.id, `تعديل المستخدم ${user.username}: ${changes.join('، ')}`);
  }
  res.json({ user: publicUser(user) });
});

usersRouter.post('/users/:id/reset-password', authenticate, requirePermission('Users', 'ResetPassword'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const user = raw.users.find(u => u.id === req.params.id && u.tenantId === tenantId && !u.isDeleted);
  if (!user) {
    res.status(404).json({ error: 'المستخدم غير موجود.' });
    return;
  }
  if (user.id === req.user!.userId) {
    res.status(400).json({ error: 'لإعادة تعيين كلمة مرورك استخدم خيار تغيير كلمة المرور.' });
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  user.passwordHash = bcrypt.hashSync(temporaryPassword, bcrypt.genSaltSync(12));
  user.mustChangePassword = true;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  revokeSessionsForUser(user.id);
  db.save();
  logAudit(tenantId, req.user!.userId, 'ResetPassword', 'Core.Users', user.id, `إعادة تعيين كلمة مرور المستخدم ${user.username}`);
  res.json({ user: publicUser(user), temporaryPassword });
});

usersRouter.post('/users/:id/unlock', authenticate, requirePermission('Users', 'Edit'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = tenantOf(req);
  const user = raw.users.find(u => u.id === req.params.id && u.tenantId === tenantId && !u.isDeleted);
  if (!user) {
    res.status(404).json({ error: 'المستخدم غير موجود.' });
    return;
  }
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  db.save();
  logAudit(tenantId, req.user!.userId, 'Unlock', 'Core.Users', user.id, `فك قفل الحساب: ${user.username}`);
  res.json({ user: publicUser(user) });
});
