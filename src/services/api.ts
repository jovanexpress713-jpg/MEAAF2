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
  discoverMigration: (sourceName?: string) =>
    request<any>('/migration/discover', {
      method: 'POST',
      body: JSON.stringify({ sourceName }),
    }),

  commitMigration: (jobId: string, patients: any[]) =>
    request<any>('/migration/commit', {
      method: 'POST',
      body: JSON.stringify({ jobId, patients }),
    }),

  // Backup & Audit
  exportBackup: () => request<any>('/backup/export'),

  resetBackup: () =>
    request<any>('/backup/reset', {
      method: 'POST',
    }),

  getAuditLogs: () => request<any[]>('/audit'),
};
