import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderEvent, OrderEventType } from '../realtime/protocol';
import { orderKeys } from './cache';
import { applyOrderEvent, createOrderEventHandler } from './realtime';
import { makeBoardOrder, makeOrder } from './test/fixtures';
import type { BoardOrder } from './types/order.types';

const BRANCH = 1;
const ME = 3;
const T0 = '2026-10-15T10:00:00.000000-05:00';
const T1 = '2026-10-15T10:05:00.000000-05:00';
const T2 = '2026-10-15T10:10:00.000000-05:00';

let eventCounter = 0;

function event(type: OrderEventType, order: BoardOrder, overrides: Partial<OrderEvent> = {}): OrderEvent {
  eventCounter += 1;
  return {
    type,
    event_id: `event-${eventCounter}`,
    sent_at: order.updated_at,
    actor_id: 8,
    branch_id: BRANCH,
    order,
    ...overrides,
  };
}

let queryClient: QueryClient;
const board = () => queryClient.getQueryData<BoardOrder[]>(orderKeys.board(BRANCH));

beforeEach(() => {
  queryClient = new QueryClient();
  queryClient.setQueryData(orderKeys.board(BRANCH), [
    makeBoardOrder({ id: 1, number: 141, created_at: T0, updated_at: T0 }),
  ]);
});

describe('applyOrderEvent', () => {
  it('puts a new order at the top of the board', () => {
    const created = makeBoardOrder({ id: 2, number: 142, created_at: T1, updated_at: T1 });

    expect(applyOrderEvent(queryClient, BRANCH, event('order.created', created))).toBe(true);

    expect(board()?.map((order) => order.id)).toEqual([2, 1]);
  });

  it('moves a card to its new status', () => {
    const moved = makeBoardOrder({ id: 1, number: 141, status: 'preparing', created_at: T0, updated_at: T1 });

    applyOrderEvent(
      queryClient,
      BRANCH,
      event('order.status_changed', moved, { from_status: 'pending', to_status: 'preparing' }),
    );

    expect(board()).toHaveLength(1);
    expect(board()?.[0].status).toBe('preparing');
  });

  it('ignores an event older than the card on the board', () => {
    applyOrderEvent(queryClient, BRANCH, event('order.status_changed', makeBoardOrder({ id: 1, status: 'on_the_way', updated_at: T2 })));

    const late = makeBoardOrder({ id: 1, status: 'preparing', updated_at: T1 });
    expect(applyOrderEvent(queryClient, BRANCH, event('order.status_changed', late))).toBe(false);

    expect(board()?.[0].status).toBe('on_the_way');
  });

  it('refetches the order detail', () => {
    queryClient.setQueryData(orderKeys.detail(BRANCH, 1), makeOrder({ id: 1 }));
    applyOrderEvent(queryClient, BRANCH, event('order.updated', makeBoardOrder({ id: 1, notes: 'Timbre', updated_at: T1 })));

    expect(queryClient.getQueryState(orderKeys.detail(BRANCH, 1))?.isInvalidated).toBe(true);
  });

  it('leaves the cache alone when the board was never loaded', () => {
    queryClient.removeQueries({ queryKey: orderKeys.board(BRANCH) });
    applyOrderEvent(queryClient, BRANCH, event('order.created', makeBoardOrder({ id: 9 })));
    expect(board()).toBeUndefined();
  });
});

describe('createOrderEventHandler', () => {
  function handler() {
    const onNewOrder = vi.fn();
    return { handle: createOrderEventHandler(queryClient, BRANCH, { currentUserId: ME, onNewOrder }), onNewOrder };
  }

  it("alerts about another user's new order", () => {
    const { handle, onNewOrder } = handler();
    const created = makeBoardOrder({ id: 2, number: 143, updated_at: T1 });

    handle(event('order.created', created, { actor_id: 8 }));

    expect(onNewOrder).toHaveBeenCalledWith(created);
  });

  it('does not alert about my own new orders or about changes', () => {
    const { handle, onNewOrder } = handler();

    handle(event('order.created', makeBoardOrder({ id: 2, updated_at: T1 }), { actor_id: ME }));
    handle(event('order.status_changed', makeBoardOrder({ id: 1, status: 'preparing', updated_at: T1 })));

    expect(onNewOrder).not.toHaveBeenCalled();
    expect(board()?.map((order) => order.id)).toEqual([2, 1]);
  });

  it('drops a repeated event', () => {
    const { handle, onNewOrder } = handler();
    const created = event('order.created', makeBoardOrder({ id: 2, updated_at: T1 }));

    handle(created);
    handle(created);

    expect(onNewOrder).toHaveBeenCalledTimes(1);
    expect(board()).toHaveLength(2);
  });

  it("ignores another branch's events", () => {
    const { handle, onNewOrder } = handler();

    handle(event('order.created', makeBoardOrder({ id: 2, updated_at: T1 }), { branch_id: 99 }));

    expect(onNewOrder).not.toHaveBeenCalled();
    expect(board()).toHaveLength(1);
  });
});
