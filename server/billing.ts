import { Router, Response } from 'express';
import { db, InvoiceRecord, InvoiceLineRecord, PaymentRecord } from './db';
import { AuthenticatedRequest, authenticate, requirePermission, logAudit } from './auth';
import { DomainError, SYSTEM_ACCOUNTS, nextSequence, toPositiveCents, todayIso, newId } from './chart';
import { createDraftJournal, assertPeriodOpen } from './ledger';

// Billing: invoices, payments, refunds and cancellations. Every money movement posts a
// balanced draft journal entry in the same transaction as the business record.
export const billingRouter = Router();

const VAT_RATE = 0.15;
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Insurance'];

function sendError(res: Response, err: unknown) {
  if (err instanceof DomainError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
  res.status(500).json({ error: `فشل ذري أثناء العملية: ${message}` });
}

function invoiceBalance(tenantId: string, invoice: InvoiceRecord) {
  const raw = db.getRawData();
  const movements = raw.payments.filter(p => p.tenantId === tenantId && p.invoiceId === invoice.id);
  const paidCents = movements.filter(p => p.kind === 'Payment').reduce((s, p) => s + p.amountCents, 0);
  const refundedCents = movements.filter(p => p.kind === 'Refund').reduce((s, p) => s + p.amountCents, 0);
  const netPaidCents = paidCents - refundedCents;
  const balanceCents = invoice.status === 'Cancelled' ? 0 : invoice.totalCents - netPaidCents;
  return { paidCents, refundedCents, netPaidCents, balanceCents };
}

function findInvoice(tenantId: string, id: string): InvoiceRecord {
  const invoice = db.getRawData().invoices.find(i => i.id === id && i.tenantId === tenantId);
  if (!invoice) throw new DomainError(404, 'الفاتورة غير موجودة.');
  return invoice;
}

function decorate(tenantId: string, invoice: InvoiceRecord) {
  return { ...invoice, ...invoiceBalance(tenantId, invoice) };
}

// ---------- Invoices ----------

billingRouter.get('/billing/invoices', authenticate, requirePermission('Billing', 'View'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const invoices = db.getRawData().invoices.filter(i => i.tenantId === tenantId).map(i => decorate(tenantId, i));
  res.json(invoices);
});

billingRouter.get('/billing/invoices/:id/payments', authenticate, requirePermission('Billing', 'View'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const invoice = findInvoice(tenantId, req.params.id);
    const payments = db.getRawData().payments.filter(p => p.tenantId === tenantId && p.invoiceId === invoice.id);
    res.json({ invoice: decorate(tenantId, invoice), movements: payments });
  } catch (err) {
    sendError(res, err);
  }
});

