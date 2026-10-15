import { Building2, ClipboardList, Package, Users, type LucideIcon } from 'lucide-react';
import type { Role } from '../auth/types/auth.types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
}

const ALL_ROLES: readonly Role[] = ['super_admin', 'branch_admin', 'branch_staff'];

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Domicilios', icon: ClipboardList, roles: ALL_ROLES },
  { to: '/catalog', label: 'Catálogo', icon: Package, roles: ALL_ROLES },
  { to: '/users', label: 'Usuarios', icon: Users, roles: ['super_admin', 'branch_admin'] },
  { to: '/branches', label: 'Sedes', icon: Building2, roles: ['super_admin'] },
];

export function navItemsFor(role: Role | undefined | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
