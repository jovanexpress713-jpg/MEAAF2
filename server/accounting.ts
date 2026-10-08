import { Router, Response } from 'express';
import { db, AccountRecord, AccountingPeriodRecord } from './db';
import { AuthenticatedRequest, authenticate, requirePermission, logAudit } from './auth';
import { DomainError, ACCOUNT_TYPES, SYSTEM_ACCOUNTS, isValidDate, periodOf, newId, todayIso } from './chart';
import { createDraftJournal, resolveLines, assertPeriodOpen, approvedBalance } from './ledger';

// Accounting: chart of accounts, journal entries & approval, period close, trial balance.
export const accountingRouter = Router();

function sendError(res: Response, err: unknown) {
  if (err instanceof DomainError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: `فشل ذري أثناء العملية: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}` });
}

// Amount in major units to non-negative integer cents (zero allowed for the unused side of a line).
function amountToCents(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  if (Math.abs(cents / 100 - n) > 1e-9) return null;
  return cents;
}

const PROTECTED_CODES: string[] = Object.values(SYSTEM_ACCOUNTS);

// ---------- Chart of accounts ----------

accountingRouter.get('/accounting/accounts', authenticate, requirePermission('Accounting', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const accounts = db.getRawData().accounts
    .filter(a => a.tenantId === tenantId)
    .sort((a, b) => a.code.localeCompare(b.code));
  res.json(accounts);
});

accountingRouter.post('/accounting/accounts', authenticate, requirePermission('Accounting', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const type = req.body?.type;

  if (!/^\d{4}$/.test(code)) {
    res.status(400).json({ error: 'رمز الحساب يجب أن يكون 4 أرقام.' });
    return;
  }
  if (name.length < 2 || name.length > 120) {
    res.status(400).json({ error: 'اسم الحساب يجب أن يكون بين 2 و120 حرفاً.' });
    return;
  }
  if (!(ACCOUNT_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: 'نوع الحساب غير صالح.' });
    return;
  }
  const raw = db.getRawData();
  if (raw.accounts.some(a => a.tenantId === tenantId && a.code === code)) {
    res.status(409).json({ error: `الحساب ${code} موجود بالفعل.` });
    return;
  }

  const account: AccountRecord = {
    id: newId('acc'),
    tenantId,
    code,
    name,
    type,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  raw.accounts.push(account);
  db.save();
  logAudit(tenantId, req.user!.userId, 'Create', 'Accounting.Accounts', account.id, `إضافة حساب ${code} - ${name}`);
  res.status(201).json(account);
});

accountingRouter.patch('/accounting/accounts/:code', authenticate, requirePermission('Accounting', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const account = db.getRawData().accounts.find(a => a.tenantId === tenantId && a.code === String(req.params.code));
  if (!account) {
    res.status(404).json({ error: 'الحساب غير موجود.' });
    return;
  }

  const changes: string[] = [];
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2 || name.length > 120) {
      res.status(400).json({ error: 'اسم الحساب يجب أن يكون بين 2 و120 حرفاً.' });
      return;
    }
    if (name !== account.name) {
      changes.push(`الاسم: ${account.name} → ${name}`);
      account.name = name;
    }
  }
  if (req.body?.isActive !== undefined && Boolean(req.body.isActive) !== account.isActive) {
    if (!req.body.isActive && PROTECTED_CODES.includes(account.code)) {
      res.status(400).json({ error: 'لا يمكن تعطيل حساب نظامي يستخدمه محرك الفوترة.' });
      return;
    }
    account.isActive = Boolean(req.body.isActive);
    changes.push(account.isActive ? 'تفعيل' : 'تعطيل');
  }
  if (changes.length > 0) {
    db.save();
    logAudit(tenantId, req.user!.userId, 'Update', 'Accounting.Accounts', account.id, `تعديل الحساب ${account.code}: ${changes.join('، ')}`);
  }
  res.json(account);
});

// ---------- Journal entries ----------

accountingRouter.get('/accounting/journal-entries', authenticate, requirePermission('Accounting', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  res.json(db.getRawData().journalEntries.filter(j => j.tenantId === tenantId));
});

accountingRouter.post('/accounting/journal-entries', authenticate, requirePermission('Accounting', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const { description, entryDate, lines } = req.body ?? {};

  if (typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'بيان القيد مطلوب.' });
    return;
  }
  if (!Array.isArray(lines) || lines.length < 2) {
    res.status(400).json({ error: 'يجب أن يحتوي القيد على طرفين على الأقل.' });
    return;
  }
  const date = entryDate || todayIso();
  if (!isValidDate(date)) {
    res.status(400).json({ error: 'تاريخ القيد غير صالح (YYYY-MM-DD).' });
    return;
  }

  const inputs = lines.map((l: any) => ({
    accountCode: String(l?.accountCode ?? ''),
    debitCents: amountToCents(l?.debit),
    creditCents: amountToCents(l?.credit),
  }));
  if (inputs.some(i => i.debitCents === null || i.creditCents === null)) {
    res.status(400).json({ error: 'المبالغ يجب أن تكون أرقاماً موجبة بحد أقصى منزلتين عشريتين.' });
    return;
  }

  try {
    db.beginTransaction();
    const entry = createDraftJournal({
      tenantId,
      userId: req.user!.userId,
      description,
      entryDate: date,
      lines: inputs as Array<{ accountCode: string; debitCents: number; creditCents: number }>,
    });
    logAudit(tenantId, req.user!.userId, 'PostDraft', 'Accounting.JournalEntries', entry.id, `حفظ قيد مسودة ${entry.entryNo}`);
    db.commit();
    res.status(201).json(entry);
  } catch (err) {
    db.rollback();
    sendError(res, err);
  }
});

