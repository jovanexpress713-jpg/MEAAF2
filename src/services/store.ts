import {
  User,
  Tenant,
  Patient,
  Invoice,
  JournalEntry,
  Product,
  AuditRecord,
  MigrationJob,
  StagedRow,
  PatientFieldMapping,
  ValidationIssue,
} from '../types';

const STORAGE_KEY = 'MEAAF_SYSTEM_STATE_V1';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000002';

const INITIAL_TENANT: Tenant = {
  id: DEFAULT_TENANT_ID,
  name: 'المنشأة الطبية الرئيسية',
  isActive: true,
};

const INITIAL_USER: User = {
  id: DEFAULT_USER_ID,
  tenantId: DEFAULT_TENANT_ID,
  username: 'admin',
  displayName: 'مدير النظام الرئيسي',
  isActive: true,
  roleName: 'مدير النظام',
  // Default password "Admin@123456" (meets 12 char minimum rule)
  passwordHash: 'Admin@123456',
};

const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat-001',
    tenantId: DEFAULT_TENANT_ID,
    medicalNo: 'MED-1001',
    fullName: 'أحمد عبد الله المنصوري',
    phone: '0501234567',
    birthDate: '1985-06-15',
    gender: 'ذكر',
    address: 'الرياض - حي الملز',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'pat-002',
    tenantId: DEFAULT_TENANT_ID,
    medicalNo: 'MED-1002',
    fullName: 'فاطمة محمد العتيبي',
    phone: '0559876543',
    birthDate: '1992-09-22',
    gender: 'أنثى',
    address: 'جدة - حي الروضة',
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: 'pat-003',
    tenantId: DEFAULT_TENANT_ID,
    medicalNo: 'MED-1003',
    fullName: 'سعيد بن ناصر الغامدي',
    phone: '0543219876',
    birthDate: '1978-01-10',
    gender: 'ذكر',
    address: 'الدمام - حي الشاطئ',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'pat-004',
    tenantId: DEFAULT_TENANT_ID,
    medicalNo: 'MED-1004',
    fullName: 'نورة سليمان الدوسري',
    phone: '0567788990',
    birthDate: '2000-04-18',
    gender: 'أنثى',
    address: 'الرياض - حي النخيل',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    tenantId: DEFAULT_TENANT_ID,
    sku: 'MED-PAN-500',
    name: 'بانادول 500 ملغ (أقراص)',
    unit: 'علبة',
    cost: 12.0,
    price: 18.5,
    stock: 145,
    isActive: true,
  },
  {
    id: 'prod-002',
    tenantId: DEFAULT_TENANT_ID,
    sku: 'MED-AMX-250',
    name: 'أموكسيسيلين 250 ملغ مضاد حيوي',
    unit: 'علبة',
    cost: 25.0,
    price: 36.0,
    stock: 62,
    isActive: true,
  },
  {
    id: 'prod-003',
    tenantId: DEFAULT_TENANT_ID,
    sku: 'CLI-SRG-GLV',
    name: 'قفازات طبية معقمة (لاتكس مقاس M)',
    unit: 'علبة 100 حبة',
    cost: 30.0,
    price: 45.0,
    stock: 28,
    isActive: true,
  },
  {
    id: 'prod-004',
    tenantId: DEFAULT_TENANT_ID,
    sku: 'CLI-SYR-05M',
    name: 'حقن طبية أحادية الاستخدام 5 مل',
    unit: 'كرتون 50 حبة',
    cost: 18.0,
    price: 28.0,
    stock: 12, // Low stock indicator
    isActive: true,
  },
  {
    id: 'prod-005',
    tenantId: DEFAULT_TENANT_ID,
    sku: 'SRV-DOC-GEN',
    name: 'كشف واستشارة طبية عامة',
    unit: 'جلسة',
    cost: 0.0,
    price: 150.0,
    stock: 999,
    isActive: true,
  },
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    tenantId: DEFAULT_TENANT_ID,
    patientId: 'pat-001',
    patientName: 'أحمد عبد الله المنصوري',
    invoiceNo: 'INV-2026-0001',
    invoiceDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    subtotal: 150.0,
    discount: 0.0,
    tax: 22.5,
    total: 172.5,
    status: 'Posted',
    lines: [
      {
        id: 'line-001',
        description: 'كشف واستشارة طبية عامة',
        quantity: 1,
        unitPrice: 150.0,
        total: 150.0,
      },
    ],
    journalEntryId: 'je-001',
  },
  {
    id: 'inv-002',
    tenantId: DEFAULT_TENANT_ID,
    patientId: 'pat-002',
    patientName: 'فاطمة محمد العتيبي',
    invoiceNo: 'INV-2026-0002',
    invoiceDate: new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10),
    subtotal: 222.0,
    discount: 22.0,
    tax: 30.0,
    total: 230.0,
    status: 'Posted',
    lines: [
      {
        id: 'line-002',
        description: 'كشف واستشارة طبية عامة',
        quantity: 1,
        unitPrice: 150.0,
        total: 150.0,
      },
      {
        id: 'line-003',
        description: 'أموكسيسيلين 250 ملغ مضاد حيوي',
        quantity: 2,
        unitPrice: 36.0,
        total: 72.0,
      },
    ],
    journalEntryId: 'je-002',
  },
];

