import crypto from 'crypto';
import { Router, Response } from 'express';
import { db, MigrationJobRecord, PatientRecord, ProductRecord, AccountRecord, JournalEntryRecord, InvoiceRecord } from './db';
import { AuthenticatedRequest, authenticate, requirePermission, logAudit } from './auth';
import { DomainError, ACCOUNT_TYPES, SYSTEM_ACCOUNTS, VAT_RATE, newId, isValidDate, toPositiveCents } from './chart';
import { resolveLines, assertPeriodOpen, nextJournalNo } from './ledger';

// Data migration: file-based import (CSV / JSON) with per-row validation, duplicate detection,
// staging, and an all-or-nothing commit. Re-running the same file is idempotent: rows whose
// natural key already exists are reported as duplicates and skipped.

export const migrationRouter = Router();

const MAX_ROWS = 10000;
const MAX_ERRORS_REPORTED = 200;

type Row = Record<string, unknown>;
type Check<T> = { ok: true; value: T } | { ok: false; field?: string; message: string };

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

// ---------- Entity definitions ----------

export const ENTITY_SPECS = {
  patients: {
    label: 'سجلات المرضى',
    key: 'medicalNo',
    fields: [
      { name: 'medicalNo', label: 'رقم الملف الطبي', required: true },
      { name: 'fullName', label: 'الاسم الكامل', required: true },
      { name: 'phone', label: 'الهاتف', required: false },
      { name: 'birthDate', label: 'تاريخ الميلاد (YYYY-MM-DD)', required: false },
      { name: 'gender', label: 'الجنس', required: false },
      { name: 'address', label: 'العنوان', required: false },
    ],
  },
  accounts: {
    label: 'دليل الحسابات',
    key: 'code',
    fields: [
      { name: 'code', label: 'الرمز (4 أرقام)', required: true },
      { name: 'name', label: 'الاسم', required: true },
      { name: 'type', label: 'النوع (Asset/Liability/Equity/Revenue/Expense)', required: true },
    ],
  },
  products: {
    label: 'الأصناف والمخزون',
    key: 'sku',
    fields: [
      { name: 'sku', label: 'رمز الصنف', required: true },
      { name: 'name', label: 'اسم الصنف', required: true },
      { name: 'unit', label: 'الوحدة', required: false },
      { name: 'cost', label: 'التكلفة', required: false },
      { name: 'price', label: 'السعر', required: false },
      { name: 'stock', label: 'الرصيد الافتتاحي', required: false },
    ],
  },
  invoices: {
    label: 'فواتير مرحّلة (مرضى موجودون مسبقاً)',
    key: 'invoiceNo',
    fields: [
      { name: 'invoiceNo', label: 'رقم الفاتورة', required: true },
      { name: 'patientMedicalNo', label: 'رقم ملف المريض (يجب ترحيله أولاً)', required: true },
      { name: 'invoiceDate', label: 'التاريخ (YYYY-MM-DD)', required: true },
      { name: 'description', label: 'وصف الخدمة', required: true },
      { name: 'quantity', label: 'الكمية (عدد صحيح)', required: true },
      { name: 'unitPrice', label: 'سعر الوحدة (قبل الضريبة)', required: true },
      { name: 'discount', label: 'الخصم', required: false },
    ],
  },
  journal_entries: {
    label: 'قيود افتتاحية معتمدة (JSON)',
    key: 'entryNo',
    fields: [
      { name: 'entryNo', label: 'رقم القيد', required: true },
      { name: 'entryDate', label: 'التاريخ (YYYY-MM-DD)', required: true },
      { name: 'description', label: 'البيان', required: true },
      { name: 'lines', label: 'الأسطر (مصفوفة {accountCode, debit, credit})', required: true },
    ],
  },
} as const;

export type EntityName = keyof typeof ENTITY_SPECS;

function isEntity(v: unknown): v is EntityName {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENTITY_SPECS, v);
}

// ---------- Normalizers (shared with sync) ----------

