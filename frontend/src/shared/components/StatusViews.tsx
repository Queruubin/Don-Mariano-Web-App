import { CircleAlert, Store, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-alt text-text-muted">
        <Icon aria-hidden="true" className="size-8" />
      </span>
      <h2 className="text-xl">{title}</h2>
      {children && <div className="max-w-md text-text-muted">{children}</div>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 border-danger/40 px-6 py-10 text-center">
      <CircleAlert aria-hidden="true" className="size-10 text-danger" />
      <p className="text-lg font-bold">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="card flex animate-pulse items-center gap-4 p-4">
          <div className="h-5 flex-1 rounded-full bg-surface-alt" />
          <div className="h-8 w-20 rounded-full bg-surface-alt" />
        </div>
      ))}
    </div>
  );
}

export function PlaceholderPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="mb-4 text-3xl">{title}</h1>
      <div className="card p-6 text-lg text-text-muted">{children}</div>
    </div>
  );
}

/**
 * Shown instead of a branch-scoped page while no branch is active.
 * `reason` is "pick" for a super admin who has not chosen one yet, and
 * "unassigned" for a branch user whose account has no active branch.
 */
export function NoBranchState({
  reason = 'pick',
  actions,
  children,
}: {
  reason?: 'pick' | 'unassigned';
  actions?: ReactNode;
  /** Replaces the default hint, e.g. on screens without the header selector. */
  children?: ReactNode;
}) {
  if (reason === 'unassigned') {
    return (
      <EmptyState icon={Store} title="Su usuario no tiene una sede" actions={actions}>
        Pídale al administrador que le asigne una sede para poder trabajar.
      </EmptyState>
    );
  }
  return (
    <EmptyState icon={Store} title="Seleccione una sede para continuar" actions={actions}>
      {children ?? 'Elija la sede en el selector «Sede» de la parte de arriba de la pantalla.'}
    </EmptyState>
  );
}