const INITIAL_JOURNALS: JournalEntry[] = [
  {
    id: 'je-001',
    tenantId: DEFAULT_TENANT_ID,
    entryNo: 'JV-2026-001',
    entryDate: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    description: 'قيد إيراد فاتورة رقم INV-2026-0001',
    isApproved: true,
    approvedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    approvedBy: DEFAULT_USER_ID,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lines: [
      {
        id: 'jl-001',
        journalEntryId: 'je-001',
        lineNo: 1,
        accountCode: '1000',
        accountName: 'الصندوق والبنك',
        debit: 172.5,
        credit: 0,
      },
      {
        id: 'jl-002',
        journalEntryId: 'je-001',
        lineNo: 2,
        accountCode: '4000',
        accountName: 'إيرادات الخدمات الطبية',
        debit: 0,
        credit: 172.5,
      },
    ],
  },
  {
    id: 'je-002',
    tenantId: DEFAULT_TENANT_ID,
    entryNo: 'JV-2026-002',
    entryDate: new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10),
    description: 'قيد إيراد فاتورة رقم INV-2026-0002',
    isApproved: true,
    approvedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    approvedBy: DEFAULT_USER_ID,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    lines: [
      {
        id: 'jl-003',
        journalEntryId: 'je-002',
        lineNo: 1,
        accountCode: '1000',
        accountName: 'الصندوق والبنك',
        debit: 230.0,
        credit: 0,
      },
      {
        id: 'jl-004',
        journalEntryId: 'je-002',
        lineNo: 2,
        accountCode: '4000',
        accountName: 'إيرادات الخدمات الطبية',
        debit: 0,
        credit: 230.0,
      },
    ],
  },
  {
    id: 'je-003',
    tenantId: DEFAULT_TENANT_ID,
    entryNo: 'JV-2026-003',
    entryDate: new Date().toISOString().slice(0, 10),
    description: 'قيد تسوية مصاريف مستلزمات طبية تشغيلية (مسودة)',
    isApproved: false,
    createdAt: new Date().toISOString(),
    lines: [
      {
        id: 'jl-005',
        journalEntryId: 'je-003',
        lineNo: 1,
        accountCode: '5000',
        accountName: 'مصاريف تشغيلية',
        debit: 450.0,
        credit: 0,
      },
      {
        id: 'jl-006',
        journalEntryId: 'je-003',
        lineNo: 2,
        accountCode: '1000',
        accountName: 'الصندوق والبنك',
        debit: 0,
        credit: 450.0,
      },
    ],
  },
];

