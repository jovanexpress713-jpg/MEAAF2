import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, UserRecord, AuditRecord } from './db';

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
export function requiresPasswordChange(user: UserRecord): boolean {
  if (user.mustChangePassword) return true;
  return bcrypt.compareSync(DEFAULT_SEED_PASSWORD, user.passwordHash);
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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول وإرفاق رمز الجلسة.' });
    return;
  }

  const token = authHeader.substring(7).trim();
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: 'جلسة الدخول منتهية الصلاحية أو غير صالحة. يرجى تسجيل الدخول مجدداً.' });
    return;
  }

  const path = req.path;
  if (session.mustChangePassword && !PASSWORD_CHANGE_EXEMPT.includes(path)) {
    res.status(403).json({ error: 'يجب تغيير كلمة المرور قبل متابعة استخدام النظام.', code: 'PASSWORD_CHANGE_REQUIRED' });
    return;
  }

  req.user = session;
  next();
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
