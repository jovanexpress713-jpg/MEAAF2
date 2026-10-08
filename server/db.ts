import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'meaaf_enterprise_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface TenantRecord {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface OrganizationRecord {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface BranchRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  city: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface DepartmentRecord {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  code: string;
}

export interface OfficeRecord {
  id: string;
  tenantId: string;
  departmentId: string;
  name: string;
  roomNumber: string;
}

export interface DeviceRecord {
  id: string;
  tenantId: string;
  officeId: string;
  deviceName: string;
  deviceType: 'Workstation' | 'Tablet' | 'Printer' | 'POS';
  osVersion: string;
  ipAddress: string;
  status: 'Online' | 'Offline' | 'Warning';
  lastSeenAt: string;
  assignedPrinter?: string;
}

export interface UserRecord {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  passwordHash: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  isDeleted: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string;
  createdAt: string;
}

export interface RoleRecord {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[]; // "Resource:Action" e.g. "Patients:View", "Billing:Create"
}

export interface PatientRecord {
  id: string;
  tenantId: string;
  branchId?: string;
  medicalNo: string;
  fullName: string;
  phone: string;
  birthDate?: string;
  gender: string;
  address?: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface ProductRecord {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  unit: string;
  costCents: number; // Stored as integer cents for 100% precision
  priceCents: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
}

export interface InvoiceLineRecord {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  branchId?: string;
  patientId: string;
  patientName: string;
  invoiceNo: string;
  invoiceDate: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  status: 'Posted' | 'Cancelled';
  lines: InvoiceLineRecord[];
  journalEntryId: string;
  createdAt: string;
}

export interface JournalLineRecord {
  id: string;
  journalEntryId: string;
  lineNo: number;
  accountCode: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
}

export interface JournalEntryRecord {
  id: string;
  tenantId: string;
  branchId?: string;
  entryNo: string;
  entryDate: string;
  description: string;
  isApproved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  lines: JournalLineRecord[];
}

export interface AuditRecord {
  id: string;
  tenantId: string;
  userId?: string;
  userName: string;
  action: string;
  resource: string;
  recordId?: string;
  details: string;
  atUtc: string;
}

export interface LicenseRecord {
  id: string;
  tenantId: string;
  licenseKey: string;
  plan: 'Enterprise' | 'Clinic' | 'Hospital';
  status: 'Active' | 'Suspended' | 'Expired';
  maxUsers: number;
  maxDevices: number;
  expiresAt: string;
  modules: string[];
}

export interface SupportTicketRecord {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Waiting' | 'Resolved' | 'Closed';
  createdAt: string;
}

export interface MigrationJobRecord {
  id: string;
  tenantId: string;
  sourceName: string;
  sourceType: 'SQLServer' | 'CSV' | 'Access';
  status: 'Discovered' | 'Staged' | 'Validated' | 'Committed' | 'Failed';
  totalSourceRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  reconciliationStatus?: 'Matched' | 'Discrepancy';
  createdAt: string;
}

export interface DatabaseSchema {
  tenants: TenantRecord[];
  organizations: OrganizationRecord[];
  branches: BranchRecord[];
  departments: DepartmentRecord[];
  offices: OfficeRecord[];
  devices: DeviceRecord[];
  users: UserRecord[];
  roles: RoleRecord[];
  patients: PatientRecord[];
  products: ProductRecord[];
  invoices: InvoiceRecord[];
  journalEntries: JournalEntryRecord[];
  auditLogs: AuditRecord[];
  licenses: LicenseRecord[];
  supportTickets: SupportTicketRecord[];
  migrationJobs: MigrationJobRecord[];
}

let dbData: DatabaseSchema;

export class EnterpriseDatabase {
  private static instance: EnterpriseDatabase;
  private transactionStack: DatabaseSchema[] = [];

  private constructor() {
    this.load();
  }

  public static getInstance(): EnterpriseDatabase {
    if (!EnterpriseDatabase.instance) {
      EnterpriseDatabase.instance = new EnterpriseDatabase();
    }
    return EnterpriseDatabase.instance;
  }

