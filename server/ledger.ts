import { db, JournalEntryRecord, JournalLineRecord, AccountRecord } from './db';
import { DomainError, newId, nextSequence, isValidDate, periodOf } from './chart';

export interface DraftLineInput {
  accountCode: string;
  debitCents: number;
  creditCents: number;
}

// Validates a set of lines against the tenant's active chart of accounts.
// Account names always come from the chart, never from the client.
export function resolveLines(
  tenantId: string,
  inputs: DraftLineInput[],
  allowInactiveAccounts = false
): Array<Omit<JournalLineRecord, 'id' | 'journalEntryId' | 'lineNo'>> {
  const raw = db.getRawData();
  if (inputs.length < 2) throw new DomainError(400, 'يجب أن يحتوي القيد على طرفين على الأقل.');

  let totalDebit = 0;
  let totalCredit = 0;
  const out: Array<Omit<JournalLineRecord, 'id' | 'journalEntryId' | 'lineNo'>> = [];

  for (const line of inputs) {
    const { debitCents, creditCents } = line;
    if (!Number.isInteger(debitCents) || !Number.isInteger(creditCents) || debitCents < 0 || creditCents < 0) {
      throw new DomainError(400, 'المبالغ في أسطر القيد يجب أن تكون أرقاماً موجبة.');
    }
    if ((debitCents > 0) === (creditCents > 0)) {
      throw new DomainError(400, 'كل سطر يجب أن يحتوي على مدين أو دائن فقط، وبمبلغ أكبر من صفر.');
    }
    const account: AccountRecord | undefined = raw.accounts.find(a => a.tenantId === tenantId && a.code === line.accountCode);
    if (!account) throw new DomainError(400, `الحساب ${line.accountCode} غير موجود في دليل حسابات المنشأة.`);
    if (!account.isActive && !allowInactiveAccounts) throw new DomainError(400, `الحساب ${line.accountCode} (${account.name}) معطل ولا يقبل قيوداً جديدة.`);

    totalDebit += debitCents;
    totalCredit += creditCents;
    out.push({ accountCode: account.code, accountName: account.name, debitCents, creditCents });
  }

  if (totalDebit !== totalCredit) {
    throw new DomainError(
      400,
      `القيد غير متوازن: إجمالي المدين (${(totalDebit / 100).toFixed(2)}) لا يساوي إجمالي الدائن (${(totalCredit / 100).toFixed(2)}).`
    );
  }
  return out;
}

// Throws when the accounting period containing `date` has been closed.
export function assertPeriodOpen(tenantId: string, date: string): void {
  const raw = db.getRawData();
  const period = periodOf(date);
  const record = raw.accountingPeriods.find(p => p.tenantId === tenantId && p.period === period);
  if (record?.status === 'Closed') {
    throw new DomainError(423, `الفترة المحاسبية ${period} مقفلة؛ لا يمكن الترحيل فيها.`);
  }
}

export function nextJournalNo(tenantId: string, year: string): string {
  const raw = db.getRawData();
  const existing = raw.journalEntries.filter(j => j.tenantId === tenantId).map(j => j.entryNo);
  return nextSequence(existing, `JV-${year}`);
}

// Creates an unapproved (draft) journal entry. Drafts must be approved by an authorized user.
export function createDraftJournal(params: {
  tenantId: string;
  userId: string;
  description: string;
  entryDate: string;
  lines: DraftLineInput[];
  branchId?: string;
  // Only for reversals of already-posted entries, which must succeed even if an account was later disabled.
  allowInactiveAccounts?: boolean;
}): JournalEntryRecord {
  if (!isValidDate(params.entryDate)) throw new DomainError(400, 'تاريخ القيد غير صالح (YYYY-MM-DD).');
  assertPeriodOpen(params.tenantId, params.entryDate);
  const resolved = resolveLines(params.tenantId, params.lines, params.allowInactiveAccounts);

  const id = newId('je');
  const entry: JournalEntryRecord = {
    id,
    tenantId: params.tenantId,
    branchId: params.branchId,
    entryNo: nextJournalNo(params.tenantId, params.entryDate.slice(0, 4)),
    entryDate: params.entryDate,
    description: params.description.trim(),
    isApproved: false,
    createdAt: new Date().toISOString(),
    lines: resolved.map((l, idx) => ({
      id: newId('jl'),
      journalEntryId: id,
      lineNo: idx + 1,
      ...l,
    })),
  };
  db.getRawData().journalEntries.unshift(entry);
  return entry;
}

// Balance of a tenant's approved entries for one account, in cents (debit positive).
export function approvedBalance(tenantId: string, accountCode: string, upToDate?: string): number {
  const raw = db.getRawData();
  let sum = 0;
  for (const j of raw.journalEntries) {
    if (j.tenantId !== tenantId || !j.isApproved) continue;
    if (upToDate && j.entryDate > upToDate) continue;
    for (const l of j.lines) {
      if (l.accountCode === accountCode) sum += l.debitCents - l.creditCents;
    }
  }
  return sum;
}
