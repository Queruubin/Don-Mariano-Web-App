import type { QueryClient } from '@tanstack/react-query';
import type { OrderEvent } from '../realtime/protocol';
import { orderKeys, upsertBoardOrder } from './cache';
import type { BoardOrder } from './types/order.types';

/** How many event ids to remember for de-duplication. */
const SEEN_EVENTS_LIMIT = 500;

function isOlder(candidate: string, current: string): boolean {
  const a = Date.parse(candidate);
  const b = Date.parse(current);
  return Number.isFinite(a) && Number.isFinite(b) && a < b;
}

/**
 * Apply one order event to the cache: the board card is inserted or updated
 * (which also moves it to its new status column), and the detail is refetched.
 * An event older than the card already on the board is ignored.
 * Returns false when the event was ignored as out of date.
 */
export function applyOrderEvent(queryClient: QueryClient, branchId: number, event: OrderEvent): boolean {
  const order = event.order;
  const cached = queryClient
    .getQueryData<BoardOrder[]>(orderKeys.board(branchId))
    ?.find((item) => item.id === order.id);
  if (cached && isOlder(order.updated_at, cached.updated_at)) return false;
  upsertBoardOrder(queryClient, branchId, order);
  void queryClient.invalidateQueries({ queryKey: orderKeys.detail(branchId, order.id) });
  return true;
}

interface OrderEventHandlerOptions {
  /** The logged-in user: their own new orders do not ring. */
  currentUserId: number;
  /** A new order taken by someone else (FR-30: sound and highlight). */
  onNewOrder: (order: BoardOrder) => void;
}

/** Event handler for one socket connection of one branch. Drops duplicates and other branches' events. */
export function createOrderEventHandler(
  queryClient: QueryClient,
  branchId: number,
  { currentUserId, onNewOrder }: OrderEventHandlerOptions,
): (event: OrderEvent) => void {
  const seen = new Set<string>();

  return (event) => {
    if (event.branch_id !== branchId || seen.has(event.event_id)) return;
    seen.add(event.event_id);
    if (seen.size > SEEN_EVENTS_LIMIT) seen.delete(seen.values().next().value as string);

    applyOrderEvent(queryClient, branchId, event);
    if (event.type === 'order.created' && event.actor_id !== currentUserId) onNewOrder(event.order);
  };
}