export function normalizePatient(row: Row): Check<{ medicalNo: string; fullName: string; phone: string; birthDate?: string; gender: string; address: string }> {
  const medicalNo = str(row.medicalNo);
  const fullName = str(row.fullName);
  if (!medicalNo || medicalNo.length > 40) return { ok: false, field: 'medicalNo', message: 'رقم الملف الطبي مطلوب (حتى 40 حرفاً).' };
  if (fullName.length < 2 || fullName.length > 120) return { ok: false, field: 'fullName', message: 'الاسم الكامل مطلوب (2-120 حرفاً).' };
  const birth = str(row.birthDate);
  if (birth && !isValidDate(birth)) return { ok: false, field: 'birthDate', message: 'تاريخ الميلاد يجب أن يكون YYYY-MM-DD.' };
  return {
    ok: true,
    value: {
      medicalNo,
      fullName,
      phone: str(row.phone),
      birthDate: birth || undefined,
      gender: str(row.gender) || 'غير محدد',
      address: str(row.address),
    },
  };
}

function moneyCents(row: Row, field: string, required: boolean): Check<number> {
  const raw = row[field];
  if (raw === undefined || raw === null || str(raw) === '') {
    return required ? { ok: false, field, message: 'القيمة مطلوبة.' } : { ok: true, value: 0 };
  }
  const cents = toPositiveCents(raw) ?? (Number(raw) === 0 && str(raw) !== '' ? 0 : null);
  if (cents === null || Number(raw) < 0) return { ok: false, field, message: 'القيمة يجب أن تكون رقماً موجباً بحد أقصى منزلتين عشريتين.' };
  return { ok: true, value: cents };
}

function normalizeAccount(row: Row): Check<{ code: string; name: string; type: string }> {
  const code = str(row.code);
  const name = str(row.name);
  const type = str(row.type);
  if (!/^\d{4}$/.test(code)) return { ok: false, field: 'code', message: 'الرمز يجب أن يكون 4 أرقام.' };
  if (name.length < 2 || name.length > 120) return { ok: false, field: 'name', message: 'الاسم مطلوب (2-120 حرفاً).' };
  if (!(ACCOUNT_TYPES as readonly string[]).includes(type)) return { ok: false, field: 'type', message: 'نوع الحساب غير صالح.' };
  return { ok: true, value: { code, name, type } };
}

function normalizeProduct(row: Row): Check<{ sku: string; name: string; unit: string; costCents: number; priceCents: number; stock: number }> {
  const sku = str(row.sku);
  const name = str(row.name);
  if (!sku || sku.length > 40) return { ok: false, field: 'sku', message: 'رمز الصنف مطلوب (حتى 40 حرفاً).' };
  if (name.length < 2 || name.length > 120) return { ok: false, field: 'name', message: 'اسم الصنف مطلوب (2-120 حرفاً).' };
  const cost = moneyCents(row, 'cost', false);
  if (!cost.ok) return cost;
  const price = moneyCents(row, 'price', false);
  if (!price.ok) return price;
  const stockRaw = row.stock === undefined || str(row.stock) === '' ? 0 : Number(row.stock);
  if (!Number.isInteger(stockRaw) || stockRaw < 0) return { ok: false, field: 'stock', message: 'الرصيد الافتتاحي يجب أن يكون عدداً صحيحاً غير سالب.' };
  return {
    ok: true,
    value: { sku, name, unit: str(row.unit) || 'وحدة', costCents: cost.value, priceCents: price.value, stock: stockRaw },
  };
}

function normalizeJournal(row: Row): Check<{ entryNo: string; entryDate: string; description: string; lines: Array<{ accountCode: string; debitCents: number; creditCents: number }> }> {
  const entryNo = str(row.entryNo);
  const entryDate = str(row.entryDate);
  const description = str(row.description);
  if (!entryNo || entryNo.length > 40) return { ok: false, field: 'entryNo', message: 'رقم القيد مطلوب.' };
  if (!isValidDate(entryDate)) return { ok: false, field: 'entryDate', message: 'التاريخ يجب أن يكون YYYY-MM-DD.' };
  if (!description) return { ok: false, field: 'description', message: 'البيان مطلوب.' };

  let rawLines: unknown = row.lines;
  if (typeof rawLines === 'string') {
    try {
      rawLines = JSON.parse(rawLines);
    } catch {
      return { ok: false, field: 'lines', message: 'الأسطر ليست JSON صالحاً.' };
    }
  }
  if (!Array.isArray(rawLines) || rawLines.length < 2) return { ok: false, field: 'lines', message: 'يجب أن يحتوي القيد على طرفين على الأقل.' };

  const lines: Array<{ accountCode: string; debitCents: number; creditCents: number }> = [];
  for (const l of rawLines as Row[]) {
    const d = moneyCents(l, 'debit', false);
    const c = moneyCents(l, 'credit', false);
    if (!d.ok) return { ok: false, field: 'lines', message: `مبلغ مدين غير صالح: ${d.message}` };
    if (!c.ok) return { ok: false, field: 'lines', message: `مبلغ دائن غير صالح: ${c.message}` };
    lines.push({ accountCode: str(l.accountCode), debitCents: d.value, creditCents: c.value });
  }
  return { ok: true, value: { entryNo, entryDate, description, lines } };
}