billingRouter.post('/billing/invoices', authenticate, requirePermission('Billing', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const { patientId, description, quantity, unitPrice, discount } = req.body ?? {};
  if (!patientId || !description || quantity === undefined || unitPrice === undefined) {
    res.status(400).json({ error: 'جميع بيانات الفاتورة ومحدد المريض مطلوبة.' });
    return;
  }
  if (typeof description !== 'string' || description.trim().length < 2) {
    res.status(400).json({ error: 'وصف الخدمة مطلوب.' });
    return;
  }

  const qty = Number(quantity);
  const unitCents = toPositiveCents(unitPrice);
  const discountCents = discount ? toPositiveCents(discount) : 0;
  if (!Number.isInteger(qty) || qty <= 0 || unitCents === null || discountCents === null) {
    res.status(400).json({ error: 'الكمية يجب أن تكون عدداً صحيحاً موجباً، والسعر والخصم قيماً صالحة (حتى منزلتين عشريتين).' });
    return;
  }

  const raw = db.getRawData();
  const tenantId = req.user!.tenantId;
  const patient = raw.patients.find(p => p.id === patientId && p.tenantId === tenantId && !p.isDeleted);
  if (!patient) {
    res.status(404).json({ error: 'المريض المحدد غير موجود أو لا ينتمي إلى هذه المنشأة.' });
    return;
  }

  const subtotalCents = qty * unitCents;
  if (discountCents > subtotalCents) {
    res.status(400).json({ error: 'قيمة الخصم لا يمكن أن تتجاوز المجموع الفرعي.' });
    return;
  }

  const netCents = subtotalCents - discountCents;
  const taxCents = Math.round(netCents * VAT_RATE);
  const totalCents = netCents + taxCents;
  const today = todayIso();
  const invoiceNo = nextSequence(
    raw.invoices.filter(i => i.tenantId === tenantId).map(i => i.invoiceNo),
    `INV-${today.slice(0, 4)}`
  );
  const invoiceId = newId('inv');

  db.beginTransaction();
  try {
    assertPeriodOpen(tenantId, today);
    // Receivable is debited for the gross total; revenue is recognized net of discount; VAT is a liability.
    const journal = createDraftJournal({
      tenantId,
      userId: req.user!.userId,
      description: `قيد فاتورة ${invoiceNo} - ${patient.fullName}`,
      entryDate: today,
      branchId: patient.branchId,
      lines: [
        { accountCode: SYSTEM_ACCOUNTS.RECEIVABLES, debitCents: totalCents, creditCents: 0 },
        { accountCode: SYSTEM_ACCOUNTS.REVENUE, debitCents: 0, creditCents: netCents },
        ...(taxCents > 0 ? [{ accountCode: SYSTEM_ACCOUNTS.VAT_PAYABLE, debitCents: 0, creditCents: taxCents }] : []),
      ],
    });

    const invoice: InvoiceRecord = {
      id: invoiceId,
      tenantId,
      branchId: patient.branchId,
      patientId: patient.id,
      patientName: patient.fullName,
      invoiceNo,
      invoiceDate: today,
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
      status: 'Posted',
      lines: [
        {
          id: newId('line'),
          invoiceId,
          description: description.trim(),
          quantity: qty,
          unitPriceCents: unitCents,
          totalCents: subtotalCents,
        } as InvoiceLineRecord,
      ],
      journalEntryId: journal.id,
      createdAt: new Date().toISOString(),
    };
    db.getRawData().invoices.unshift(invoice);

    logAudit(tenantId, req.user!.userId, 'Create', 'Billing.Invoices', invoice.id, `إصدار فاتورة ${invoiceNo} بقيمة ${(totalCents / 100).toFixed(2)}`);
    db.commit();
    res.status(201).json({
      invoice: decorate(tenantId, invoice),
      draftJournal: journal,
      message: `تم إصدار الفاتورة ${invoiceNo} وقيد مسودة مرافق ${journal.entryNo}.`,
    });
  } catch (err) {
    db.rollback();
    sendError(res, err);
  }
});

// ---------- Payments & refunds ----------

function readAmount(res: Response, value: unknown): number | null {
  const cents = toPositiveCents(value);
  if (cents === null) {
    res.status(400).json({ error: 'المبلغ يجب أن يكون رقماً موجباً بحد أقصى منزلتين عشريتين.' });
    return null;
  }
  return cents;
}

billingRouter.post('/billing/invoices/:id/payments', authenticate, requirePermission('Billing', 'Create'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const method = typeof req.body?.method === 'string' ? req.body.method : 'Cash';
  const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim().slice(0, 80) : undefined;
  if (!PAYMENT_METHODS.includes(method)) {
    res.status(400).json({ error: 'طريقة الدفع غير معروفة.' });
    return;
  }
  const amountCents = readAmount(res, req.body?.amount);
  if (amountCents === null) return;

  db.beginTransaction();
  try {
    const invoice = findInvoice(tenantId, req.params.id);
    if (invoice.status !== 'Posted') throw new DomainError(400, 'لا يمكن تحصيل فاتورة ملغاة.');
    const { balanceCents } = invoiceBalance(tenantId, invoice);
    if (amountCents > balanceCents) {
      throw new DomainError(400, `المبلغ يتجاوز الرصيد المستحق (${(balanceCents / 100).toFixed(2)}).`);
    }

    const today = todayIso();
    const journal = createDraftJournal({
      tenantId,
      userId: req.user!.userId,
      description: `تحصيل ${method} للفاتورة ${invoice.invoiceNo}`,
      entryDate: today,
      lines: [
        { accountCode: SYSTEM_ACCOUNTS.CASH, debitCents: amountCents, creditCents: 0 },
        { accountCode: SYSTEM_ACCOUNTS.RECEIVABLES, debitCents: 0, creditCents: amountCents },
      ],
    });

    const payment: PaymentRecord = {
      id: newId('pay'),
      tenantId,
      invoiceId: invoice.id,
      kind: 'Payment',
      amountCents,
      method,
      reference,
      journalEntryId: journal.id,
      entryDate: today,
      createdBy: req.user!.userId,
      createdAt: new Date().toISOString(),
    };
    db.getRawData().payments.unshift(payment);
    logAudit(tenantId, req.user!.userId, 'Payment', 'Billing.Payments', payment.id, `تحصيل ${(amountCents / 100).toFixed(2)} للفاتورة ${invoice.invoiceNo} (${method})`);
    db.commit();

    res.status(201).json({ payment, draftJournal: journal, invoice: decorate(tenantId, invoice) });
  } catch (err) {
    db.rollback();
    sendError(res, err);
  }
});

