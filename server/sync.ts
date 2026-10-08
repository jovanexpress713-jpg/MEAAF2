import { Router, Response } from 'express';
import { db, PatientRecord, SyncOperationRecord } from './db';
import { AuthenticatedRequest, authenticate, requirePermission, logAudit } from './auth';
import { newId } from './chart';
import { normalizePatient } from './migration';

// Offline sync for devices that queue work while disconnected.
//
// Push: each operation carries a client-generated id. The server records the outcome of every
// id, so retrying a batch (after a dropped response) never applies an operation twice.
// Conflicts are reported back to the device and never overwritten silently.
//
// Pull: returns records whose sync sequence is greater than the device's cursor.

export const syncRouter = Router();

const MAX_OPS_PER_PUSH = 200;
const PULL_LIMIT = 1000;
const SUPPORTED_TYPES = ['patient.create'] as const;

interface OpResult {
  opId: string;
  status: SyncOperationRecord['status'];
  message: string;
  resultId?: string;
}

function applyPatientCreate(tenantId: string, userId: string, deviceId: string, payload: unknown): Omit<OpResult, 'opId'> {
  const checked = normalizePatient((payload ?? {}) as Record<string, unknown>);
  if (!checked.ok) return { status: 'rejected', message: checked.message };

  const raw = db.getRawData();
  const existing = raw.patients.find(
    p => p.tenantId === tenantId && !p.isDeleted && p.medicalNo.toLowerCase() === checked.value.medicalNo.toLowerCase()
  );
  if (existing) {
    // Typical when two offline devices assigned the same number. The server keeps its record.
    return {
      status: 'conflict',
      message: `رقم الملف ${checked.value.medicalNo} مسجل مسبقاً لمريض آخر (${existing.fullName}).`,
      resultId: existing.id,
    };
  }

  const patient: PatientRecord = {
    id: newId('pat'),
    tenantId,
    medicalNo: checked.value.medicalNo,
    fullName: checked.value.fullName,
    phone: checked.value.phone,
    birthDate: checked.value.birthDate,
    gender: checked.value.gender,
    address: checked.value.address,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    syncSeq: ++raw.syncCursor,
  };
  raw.patients.unshift(patient);
  logAudit(tenantId, userId, 'SyncCreate', 'Core.Patients', patient.id, `مزامنة مريض جديد من الجهاز ${deviceId}: ${patient.medicalNo}`);
  return { status: 'applied', message: 'تم إنشاء المريض.', resultId: patient.id };
}

syncRouter.post('/sync/push', authenticate, requirePermission('Patients', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const { deviceId, operations } = req.body ?? {};

  if (typeof deviceId !== 'string' || deviceId.length < 4 || deviceId.length > 80) {
    res.status(400).json({ error: 'معرّف الجهاز غير صالح.' });
    return;
  }
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > MAX_OPS_PER_PUSH) {
    res.status(400).json({ error: `عدد العمليات يجب أن يكون بين 1 و${MAX_OPS_PER_PUSH}.` });
    return;
  }

  const results: OpResult[] = [];
  for (const op of operations) {
    const opId = typeof op?.opId === 'string' ? op.opId : '';
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(opId)) {
      results.push({ opId: String(op?.opId ?? ''), status: 'rejected', message: 'معرّف العملية غير صالح.' });
      continue;
    }

    // Idempotency: a known operation returns its recorded outcome without re-applying.
    const known = db.getRawData().syncOperations.find(o => o.id === opId && o.tenantId === tenantId);
    if (known) {
      results.push({ opId, status: known.status, message: known.message, resultId: known.resultId });
      continue;
    }

    if (!(SUPPORTED_TYPES as readonly string[]).includes(op.type)) {
      const rejected: Omit<OpResult, 'opId'> = { status: 'rejected', message: 'نوع العملية غير مدعوم.' };
      recordOperation(tenantId, deviceId, opId, op.type, rejected);
      results.push({ opId, ...rejected });
      continue;
    }

    db.beginTransaction();
    try {
      const outcome = applyPatientCreate(tenantId, req.user!.userId, deviceId, op.payload);
      recordOperation(tenantId, deviceId, opId, op.type, outcome);
      db.commit();
      results.push({ opId, ...outcome });
    } catch (err) {
      db.rollback();
      const failed: Omit<OpResult, 'opId'> = { status: 'rejected', message: err instanceof Error ? err.message : 'فشل غير متوقع.' };
      results.push({ opId, ...failed });
    }
  }

  db.save();
  res.json({ results, cursor: db.getRawData().syncCursor });
});

function recordOperation(tenantId: string, deviceId: string, opId: string, type: string, outcome: Omit<OpResult, 'opId'>) {
  db.getRawData().syncOperations.push({
    id: opId,
    tenantId,
    deviceId,
    type: String(type ?? ''),
    status: outcome.status,
    message: outcome.message,
    resultId: outcome.resultId,
    createdAt: new Date().toISOString(),
  });
}

syncRouter.get('/sync/pull', authenticate, requirePermission('Patients', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const since = Number(req.query.since ?? 0);
  if (!Number.isInteger(since) || since < 0) {
    res.status(400).json({ error: 'مؤشر المزامنة غير صالح.' });
    return;
  }
  const raw = db.getRawData();
  const changed = raw.patients
    .filter(p => p.tenantId === tenantId && (p.syncSeq ?? 0) > since)
    .sort((a, b) => (a.syncSeq ?? 0) - (b.syncSeq ?? 0));
  const page = changed.slice(0, PULL_LIMIT);
  const nextCursor = page.length > 0 ? page[page.length - 1].syncSeq! : since;
  res.json({
    patients: page,
    cursor: nextCursor,
    hasMore: changed.length > PULL_LIMIT,
  });
});
