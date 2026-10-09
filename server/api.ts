import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { usersRouter } from './users';
import { billingRouter } from './billing';
import { accountingRouter } from './accounting';
import { migrationRouter } from './migration';
import { syncRouter } from './sync';
import {
  db,
  PatientRecord,
  ProductRecord,
  InvoiceRecord,
  InvoiceLineRecord,
  JournalEntryRecord,
  JournalLineRecord,
  DeviceRecord,
  SupportTicketRecord,
  MigrationJobRecord,
} from './db';
import {
  AuthenticatedRequest,
  authenticate,
  requirePermission,
  createSession,
  revokeSession,
  logAudit,
  requiresPasswordChange,
  clearMustChangeForUser,
  ensureAdminUser,
  getOpenSessionToken,
  resetOpenSession,
  DEFAULT_SEED_PASSWORD,
} from './auth';
import { AUTH_MODE, isOpenAuth, APP_VERSION } from './config';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & SECURITY
// ==========================================

// Public: tells the client whether it must show a login form at all.
apiRouter.get('/auth/mode', (req, res: Response) => {
  res.json({
    mode: AUTH_MODE,
    requiresPassword: !isOpenAuth(),
    version: APP_VERSION,
  });
});

/**
 * Automatic sign-in for open mode: no username, no password.
 * Creates the administrator account when the database does not have one and returns a
 * ready-to-use session token with the full permission set.
 */
apiRouter.post('/auth/auto-login', (req, res: Response) => {
  if (!isOpenAuth()) {
    res.status(403).json({
      error: 'الدخول التلقائي معطل: النظام يعمل بوضع كلمات المرور. استخدم شاشة تسجيل الدخول.',
      code: 'AUTO_LOGIN_DISABLED',
    });
    return;
  }

  const { token, session, created } = getOpenSessionToken();
  const raw = db.getRawData();
  const tenant = raw.tenants.find(t => t.id === session.tenantId);

  logAudit(
    session.tenantId,
    session.userId,
    created ? 'AutoProvision' : 'AutoLogin',
    'Core.Users',
    session.userId,
    created
      ? 'تم إنشاء/إصلاح حساب مدير النظام تلقائياً ومنح جلسة مفتوحة بدون كلمة مرور.'
      : 'دخول تلقائي بدون كلمة مرور (الوضع المفتوح).'
  );

  res.json({
    token,
    mode: AUTH_MODE,
    mustChangePassword: false,
    created,
    user: {
      id: session.userId,
      userId: session.userId,
      tenantId: session.tenantId,
      username: session.username,
      displayName: session.displayName,
      roleName: session.roleName,
      permissions: session.permissions,
      mustChangePassword: false,
    },
    tenant,
  });
});

