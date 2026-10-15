import { Store } from 'lucide-react';
import { useEffect, useId } from 'react';
import { useBranchOptions } from '../hooks/useBranches';
import { useBranchStore } from '../store/branchStore';

/** Super admin picks the branch to act in (PRD FR-3). Sent as `X-Branch-Id` by the API client. */
export function BranchSelector() {
  const id = useId();
  const { data: branches, isLoading, isError } = useBranchOptions();
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);

  // Keep a valid selection: default to the first branch, drop one that no longer exists.
  useEffect(() => {
    if (!branches) return;
    const stillValid = branches.some((branch) => branch.id === selectedBranchId);
    if (!stillValid) setSelectedBranchId(branches[0]?.id ?? null);
  }, [branches, selectedBranchId, setSelectedBranchId]);

  if (isError) {
    return <p className="font-semibold text-danger">No pudimos cargar las sedes.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="flex items-center gap-1 font-bold text-text-muted">
        <Store aria-hidden="true" className="size-5" />
        Sede
      </label>
      <select
        id={id}
        className="input w-full py-1 sm:w-56"
        value={selectedBranchId ?? ''}
        disabled={isLoading || !branches?.length}
        onChange={(event) => setSelectedBranchId(Number(event.target.value))}
      >
        {isLoading && <option value="">Cargando sedes…</option>}
        {branches?.length === 0 && <option value="">No hay sedes activas</option>}
        {branches?.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
