const API_BASE = '/api';

function getAuthToken(): string | null {
  return localStorage.getItem('MEAAF_AUTH_TOKEN');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('MEAAF_AUTH_TOKEN', token);
  } else {
    localStorage.removeItem('MEAAF_AUTH_TOKEN');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP Error ${response.status}`);
  }

  return data as T;
}

export const Api = {
  // Migration (file-based import)
  getMigrationEntities: () => request<any[]>('/migration/entities'),
  getMigrationJobs: () => request<any[]>('/migration/jobs'),
  stageMigration: (data: { entity: string; rows: Record<string, unknown>[]; sourceName: string; sourceType: 'CSV' | 'JSON' }) =>
    request<any>('/migration/jobs', { method: 'POST', body: JSON.stringify(data) }),
  commitMigration: (id: string) => request<any>(`/migration/jobs/${encodeURIComponent(id)}/commit`, { method: 'POST' }),
  discardMigration: (id: string) => request<any>(`/migration/jobs/${encodeURIComponent(id)}/discard`, { method: 'POST' }),

  // Offline sync
  syncPush: (deviceId: string, operations: Array<{ opId: string; type: string; payload: unknown }>) =>
    request<{ results: Array<{ opId: string; status: string; message: string; resultId?: string }>; cursor: number }>(
      '/sync/push',
      { method: 'POST', body: JSON.stringify({ deviceId, operations }) }
    ),
  syncPull: (since: number) => request<{ patients: any[]; cursor: number; hasMore: boolean }>(`/sync/pull?since=${since}`),

  // Billing actions
  getInvoicePayments: (id: string) => request<{ invoice: any; movements: any[] }>(`/billing/invoices/${encodeURIComponent(id)}/payments`),
  payInvoice: (id: string, data: { amount: number; method: string; reference?: string }) =>
    request<any>(`/billing/invoices/${encodeURIComponent(id)}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  refundInvoice: (id: string, data: { amount: number; reason: string }) =>
    request<any>(`/billing/invoices/${encodeURIComponent(id)}/refunds`, { method: 'POST', body: JSON.stringify(data) }),
  cancelInvoice: (id: string, data: { reason: string }) =>
    request<any>(`/billing/invoices/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify(data) }),

  // Accounting administration
  getAccounts: () => request<any[]>('/accounting/accounts'),
  createAccount: (data: { code: string; name: string; type: string }) =>
    request<any>('/accounting/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (code: string, data: { name?: string; isActive?: boolean }) =>
    request<any>(`/accounting/accounts/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getPeriods: () => request<any[]>('/accounting/periods'),
  closePeriod: (period: string) => request<any>(`/accounting/periods/${period}/close`, { method: 'POST' }),
  reopenPeriod: (period: string, reason: string) =>
    request<any>(`/accounting/periods/${period}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getTrialBalance: (asOf?: string) =>
    request<any>(`/accounting/trial-balance${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''}`),
  // Users & roles
  getUsers: () => request<any[]>('/users'),
  createUser: (data: { username: string; displayName: string; roleId: string }) =>
    request<{ user: any; temporaryPassword: string }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: { displayName?: string; roleId?: string; isActive?: boolean }) =>
    request<{ user: any }>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetUserPassword: (id: string) =>
    request<{ user: any; temporaryPassword: string }>(`/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
  unlockUser: (id: string) =>
    request<{ user: any }>(`/users/${encodeURIComponent(id)}/unlock`, { method: 'POST' }),
  getRoles: () => request<{ roles: any[]; catalog: Record<string, string[]> }>('/roles'),
  createRole: (data: { name: string; permissions: string[] }) =>
    request<{ role: any }>('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: { name?: string; permissions?: string[] }) =>
    request<{ role: any }>(`/roles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (id: string) =>
    request<{ success: boolean }>(`/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: any; tenant: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<{ user: any; tenant: any }>('/auth/me'),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Enterprise Hierarchy
  getHierarchy: () => request<any>('/hierarchy'),

  // Patients
  getPatients: (q?: string) => request<any[]>(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  createPatient: (data: any) =>
    request<any>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Billing
  getInvoices: () => request<any[]>('/billing/invoices'),

  createInvoice: (data: { patientId: string; description: string; quantity: number; unitPrice: number; discount?: number }) =>
    request<any>('/billing/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Accounting
  getJournalEntries: () => request<any[]>('/accounting/journal-entries'),

  postJournalEntry: (data: { description: string; entryDate?: string; lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }> }) =>
    request<any>('/accounting/journal-entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approveJournalEntry: (id: string) =>
    request<any>(`/accounting/journal-entries/${id}/approve`, {
      method: 'POST',
    }),

  // Inventory
  getProducts: () => request<any[]>('/inventory/products'),

  createProduct: (data: { sku: string; name: string; unit: string; cost: number; price: number }) =>
    request<any>('/inventory/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addStock: (id: string, quantity: number) =>
    request<any>(`/inventory/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ quantity }),
    }),

  // Reports
  getDashboardReports: () => request<{ patients: number; revenue: number; debit: number; credit: number }>('/reports/dashboard'),

  // Health Center
  getHealth: () => request<any>('/health'),

  // Devices
  getDevices: () => request<any[]>('/devices'),

  registerDevice: (data: any) =>
    request<any>('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Support
  getTickets: () => request<any[]>('/support/tickets'),

  createTicket: (data: { title: string; description: string; severity?: string }) =>
    request<any>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Migration
  // Backup & Audit
  exportBackup: () => request<any>('/backup/export'),

  resetBackup: () =>
    request<any>('/backup/reset', {
      method: 'POST',
    }),

  getAuditLogs: () => request<any[]>('/audit'),
};
