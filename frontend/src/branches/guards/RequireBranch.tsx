import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../auth/store/authStore';
import { ListSkeleton, NoBranchState } from '../../shared/components/StatusViews';
import { useActiveBranch } from '../hooks/useBranches';

/**
 * Renders branch-scoped pages only once a branch is active (PRD FR-2, FR-3).
 * Without one their queries stay disabled and the pages would load forever.
 * `standalone` is for screens without the app header (the print view): the
 * fallback gets its own padding and a way back to the app.
 */
export function RequireBranch({ standalone = false }: { standalone?: boolean }) {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');
  const branch = useActiveBranch();

  let fallback = null;
  if (branch.isLoading) fallback = <ListSkeleton />;
  else if (branch.id == null) {
    fallback = (
      <NoBranchState
        reason={isSuperAdmin ? 'pick' : 'unassigned'}
        actions={
          standalone && (
            <Link to="/domicilios" className="btn btn-primary">
              Ir a domicilios
            </Link>
          )
        }
      >
        {standalone ? 'Vuelva a Domicilios y elija la sede en la parte de arriba.' : undefined}
      </NoBranchState>
    );
  }
  if (!fallback) return <Outlet />;
  return standalone ? <div className="mx-auto max-w-xl p-4">{fallback}</div> : fallback;
}
