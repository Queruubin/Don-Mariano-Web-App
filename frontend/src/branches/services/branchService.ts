import api from '../../shared/utils/api';
import type { Paginated } from '../../shared/types';
import type { Branch } from '../types/branch.types';

export const branchService = {
  /** Every branch, following pagination. Super admin only. */
  async listAll(): Promise<Branch[]> {
    const branches: Branch[] = [];
    let page = 1;
    for (;;) {
      const { data } = await api.get<Paginated<Branch>>('/api/branches/', { params: { page } });
      branches.push(...data.results);
      if (!data.next) return branches;
      page += 1;
    }
  },
};
