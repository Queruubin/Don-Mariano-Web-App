import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orderService } from '../../services/orderService';
import { makeOrder, renderRoutes } from '../../test/fixtures';
import { OrderPrintPage } from './OrderPrintPage';

vi.mock('../../services/orderService', () => ({
  orderService: { listBoard: vi.fn(), advance: vi.fn(), cancel: vi.fn(), get: vi.fn() },
}));

function renderTicket() {
  return renderRoutes([{ path: '/domicilios/:id/imprimir', element: <OrderPrintPage /> }], '/domicilios/1/imprimir');
}

beforeEach(() => {
  vi.mocked(orderService.get).mockReset().mockResolvedValue(makeOrder());
  window.print = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('print view', () => {
  it('shows everything the picker and driver need', async () => {
    renderTicket();
    const ticket = await screen.findByRole('article', { name: 'Ticket del domicilio #0142' });

    expect(within(ticket).getByText('#0142')).toBeInTheDocument();
    expect(within(ticket).getByText('Sede Centro')).toBeInTheDocument();
    expect(within(ticket).getByText('Gloria Pérez')).toBeInTheDocument();
    expect(within(ticket).getByText('Tel: 3001234567')).toBeInTheDocument();
    expect(within(ticket).getByText('Cra 7 #45-10')).toBeInTheDocument();
    expect(within(ticket).getByText('Indicaciones: apto 302')).toBeInTheDocument();

    // Items with quantities, and their observations stand out.
    expect(within(ticket).getByText('Productos (2)')).toBeInTheDocument();
    expect(within(ticket).getByText('1,5 libras')).toBeInTheDocument();
    expect(within(ticket).getByText('» bien verde')).toBeInTheDocument();
    expect(within(ticket).getByText('$ 2.000')).toBeInTheDocument();

    expect(within(ticket).getByText('Efectivo')).toBeInTheDocument();
    expect(within(ticket).getByText('$ 45.000')).toBeInTheDocument();
    expect(within(ticket).getByText('$ 50.000')).toBeInTheDocument();
    expect(within(ticket).getByText('$ 5.000')).toBeInTheDocument();
    expect(within(ticket).getByText('Llamar al llegar')).toBeInTheDocument();
  });

  it('prints only when asked', async () => {
    const { user } = renderTicket();
    await screen.findByRole('article', { name: /Ticket/ });
    expect(window.print).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