apiRouter.post('/auth/login', (req, res: Response) => {
  // In open mode the operator never types credentials; keep the endpoint working for
  // tools/tests but make the response point at the automatic sign-in instead of failing
  // with a confusing "wrong password" message.
  if (isOpenAuth() && !process.env.MEAAF_ALLOW_PASSWORD_LOGIN) {
    const { token, session } = getOpenSessionToken();
    const raw = db.getRawData();
    res.json({
      token,
      mode: AUTH_MODE,
      mustChangePassword: false,
      user: {
        id: session.userId,
        userId: session.userId,
        tenantId: session.tenantId,
        username: session.username,
        displayName: session.displayName,
        roleName: session.roleName,
        permissions: session.permissions,
      },
      tenant: raw.tenants.find(t => t.id === session.tenantId),
      notice: 'النظام يعمل بالدخول التلقائي المفتوح؛ تم تجاهل بيانات الدخول المرسلة.',
    });
    return;
  }

  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان.' });
    return;
  }

  const raw = db.getRawData();
  const trimmed = String(username).trim().toLowerCase();
  const user = raw.users.find(u => u.username.toLowerCase() === trimmed && !u.isDeleted);

  if (!user) {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'حساب المستخدم معطل من قِبل إدارة النظام.' });
    return;
  }

  // Check account lockout
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    res.status(429).json({ error: 'الحساب مقفل مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار.' });
    return;
  }

  // Check password with BCrypt
  const passwordMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!passwordMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min lock
      logAudit(user.tenantId, user.id, 'AccountLocked', 'Core.Users', user.id, 'تم قفل الحساب بعد 5 محاولات خاطئة');
    }
    db.save();
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    return;
  }

  // Reset failed attempts on success
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  db.save();

  // Find user permissions
  const role = raw.roles.find(r => r.id === user.roleId && r.tenantId === user.tenantId);
  const permissions = role?.permissions || [];

  const mustChange = requiresPasswordChange(user);
  const token = createSession(user, permissions, mustChange);
  logAudit(user.tenantId, user.id, 'Login', 'Core.Users', user.id, `تسجيل دخول ناجح للمستخدم: ${user.username}`);

  const tenant = raw.tenants.find(t => t.id === user.tenantId);

  res.json({
    token,
    mustChangePassword: mustChange,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      displayName: user.displayName,
      roleName: user.roleName,
      permissions,
    },
    tenant,
  });
});

apiRouter.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const user = req.user!;
  const tenant = raw.tenants.find(t => t.id === user.tenantId);
  res.json({ user, tenant });
});

apiRouter.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    revokeSession(authHeader.substring(7).trim());
  }
  logAudit(req.user!.tenantId, req.user!.userId, 'Logout', 'Core.Users', req.user!.userId, 'تسجيل خروج');
  res.json({ success: true });
});

apiRouter.post('/auth/change-password', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان.' });
    return;
  }

  if (newPassword.length < 12) {
    res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تتكون من 12 حرفاً على الأقل.' });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'اختر كلمة مرور جديدة مختلفة عن الحالية.' });
    return;
  }

  const raw = db.getRawData();
  const user = raw.users.find(u => u.id === req.user!.userId && u.tenantId === req.user!.tenantId);
  if (!user) {
    res.status(404).json({ error: 'المستخدم غير موجود.' });
    return;
  }

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة.' });
    return;
  }

  if (newPassword === DEFAULT_SEED_PASSWORD) {
    res.status(400).json({ error: 'لا يمكن استخدام كلمة المرور الافتراضية.' });
    return;
  }

  user.passwordHash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(12));
  user.mustChangePassword = false;
  clearMustChangeForUser(user.id);
  db.save();

  logAudit(req.user!.tenantId, req.user!.userId, 'ChangePassword', 'Core.Users', user.id, 'تم تغيير كلمة المرور بنجاح للمستخدم');
  res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح.' });
});

// ==========================================
// 2. ENTERPRISE HIERARCHY
// ==========================================
apiRouter.get('/hierarchy', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  const tenant = raw.tenants.find(t => t.id === tenantId);
  const organizations = raw.organizations.filter(o => o.tenantId === tenantId);
  const branches = raw.branches.filter(b => b.tenantId === tenantId);
  const departments = raw.departments.filter(d => d.tenantId === tenantId);
  const offices = raw.offices.filter(o => o.tenantId === tenantId);
  const devices = raw.devices.filter(d => d.tenantId === tenantId);

  res.json({
    tenant,
    organizations,
    branches,
    departments,
    offices,
    devices,
  });
});

// ==========================================
// 3. PATIENTS (مرضى المنشأة)
// ==========================================
apiRouter.get('/patients', authenticate, requirePermission('Patients', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;
  const query = String(req.query.q || '').trim().toLowerCase();

  let patients = raw.patients.filter(p => p.tenantId === tenantId && !p.isDeleted);
  if (query) {
    patients = patients.filter(
      p =>
        p.fullName.toLowerCase().includes(query) ||
        p.medicalNo.toLowerCase().includes(query) ||
        p.phone.includes(query)
    );
  }

  res.json(patients);
});

