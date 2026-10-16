import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderService } from '../../services/orderService';
import { apiError, makeOrder, renderRoutes } from '../../test/fixtures';
import { OrderDetailPage } from './OrderDetailPage';

vi.mock('../../services/orderService', () => ({
  orderService: { listBoard: vi.fn(), advance: vi.fn(), cancel: vi.fn(), get: vi.fn() },
}));

const PREPARING = makeOrder({
  id: 7,
  number: 142,
  status: 'preparing',
  next_status: 'on_the_way',
  status_events: [
    { from_status: '', to_status: 'pending', changed_by: 3, changed_by_name: 'Gloria', changed_at: '2026-10-15T15:00:00Z', reason: '' },
    {
      from_status: 'pending',
      to_status: 'preparing',
      changed_by: 4,
      changed_by_name: 'Andrés',
      changed_at: '2026-10-15T15:10:00Z',
      reason: '',
    },
  ],
});

function renderDetail() {
  return renderRoutes(
    [
      { path: '/domicilios/:id', element: <OrderDetailPage /> },
      { path: '/domicilios/:id/imprimir', element: <p>Ticket</p> },
    ],
    '/domicilios/7',
  );
}

beforeEach(() => {
  vi.mocked(orderService.get).mockReset().mockResolvedValue(PREPARING);
  vi.mocked(orderService.cancel).mockReset();
  vi.mocked(orderService.advance).mockReset();
});

describe('order detail', () => {
  it('shows the customer, items, payment and actions', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Domicilio #0142' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: '3001234567' })).toHaveAttribute('href', 'tel:+573001234567');
    expect(screen.getByText('Indicaciones: apto 302')).toBeInTheDocument();

    const items = screen.getByRole('list', { name: 'Productos' });
    expect(within(items).getByText('1,5 libras')).toBeInTheDocument();
    expect(within(items).getByText('Observación: bien verde')).toBeInTheDocument();
    expect(within(items).getByText('$ 2.000')).toBeInTheDocument();
    expect(within(items).getAllByText('Producto libre')).toHaveLength(1);

    expect(screen.getByText('$ 45.000')).toBeInTheDocument();
    expect(screen.getByText('$ 50.000')).toBeInTheDocument();
    expect(screen.getByText('$ 5.000')).toBeInTheDocument();
    expect(screen.getByText('Llamar al llegar')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/domicilios/7/editar');
    expect(screen.getByRole('link', { name: 'Imprimir' })).toHaveAttribute('href', '/domicilios/7/imprimir');
    expect(screen.getByRole('link', { name: 'Volver a domicilios' })).toHaveAttribute('href', '/domicilios');
  });

  it('shows the status history with who and when, then the steps left', async () => {
    renderDetail();
    const timeline = await screen.findByRole('list', { name: 'Historial del domicilio' });
    const steps = within(timeline).getAllByRole('listitem');
    expect(steps.map((step) => within(step).getByText(/Pendiente|Alistando|En camino|Entregado/).textContent)).toEqual([
      'Pendiente',
      'Alistando',
      'En camino',
      'Entregado',
    ]);
    expect(steps[0]).toHaveTextContent('por Gloria');
    expect(steps[1]).toHaveTextContent('por Andrés');
    expect(steps[1]).toHaveTextContent('10:10 a. m.');
    expect(steps[2]).toHaveTextContent('Falta');
  });

  it('shows the cancel reason and hides actions once cancelled', async () => {
    vi.mocked(orderService.get).mockResolvedValue({
      ...PREPARING,
      status: 'cancelled',
      next_status: null,
      is_editable: false,
      cancel_reason: 'No hay producto',
      status_events: [
        ...PREPARING.status_events,
        {
          from_status: 'preparing',
          to_status: 'cancelled',
          changed_by: 3,
          changed_by_name: 'Gloria',
          changed_at: '2026-10-15T15:20:00Z',
          reason: 'No hay producto',
        },
      ],
    });
    renderDetail();
    expect(await screen.findByText('Cancelado. Motivo: No hay producto')).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Historial del domicilio' })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[2]).toHaveTextContent('Motivo: No hay producto');
    expect(screen.queryByRole('button', { name: 'Cancelar domicilio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Imprimir' })).toBeInTheDocument();
  });

  it('advances from the detail view with the status it shows', async () => {
    const onTheWay = { ...PREPARING, status: 'on_the_way' as const, next_status: 'delivered' as const };
    vi.mocked(orderService.advance).mockResolvedValue(onTheWay);
    const { user } = renderDetail();
    await screen.findByRole('button', { name: 'Enviar' });
    vi.mocked(orderService.get).mockResolvedValue(onTheWay);
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(orderService.advance).toHaveBeenCalledWith(7, 'preparing');
    expect(await screen.findByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument();
  });
});

describe('cancelling an order', () => {
  it('requires a reason', async () => {
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Cancelar domicilio' }));
    const dialog = screen.getByRole('dialog', { name: '¿Cancelar el domicilio #0142?' });

    await user.click(within(dialog).getByRole('button', { name: 'Sí, cancelar domicilio' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Elija o escriba el motivo de la cancelación.');
    expect(within(dialog).getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true');
    expect(orderService.cancel).not.toHaveBeenCalled();
  });

  it('cancels with a quick reason', async () => {
    vi.mocked(orderService.cancel).mockResolvedValue({
      ...PREPARING,
      status: 'cancelled',
      next_status: null,
      is_editable: false,
      cancel_reason: 'Dirección errada',
    });
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Cancelar domicilio' }));
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Dirección errada' }));
    expect(within(dialog).getByRole('button', { name: 'Dirección errada' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Sí, cancelar domicilio' }));

    expect(orderService.cancel).toHaveBeenCalledWith(7, 'Dirección errada', 'preparing');
    expect(await screen.findByText('Cancelado. Motivo: Dirección errada')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels with a typed reason and shows server errors in the dialog', async () => {
    vi.mocked(orderService.cancel).mockRejectedValue(apiError(500, {}));
    const { user } = renderDetail();
    await user.click(await screen.findByRole('button', { name: 'Cancelar domicilio' }));
    const dialog = screen.getByRole('dialog');

    await user.type(within(dialog).getByLabelText('Motivo'), '  Cliente no contesta ');
    await user.click(within(dialog).getByRole('button', { name: 'Sí, cancelar domicilio' }));

    expect(orderService.cancel).toHaveBeenCalledWith(7, 'Cliente no contesta', 'preparing');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Algo salió mal en el servidor');
  });
});
