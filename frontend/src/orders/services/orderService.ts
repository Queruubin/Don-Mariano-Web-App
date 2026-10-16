import api from '../../shared/utils/api';
import type { Paginated } from '../../shared/types';
import type { BoardOrder, Order, OrderInput, OrderStatus } from '../types/order.types';

const BASE = '/api/orders/';
/** The board loads every active order of the day in one page. */
const BOARD_PAGE_SIZE = 200;

export const orderService = {
  /** Active orders plus today's delivered and cancelled ones, newest first (FR-27). */
  async listBoard(): Promise<BoardOrder[]> {
    const { data } = await api.get<Paginated<BoardOrder>>(BASE, {
      params: { board: 'true', page_size: BOARD_PAGE_SIZE },
    });
    return data.results;
  },

  async get(id: number): Promise<Order> {
    const { data } = await api.get<Order>(`${BASE}${id}/`);
    return data;
  },

  async create(input: OrderInput): Promise<Order> {
    const { data } = await api.post<Order>(BASE, input);
    return data;
  },

  async update(id: number, input: OrderInput): Promise<Order> {
    const { data } = await api.patch<Order>(`${BASE}${id}/`, input);
    return data;
  },

  /**
   * Move the order one step forward (FR-28). `expectedStatus` is the status
   * this screen shows; the server answers 409 if someone else moved it first.
   */
  async advance(id: number, expectedStatus: OrderStatus): Promise<Order> {
    const { data } = await api.post<Order>(`${BASE}${id}/transition/`, {
      to_status: 'next',
      expected_status: expectedStatus,
    });
    return data;
  },

  async cancel(id: number, reason: string, expectedStatus: OrderStatus): Promise<Order> {
    const { data } = await api.post<Order>(`${BASE}${id}/cancel/`, {
      reason,
      expected_status: expectedStatus,
    });
    return data;
  },
};
