import type { Permission, Role } from '@/types';

const ROLE_BASE_PERMISSIONS: Record<Role, Permission[]> = {
  pi: [
    'manage_users',
    'manage_vendors',
    'upload_kb_docs',
    'assign_tasks',
    'approve_purchase_request',
    'view_financial_summary',
    'manage_locations',
    'manage_inventory',
    'manage_categories',
    'assign_permissions',
  ],
  researcher: ['assign_tasks', 'manage_inventory'],
  student: [],
};

export function hasPermission(
  role: Role,
  permission: Permission,
  extraPermissions: Permission[] = []
): boolean {
  return (
    ROLE_BASE_PERMISSIONS[role].includes(permission) ||
    extraPermissions.includes(permission)
  );
}

export function hasAnyPermission(
  role: Role,
  permissions: Permission[],
  extraPermissions: Permission[] = []
): boolean {
  return permissions.some((p) => hasPermission(role, p, extraPermissions));
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    pi: 'PI',
    researcher: 'Researcher',
    student: 'Student',
  };
  return labels[role];
}