// ---------- Validation against tenant state ----------

interface ValidationResult {
  valid: Row[]; // raw rows that passed and are not duplicates
  duplicates: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  invalidRows: number;
}

function keyOf(entity: EntityName, normalized: any): string {
  return String(ENTITY_SPECS[entity].key === 'medicalNo' ? normalized.medicalNo : normalized[ENTITY_SPECS[entity].key]).toLowerCase();
}

function existingKeys(tenantId: string, entity: EntityName): Set<string> {
  const raw = db.getRawData();
  switch (entity) {
    case 'patients':
      return new Set(raw.patients.filter(p => p.tenantId === tenantId && !p.isDeleted).map(p => p.medicalNo.toLowerCase()));
    case 'accounts':
      return new Set(raw.accounts.filter(a => a.tenantId === tenantId).map(a => a.code.toLowerCase()));
    case 'products':
      return new Set(raw.products.filter(p => p.tenantId === tenantId).map(p => p.sku.toLowerCase()));
    case 'journal_entries':
      return new Set(raw.journalEntries.filter(j => j.tenantId === tenantId).map(j => j.entryNo.toLowerCase()));
    case 'invoices':
      return new Set(raw.invoices.filter(i => i.tenantId === tenantId).map(i => i.invoiceNo.toLowerCase()));
  }
}

function normalizeInvoice(row: Row): Check<{ invoiceNo: string; patientMedicalNo: string; invoiceDate: string; description: string; quantity: number; unitPriceCents: number; discountCents: number; subtotalCents: number; taxCents: number; totalCents: number }> {
  const invoiceNo = str(row.invoiceNo);
  if (!invoiceNo || invoiceNo.length > 40) return { ok: false, field: 'invoiceNo', message: 'رقم الفاتورة مطلوب (حتى 40 حرفاً).' };
  const patientMedicalNo = str(row.patientMedicalNo);
  if (!patientMedicalNo) return { ok: false, field: 'patientMedicalNo', message: 'رقم ملف المريض مطلوب.' };
  const invoiceDate = str(row.invoiceDate);
  if (!isValidDate(invoiceDate)) return { ok: false, field: 'invoiceDate', message: 'تاريخ الفاتورة يجب أن يكون YYYY-MM-DD.' };
  const description = str(row.description);
  if (description.length < 2) return { ok: false, field: 'description', message: 'وصف الخدمة مطلوب.' };
  const quantity = Number(str(row.quantity));
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, field: 'quantity', message: 'الكمية يجب أن تكون عدداً صحيحاً موجباً.' };
  const unit = moneyCents(row, 'unitPrice', true);
  if (!unit.ok) return unit;
  if (unit.value <= 0) return { ok: false, field: 'unitPrice', message: 'سعر الوحدة يجب أن يكون أكبر من صفر.' };
  const disc = moneyCents(row, 'discount', false);
  if (!disc.ok) return disc;
  const subtotalCents = quantity * unit.value;
  if (disc.value > subtotalCents) return { ok: false, field: 'discount', message: 'الخصم لا يمكن أن يتجاوز المجموع الفرعي.' };
  const netCents = subtotalCents - disc.value;
  const taxCents = Math.round(netCents * VAT_RATE);
  return {
    ok: true,
    value: { invoiceNo, patientMedicalNo, invoiceDate, description, quantity, unitPriceCents: unit.value, discountCents: disc.value, subtotalCents, taxCents, totalCents: netCents + taxCents },
  };
}