const INITIAL_AUDITS: AuditRecord[] = [
  {
    id: 'aud-001',
    tenantId: DEFAULT_TENANT_ID,
    userId: DEFAULT_USER_ID,
    userName: 'مدير النظام',
    action: 'Seed',
    resource: 'SetupService',
    details: 'تهيئة المنشأة والمستخدم الافتراضي وصلاحيات النظام',
    atUtc: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'aud-002',
    tenantId: DEFAULT_TENANT_ID,
    userId: DEFAULT_USER_ID,
    userName: 'مدير النظام',
    action: 'Create',
    resource: 'Billing.Invoices',
    recordId: 'INV-2026-0001',
    details: 'إصدار فاتورة للمريض أحمد عبد الله المنصوري بإجمالي 172.50',
    atUtc: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'aud-003',
    tenantId: DEFAULT_TENANT_ID,
    userId: DEFAULT_USER_ID,
    userName: 'مدير النظام',
    action: 'Approve',
    resource: 'Accounting.JournalEntries',
    recordId: 'JV-2026-001',
    details: 'اعتماد القيد المحاسبي بعد التحقق من توازن المدين والدائن',
    atUtc: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export interface SystemState {
  tenant: Tenant;
  users: User[];
  currentUser: User | null;
  patients: Patient[];
  products: Product[];
  invoices: Invoice[];
  journals: JournalEntry[];
  audits: AuditRecord[];
}

function loadState(): SystemState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        tenant: parsed.tenant || INITIAL_TENANT,
        users: parsed.users || [INITIAL_USER],
        currentUser: parsed.currentUser !== undefined ? parsed.currentUser : INITIAL_USER,
        patients: parsed.patients || INITIAL_PATIENTS,
        products: parsed.products || INITIAL_PRODUCTS,
        invoices: parsed.invoices || INITIAL_INVOICES,
        journals: parsed.journals || INITIAL_JOURNALS,
        audits: parsed.audits || INITIAL_AUDITS,
      };
    }
  } catch (err) {
    console.error('Failed to load state from localStorage', err);
  }

  return {
    tenant: INITIAL_TENANT,
    users: [INITIAL_USER],
    currentUser: INITIAL_USER,
    patients: INITIAL_PATIENTS,
    products: INITIAL_PRODUCTS,
    invoices: INITIAL_INVOICES,
    journals: INITIAL_JOURNALS,
    audits: INITIAL_AUDITS,
  };
}

let state: SystemState = loadState();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage', err);
  }
}

