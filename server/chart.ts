import crypto from 'crypto';

// Default chart of accounts provisioned for every tenant. Codes used internally by the
// billing engine (1000, 1100, 2100, 4000) must always exist for a tenant.
export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const SYSTEM_ACCOUNTS = {
  CASH: '1000',
  RECEIVABLES: '1100',
  VAT_PAYABLE: '2100',
  REVENUE: '4000',
} as const;

export const DEFAULT_CHART: Array<{ code: string; name: string; type: AccountType }> = [
  { code: '1000', name: 'الصندوق والبنك', type: 'Asset' },
  { code: '1100', name: 'ذمم المرضى المدينة', type: 'Asset' },
  { code: '1200', name: 'المخزون', type: 'Asset' },
  { code: '2100', name: 'ضريبة القيمة المضافة المستحقة', type: 'Liability' },
  { code: '3000', name: 'رأس المال', type: 'Equity' },
  { code: '4000', name: 'إيرادات الخدمات الطبية', type: 'Revenue' },
  { code: '5000', name: 'تكلفة المبيعات', type: 'Expense' },
  { code: '6000', name: 'مصروفات تشغيلية', type: 'Expense' },
];

export class DomainError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function periodOf(date: string): string {
  return date.slice(0, 7);
}

// Converts a monetary amount (major units, up to 2 decimals) to integer cents.
// Returns null when the value is not a positive finite amount with at most 2 decimals.
export function toPositiveCents(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  if (Math.abs(cents / 100 - n) > 1e-9) return null;
  return cents;
}

// Next sequential number for a prefix, based on the highest existing suffix (never reuses numbers).
export function nextSequence(existing: string[], prefix: string): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const n of existing) {
    const m = re.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}
