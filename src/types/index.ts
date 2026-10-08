export interface User {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  isActive: boolean;
  passwordHash?: string;
  roleName: string;
}

export interface Tenant {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
}

export interface Patient {
  id: string;
  tenantId: string;
  medicalNo: string;
  fullName: string;
  phone: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  invoiceNo: string;
  invoiceDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'Posted' | 'Draft' | 'Cancelled';
  lines: InvoiceLine[];
  journalEntryId?: string;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  lineNo: number;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  entryNo: string;
  entryDate: string;
  description: string;
  isApproved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  lines: JournalLine[];
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface AuditRecord {
  id: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  action: string;
  resource: string;
  recordId?: string;
  details: string;
  atUtc: string;
}

export interface MigrationJob {
  id: string;
  tenantId: string;
  sourceName: string;
  status: 'Discovered' | 'Staged' | 'Validated' | 'Committed' | 'Failed';
  createdAt: string;
  error?: string;
}

export interface StagedRow {
  rowNumber: number;
  payload: Record<string, any>;
  validationError?: string;
}

export interface PatientFieldMapping {
  medicalNoCol: string;
  fullNameCol: string;
  phoneCol?: string;
  birthDateCol?: string;
  genderCol?: string;
  addressCol?: string;
}

export interface ValidationIssue {
  rowNumber: number;
  error: string;
}

export const Perm = {
  View: 'View',
  Create: 'Create',
  Edit: 'Edit',
  Delete: 'Delete',
  Approve: 'Approve',
  Configure: 'Configure',
  Patients: 'Patients',
  Billing: 'Billing',
  Accounting: 'Accounting',
  Inventory: 'Inventory',
  Reports: 'Reports',
  Users: 'Users',
  Migration: 'Migration',
  Licensing: 'Licensing',
  Backup: 'Backup',
  Sync: 'Sync',
  Settings: 'Settings',
} as const;
