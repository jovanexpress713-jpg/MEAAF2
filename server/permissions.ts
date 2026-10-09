// Canonical permission catalog. Every role permission must be one of these "Resource:Action" keys.
export const PERMISSION_CATALOG: Record<string, string[]> = {
  Patients: ['View', 'Create', 'Edit', 'Delete'],
  Billing: ['View', 'Create', 'Approve'],
  Accounting: ['View', 'Create', 'Approve'],
  Inventory: ['View', 'Create', 'Edit'],
  Reports: ['View', 'Export'],
  Migration: ['View', 'Create', 'Commit'],
  Backup: ['View', 'Create', 'Restore'],
  Devices: ['View', 'Configure'],
  Control: ['View', 'Configure'],
  Health: ['View'],
  Support: ['View', 'Create'],
  Users: ['View', 'Create', 'Edit', 'ResetPassword'],
};

export const ALL_PERMISSIONS: string[] = Object.entries(PERMISSION_CATALOG).flatMap(
  ([resource, actions]) => actions.map(a => `${resource}:${a}`)
);

export function isKnownPermission(p: string): boolean {
  return ALL_PERMISSIONS.includes(p);
}
