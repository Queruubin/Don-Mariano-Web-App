import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '../types/auth.types';
import { useAuthStore } from '../store/authStore';

/** Sends users without one of `roles` back home. The backend enforces the same rules. */
export function RequireRole({ roles }: { roles: readonly Role[] }) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
