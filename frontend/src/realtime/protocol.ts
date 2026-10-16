import type { BoardOrder, OrderStatus } from '../orders/types/order.types';

/**
 * The /ws/branch/ protocol (mirrors backend `apps/realtime/protocol.py`).
 *
 * The client opens the socket, sends `{type: "auth", token, branch_id}` and
 * waits for `auth.ok`. From then on the server pushes order events of that
 * branch, and answers each `ping` with a `pong`.
 */
export const CloseCode = {
  /** Our own close (logout, branch change). */
  NORMAL: 1000,
  /** No ping or message from us for too long. */
  IDLE_TIMEOUT: 4002,
  PROTOCOL_ERROR: 4400,
  /** Bad token or inactive user/branch: refresh the token and retry once. */
  AUTH_FAILED: 4401,
  /** Not allowed in that branch: do not retry until the branch changes. */
  FORBIDDEN: 4403,
  AUTH_TIMEOUT: 4408,
  /** The access token expired while connected: refresh and reconnect right away. */
  AUTH_EXPIRED: 4419,
  /** The server cannot reach Redis: retry with backoff. */
  UNAVAILABLE: 4503,
} as const;

export type OrderEventType = 'order.created' | 'order.updated' | 'order.status_changed' | 'order.cancelled';

export interface OrderEvent {
  type: OrderEventType;
  event_id: string;
  /** Server time when the event was published (ISO 8601). */
  sent_at: string;
  /** Who made the change. */
  actor_id: number | null;
  branch_id: number;
  order: BoardOrder;
  /** Present on status changes and cancellations. */
  from_status?: OrderStatus;
  to_status?: OrderStatus;
}

export type ServerMessage =
  | { type: 'auth.ok'; branch_id: number; user_id: number }
  | { type: 'pong' }
  | OrderEvent;

const ORDER_EVENT_TYPES: ReadonlySet<string> = new Set<OrderEventType>([
  'order.created',
  'order.updated',
  'order.status_changed',
  'order.cancelled',
]);

export function isOrderEvent(message: { type?: unknown }): message is OrderEvent {
  return typeof message.type === 'string' && ORDER_EVENT_TYPES.has(message.type);
}
