import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { useAuthStore } from '../../auth/store/authStore';
import { Toaster } from '../../shared/components/Toaster';
import { useToastStore } from '../../shared/toast/toastStore';
import type { BoardOrder, Order } from '../types/order.types';

const NOW = new Date().toISOString();

export function makeBoardOrder(overrides: Partial<BoardOrder> = {}): BoardOrder {
  return {
    id: 1,
    number: 142,
    status: 'pending',
    status_label: 'Pendiente',
    next_status: 'preparing',
    is_editable: true,
    customer: { id: 5, phone: '3001234567', name: 'Gloria Pérez' },
    address_snapshot: 'Cra 7 #45-10',
    address_notes: 'apto 302',
    payment_method: 'cash',
    total_amount: '45000',
    pays_with: '50000',
    change_due: '5000',
    notes: '',
    cancel_reason: '',
    created_by: 3,
    created_by_name: 'Gloria',
    created_at: NOW,
    updated_at: NOW,
    status_changed_at: NOW,
    item_count: 2,
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  const { item_count: _count, ...base } = makeBoardOrder();
  return {
    ...base,
    notes: 'Llamar al llegar',
    items: [
      { id: 1, product: 9, name: 'Aguacate Hass', quantity: '1.50', unit: 'libra', notes: 'bien verde', is_free_text: false },
      { id: 2, product: null, name: 'Cilantro', quantity: '2000', unit: 'pesos', notes: '', is_free_text: true },
    ],
    status_events: [
      {
        from_status: '',
        to_status: 'pending',
        changed_by: 3,
        changed_by_name: 'Gloria',
        changed_at: NOW,
        reason: '',
      },
    ],
    ...overrides,
  };
}

/** An axios error as the API client would reject it. */
export function apiError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse;
  return new AxiosError('Request failed', String(status), undefined, undefined, response);
}

/** Render routes as a logged-in staff user of "Sede Centro", with the toast stack. */
export function renderRoutes(routes: RouteObject[], initialEntry: string) {
  useToastStore.setState({ toasts: [] });
  useAuthStore.setState({
    isAuthenticated: true,
    user: {
      id: 3,
      email: 'gloria@donmariano.co',
      name: 'Gloria',
      role: 'branch_staff',
      branch: 1,
      branch_name: 'Sede Centro',
      is_active: true,
      date_joined: '2026-01-01T00:00:00Z',
    },
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), router, queryClient };
}
