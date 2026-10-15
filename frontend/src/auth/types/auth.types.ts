export type Role = 'super_admin' | 'branch_admin' | 'branch_staff';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  branch: number | null;
  branch_name: string | null;
  is_active: boolean;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