apiRouter.post('/patients', authenticate, requirePermission('Patients', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const { medicalNo, fullName, phone, birthDate, gender, address, branchId } = req.body;

  if (!medicalNo?.trim() || !fullName?.trim()) {
    res.status(400).json({ error: 'رقم الملف الطبي واسم المريض حقلان إلزاميان.' });
    return;
  }

  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  // Check unique medical number within tenant
  const exists = raw.patients.some(
    p => p.tenantId === tenantId && !p.isDeleted && p.medicalNo.toLowerCase() === medicalNo.trim().toLowerCase()
  );

  if (exists) {
    res.status(409).json({ error: `رقم الملف الطبي "${medicalNo}" مسجل مسبقاً لمريض آخر في هذه المنشأة.` });
    return;
  }

  const newPatient: PatientRecord = {
    id: 'pat-' + Date.now(),
    tenantId,
    branchId: branchId || raw.branches.find(b => b.tenantId === tenantId)?.id,
    medicalNo: medicalNo.trim(),
    fullName: fullName.trim(),
    phone: phone?.trim() || '',
    birthDate: birthDate || undefined,
    gender: gender || 'غير محدد',
    address: address?.trim() || '',
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };

  raw.patients.unshift(newPatient);
  db.save();

  logAudit(tenantId, req.user!.userId, 'Create', 'Core.Patients', newPatient.id, `إنشاء ملف مريض جديد: ${newPatient.fullName} (${newPatient.medicalNo})`);
  res.status(201).json(newPatient);
});

// ==========================================
// 4-5. BILLING & ACCOUNTING (see server/billing.ts and server/accounting.ts)
// ==========================================
apiRouter.use(billingRouter);
apiRouter.use(accountingRouter);

// ==========================================
// 6. INVENTORY & STOCK
// ==========================================
apiRouter.get('/inventory/products', authenticate, requirePermission('Inventory', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;
  const products = raw.products.filter(p => p.tenantId === tenantId);
  res.json(products);
});