function normalizeRow(entity: EntityName, row: Row): Check<any> {
  switch (entity) {
    case 'patients': return normalizePatient(row);
    case 'accounts': return normalizeAccount(row);
    case 'products': return normalizeProduct(row);
    case 'journal_entries': return normalizeJournal(row);
    case 'invoices': return normalizeInvoice(row);
  }
}

// Validates rows in order. Rows already present in the tenant are duplicates (skipped, not errors).
export function validateRows(tenantId: string, entity: EntityName, rows: Row[]): ValidationResult {
  const seen = existingKeys(tenantId, entity);
  const valid: Row[] = [];
  const errors: ValidationResult['errors'] = [];
  let duplicates = 0;
  let invalidRows = 0;

  rows.forEach((row, idx) => {
    const rowNo = idx + 1;
    const normalized = normalizeRow(entity, row);
    if (!normalized.ok) {
      invalidRows++;
      if (errors.length < MAX_ERRORS_REPORTED) errors.push({ row: rowNo, field: normalized.field, message: normalized.message });
      return;
    }

    // Accounting-specific checks: lines must reference active accounts, balance, and open periods.
    if (entity === 'journal_entries') {
      const j = normalized.value as any;
      try {
        assertPeriodOpen(tenantId, j.entryDate);
        resolveLines(tenantId, j.lines);
      } catch (err) {
        invalidRows++;
        if (errors.length < MAX_ERRORS_REPORTED) errors.push({ row: rowNo, field: 'lines', message: err instanceof Error ? err.message : 'قيد غير صالح.' });
        return;
      }
    }

    if (entity === 'invoices') {
      const inv = normalized.value as any;
      const patientExists = db.getRawData().patients.some(p => p.tenantId === tenantId && !p.isDeleted && p.medicalNo.toLowerCase() === inv.patientMedicalNo.toLowerCase());
      if (!patientExists) {
        invalidRows++;
        if (errors.length < MAX_ERRORS_REPORTED) errors.push({ row: rowNo, field: 'patientMedicalNo', message: 'المريض غير موجود في هذه المنشأة؛ رحّل سجلات المرضى أولاً.' });
        return;
      }
      try {
        assertPeriodOpen(tenantId, inv.invoiceDate);
      } catch (err) {
        invalidRows++;
        if (errors.length < MAX_ERRORS_REPORTED) errors.push({ row: rowNo, field: 'invoiceDate', message: err instanceof Error ? err.message : 'فترة غير صالحة.' });
        return;
      }
    }

    const key = keyOf(entity, normalized.value);
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    valid.push(row);
  });

  return { valid, duplicates, errors, invalidRows };
}