billingRouter.post('/billing/invoices/:id/refunds', authenticate, requirePermission('Billing', 'Approve'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5) {
    res.status(400).json({ error: 'سبب الاسترداد مطلوب (5 أحرف على الأقل).' });
    return;
  }
  const amountCents = readAmount(res, req.body?.amount);
  if (amountCents === null) return;

  db.beginTransaction();
  try {
    const invoice = findInvoice(tenantId, req.params.id);
    if (invoice.status !== 'Posted') throw new DomainError(400, 'لا يمكن استرداد فاتورة ملغاة.');
    const { netPaidCents } = invoiceBalance(tenantId, invoice);
    if (amountCents > netPaidCents) {
      throw new DomainError(400, `مبلغ الاسترداد يتجاوز الصافي المدفوع (${(netPaidCents / 100).toFixed(2)}).`);
    }

    const today = todayIso();
    const journal = createDraftJournal({
      tenantId,
      userId: req.user!.userId,
      description: `استرداد للفاتورة ${invoice.invoiceNo}: ${reason}`,
      entryDate: today,
      lines: [
        { accountCode: SYSTEM_ACCOUNTS.RECEIVABLES, debitCents: amountCents, creditCents: 0 },
        { accountCode: SYSTEM_ACCOUNTS.CASH, debitCents: 0, creditCents: amountCents },
      ],
    });

    const refund: PaymentRecord = {
      id: newId('ref'),
      tenantId,
      invoiceId: invoice.id,
      kind: 'Refund',
      amountCents,
      method: 'Refund',
      reason,
      journalEntryId: journal.id,
      entryDate: today,
      createdBy: req.user!.userId,
      createdAt: new Date().toISOString(),
    };
    db.getRawData().payments.unshift(refund);
    logAudit(tenantId, req.user!.userId, 'Refund', 'Billing.Payments', refund.id, `استرداد ${(amountCents / 100).toFixed(2)} من الفاتورة ${invoice.invoiceNo}: ${reason}`);
    db.commit();

    res.status(201).json({ refund, draftJournal: journal, invoice: decorate(tenantId, invoice) });
  } catch (err) {
    db.rollback();
    sendError(res, err);
  }
});

// ---------- Cancellation ----------

billingRouter.post('/billing/invoices/:id/cancel', authenticate, requirePermission('Billing', 'Approve'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5) {
    res.status(400).json({ error: 'سبب الإلغاء مطلوب (5 أحرف على الأقل).' });
    return;
  }

  db.beginTransaction();
  try {
    const invoice = findInvoice(tenantId, req.params.id);
    if (invoice.status !== 'Posted') throw new DomainError(400, 'الفاتورة ملغاة مسبقاً.');
    const { netPaidCents } = invoiceBalance(tenantId, invoice);
    if (netPaidCents !== 0) {
      throw new DomainError(400, 'لا يمكن إلغاء فاتورة عليها مدفوعات؛ استرد المبلغ أولاً.');
    }

    const today = todayIso();
    // Reverse the original posting line by line (debits and credits swapped). Works for any
    // invoice regardless of which chart codes were used when it was issued.
    const original = db.getRawData().journalEntries.find(j => j.id === invoice.journalEntryId && j.tenantId === tenantId);
    if (!original) throw new DomainError(409, 'قيد الفاتورة الأصلي غير موجود؛ لا يمكن العكس تلقائياً.');
    const journal = createDraftJournal({
      tenantId,
      userId: req.user!.userId,
      description: `عكس قيد الفاتورة ${invoice.invoiceNo}: ${reason}`,
      entryDate: today,
      allowInactiveAccounts: true,
      lines: original.lines.map(l => ({
        accountCode: l.accountCode,
        debitCents: l.creditCents,
        creditCents: l.debitCents,
      })),
    });

    invoice.status = 'Cancelled';
    invoice.cancelledAt = new Date().toISOString();
    invoice.cancelledBy = req.user!.userId;
    invoice.cancelReason = reason;
    logAudit(tenantId, req.user!.userId, 'Cancel', 'Billing.Invoices', invoice.id, `إلغاء الفاتورة ${invoice.invoiceNo}: ${reason}`);
    db.commit();

    res.json({ invoice: decorate(tenantId, invoice), reversalJournal: journal });
  } catch (err) {
    db.rollback();
    sendError(res, err);
  }
});
