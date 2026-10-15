import type { Role } from './types/auth.types';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Administrador general',
  branch_admin: 'Administrador de sede',
  branch_staff: 'Personal de sede',
};

/** Branch admins and super admins manage the catalog and staff (PRD section 3). */
export function isAdminRole(role: Role | undefined | null): boolean {
  return role === 'super_admin' || role === 'branch_admin';
}

export function canManageCatalog(role: Role | undefined | null): boolean {
  return isAdminRole(role);
}