// Inserts already-validated rows. Must run inside a transaction.
function importRows(tenantId: string, entity: EntityName, rows: Row[], jobId: string): number {
  const raw = db.getRawData();
  const now = new Date().toISOString();
  let count = 0;

  for (const row of rows) {
    const n = normalizeRow(entity, row);
    if (!n.ok) throw new DomainError(409, `صف غير صالح أثناء الاستيراد: ${n.message}`);

    switch (entity) {
      case 'patients': {
        const v = n.value;
        const patient: PatientRecord = {
          id: newId('pat'),
          tenantId,
          medicalNo: v.medicalNo,
          fullName: v.fullName,
          phone: v.phone,
          birthDate: v.birthDate,
          gender: v.gender,
          address: v.address,
          isDeleted: false,
          createdAt: now,
          syncSeq: ++raw.syncCursor,
        };
        raw.patients.unshift(patient);
        break;
      }
      case 'accounts': {
        const account: AccountRecord = { id: newId('acc'), tenantId, code: n.value.code, name: n.value.name, type: n.value.type, isActive: true, createdAt: now };
        raw.accounts.push(account);
        break;
      }
      case 'products': {
        const v = n.value;
        const product: ProductRecord = { id: newId('prd'), tenantId, sku: v.sku, name: v.name, unit: v.unit, costCents: v.costCents, priceCents: v.priceCents, stock: v.stock, isActive: true, createdAt: now };
        raw.products.unshift(product);
        break;
      }
      case 'invoices': {
        const v = n.value;
        const patient = raw.patients.find(p => p.tenantId === tenantId && !p.isDeleted && p.medicalNo.toLowerCase() === v.patientMedicalNo.toLowerCase());
        if (!patient) throw new DomainError(409, `المريض ${v.patientMedicalNo} غير موجود أثناء الترحيل.`);
        const invoiceId = newId('inv');
        const jeId = newId('je');
        // Historical invoices are posted with the same accounts as live billing and approved on import.
        const lines = [
          { accountCode: SYSTEM_ACCOUNTS.RECEIVABLES, debitCents: v.totalCents, creditCents: 0 },
          { accountCode: SYSTEM_ACCOUNTS.REVENUE, debitCents: 0, creditCents: v.subtotalCents - v.discountCents },
          ...(v.taxCents > 0 ? [{ accountCode: SYSTEM_ACCOUNTS.VAT_PAYABLE, debitCents: 0, creditCents: v.taxCents }] : []),
        ];
        const journal: JournalEntryRecord = {
          id: jeId,
          tenantId,
          branchId: patient.branchId,
          entryNo: nextJournalNo(tenantId, v.invoiceDate.slice(0, 4)),
          entryDate: v.invoiceDate,
          description: `قيد فاتورة مرحّلة ${v.invoiceNo} - ${patient.fullName} (ترحيل ${jobId})`,
          isApproved: true,
          approvedAt: now,
          approvedBy: `migration:${jobId}`,
          createdAt: now,
          lines: resolveLines(tenantId, lines).map((l, idx) => ({ id: newId('jl'), journalEntryId: jeId, lineNo: idx + 1, ...l })),
        };
        raw.journalEntries.unshift(journal);
        const invoice: InvoiceRecord = {
          id: invoiceId,
          tenantId,
          branchId: patient.branchId,
          patientId: patient.id,
          patientName: patient.fullName,
          invoiceNo: v.invoiceNo,
          invoiceDate: v.invoiceDate,
          subtotalCents: v.subtotalCents,
          discountCents: v.discountCents,
          taxCents: v.taxCents,
          totalCents: v.totalCents,
          status: 'Posted',
          lines: [{ id: newId('line'), invoiceId, description: v.description, quantity: v.quantity, unitPriceCents: v.unitPriceCents, totalCents: v.subtotalCents }],
          journalEntryId: jeId,
          createdAt: now,
        };
        raw.invoices.unshift(invoice);
        break;
      }
      case 'journal_entries': {
        const v = n.value;
        const id = newId('je');
        const entry: JournalEntryRecord = {
          id,
          tenantId,
          entryNo: v.entryNo,
          entryDate: v.entryDate,
          description: `${v.description} (ترحيل ${jobId})`,
          isApproved: true,
          approvedAt: now,
          approvedBy: `migration:${jobId}`,
          createdAt: now,
          lines: resolveLines(tenantId, v.lines).map((l, idx) => ({ id: newId('jl'), journalEntryId: id, lineNo: idx + 1, ...l })),
        };
        raw.journalEntries.unshift(entry);
        break;
      }
    }
    count++;
  }
  return count;
}

// ---------- Endpoints ----------

migrationRouter.get('/migration/entities', authenticate, requirePermission('Migration', 'View'), (_req: AuthenticatedRequest, res: Response) => {
  res.json(Object.entries(ENTITY_SPECS).map(([name, spec]) => ({ name, label: spec.label, key: spec.key, fields: spec.fields })));
});

function summarize(job: MigrationJobRecord) {
  const { stagedRows, ...rest } = job;
  return { ...rest, stagedCount: stagedRows.length };
}

migrationRouter.get('/migration/jobs', authenticate, requirePermission('Migration', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  res.json(db.getRawData().migrationJobs.filter(j => j.tenantId === tenantId).map(summarize));
});

