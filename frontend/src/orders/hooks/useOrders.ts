import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { catalogService } from '../../catalog/services/catalogService';
import { customerService } from '../../customers/services/customerService';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { MIN_PHONE_DIGITS, phoneDigits } from '../form/orderForm';
import { orderService } from '../services/orderService';
import type { OrderInput } from '../types/order.types';

/** Query keys include the branch so switching branches never shows stale data. */
export const orderKeys = {
  all: (branchId: number | null) => ['orders', branchId] as const,
  recent: (branchId: number | null) => [...orderKeys.all(branchId), 'recent'] as const,
  detail: (branchId: number | null, id: number) => [...orderKeys.all(branchId), 'detail', id] as const,
  customer: (branchId: number | null, phone: string) => ['customers', branchId, 'lookup', phone] as const,
  autocomplete: (branchId: number | null, query: string) => ['catalog', branchId, 'autocomplete', query] as const,
};

export function useRecentOrders() {
  const { id: branchId } = useActiveBranch();
  return useQuery({
    queryKey: orderKeys.recent(branchId),
    queryFn: orderService.listRecent,
    enabled: branchId != null,
  });
}

export function useOrder(id: number) {
  const { id: branchId } = useActiveBranch();
  return useQuery({
    queryKey: orderKeys.detail(branchId, id),
    queryFn: () => orderService.get(id),
    enabled: branchId != null && Number.isFinite(id),
    // Always edit the latest version.
    staleTime: 0,
  });
}

export function useSaveOrder(orderId?: number) {
  const queryClient = useQueryClient();
  const { id: branchId } = useActiveBranch();
  return useMutation({
    mutationFn: (input: OrderInput) =>
      orderId == null ? orderService.create(input) : orderService.update(orderId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all(branchId) });
      // Saved addresses and names may have changed (FR-15).
      void queryClient.invalidateQueries({ queryKey: ['customers', branchId] });
    },
  });
}

export const LOOKUP_DEBOUNCE_MS = 400;

/** Debounced phone lookup (FR-13). `customer` is null when the phone is new. */
export function useCustomerLookup(phone: string) {
  const { id: branchId } = useActiveBranch();
  const digits = phoneDigits(phone);
  const debounced = useDebouncedValue(digits, LOOKUP_DEBOUNCE_MS);
  const ready = debounced.length >= MIN_PHONE_DIGITS && debounced === digits;
  const query = useQuery({
    queryKey: orderKeys.customer(branchId, debounced),
    queryFn: () => customerService.lookup(debounced),
    enabled: branchId != null && ready,
    staleTime: 60_000,
  });
  return {
    /** The phone the result belongs to. */
    phone: debounced,
    isSearching: digits.length >= MIN_PHONE_DIGITS && (!ready || query.isFetching),
    isDone: ready && query.isSuccess,
    customer: ready ? (query.data ?? null) : null,
    isError: ready && query.isError,
  };
}

export const AUTOCOMPLETE_MIN_CHARS = 2;
export const AUTOCOMPLETE_DEBOUNCE_MS = 200;

/**
 * Product matches for the cart search (FR-16). `isFresh` is false while the
 * results belong to an older query, so Enter never adds a stale match.
 */
export function useProductAutocomplete(query: string) {
  const { id: branchId } = useActiveBranch();
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, AUTOCOMPLETE_DEBOUNCE_MS);
  const enabled = branchId != null && debounced.length >= AUTOCOMPLETE_MIN_CHARS;
  const result = useQuery({
    queryKey: orderKeys.autocomplete(branchId, debounced),
    queryFn: () => catalogService.autocomplete(debounced),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const isFresh = enabled && debounced === trimmed && result.isSuccess && !result.isPlaceholderData;
  return {
    products: result.data ?? [],
    isFresh,
    isSearching: trimmed.length >= AUTOCOMPLETE_MIN_CHARS && !isFresh && !result.isError,
    isError: result.isError,
  };
}
