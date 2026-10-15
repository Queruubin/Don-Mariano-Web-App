import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BranchState {
  /** Branch a super admin is acting in (PRD FR-3). Unused for branch users. */
  selectedBranchId: number | null;
  setSelectedBranchId: (id: number | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),
    }),
    { name: 'don-mariano-branch' },
  ),
);