  private load(): void {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        dbData = JSON.parse(raw);
        return;
      } catch (err) {
        console.error('Failed to parse DB_FILE, seeding fresh database...', err);
      }
    }
    this.seedDefaultData();
  }

  public save(): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write to DB_FILE', err);
      throw new Error('Database write error');
    }
  }

  // ACID Transaction Support
  public beginTransaction(): void {
    // Deep clone state into transaction snapshot stack
    this.transactionStack.push(JSON.parse(JSON.stringify(dbData)));
  }

  public commit(): void {
    if (this.transactionStack.length === 0) {
      throw new Error('No active transaction to commit');
    }
    this.transactionStack.pop();
    this.save();
  }

  public rollback(): void {
    if (this.transactionStack.length === 0) {
      throw new Error('No active transaction to rollback');
    }
    const previous = this.transactionStack.pop()!;
    dbData = previous;
  }

  public getRawData(): DatabaseSchema {
    return dbData;
  }

  public seedDefaultData(): void {
    const defaultTenantId = 'tenant-001';
    const tenantBId = 'tenant-002'; // For multi-tenant isolation testing

    const salt = bcrypt.genSaltSync(10);
    const adminPasswordHash = bcrypt.hashSync('Admin@123456', salt);

    const initialRoles: RoleRecord[] = [
      {
        id: 'role-admin',
        tenantId: defaultTenantId,
        name: 'مدير النظام الكامل (Enterprise Admin)',
        permissions: [
          'Patients:View', 'Patients:Create', 'Patients:Edit', 'Patients:Delete',
          'Billing:View', 'Billing:Create', 'Billing:Approve',
          'Accounting:View', 'Accounting:Create', 'Accounting:Approve',
          'Inventory:View', 'Inventory:Create', 'Inventory:Edit',
          'Reports:View', 'Reports:Export',
          'Migration:View', 'Migration:Create', 'Migration:Commit',
          'Backup:View', 'Backup:Create', 'Backup:Restore',
          'Devices:View', 'Devices:Configure',
          'Control:View', 'Control:Configure',
          'Health:View', 'Support:View', 'Support:Create',
        ],
      },
      {
        id: 'role-doctor',
        tenantId: defaultTenantId,
        name: 'طبيب معالج (Physician)',
        permissions: [
          'Patients:View', 'Patients:Create',
          'Billing:View', 'Reports:View',
        ],
      },
      {
        id: 'role-accountant',
        tenantId: defaultTenantId,
        name: 'محاسب مالي (Financial Accountant)',
        permissions: [
          'Billing:View', 'Billing:Create',
          'Accounting:View', 'Accounting:Create', 'Accounting:Approve',
          'Reports:View', 'Reports:Export',
        ],
      },
    ];

    const initialTenants: TenantRecord[] = [
      {
        id: defaultTenantId,
        name: 'مجموعة مِعاف للرعاية الصحية والطبية',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: tenantBId,
        name: 'مركز الشفاء الطبي التخصصي (منشأة معزولة B)',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const initialOrgs: OrganizationRecord[] = [
      {
        id: 'org-001',
        tenantId: defaultTenantId,
        name: 'الإدارة المركزية للمستشفيات',
        code: 'MEAAF-HQ',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const initialBranches: BranchRecord[] = [
      {
        id: 'branch-001',
        tenantId: defaultTenantId,
        organizationId: 'org-001',
        name: 'الفرع الرئيسي - الرياض (العليا)',
        city: 'الرياض',
        phone: '0112345678',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'branch-002',
        tenantId: defaultTenantId,
        organizationId: 'org-001',
        name: 'فرع مجمع عيادات جدة',
        city: 'جدة',
        phone: '0129876543',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const initialDepts: DepartmentRecord[] = [
      { id: 'dept-001', tenantId: defaultTenantId, branchId: 'branch-001', name: 'قسم العيادات الخارجية', code: 'OPD' },
      { id: 'dept-002', tenantId: defaultTenantId, branchId: 'branch-001', name: 'قسم المحاسبة والمالية', code: 'FIN' },
      { id: 'dept-003', tenantId: defaultTenantId, branchId: 'branch-001', name: 'قسم الصيدلية والمستودع', code: 'PHARM' },
    ];

    const initialOffices: OfficeRecord[] = [
      { id: 'off-001', tenantId: defaultTenantId, departmentId: 'dept-001', name: 'عيادة الباطنية 1', roomNumber: '101' },
      { id: 'off-002', tenantId: defaultTenantId, departmentId: 'dept-001', name: 'عيادة الأطفال', roomNumber: '102' },
      { id: 'off-003', tenantId: defaultTenantId, departmentId: 'dept-002', name: 'مكتب أمين الصندوق الرئيسي', roomNumber: '201' },
    ];

    const initialDevices: DeviceRecord[] = [
      {
        id: 'dev-001',
        tenantId: defaultTenantId,
        officeId: 'off-003',
        deviceName: 'POS-CASHIER-01',
        deviceType: 'Workstation',
        osVersion: 'Windows 11 Pro Enterprise',
        ipAddress: '192.168.10.45',
        status: 'Online',
        lastSeenAt: new Date().toISOString(),
        assignedPrinter: 'Epson TM-T88VI Thermal Receipt Printer',
      },
      {
        id: 'dev-002',
        tenantId: defaultTenantId,
        officeId: 'off-001',
        deviceName: 'CLINIC-PC-101',
        deviceType: 'Workstation',
        osVersion: 'Windows 11 Pro',
        ipAddress: '192.168.10.60',
        status: 'Online',
        lastSeenAt: new Date().toISOString(),
        assignedPrinter: 'HP LaserJet Pro M404n',
      },
    ];

    const initialUsers: UserRecord[] = [
      {
        id: 'user-admin',
        tenantId: defaultTenantId,
        username: 'admin',
        displayName: 'مدير النظام (Enterprise Admin)',
        passwordHash: adminPasswordHash,
        roleId: 'role-admin',
        roleName: 'مدير النظام الكامل (Enterprise Admin)',
        isActive: true,
        isDeleted: false,
        failedLoginAttempts: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'user-doctor',
        tenantId: defaultTenantId,
        username: 'dr.khalid',
        displayName: 'د. خالد إبراهيم',
        passwordHash: adminPasswordHash,
        roleId: 'role-doctor',
        roleName: 'طبيب معالج (Physician)',
        isActive: true,
        isDeleted: false,
        failedLoginAttempts: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      // Tenant B isolated user
      {
        id: 'user-tenantB-admin',
        tenantId: tenantBId,
        username: 'admin_tenantB',
        displayName: 'مدير منشأة الشفاء (Tenant B)',
        passwordHash: adminPasswordHash,
        roleId: 'role-admin',
        roleName: 'مدير المنشأة B',
        isActive: true,
        isDeleted: false,
        failedLoginAttempts: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const initialPatients: PatientRecord[] = [
      {
        id: 'pat-1001',
        tenantId: defaultTenantId,
        branchId: 'branch-001',
        medicalNo: 'MED-1001',
        fullName: 'أحمد عبد الله المنصوري',
        phone: '0501234567',
        birthDate: '1985-06-15',
        gender: 'ذكر',
        address: 'الرياض - حي الملز',
        isDeleted: false,
        createdAt: '2026-01-10T10:00:00Z',
      },
      {
        id: 'pat-1002',
        tenantId: defaultTenantId,
        branchId: 'branch-001',
        medicalNo: 'MED-1002',
        fullName: 'فاطمة محمد العتيبي',
        phone: '0559876543',
        birthDate: '1992-09-22',
        gender: 'أنثى',
        address: 'جدة - حي الروضة',
        isDeleted: false,
        createdAt: '2026-01-12T14:30:00Z',
      },
      // Tenant B isolated patient
      {
        id: 'pat-tenantB-01',
        tenantId: tenantBId,
        medicalNo: 'MED-B-001',
        fullName: 'مريض تجربة المنشأة المعزولة B',
        phone: '0599999999',
        gender: 'ذكر',
        isDeleted: false,
        createdAt: '2026-01-15T09:00:00Z',
      },
    ];

    const initialProducts: ProductRecord[] = [
      {
        id: 'prod-001',
        tenantId: defaultTenantId,
        sku: 'MED-PAN-500',
        name: 'بانادول 500 ملغ (أقراص)',
        unit: 'علبة',
        costCents: 1200, // 12.00 SAR
        priceCents: 1850, // 18.50 SAR
        stock: 145,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'prod-002',
        tenantId: defaultTenantId,
        sku: 'MED-AMX-250',
        name: 'أموكسيسيلين 250 ملغ مضاد حيوي',
        unit: 'علبة',
        costCents: 2500,
        priceCents: 3600,
        stock: 62,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'prod-003',
        tenantId: defaultTenantId,
        sku: 'CLI-SRG-GLV',
        name: 'قفازات طبية معقمة لاتكس',
        unit: 'علبة 100 حبة',
        costCents: 3000,
        priceCents: 4500,
        stock: 28,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const initialInvoices: InvoiceRecord[] = [
      {
        id: 'inv-2026-0001',
        tenantId: defaultTenantId,
        branchId: 'branch-001',
        patientId: 'pat-1001',
        patientName: 'أحمد عبد الله المنصوري',
        invoiceNo: 'INV-2026-0001',
        invoiceDate: '2026-01-15',
        subtotalCents: 15000,
        discountCents: 0,
        taxCents: 2250,
        totalCents: 17250,
        status: 'Posted',
        lines: [
          {
            id: 'line-001',
            invoiceId: 'inv-2026-0001',
            description: 'كشف واستشارة طبية عامة',
            quantity: 1,
            unitPriceCents: 15000,
            totalCents: 15000,
          },
        ],
        journalEntryId: 'je-2026-0001',
        createdAt: '2026-01-15T11:00:00Z',
      },
    ];

    const initialJournals: JournalEntryRecord[] = [
      {
        id: 'je-2026-0001',
        tenantId: defaultTenantId,
        branchId: 'branch-001',
        entryNo: 'JV-2026-001',
        entryDate: '2026-01-15',
        description: 'قيد إيراد فاتورة INV-2026-0001 للمريض أحمد عبد الله المنصوري',
        isApproved: true,
        approvedAt: '2026-01-15T11:05:00Z',
        approvedBy: 'user-admin',
        createdAt: '2026-01-15T11:00:00Z',
        lines: [
          {
            id: 'jl-001',
            journalEntryId: 'je-2026-0001',
            lineNo: 1,
            accountCode: '1000',
            accountName: 'الصندوق والبنك',
            debitCents: 17250,
            creditCents: 0,
          },
          {
            id: 'jl-002',
            journalEntryId: 'je-2026-0001',
            lineNo: 2,
            accountCode: '4000',
            accountName: 'إيرادات الخدمات الطبية',
            debitCents: 0,
            creditCents: 17250,
          },
        ],
      },
    ];

    const initialAudits: AuditRecord[] = [
      {
        id: 'aud-001',
        tenantId: defaultTenantId,
        userId: 'user-admin',
        userName: 'مدير النظام',
        action: 'SystemInit',
        resource: 'Core.System',
        details: 'تهيئة قاعدة البيانات المركزية للمنظومة والهيكل المؤسسي',
        atUtc: '2026-01-01T00:00:00Z',
      },
    ];

    const initialLicenses: LicenseRecord[] = [
      {
        id: 'lic-001',
        tenantId: defaultTenantId,
        licenseKey: 'MEAAF-ENT-2026-PROD-998811',
        plan: 'Enterprise',
        status: 'Active',
        maxUsers: 50,
        maxDevices: 25,
        expiresAt: '2027-12-31T23:59:59Z',
        modules: ['Patients', 'Billing', 'Accounting', 'Inventory', 'Reports', 'Migration', 'Devices', 'Control'],
      },
    ];

    const initialTickets: SupportTicketRecord[] = [
      {
        id: 'tkt-001',
        tenantId: defaultTenantId,
        userId: 'user-admin',
        userName: 'مدير النظام',
        title: 'طلب تكوين طابعة الفواتير الحرارية الجديدة',
        description: 'يرجى التأكد من ربط طابعة Epson TM-T88VI بنقطة البيع في فرع الرياض.',
        severity: 'Medium',
        status: 'Resolved',
        createdAt: '2026-01-16T12:00:00Z',
      },
    ];

    dbData = {
      tenants: initialTenants,
      organizations: initialOrgs,
      branches: initialBranches,
      departments: initialDepts,
      offices: initialOffices,
      devices: initialDevices,
      users: initialUsers,
      roles: initialRoles,
      patients: initialPatients,
      products: initialProducts,
      invoices: initialInvoices,
      journalEntries: initialJournals,
      auditLogs: initialAudits,
      licenses: initialLicenses,
      supportTickets: initialTickets,
      migrationJobs: [],
    };

    this.save();
  }
}

export const db = EnterpriseDatabase.getInstance();