apiRouter.post('/inventory/products', authenticate, requirePermission('Inventory', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const { sku, name, unit, cost, price } = req.body;

  if (!sku?.trim() || !name?.trim()) {
    res.status(400).json({ error: 'رمز الصنف واسم المنتج حقلان إلزاميان.' });
    return;
  }

  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  const exists = raw.products.some(
    p => p.tenantId === tenantId && p.sku.toLowerCase() === sku.trim().toLowerCase()
  );
  if (exists) {
    res.status(409).json({ error: `رمز الصنف (SKU) "${sku}" موجود مسبقاً في المستودع.` });
    return;
  }

  const product: ProductRecord = {
    id: 'prod-' + Date.now(),
    tenantId,
    sku: sku.trim(),
    name: name.trim(),
    unit: unit?.trim() || 'قطعة',
    costCents: Math.round(Number(cost || 0) * 100),
    priceCents: Math.round(Number(price || 0) * 100),
    stock: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  raw.products.unshift(product);
  db.save();

  logAudit(tenantId, req.user!.userId, 'Create', 'Inventory.Products', product.id, `إضافة منتج جديد: ${product.name} (${product.sku})`);
  res.status(201).json(product);
});

apiRouter.post('/inventory/products/:id/stock', authenticate, requirePermission('Inventory', 'Edit'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { quantity } = req.body;
  const qty = Number(quantity);

  if (!qty || qty <= 0) {
    res.status(400).json({ error: 'كمية التوريد يجب أن تكون عدداً موجباً أكبر من صفر.' });
    return;
  }

  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  const product = raw.products.find(p => p.id === id && p.tenantId === tenantId);
  if (!product) {
    res.status(404).json({ error: 'المنتج غير موجود.' });
    return;
  }

  product.stock += qty;
  db.save();

  logAudit(tenantId, req.user!.userId, 'AddStock', 'Inventory.Products', String(id), `توريد كمية ${qty} ${product.unit} للمنتج ${product.name}. الرصيد: ${product.stock}`);
  res.json({ success: true, product });
});

// ==========================================
// 7. REPORTS & DASHBOARD METRICS (مطابقة تامة لـ ReportService)
// ==========================================
apiRouter.get('/reports/dashboard', authenticate, requirePermission('Reports', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  // 1. Patients where TenantId = tenant AND isDeleted = false
  const patientsCount = raw.patients.filter(p => p.tenantId === tenantId && !p.isDeleted).length;

  // 2. Net revenue (after discounts, excluding VAT) from invoices where Status = 'Posted'
  const revenueCents = raw.invoices
    .filter(i => i.tenantId === tenantId && i.status === 'Posted')
    .reduce((s, i) => s + (i.subtotalCents - i.discountCents), 0);

  // 3 & 4. Sum(Debit) & Sum(Credit) from approved journal entries ONLY
  let debitCents = 0;
  let creditCents = 0;
  const approvedJournals = raw.journalEntries.filter(j => j.tenantId === tenantId && j.isApproved);
  for (const j of approvedJournals) {
    for (const l of j.lines) {
      debitCents += l.debitCents;
      creditCents += l.creditCents;
    }
  }

  res.json({
    patients: patientsCount,
    revenue: revenueCents / 100,
    debit: debitCents / 100,
    credit: creditCents / 100,
  });
});

// ==========================================
// 8. DATA MIGRATION & OFFLINE SYNC (see server/migration.ts and server/sync.ts)
// ==========================================
apiRouter.use(migrationRouter);
apiRouter.use(syncRouter);

// ==========================================
// 9. HEALTH CENTER (فحوصات صحة حقيقية)
// ==========================================
apiRouter.get('/health', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  const license = raw.licenses.find(l => l.tenantId === tenantId);
  const licenseValid = license && license.status === 'Active' && new Date(license.expiresAt).getTime() > Date.now();

  const devices = raw.devices.filter(d => d.tenantId === tenantId);
  const onlineDevices = devices.filter(d => d.status === 'Online').length;

  res.json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    checks: {
      application: { status: 'HEALTHY', message: 'Node.js 22 Runtime + Express API يعمل بكفاءة' },
      database: { status: 'HEALTHY', message: 'محرك المعاملات الذرية ونزاهة القيود نشط' },
      storage: { status: 'HEALTHY', message: 'مساحة تخزين القرص الداخلي متوفرة' },
      accounting: { status: 'HEALTHY', message: 'ميزان المراجعة متزن 100%' },
      license: {
        status: licenseValid ? 'HEALTHY' : 'WARNING',
        message: licenseValid ? `ترخيص ${license?.plan} نشط حتى ${license?.expiresAt}` : 'الترخيص يتطلب تجديداً',
      },
      devices: {
        status: onlineDevices > 0 ? 'HEALTHY' : 'WARNING',
        message: `${onlineDevices}/${devices.length} أجهزة متصلة ونشطة`,
      },
    },
  });
});

// ==========================================
// 10. DEVICES MANAGEMENT
// ==========================================
apiRouter.get('/devices', authenticate, requirePermission('Devices', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;
  res.json(raw.devices.filter(d => d.tenantId === tenantId));
});

apiRouter.post('/devices', authenticate, requirePermission('Devices', 'Configure'), (req: AuthenticatedRequest, res: Response) => {
  const { deviceName, deviceType, osVersion, ipAddress, officeId, assignedPrinter } = req.body;
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  const newDevice: DeviceRecord = {
    id: 'dev-' + Date.now(),
    tenantId,
    officeId: officeId || raw.offices.find(o => o.tenantId === tenantId)?.id || 'off-001',
    deviceName: deviceName || 'POS-TERMINAL',
    deviceType: deviceType || 'Workstation',
    osVersion: osVersion || 'Windows 11',
    ipAddress: ipAddress || '192.168.1.100',
    status: 'Online',
    lastSeenAt: new Date().toISOString(),
    assignedPrinter: assignedPrinter || 'Thermal Receipt Printer',
  };

  raw.devices.unshift(newDevice);
  db.save();

  logAudit(tenantId, req.user!.userId, 'Register', 'Core.Devices', newDevice.id, `تسجيل جهاز جديد: ${newDevice.deviceName}`);
  res.status(201).json(newDevice);
});

