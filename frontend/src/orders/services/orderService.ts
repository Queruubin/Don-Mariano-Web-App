import api from '../../shared/utils/api';
import type { Paginated } from '../../shared/types';
import type { Order, OrderInput, OrderSummary } from '../types/order.types';

const BASE = '/api/orders/';

export const orderService = {
  /** Newest first. */
  async listRecent(): Promise<Paginated<OrderSummary>> {
    const { data } = await api.get<Paginated<OrderSummary>>(BASE);
    return data;
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
};
