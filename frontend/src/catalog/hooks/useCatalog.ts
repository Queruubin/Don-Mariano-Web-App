import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { catalogService } from '../services/catalogService';
import type { ProductFilters, ProductInput } from '../types/catalog.types';

/** Query keys include the branch so switching branches never shows stale data. */
export const catalogKeys = {
  all: (branchId: number | null) => ['catalog', branchId] as const,
  products: (branchId: number | null, filters: ProductFilters) =>
    [...catalogKeys.all(branchId), 'products', filters] as const,
  categories: (branchId: number | null) => [...catalogKeys.all(branchId), 'categories'] as const,
};

export function useProducts(filters: ProductFilters) {
  const { id: branchId } = useActiveBranch();
  return useInfiniteQuery({
    queryKey: catalogKeys.products(branchId, filters),
    queryFn: ({ pageParam }) => catalogService.list(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) => (lastPage.next ? lastPageParam + 1 : undefined),
    enabled: branchId != null,
    placeholderData: (previous) => previous,
  });
}

export function useCategories() {
  const { id: branchId } = useActiveBranch();
  return useQuery({
    queryKey: catalogKeys.categories(branchId),
    queryFn: catalogService.categories,
    enabled: branchId != null,
  });
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  const { id: branchId } = useActiveBranch();
  return () => queryClient.invalidateQueries({ queryKey: catalogKeys.all(branchId) });
}

export function useSaveProduct() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: ProductInput }) =>
      id == null ? catalogService.create(input) : catalogService.update(id, input),
    onSuccess: invalidate,
  });
}

export function useSetProductActive() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }): Promise<void> => {
      if (active) await catalogService.activate(id);
      else await catalogService.deactivate(id);
    },
    onSuccess: invalidate,
  });
}

export function usePreviewImport() {
  return useMutation({ mutationFn: (file: File) => catalogService.previewImport(file) });
}

export function useApplyImport() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (file: File) => catalogService.applyImport(file),
    onSuccess: invalidate,
  });
}