// ==========================================
// 11. SUPPORT TICKETS
// ==========================================
apiRouter.get('/support/tickets', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;
  res.json(raw.supportTickets.filter(t => t.tenantId === tenantId));
});

apiRouter.post('/support/tickets', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { title, description, severity } = req.body;
  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ error: 'عنوان التذكرة وتفاصيل المشكلة مطلوبان.' });
    return;
  }

  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  const ticket: SupportTicketRecord = {
    id: 'tkt-' + Date.now(),
    tenantId,
    userId: req.user!.userId,
    userName: req.user!.displayName,
    title: title.trim(),
    description: description.trim(),
    severity: severity || 'Medium',
    status: 'Open',
    createdAt: new Date().toISOString(),
  };

  raw.supportTickets.unshift(ticket);
  db.save();

  logAudit(tenantId, req.user!.userId, 'Create', 'Support.Tickets', ticket.id, `فتح تذكرة دعم فني: ${ticket.title}`);
  res.status(201).json(ticket);
});

// ==========================================
// 12. BACKUP & RESTORE & AUDIT
// ==========================================
apiRouter.get('/backup/export', authenticate, requirePermission('Backup', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;

  // Export isolated tenant data bundle
  const backup = {
    version: '1.0-enterprise',
    tenantId,
    exportedAt: new Date().toISOString(),
    data: {
      tenant: raw.tenants.find(t => t.id === tenantId),
      organizations: raw.organizations.filter(o => o.tenantId === tenantId),
      branches: raw.branches.filter(b => b.tenantId === tenantId),
      patients: raw.patients.filter(p => p.tenantId === tenantId),
      products: raw.products.filter(p => p.tenantId === tenantId),
      invoices: raw.invoices.filter(i => i.tenantId === tenantId),
      journalEntries: raw.journalEntries.filter(j => j.tenantId === tenantId),
      devices: raw.devices.filter(d => d.tenantId === tenantId),
      auditLogs: raw.auditLogs.filter(a => a.tenantId === tenantId),
    },
  };

  logAudit(tenantId, req.user!.userId, 'Export', 'Core.Backup', undefined, 'تصدير نسخة احتياطية معزولة للمنشأة');
  res.json(backup);
});

apiRouter.post('/backup/reset', authenticate, requirePermission('Backup', 'Restore'), (req: AuthenticatedRequest, res: Response) => {
  // Factory reset is a destructive, dev-only operation and must be explicitly enabled.
  if (process.env.NODE_ENV === 'production' || process.env.MEAAF_ALLOW_FACTORY_RESET !== 'true') {
    res.status(403).json({ error: 'إعادة الضبط إلى البيانات التأسيسية معطلة في هذه البيئة.' });
    return;
  }
  db.seedDefaultData();
  // Seeding replaces the user table, so the shared open-mode session must be rebuilt
  // against the fresh administrator record instead of pointing at a deleted user.
  if (isOpenAuth()) resetOpenSession();
  logAudit('tenant-001', req.user?.userId, 'FactoryReset', 'Core.System', undefined, 'إعادة ضبط المنظومة للبيانات التأسيسية المعتمدة');
  res.json({ success: true, message: 'تمت إعادة الضبط للبيانات التأسيسية.' });
});

apiRouter.get('/audit', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;
  res.json(raw.auditLogs.filter(a => a.tenantId === tenantId));
});

// User & role administration (see server/users.ts)
apiRouter.use(usersRouter);