accountingRouter.post('/accounting/journal-entries/:id/approve', authenticate, requirePermission('Accounting', 'Approve'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const entry = db.getRawData().journalEntries.find(j => j.id === String(req.params.id) && j.tenantId === tenantId);
  if (!entry) {
    res.status(404).json({ error: 'القيد المحاسبي غير موجود.' });
    return;
  }
  if (entry.isApproved) {
    res.status(400).json({ error: 'القيد معتمد مسبقاً.' });
    return;
  }
  try {
    assertPeriodOpen(tenantId, entry.entryDate);
    // Re-validate lines against the current chart (accounts may have been disabled since drafting).
    resolveLines(tenantId, entry.lines.map(l => ({ accountCode: l.accountCode, debitCents: l.debitCents, creditCents: l.creditCents })));
  } catch (err) {
    sendError(res, err);
    return;
  }
  entry.isApproved = true;
  entry.approvedAt = new Date().toISOString();
  entry.approvedBy = req.user!.userId;
  db.save();
  logAudit(tenantId, req.user!.userId, 'Approve', 'Accounting.JournalEntries', entry.id, `اعتماد القيد ${entry.entryNo}`);
  res.json({ success: true, entry });
});

// ---------- Accounting periods ----------

function periodRecord(tenantId: string, period: string): AccountingPeriodRecord | undefined {
  return db.getRawData().accountingPeriods.find(p => p.tenantId === tenantId && p.period === period);
}

accountingRouter.get('/accounting/periods', authenticate, requirePermission('Accounting', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const records = db.getRawData().accountingPeriods.filter(p => p.tenantId === tenantId);
  const drafts = db.getRawData().journalEntries.filter(j => j.tenantId === tenantId && !j.isApproved);
  const periods = records
    .map(p => ({ ...p, draftEntries: drafts.filter(d => periodOf(d.entryDate) === p.period).length }))
    .sort((a, b) => b.period.localeCompare(a.period));
  res.json(periods);
});

accountingRouter.post('/accounting/periods/:period/close', authenticate, requirePermission('Accounting', 'Approve'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const period = String(req.params.period);
  if (!/^\d{4}-\d{2}$/.test(period)) {
    res.status(400).json({ error: 'صيغة الفترة يجب أن تكون YYYY-MM.' });
    return;
  }
  if (period > todayIso().slice(0, 7)) {
    res.status(400).json({ error: 'لا يمكن إقفال فترة مستقبلية.' });
    return;
  }
  if (periodRecord(tenantId, period)?.status === 'Closed') {
    res.status(400).json({ error: 'الفترة مقفلة بالفعل.' });
    return;
  }
  // A period cannot close while it still has drafts: they would be stranded outside the books.
  const drafts = db.getRawData().journalEntries.filter(j => j.tenantId === tenantId && !j.isApproved && periodOf(j.entryDate) === period);
  if (drafts.length > 0) {
    res.status(409).json({ error: `لا يمكن الإقفال: يوجد ${drafts.length} قيد مسودة غير معتمد في هذه الفترة.` });
    return;
  }

  const existing = periodRecord(tenantId, period);
  const record: AccountingPeriodRecord = existing ?? { id: newId('per'), tenantId, period, status: 'Open' };
  if (!existing) db.getRawData().accountingPeriods.push(record);
  record.status = 'Closed';
  record.closedAt = new Date().toISOString();
  record.closedBy = req.user!.userId;
  delete record.reopenReason;
  db.save();
  logAudit(tenantId, req.user!.userId, 'ClosePeriod', 'Accounting.Periods', record.id, `إقفال الفترة المحاسبية ${period}`);
  res.json(record);
});

accountingRouter.post('/accounting/periods/:period/reopen', authenticate, requirePermission('Accounting', 'Approve'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const period = String(req.params.period);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10) {
    res.status(400).json({ error: 'سبب إعادة فتح الفترة مطلوب (10 أحرف على الأقل).' });
    return;
  }
  const record = periodRecord(tenantId, period);
  if (!record || record.status !== 'Closed') {
    res.status(400).json({ error: 'الفترة ليست مقفلة.' });
    return;
  }
  record.status = 'Open';
  record.reopenReason = reason;
  db.save();
  logAudit(tenantId, req.user!.userId, 'ReopenPeriod', 'Accounting.Periods', record.id, `إعادة فتح الفترة ${period}: ${reason}`);
  res.json(record);
});

// ---------- Trial balance ----------

accountingRouter.get('/accounting/trial-balance', authenticate, requirePermission('Accounting', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const asOf = typeof req.query.asOf === 'string' && req.query.asOf ? req.query.asOf : todayIso();
  if (!isValidDate(asOf)) {
    res.status(400).json({ error: 'تاريخ التقرير غير صالح (YYYY-MM-DD).' });
    return;
  }

  const raw = db.getRawData();
  const rows = raw.accounts
    .filter(a => a.tenantId === tenantId)
    .map(a => {
      const balance = approvedBalance(tenantId, a.code, asOf);
      return {
        code: a.code,
        name: a.name,
        type: a.type,
        isActive: a.isActive,
        debitCents: balance > 0 ? balance : 0,
        creditCents: balance < 0 ? -balance : 0,
      };
    })
    .filter(r => r.debitCents !== 0 || r.creditCents !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalDebitCents = rows.reduce((s, r) => s + r.debitCents, 0);
  const totalCreditCents = rows.reduce((s, r) => s + r.creditCents, 0);

  res.json({
    asOf,
    rows,
    totals: { debitCents: totalDebitCents, creditCents: totalCreditCents },
    balanced: totalDebitCents === totalCreditCents,
  });
});
