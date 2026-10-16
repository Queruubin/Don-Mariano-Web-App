import type { QueryClient } from '@tanstack/react-query';
import type { BoardOrder, Order } from './types/order.types';

/**
 * Query keys and cache writers for orders.
 *
 * Every key includes the branch, so switching branches never shows stale data.
 * Mutations and (from milestone 5) real-time events update the cache only
 * through these helpers: a socket message can call `upsertOrder` with the
 * order it carries, or `invalidateOrders` when it only says "something changed".
 */
export const orderKeys = {
  all: (branchId: number | null) => ['orders', branchId] as const,
  board: (branchId: number | null) => [...orderKeys.all(branchId), 'board'] as const,
  detail: (branchId: number | null, id: number) => [...orderKeys.all(branchId), 'detail', id] as const,
  /** Shared by every status-changing mutation, so polling can pause while one runs. */
  lifecycle: (branchId: number | null) => [...orderKeys.all(branchId), 'lifecycle'] as const,
  customer: (branchId: number | null, phone: string) => ['customers', branchId, 'lookup', phone] as const,
  autocomplete: (branchId: number | null, query: string) => ['catalog', branchId, 'autocomplete', query] as const,
};

function toBoardOrder(order: Order | BoardOrder, previous?: BoardOrder): BoardOrder {
  if ('item_count' in order) return order;
  const { items, status_events: _events, ...summary } = order;
  return { ...summary, item_count: items?.length ?? previous?.item_count ?? 0 };
}

/** Put the latest version of an order on the board (adding it if it is new). */
export function upsertBoardOrder(queryClient: QueryClient, branchId: number | null, order: Order | BoardOrder): void {
  queryClient.setQueryData<BoardOrder[]>(orderKeys.board(branchId), (board) => {
    if (!board) return board;
    const index = board.findIndex((item) => item.id === order.id);
    if (index === -1) {
      return [toBoardOrder(order), ...board].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    }
    const next = [...board];
    next[index] = toBoardOrder(order, board[index]);
    return next;
  });
}

/** Store a full order (from a mutation response or a socket event) in the board and the detail view. */
export function upsertOrder(queryClient: QueryClient, branchId: number | null, order: Order): void {
  queryClient.setQueryData(orderKeys.detail(branchId, order.id), order);
  upsertBoardOrder(queryClient, branchId, order);
}

/** Refetch every order query of the branch. */
export function invalidateOrders(queryClient: QueryClient, branchId: number | null): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: orderKeys.all(branchId) });
}
