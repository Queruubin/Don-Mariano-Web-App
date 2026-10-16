import { isAxiosError } from 'axios';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { catalogService } from '../../catalog/services/catalogService';
import { customerService } from '../../customers/services/customerService';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { showToast } from '../../shared/toast/toastStore';
import { apiErrorMessage } from '../../shared/utils/apiErrors';
import { invalidateOrders, orderKeys, upsertBoardOrder, upsertOrder } from '../cache';
import { MIN_PHONE_DIGITS, phoneDigits } from '../form/orderForm';
import { formatOrderNumber, isEditableStatus, nextStatus, STATUS_META } from '../labels';
import { orderService } from '../services/orderService';
import type { BoardOrder, Order, OrderInput, OrderStatus } from '../types/order.types';

export { orderKeys } from '../cache';

/** Polling until real time arrives (milestone 5), and the fallback after it (PRD section 5). */
export const BOARD_REFRESH_MS = 15_000;

/**
 * Active orders plus today's finished ones (FR-27). Refreshes every 15s and
 * when the tablet comes back to the app, but never while a status change is
 * on its way, so an optimistic move is not undone by an older response.
 */
export function useBoardOrders() {
  const queryClient = useQueryClient();
  const { id: branchId } = useActiveBranch();
  return useQuery({
    queryKey: orderKeys.board(branchId),
    queryFn: orderService.listBoard,
    enabled: branchId != null,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: () =>
      queryClient.isMutating({ mutationKey: orderKeys.lifecycle(branchId) }) > 0 ? false : BOARD_REFRESH_MS,
  });
}

export function useOrder(id: number, { live = false }: { live?: boolean } = {}) {
  const { id: branchId } = useActiveBranch();
  return useQuery({
    queryKey: orderKeys.detail(branchId, id),
    queryFn: () => orderService.get(id),
    enabled: branchId != null && Number.isFinite(id),
    // Always show and edit the latest version.
    staleTime: 0,
    refetchOnWindowFocus: live,
    refetchInterval: live ? BOARD_REFRESH_MS : false,
  });
}

/** True for HTTP 409: someone else changed the order's status first. */
export function isStaleStatusError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409;
}

/** What the order looks like right after a one-tap advance, before the server answers. */
function advancedLocally(order: BoardOrder): BoardOrder {
  const status = nextStatus(order.status) ?? order.status;
  const next = nextStatus(status);
  return {
    ...order,
    status,
    status_label: STATUS_META[status].label,
    next_status: next,
    is_editable: isEditableStatus(status),
    status_changed_at: new Date().toISOString(),
  };
}

/**
 * One-tap "next status" (FR-28) with an optimistic move on the board. On error
 * the card goes back; on 409 the board is refreshed and the server's message shown.
 * Callbacks live here (not in `mutate`) so they still run after the card moves.
 */
export function useAdvanceOrder() {
  const queryClient = useQueryClient();
  const { id: branchId } = useActiveBranch();
  const lifecycleKey = orderKeys.lifecycle(branchId);

  return useMutation({
    mutationKey: lifecycleKey,
    mutationFn: (order: BoardOrder | Order) => orderService.advance(order.id, order.status),
    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.board(branchId) });
      const original = queryClient
        .getQueryData<BoardOrder[]>(orderKeys.board(branchId))
        ?.find((item) => item.id === order.id);
      if (original) upsertBoardOrder(queryClient, branchId, advancedLocally(original));
      return { original };
    },
    onError: (error, order, context) => {
      if (context?.original) upsertBoardOrder(queryClient, branchId, context.original);
      showToast(
        isStaleStatusError(error)
          ? `${formatOrderNumber(order.number)}: ${apiErrorMessage(error)}`
          : `No pudimos mover el domicilio ${formatOrderNumber(order.number)}. ${apiErrorMessage(error)}`,
        'error',
      );
    },
    onSuccess: (updated) => {
      upsertOrder(queryClient, branchId, updated);
      showToast(`Domicilio ${formatOrderNumber(updated.number)} pasó a ${STATUS_META[updated.status].label}`, 'success');
    },
    onSettled: (_data, _error, order) => {
      // Refresh once the last pending change is done (this one still counts here).
      if (queryClient.isMutating({ mutationKey: lifecycleKey }) <= 1) void invalidateOrders(queryClient, branchId);
      else void queryClient.invalidateQueries({ queryKey: orderKeys.detail(branchId, order.id) });
    },
  });
}

export const CANCEL_REASONS = ['Cliente canceló', 'No hay producto', 'Dirección errada'] as const;

/** Cancel with a reason (FR-28). Errors are shown by the dialog, so the user can retry. */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { id: branchId } = useActiveBranch();
  return useMutation({
    mutationKey: orderKeys.lifecycle(branchId),
    mutationFn: ({ order, reason }: { order: { id: number; status: OrderStatus }; reason: string }) =>
      orderService.cancel(order.id, reason, order.status),
    onSuccess: (updated: Order) => {
      upsertOrder(queryClient, branchId, updated);
      showToast(`Domicilio ${formatOrderNumber(updated.number)} cancelado`, 'success');
    },
    onError: (error) => {
      if (!isStaleStatusError(error)) return;
      void invalidateOrders(queryClient, branchId);
      showToast(apiErrorMessage(error), 'error');
    },
  });
}

export function useSaveOrder(orderId?: number) {
  const queryClient = useQueryClient();
  const { id: branchId } = useActiveBranch();
  return useMutation({
    mutationFn: (input: OrderInput) =>
      orderId == null ? orderService.create(input) : orderService.update(orderId, input),
    onSuccess: () => {
      void invalidateOrders(queryClient, branchId);
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