migrationRouter.post('/migration/jobs', authenticate, requirePermission('Migration', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const { entity, rows, sourceName, sourceType } = req.body ?? {};

  if (!isEntity(entity)) {
    res.status(400).json({ error: 'نوع البيانات المطلوب ترحيله غير معروف.' });
    return;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'لا توجد صفوف للترحيل.' });
    return;
  }
  if (rows.length > MAX_ROWS) {
    res.status(400).json({ error: `الحد الأقصى ${MAX_ROWS} صف للدفعة الواحدة.` });
    return;
  }
  if (!rows.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
    res.status(400).json({ error: 'كل صف يجب أن يكون كائناً.' });
    return;
  }

  const result = validateRows(tenantId, entity, rows as Row[]);
  const job: MigrationJobRecord = {
    id: newId('mig'),
    tenantId,
    sourceName: str(sourceName).slice(0, 120) || 'ملف غير مسمى',
    sourceType: sourceType === 'JSON' ? 'JSON' : 'CSV',
    entity,
    status: result.invalidRows === 0 && result.valid.length > 0 ? 'Validated' : 'Staged',
    totalRows: rows.length,
    validRows: result.valid.length,
    duplicateRows: result.duplicates,
    invalidRows: result.invalidRows,
    importedRows: 0,
    errors: result.errors,
    stagedRows: result.valid,
    sourceChecksum: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    createdBy: req.user!.userId,
    createdAt: new Date().toISOString(),
  };
  db.getRawData().migrationJobs.unshift(job);
  db.save();
  logAudit(tenantId, req.user!.userId, 'Stage', 'Migration.Jobs', job.id, `تحضير ترحيل ${entity}: ${job.validRows} صالح، ${job.duplicateRows} مكرر، ${job.invalidRows} خطأ`);
  res.status(201).json(summarize(job));
});

migrationRouter.post('/migration/jobs/:id/commit', authenticate, requirePermission('Migration', 'Commit'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const job = db.getRawData().migrationJobs.find(j => j.id === String(req.params.id) && j.tenantId === tenantId);
  if (!job) {
    res.status(404).json({ error: 'مهمة الترحيل غير موجودة.' });
    return;
  }
  if (job.status !== 'Validated') {
    res.status(409).json({ error: 'لا يمكن تنفيذ هذه المهمة؛ يجب أن تكون بحالة "Validated" بدون أخطاء.' });
    return;
  }

  // Re-validate against current data: the tenant may have changed since staging.
  const recheck = validateRows(tenantId, job.entity, job.stagedRows);
  if (recheck.invalidRows > 0 || recheck.valid.length !== job.stagedRows.length) {
    job.status = 'Staged';
    job.errors = recheck.errors;
    job.validRows = recheck.valid.length;
    job.invalidRows = recheck.invalidRows;
    db.save();
    res.status(409).json({ error: 'تغيّرت بيانات المنشأة منذ التحضير؛ راجع الأخطاء وأعد التحضير.', job: summarize(job) });
    return;
  }

  db.beginTransaction();
  try {
    const imported = importRows(tenantId, job.entity, job.stagedRows, job.id);
    job.status = 'Committed';
    job.importedRows = imported;
    job.committedAt = new Date().toISOString();
    job.stagedRows = [];
    logAudit(tenantId, req.user!.userId, 'Commit', 'Migration.Jobs', job.id, `ترحيل ذري لـ ${imported} صف من ${job.entity} (مكرر: ${job.duplicateRows})`);
    db.commit();
    res.json({ success: true, importedRows: imported, job: summarize(job) });
  } catch (err) {
    db.rollback();
    res.status(err instanceof DomainError ? err.status : 500).json({ error: `فشل الترحيل وتم التراجع عن كل التغييرات: ${err instanceof Error ? err.message : ''}` });
  }
});

migrationRouter.post('/migration/jobs/:id/discard', authenticate, requirePermission('Migration', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const job = db.getRawData().migrationJobs.find(j => j.id === String(req.params.id) && j.tenantId === tenantId);
  if (!job || job.status === 'Committed') {
    res.status(404).json({ error: 'لا يمكن إلغاء هذه المهمة.' });
    return;
  }
  job.status = 'Rejected';
  job.stagedRows = [];
  db.save();
  logAudit(tenantId, req.user!.userId, 'Discard', 'Migration.Jobs', job.id, 'إلغاء مهمة ترحيل وحذف صفوف staging');
  res.json({ success: true, job: summarize(job) });
});

