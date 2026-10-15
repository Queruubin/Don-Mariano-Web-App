import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../auth/store/authStore';
import { customerService } from '../../customers/services/customerService';
import { orderService } from '../services/orderService';
import type { Order } from '../types/order.types';
import { EditOrderPage } from './EditOrderPage';

vi.mock('../../catalog/services/catalogService', () => ({ catalogService: { autocomplete: vi.fn() } }));
vi.mock('../../customers/services/customerService', () => ({ customerService: { lookup: vi.fn() } }));
vi.mock('../services/orderService', () => ({
  orderService: { create: vi.fn(), update: vi.fn(), get: vi.fn(), listRecent: vi.fn() },
}));

const ORDER = {
  id: 7,
  number: 142,
  status: 'preparing',
  is_editable: true,
  customer: { id: 5, phone: '3001234567', name: 'Gloria Pérez' },
  address_snapshot: 'Cra 7 #45-10',
  address_notes: 'apto 302',
  payment_method: 'card',
  total_amount: '45000',
  pays_with: null,
  notes: '',
  items: [{ id: 1, product: null, name: 'Papaya', quantity: '1.00', unit: 'unidad', notes: 'madura', is_free_text: true }],
} as unknown as Order;

function renderPage() {
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
  const router = createMemoryRouter([{ path: '/domicilios/:id/editar', element: <EditOrderPage /> }], {
    initialEntries: ['/domicilios/7/editar'],
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.mocked(orderService.get).mockReset();
  vi.mocked(orderService.update).mockReset();
  vi.mocked(customerService.lookup).mockReset().mockResolvedValue({
    id: 5,
    phone: '3001234567',
    name: 'Gloria Pérez',
    addresses: [{ id: 20, address: 'Cra 7 #45-10', notes: 'apto 302', last_used_at: '' }],
    created_at: '',
    updated_at: '',
  });
});

describe('editing an order', () => {
  it('prefills the form and saves the changes', async () => {
    vi.mocked(orderService.get).mockResolvedValue(ORDER);
    vi.mocked(orderService.update).mockResolvedValue(ORDER);
    const user = renderPage();

    expect(await screen.findByRole('heading', { name: 'Editar domicilio #0142' })).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toHaveValue('3001234567');
    expect(await screen.findByRole('radio', { name: /Cra 7 #45-10/ })).toBeChecked();
    expect(screen.getByLabelText('Total del domicilio')).toHaveValue('$ 45.000');

    await user.click(screen.getByRole('button', { name: 'Aumentar cantidad de Papaya' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, guardar' }));

    expect(await screen.findByRole('heading', { name: 'Domicilio #0142 actualizado' })).toBeInTheDocument();
    expect(orderService.update).toHaveBeenCalledWith(7, {
      customer: { phone: '3001234567', name: 'Gloria Pérez', address_id: 20, address_notes: 'apto 302' },
      items: [{ name: 'Papaya', quantity: '2', unit: 'unidad', notes: 'madura' }],
      payment_method: 'card',
      total_amount: '45000',
      pays_with: null,
      notes: '',
    });
  });

  it('is read-only once the order left the store', async () => {
    vi.mocked(orderService.get).mockResolvedValue({ ...ORDER, status: 'on_the_way', is_editable: false });
    renderPage();
    expect(await screen.findByText('El domicilio #0142 ya no se puede editar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  });
});
