import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, UserRecord, RoleRecord, AuditRecord } from './db';
import { ALL_PERMISSIONS } from './permissions';
import { AUTH_MODE, isOpenAuth, DEFAULT_TENANT_ID, OPEN_ADMIN_USERNAME } from './config';

// In-memory active session tokens mapped to user ID and tenant ID
interface SessionData {
  userId: string;
  tenantId: string;
  username: string;
  displayName: string;
  roleName: string;
  permissions: string[];
  mustChangePassword: boolean;
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();

export interface AuthenticatedRequest extends Request {
  user?: SessionData;
}

export const DEFAULT_SEED_PASSWORD = 'Admin@123456';

// True when the account still uses the publicly known seed password or was flagged by an admin.
// In open mode nobody is ever blocked by a forced password change: the operator signs in
// automatically and the seed password is not used to authenticate at all.
export function requiresPasswordChange(user: UserRecord): boolean {
  if (isOpenAuth()) return false;
  if (user.mustChangePassword) return true;
  return bcrypt.compareSync(DEFAULT_SEED_PASSWORD, user.passwordHash);
}

/**
 * Returns the administrator account used for automatic sign-in, creating it when the
 * database does not have one yet (fresh install, restored backup, or a data file where
 * every admin was disabled or deleted).
 *
 * The account is created with an unusable random password hash, so enabling password
 * mode later cannot be bypassed by guessing: an operator must run
 * `npm run unlock-admin` to set a real password.
 */
export function ensureAdminUser(): { user: UserRecord; role: RoleRecord; created: boolean } {
  const raw = db.getRawData();

  // Make sure the tenant exists; a data file with no tenants would otherwise produce
  // an administrator that can see nothing.
  if (!raw.tenants.some(t => t.id === DEFAULT_TENANT_ID)) {
    raw.tenants.unshift({
      id: DEFAULT_TENANT_ID,
      name: 'مجموعة مِعاف للرعاية الصحية',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  const roleId = DEFAULT_TENANT_ID === 'tenant-001' ? 'role-admin' : `role-admin-${DEFAULT_TENANT_ID}`;
  let role = raw.roles.find(r => r.id === roleId && r.tenantId === DEFAULT_TENANT_ID);
  if (!role) {
    role = {
      id: roleId,
      tenantId: DEFAULT_TENANT_ID,
      name: 'مدير النظام الكامل (Enterprise Admin)',
      permissions: [...ALL_PERMISSIONS],
    };
    raw.roles.push(role);
  }
  // An admin role that lost permissions in an older data file would block whole modules.
  const missing = ALL_PERMISSIONS.filter(p => !role.permissions.includes(p));
  if (missing.length > 0) role.permissions.push(...missing);

  // Prefer an existing usable administrator, then any active admin-role user.
  const usableAdmin = (u: UserRecord) =>
    u.tenantId === DEFAULT_TENANT_ID && !u.isDeleted && u.isActive && u.roleId === role!.id;

  let user = raw.users.find(u => u.username.toLowerCase() === OPEN_ADMIN_USERNAME.toLowerCase() && !u.isDeleted);
  let created = false;

  if (!user) {
    user = {
      id: 'user-' + crypto.randomBytes(6).toString('hex'),
      tenantId: DEFAULT_TENANT_ID,
      username: OPEN_ADMIN_USERNAME,
      displayName: 'مدير النظام',
      // Random 32-byte secret that is never shown or stored in plain text anywhere.
      passwordHash: bcrypt.hashSync(crypto.randomBytes(32).toString('base64url'), bcrypt.genSaltSync(10)),
      roleId: role.id,
      roleName: role.name,
      isActive: true,
      isDeleted: false,
      failedLoginAttempts: 0,
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
    };
    raw.users.push(user);
    created = true;
  } else {
    // Heal an existing account so automatic sign-in can never be blocked by state left
    // over from the password era (disabled, locked, flagged, or moved to another role).
    if (!usableAdmin(user)) {
      user.tenantId = DEFAULT_TENANT_ID;
      user.roleId = role.id;
      user.roleName = role.name;
      user.isActive = true;
      user.isDeleted = false;
      user.lockedUntil = undefined;
      user.failedLoginAttempts = 0;
      created = true; // reported as "repaired" through the same audit event
    }
    user.mustChangePassword = false;
  }

  db.save();
  return { user, role, created };
}

// One reusable session for the whole open-mode process. Creating a session per request
// would grow the in-memory map without bound.
let openSessionToken: string | null = null;

/** Session token that signs the operator in as the system administrator. */
export function getOpenSessionToken(): { token: string; session: SessionData; created: boolean } {
  const { user, role, created } = ensureAdminUser();
  const existing = openSessionToken ? sessions.get(openSessionToken) : undefined;

  if (existing && existing.userId === user.id && Date.now() < existing.expiresAt) {
    // Keep permissions in sync with the role in case it changed at runtime.
    existing.permissions = [...role.permissions];
    existing.displayName = user.displayName;
    existing.roleName = user.roleName;
    existing.mustChangePassword = false;
    return { token: openSessionToken!, session: existing, created: false };
  }

  const token = createSession(user, [...role.permissions], false);
  openSessionToken = token;
  return { token, session: sessions.get(token)!, created };
}

/** Invalidates the shared open-mode session (used after a factory reset). */
export function resetOpenSession(): void {
  if (openSessionToken) {
    sessions.delete(openSessionToken);
    openSessionToken = null;
  }
}


// Paths allowed while a password change is still required.
const PASSWORD_CHANGE_EXEMPT = ['/auth/me', '/auth/logout', '/auth/change-password'];

export function createSession(user: UserRecord, permissions: string[], mustChangePassword = false): string {
  const token = 'mff_' + crypto.randomBytes(32).toString('base64url');
  // Session valid for 24 hours
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  
  sessions.set(token, {
    userId: user.id,
    tenantId: user.tenantId,
    username: user.username,
    displayName: user.displayName,
    roleName: user.roleName,
    permissions,
    mustChangePassword,
    expiresAt,
  });

  return token;
}

export function clearMustChangeForUser(userId: string): void {
  for (const session of sessions.values()) {
    if (session.userId === userId) session.mustChangePassword = false;
  }
}

export function revokeSessionsForUser(userId: string): void {
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) sessions.delete(token);
  }
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}

export function getSession(token: string): SessionData | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const session = token ? getSession(token) : null;

  if (session) {
    const path = req.path;
    if (session.mustChangePassword && !PASSWORD_CHANGE_EXEMPT.includes(path)) {
      res.status(403).json({ error: 'يجب تغيير كلمة المرور قبل متابعة استخدام النظام.', code: 'PASSWORD_CHANGE_REQUIRED' });
      return;
    }

    req.user = session;
    next();
    return;
  }

  // Open mode: a missing, expired or stale token (for example after the server restarted,
  // because sessions live in memory) must never throw the operator out of the system.
  // Sign the request in as the administrator instead of answering 401.
  if (isOpenAuth()) {
    const open = getOpenSessionToken();
    req.user = open.session;
    if (token) {
      // Hand the client the currently valid token so it can stop using the dead one.
      res.setHeader('X-MEAAF-Session', open.token);
    }
    next();
    return;
  }

  if (!authHeader) {
    res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول وإرفاق رمز الجلسة.' });
    return;
  }

  res.status(401).json({ error: 'جلسة الدخول منتهية الصلاحية أو غير صالحة. يرجى تسجيل الدخول مجدداً.' });
}

export function requirePermission(resource: string, action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول.' });
      return;
    }

    const permissionKey = `${resource}:${action}`;
    // Permissions come only from the role's explicit list; the role's display name grants nothing.
    const hasPerm = req.user.permissions.includes(permissionKey);

    if (!hasPerm) {
      // Audit security rejection
      logAudit(req.user.tenantId, req.user.userId, 'AccessDenied', resource, undefined, `رفض وصول للعملية: ${action}`);
      res.status(403).json({ error: `صلاحيات غير كافية: العملية تطلب إذن "${permissionKey}".` });
      return;
    }

    next();
  };
}

export function logAudit(
  tenantId: string,
  userId: string | undefined,
  action: string,
  resource: string,
  recordId: string | undefined,
  details: string
): void {
  const raw = db.getRawData();
  const userName = userId ? raw.users.find(u => u.id === userId)?.displayName || 'مستخدم' : 'نظام الخادم';
  
  const rec: AuditRecord = {
    id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    tenantId,
    userId,
    userName,
    action,
    resource,
    recordId,
    details,
    atUtc: new Date().toISOString(),
  };

  raw.auditLogs.unshift(rec);
  // Keep last 1,000 audit records in database
  if (raw.auditLogs.length > 1000) raw.auditLogs.pop();
  db.save();
}
