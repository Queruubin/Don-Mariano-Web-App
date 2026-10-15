import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../auth/store/authStore';
import { branchService } from '../services/branchService';
import { useBranchStore } from '../store/branchStore';

export const branchKeys = {
  all: ['branches'] as const,
};

/** Active branches for the super admin selector. Disabled for branch users. */
export function useBranchOptions() {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');
  return useQuery({
    queryKey: branchKeys.all,
    queryFn: branchService.listAll,
    enabled: isSuperAdmin,
    select: (branches) => branches.filter((branch) => branch.is_active),
    staleTime: 5 * 60_000,
  });
}

export interface ActiveBranch {
  id: number | null;
  name: string | null;
  /** True while a super admin's branch list is still loading. */
  isLoading: boolean;
}

/** The branch the current user acts in: their own, or the one a super admin picked. */
export function useActiveBranch(): ActiveBranch {
  const user = useAuthStore((s) => s.user);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const { data: branches, isLoading } = useBranchOptions();

  if (user?.role !== 'super_admin') {
    return { id: user?.branch ?? null, name: user?.branch_name ?? null, isLoading: false };
  }
  const selected = branches?.find((branch) => branch.id === selectedBranchId);
  return { id: selected?.id ?? null, name: selected?.name ?? null, isLoading };
}
