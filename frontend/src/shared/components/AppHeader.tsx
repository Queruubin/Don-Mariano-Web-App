import { LogOut, Store } from 'lucide-react';
import logo from '../../assets/logo_letter.png';
import { ROLE_LABELS } from '../../auth/roles';
import { useLogout } from '../../auth/hooks/useLogout';
import { useAuthStore } from '../../auth/store/authStore';
import { BranchSelector } from '../../branches/components/BranchSelector';

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="flex min-h-[4.5rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:px-6">
        <img src={logo} alt="Tiendas Don Mariano" className="h-12 w-auto" />

        <div className="order-last w-full sm:order-none sm:w-auto">
          {user?.role === 'super_admin' ? (
            <BranchSelector />
          ) : (
            user?.branch_name && (
              <p className="flex items-center gap-2 font-bold text-text-muted">
                <Store aria-hidden="true" className="size-5" />
                {user.branch_name}
              </p>
            )
          )}
        </div>

        {/* Zero basis keeps this group on the logo's row on narrow phones; long names truncate. */}
        <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-2">
          {user && (
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate font-bold">{user.name}</p>
              <p className="truncate text-sm text-text-muted">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
          <button type="button" onClick={logout} className="btn btn-ghost shrink-0 px-3">
            <LogOut aria-hidden="true" className="size-5" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
