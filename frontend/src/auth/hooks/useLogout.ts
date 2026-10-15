import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useBranchStore } from '../../branches/store/branchStore';
import { useAuthStore } from '../store/authStore';

/** Log out and forget everything cached for this user. */
export function useLogout() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const setSelectedBranchId = useBranchStore((s) => s.setSelectedBranchId);

  return useCallback(() => {
    logout();
    setSelectedBranchId(null);
    queryClient.clear();
  }, [logout, setSelectedBranchId, queryClient]);
}