export const Store = {
  getState(): SystemState {
    return state;
  },

  resetDefaults() {
    state = {
      tenant: INITIAL_TENANT,
      users: [INITIAL_USER],
      currentUser: INITIAL_USER,
      patients: INITIAL_PATIENTS,
      products: INITIAL_PRODUCTS,
      invoices: INITIAL_INVOICES,
      journals: INITIAL_JOURNALS,
      audits: [
        ...INITIAL_AUDITS,
        {
          id: 'aud-' + Date.now(),
          tenantId: DEFAULT_TENANT_ID,
          userId: DEFAULT_USER_ID,
          userName: 'مدير النظام',
          action: 'Reset',
          resource: 'System',
          details: 'إعادة ضبط النظام إلى البيانات التأسيسية',
          atUtc: new Date().toISOString(),
        },
      ],
    };
    persist();
  },

  // Auth & Session
  getCurrentUser(): User | null {
    return state.currentUser;
  },

  login(username: string, password: string): { success: boolean; error?: string } {
    const trimmed = username.trim().toLowerCase();
    const user = state.users.find(
      (u) => u.username.toLowerCase() === trimmed && u.isActive
    );

    if (!user) {
      return { success: false, error: 'اسم المستخدم غير موجود أو غير مفعل.' };
    }

    // Verify password: check stored hash or initial default
    if (user.passwordHash && user.passwordHash !== password) {
      return { success: false, error: 'كلمة المرور غير صحيحة.' };
    }

    state.currentUser = user;
    this.addAudit('Login', 'Core.Users', user.id, `تسجيل دخول ناجح للمستخدم: ${user.username}`);
    persist();
    return { success: true };
  },

  logout() {
    if (state.currentUser) {
      this.addAudit('Logout', 'Core.Users', state.currentUser.id, `تسجيل خروج المستخدم`);
    }
    state.currentUser = null;
    persist();
  },

  changePassword(currentPassword: string, newPassword: string): { success: boolean; error?: string } {
    if (!state.currentUser) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً.' };
    }

    const user = state.users.find((u) => u.id === state.currentUser?.id);
    if (!user) {
      return { success: false, error: 'المستخدم الحالي غير موجود.' };
    }

    if (user.passwordHash && user.passwordHash !== currentPassword) {
      return { success: false, error: 'كلمة المرور الحالية غير مطابقة.' };
    }

    if (!newPassword || newPassword.length < 12) {
      return { success: false, error: 'كلمة المرور الجديدة يجب أن تتكون من 12 حرفاً على الأقل.' };
    }

    if (newPassword === currentPassword) {
      return { success: false, error: 'اختر كلمة مرور جديدة مختلفة عن الحالية.' };
    }

    user.passwordHash = newPassword;
    state.currentUser = { ...user };
    this.addAudit('ChangePassword', 'Core.Users', user.id, 'تم تغيير كلمة المرور بنجاح للمستخدم');
    persist();
    return { success: true };
  },

  hasPermission(resource: string, action: string): boolean {
    if (!state.currentUser) return false;
    // Admin has full permissions
    return true;
  },

  // Auditing
  addAudit(action: string, resource: string, recordId?: string, details: string = '') {
    const rec: AuditRecord = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      tenantId: state.tenant.id,
      userId: state.currentUser?.id,
      userName: state.currentUser?.displayName || 'نظام',
      action,
      resource,
      recordId,
      details,
      atUtc: new Date().toISOString(),
    };
    state.audits.unshift(rec);
    if (state.audits.length > 500) state.audits.pop();
  },

  // Patients
  searchPatients(query: string = ''): Patient[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...state.patients];
    return state.patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.medicalNo.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q))
    );
  },

  createPatient(data: Omit<Patient, 'id' | 'tenantId' | 'createdAt'>): Patient {
    if (!data.fullName?.trim()) throw new Error('اسم المريض مطلوب.');
    if (!data.medicalNo?.trim()) throw new Error('رقم الملف الطبي مطلوب.');

    const exists = state.patients.some(
      (p) => p.medicalNo.trim().toLowerCase() === data.medicalNo.trim().toLowerCase()
    );
    if (exists) {
      throw new Error(`رقم الملف الطبي "${data.medicalNo}" مسجل مسبقاً لمريض آخر.`);
    }

    const patient: Patient = {
      id: 'pat-' + Date.now(),
      tenantId: state.tenant.id,
      medicalNo: data.medicalNo.trim(),
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || '',
      birthDate: data.birthDate,
      gender: data.gender || 'غير محدد',
      address: data.address?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    state.patients.unshift(patient);
    this.addAudit('Create', 'Core.Patients', patient.id, `إنشاء ملف مريض جديد: ${patient.fullName} (${patient.medicalNo})`);
    persist();
    return patient;
  },

  // Invoices & Billing
  createInvoice(
    patientId: string,
    description: string,
    quantity: number,
    unitPrice: number,
    discount: number = 0
  ): Invoice {
    const patient = state.patients.find((p) => p.id === patientId);
    if (!patient) throw new Error('المريض المحدد غير موجود.');
    if (quantity <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر.');
    if (unitPrice < 0) throw new Error('السعر لا يمكن أن يكون سالباً.');

    const subtotal = Math.round(quantity * unitPrice * 100) / 100;
    if (discount < 0 || discount > subtotal) {
      throw new Error('قيمة الخصم غير صالحة.');
    }

    // 15% standard tax on net amount
    const netAmount = subtotal - discount;
    const tax = Math.round(netAmount * 0.15 * 100) / 100;
    const total = Math.round((netAmount + tax) * 100) / 100;

    const invoiceNo = `INV-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(4, '0')}`;
    const invoiceId = 'inv-' + Date.now();

    // In MEAAF architecture: An invoice creates a Draft Journal Entry automatically
    const entryNo = `JV-${new Date().getFullYear()}-${String(state.journals.length + 1).padStart(3, '0')}`;
    const journalId = 'je-' + Date.now();

    const draftJournal: JournalEntry = {
      id: journalId,
      tenantId: state.tenant.id,
      entryNo,
      entryDate: new Date().toISOString().slice(0, 10),
      description: `قيد مسودة صادر آلياً للفاتورة ${invoiceNo} - ${patient.fullName}`,
      isApproved: false,
      createdAt: new Date().toISOString(),
      lines: [
        {
          id: 'jl-' + Date.now() + '-1',
          journalEntryId: journalId,
          lineNo: 1,
          accountCode: '1000',
          accountName: 'الصندوق والبنك',
          debit: total,
          credit: 0,
        },
        {
          id: 'jl-' + Date.now() + '-2',
          journalEntryId: journalId,
          lineNo: 2,
          accountCode: '4000',
          accountName: 'إيرادات الخدمات الطبية',
          debit: 0,
          credit: total,
        },
      ],
    };

    const invoice: Invoice = {
      id: invoiceId,
      tenantId: state.tenant.id,
      patientId: patient.id,
      patientName: patient.fullName,
      invoiceNo,
      invoiceDate: new Date().toISOString().slice(0, 10),
      subtotal,
      discount,
      tax,
      total,
      status: 'Posted',
      lines: [
        {
          id: 'line-' + Date.now(),
          description,
          quantity,
          unitPrice,
          total: subtotal,
        },
      ],
      journalEntryId: journalId,
    };

    state.journals.unshift(draftJournal);
    state.invoices.unshift(invoice);

    this.addAudit('Create', 'Billing.Invoices', invoice.id, `إصدار فاتورة رقم ${invoiceNo} بمبلغ ${total.toFixed(2)} ر.س`);
    this.addAudit('AutoDraft', 'Accounting.JournalEntries', journalId, `إنشاء قيد محاسبي مسودة ${entryNo} للفاتورة ${invoiceNo}`);
    persist();
    return invoice;
  },

  // Accounting
  postJournalEntry(
    description: string,
    lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }>,
    entryDate: string = new Date().toISOString().slice(0, 10)
  ): JournalEntry {
    if (!description.trim()) throw new Error('بيان القيد مطلوب.');
    if (!lines || lines.length < 2) throw new Error('القيد المحاسبي يجب أن يحتوي على طرفين على الأقل.');

    let totalDebit = 0;
    let totalCredit = 0;

    for (const l of lines) {
      if (l.debit < 0 || l.credit < 0) throw new Error('المبالغ يجب ألا تكون سالبة.');
      if (l.debit > 0 && l.credit > 0) throw new Error('لا يمكن تسجيل مدين ودائن في نفس سطر القيد.');
      totalDebit += l.debit;
      totalCredit += l.credit;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`القيد غير متوازن! إجمالي المدين (${totalDebit.toFixed(2)}) لا يساوي إجمالي الدائن (${totalCredit.toFixed(2)}).`);
    }

    const entryNo = `JV-${new Date().getFullYear()}-${String(state.journals.length + 1).padStart(3, '0')}`;
    const id = 'je-' + Date.now();

    const entry: JournalEntry = {
      id,
      tenantId: state.tenant.id,
      entryNo,
      entryDate,
      description: description.trim(),
      isApproved: false, // Always starts as Draft in MEAAF
      createdAt: new Date().toISOString(),
      lines: lines.map((l, index) => ({
        id: 'jl-' + Date.now() + '-' + index,
        journalEntryId: id,
        lineNo: index + 1,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: l.debit,
        credit: l.credit,
      })),
    };

    state.journals.unshift(entry);
    this.addAudit('Post', 'Accounting.JournalEntries', id, `تسجيل قيد محاسبي مسودة رقم ${entryNo} بمبلغ ${totalDebit.toFixed(2)} ر.س`);
    persist();
    return entry;
  },

  approveJournalEntry(id: string): JournalEntry {
    const entry = state.journals.find((j) => j.id === id);
    if (!entry) throw new Error('القيد غير موجود.');
    if (entry.isApproved) throw new Error('القيد معتمد مسبقاً.');

    // Verify balance before approving
    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('لا يمكن اعتماد قيد غير متوازن.');
    }

    entry.isApproved = true;
    entry.approvedAt = new Date().toISOString();
    entry.approvedBy = state.currentUser?.id;

    this.addAudit('Approve', 'Accounting.JournalEntries', id, `اعتماد القيد المحاسبي رقم ${entry.entryNo}`);
    persist();
    return entry;
  },

  // Inventory
  createProduct(data: Omit<Product, 'id' | 'tenantId' | 'stock'>): Product {
    if (!data.name.trim()) throw new Error('اسم المنتج مطلوب.');
    if (!data.sku.trim()) throw new Error('رمز الصنف (SKU) مطلوب.');

    const exists = state.products.some(
      (p) => p.sku.trim().toLowerCase() === data.sku.trim().toLowerCase()
    );
    if (exists) throw new Error(`رمز الصنف (SKU) "${data.sku}" موجود مسبقاً.`);

    const prod: Product = {
      id: 'prod-' + Date.now(),
      tenantId: state.tenant.id,
      sku: data.sku.trim(),
      name: data.name.trim(),
      unit: data.unit.trim() || 'قطعة',
      cost: Number(data.cost) || 0,
      price: Number(data.price) || 0,
      stock: 0,
      isActive: true,
    };

    state.products.unshift(prod);
    this.addAudit('Create', 'Inventory.Products', prod.id, `إضافة منتج جديد للمخزون: ${prod.name} (${prod.sku})`);
    persist();
    return prod;
  },

  addStock(productId: string, quantity: number): Product {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) throw new Error('المنتج غير موجود.');
    if (quantity <= 0) throw new Error('كمية التوريد يجب أن تكون أكبر من صفر.');

    prod.stock += quantity;
    this.addAudit(
      'AddStock',
      'Inventory.Products',
      prod.id,
      `توريد مخزني: إضافة ${quantity} ${prod.unit} للمنتج ${prod.name}. الرصيد الجديد: ${prod.stock}`
    );
    persist();
    return prod;
  },

  // Reports
  getDashboardStats(): { patients: number; revenue: number; debit: number; credit: number } {
    // Exactly matches ReportService.cs in MEAAF:
    // 1. Patient count where IsDeleted = 0
    // 2. Sum(Total) from Invoices where Status = 'Posted'
    // 3. Sum(Debit) from JournalLines where entry isApproved = 1
    // 4. Sum(Credit) from JournalLines where entry isApproved = 1
    const patients = state.patients.length;
    const revenue = state.invoices
      .filter((i) => i.status === 'Posted')
      .reduce((sum, i) => sum + i.total, 0);

    const approvedJournals = state.journals.filter((j) => j.isApproved);
    let debit = 0;
    let credit = 0;
    for (const j of approvedJournals) {
      for (const l of j.lines) {
        debit += l.debit;
        credit += l.credit;
      }
    }

    return {
      patients,
      revenue,
      debit,
      credit,
    };
  },

  // Migration Service
  discoverSource(sourceName: string = 'SQLServer: Legacy_Clinic_DB'): {
    jobId: string;
    tables: string[];
  } {
    const jobId = 'mig-' + Date.now();
    this.addAudit('Discover', 'Migration.Jobs', jobId, `اكتشاف جداول مصدر الترحيل: ${sourceName}`);
    return {
      jobId,
      tables: ['LegacyPatients', 'PatientArchive', 'OldMedicalRecords'],
    };
  },

  getSampleStagedRows(sourceTable: string): StagedRow[] {
    return [
      {
        rowNumber: 1,
        payload: {
          FileNumber: 'IMP-2001',
          PatientName: 'خالد عبد الرحمن السالم',
          Mobile: '0509988771',
          DOB: '1988-03-12',
          Sex: 'ذكر',
          City: 'الرياض',
        },
      },
      {
        rowNumber: 2,
        payload: {
          FileNumber: 'IMP-2002',
          PatientName: 'منى صالح الزهراني',
          Mobile: '0554433221',
          DOB: '1995-11-20',
          Sex: 'أنثى',
          City: 'جدة',
        },
      },
      {
        rowNumber: 3,
        payload: {
          FileNumber: 'IMP-2003',
          PatientName: 'عبد العزيز فهد الشمري',
          Mobile: '0561122334',
          DOB: '1982-08-05',
          Sex: 'ذكر',
          City: 'حائل',
        },
      },
      {
        rowNumber: 4,
        payload: {
          FileNumber: 'MED-1001', // Duplicate intentionally for validation demonstration
          PatientName: 'أحمد عبد الله المنصوري',
          Mobile: '0501234567',
          DOB: '1985-06-15',
          Sex: 'ذكر',
          City: 'الرياض',
        },
      },
      {
        rowNumber: 5,
        payload: {
          FileNumber: '', // Missing medical number for validation demonstration
          PatientName: 'سامي طارق الحارثي',
          Mobile: '0547788991',
          DOB: '1990-05-10',
          Sex: 'ذكر',
          City: 'الطائف',
        },
      },
    ];
  },

  validatePatientMigration(
    stagedRows: StagedRow[],
    mapping: PatientFieldMapping
  ): {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    issues: ValidationIssue[];
    validData: Patient[];
  } {
    const issues: ValidationIssue[] = [];
    const validData: Patient[] = [];

    const existingMedicalNos = new Set(
      state.patients.map((p) => p.medicalNo.toLowerCase())
    );

    stagedRows.forEach((row) => {
      const p = row.payload;
      const medNo = String(p[mapping.medicalNoCol] || '').trim();
      const name = String(p[mapping.fullNameCol] || '').trim();

      if (!medNo) {
        issues.push({
          rowNumber: row.rowNumber,
          error: `حقل رقم الملف الطبي (${mapping.medicalNoCol}) فارغ.`,
        });
        return;
      }

      if (!name) {
        issues.push({
          rowNumber: row.rowNumber,
          error: `حقل اسم المريض (${mapping.fullNameCol}) فارغ.`,
        });
        return;
      }

      if (existingMedicalNos.has(medNo.toLowerCase())) {
        issues.push({
          rowNumber: row.rowNumber,
          error: `رقم الملف الطبي "${medNo}" موجود مسبقاً في قاعدة بيانات النظام.`,
        });
        return;
      }

      validData.push({
        id: 'pat-mig-' + Date.now() + '-' + row.rowNumber,
        tenantId: state.tenant.id,
        medicalNo: medNo,
        fullName: name,
        phone: mapping.phoneCol ? String(p[mapping.phoneCol] || '').trim() : '',
        birthDate: mapping.birthDateCol ? String(p[mapping.birthDateCol] || '').trim() : undefined,
        gender: mapping.genderCol ? String(p[mapping.genderCol] || '').trim() : 'غير محدد',
        address: mapping.addressCol ? String(p[mapping.addressCol] || '').trim() : '',
        createdAt: new Date().toISOString(),
      });
    });

    return {
      totalRows: stagedRows.length,
      validRows: validData.length,
      invalidRows: issues.length,
      issues,
      validData,
    };
  },

  commitPatients(validPatients: Patient[]): number {
    if (!validPatients.length) return 0;

    state.patients.unshift(...validPatients);
    this.addAudit(
      'Commit',
      'Migration.Patients',
      undefined,
      `ترحيل واستيراد ذري لـ ${validPatients.length} مريض من المصدر المؤقت staging`
    );
    persist();
    return validPatients.length;
  },

  // Backup & Export
  exportBackupJson(): string {
    const backup = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      state,
    };
    this.addAudit('Backup', 'System.Backup', undefined, 'تصدير نسخة احتياطية كاملة من بيانات المنظومة');
    persist();
    return JSON.stringify(backup, null, 2);
  },

  restoreBackupJson(jsonString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.state || !parsed.state.tenant) {
        return { success: false, error: 'ملف النسخة الاحتياطية غير صالح أو تالف.' };
      }
      state = parsed.state;
      this.addAudit('Restore', 'System.Backup', undefined, 'استعادة المنظومة من نسخة احتياطية');
      persist();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطأ أثناء قراءة ملف النسخة الاحتياطية.' };
    }
  },
};
