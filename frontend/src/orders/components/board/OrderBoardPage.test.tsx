import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHighlights, highlightOrder } from '../../alerts/newOrderAlerts';
import { applyOrderEvent } from '../../realtime';
import { orderService } from '../../services/orderService';
import { apiError, makeBoardOrder, makeOrder, renderRoutes } from '../../test/fixtures';
import type { Order } from '../../types/order.types';
import { OrderBoardPage } from './OrderBoardPage';

vi.mock('../../services/orderService', () => ({
  orderService: { listBoard: vi.fn(), advance: vi.fn(), cancel: vi.fn(), get: vi.fn() },
}));

const PENDING = makeBoardOrder({ id: 1, number: 142, customer: { id: 5, phone: '3001234567', name: 'Gloria Pérez' } });
const PREPARING = makeBoardOrder({
  id: 2,
  number: 141,
  status: 'preparing',
  next_status: 'on_the_way',
  payment_method: 'nequi',
  pays_with: null,
  change_due: null,
  customer: { id: 6, phone: '3109876543', name: 'Andrés Rojas' },
});
const ON_THE_WAY = makeBoardOrder({ id: 3, number: 140, status: 'on_the_way', next_status: null, is_editable: false });
const DELIVERED = makeBoardOrder({ id: 4, number: 139, status: 'delivered', next_status: null, is_editable: false });
const CANCELLED = makeBoardOrder({
  id: 5,
  number: 138,
  status: 'cancelled',
  next_status: null,
  is_editable: false,
  cancel_reason: 'Cliente canceló',
});
const BOARD = [PENDING, PREPARING, ON_THE_WAY, DELIVERED, CANCELLED];

function renderBoard() {
  return renderRoutes(
    [
      { path: '/domicilios', element: <OrderBoardPage /> },
      { path: '/domicilios/:id', element: <p>Detalle</p> },
    ],
    '/domicilios',
  );
}

function column(name: RegExp) {
  return screen.getByRole('region', { name });
}

function setPhoneWidth(isPhone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: !isPhone,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(orderService.listBoard).mockReset().mockResolvedValue(BOARD);
  vi.mocked(orderService.advance).mockReset();
  setPhoneWidth(false);
});

afterEach(() => {
  // @ts-expect-error jsdom has no matchMedia; tests add it.
  delete window.matchMedia;
});

describe('order board on a tablet', () => {
  it('groups active orders in columns with counts', async () => {
    renderBoard();

    expect(await screen.findByRole('region', { name: /Pendientes\s*1/ })).toBeInTheDocument();
    expect(within(column(/Pendientes/)).getByRole('article', { name: '#0142' })).toBeInTheDocument();
    expect(within(column(/Alistando\s*1/)).getByRole('article', { name: '#0141' })).toBeInTheDocument();
    expect(within(column(/En camino\s*1/)).getByRole('article', { name: '#0140' })).toBeInTheDocument();

    // Finished orders are collapsed, with their count.
    const finished = screen.getByRole('button', { name: /Terminados hoy\s*2/ });
    expect(finished).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('article', { name: '#0139' })).not.toBeInTheDocument();
  });

  it('shows the card details, with status icon and label', async () => {
    renderBoard();
    const card = await screen.findByRole('article', { name: '#0142' });
    expect(within(card).getByText('Pendiente')).toBeInTheDocument();
    expect(within(card).getByText('Gloria Pérez')).toBeInTheDocument();
    expect(within(card).getByText('Cra 7 #45-10')).toBeInTheDocument();
    expect(within(card).getByText('2 productos')).toBeInTheDocument();
    expect(within(card).getByText('Efectivo')).toBeInTheDocument();
    expect(within(card).getByText('$ 45.000')).toBeInTheDocument();
    expect(within(card).getByText(/Paga con \$ 50\.000/)).toHaveTextContent('Paga con $ 50.000 · Cambio $ 5.000');
    expect(within(card).getByText('hace un momento · Gloria')).toBeInTheDocument();
    expect(within(card).getByRole('link')).toHaveAttribute('href', '/domicilios/1');

    const nequi = screen.getByRole('article', { name: '#0141' });
    expect(within(nequi).queryByText(/Paga con/)).not.toBeInTheDocument();
    expect(within(nequi).getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
    expect(within(column(/En camino/)).getByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument();
  });

  it('opens the finished section with delivered and cancelled orders', async () => {
    const { user } = renderBoard();
    await user.click(await screen.findByRole('button', { name: /Terminados hoy/ }));
    const cancelled = screen.getByRole('article', { name: '#0138' });
    expect(within(cancelled).getByText('Motivo: Cliente canceló')).toBeInTheDocument();
    expect(within(cancelled).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: '#0139' })).toBeInTheDocument();
  });

  it('moves the card right away and sends the status it saw', async () => {
    const request = deferred<Order>();
    vi.mocked(orderService.advance).mockReturnValue(request.promise);
    const { user } = renderBoard();

    const card = await screen.findByRole('article', { name: '#0142' });
    await user.click(within(card).getByRole('button', { name: 'Pasar a Alistando' }));

    expect(orderService.advance).toHaveBeenCalledWith(1, 'pending');
    // Optimistic: already under "Alistando", while the server has not answered.
    const moved = within(column(/Alistando\s*2/)).getByRole('article', { name: '#0142' });
    expect(within(moved).getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(within(column(/Pendientes\s*0/)).getByText('No hay domicilios pendientes.')).toBeInTheDocument();

    vi.mocked(orderService.listBoard).mockResolvedValue([
      { ...PENDING, status: 'preparing', next_status: 'on_the_way' },
      PREPARING,
      ON_THE_WAY,
      DELIVERED,
      CANCELLED,
    ]);
    request.resolve(makeOrder({ id: 1, number: 142, status: 'preparing', next_status: 'on_the_way' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Domicilio #0142 pasó a Alistando');
    await waitFor(() => expect(within(moved).getByRole('button', { name: 'Enviar' })).toBeEnabled());
  });

  it('puts the card back and refreshes when someone else moved it first (409)', async () => {
    vi.mocked(orderService.advance).mockRejectedValue(
      apiError(409, { detail: 'Este domicilio ya cambió de estado. Ahora está "En camino".', code: 'stale_status' }),
    );
    const { user } = renderBoard();

    const card = await screen.findByRole('article', { name: '#0142' });
    vi.mocked(orderService.listBoard).mockResolvedValue([
      { ...PENDING, status: 'on_the_way', next_status: 'delivered' },
      PREPARING,
      ON_THE_WAY,
      DELIVERED,
      CANCELLED,
    ]);
    await user.click(within(card).getByRole('button', { name: 'Pasar a Alistando' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('#0142: Este domicilio ya cambió de estado');
    // The refreshed board shows where the order really is.
    await waitFor(() =>
      expect(within(column(/En camino\s*2/)).getByRole('article', { name: '#0142' })).toBeInTheDocument(),
    );
    expect(orderService.listBoard).toHaveBeenCalledTimes(2);
  });

  it('puts the card back with a friendly message on other errors', async () => {
    vi.mocked(orderService.advance).mockRejectedValue(apiError(500, {}));
    const { user } = renderBoard();

    const card = await screen.findByRole('article', { name: '#0142' });
    await user.click(within(card).getByRole('button', { name: 'Pasar a Alistando' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos mover el domicilio #0142');
    await waitFor(() =>
      expect(within(column(/Pendientes\s*1/)).getByRole('article', { name: '#0142' })).toBeInTheDocument(),
    );
  });

  it('filters by number, customer or phone', async () => {
    const { user } = renderBoard();
    const search = await screen.findByRole('searchbox', { name: 'Buscar domicilio' });

    await user.type(search, 'andres');
    expect(screen.getByRole('article', { name: '#0141' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: '#0142' })).not.toBeInTheDocument();
    expect(within(column(/Pendientes\s*0/)).getByText('Ningún domicilio coincide con la búsqueda.')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, '#0142');
    expect(screen.getByRole('article', { name: '#0142' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: '#0141' })).not.toBeInTheDocument();
  });

  it('shows empty columns when there are no orders', async () => {
    vi.mocked(orderService.listBoard).mockResolvedValue([]);
    renderBoard();
    expect(await screen.findByText('No hay domicilios pendientes.')).toBeInTheDocument();
    expect(screen.getByText('No hay domicilios alistándose.')).toBeInTheDocument();
    expect(screen.getByText('No hay domicilios en camino.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo domicilio' })).toHaveAttribute('href', '/domicilios/nuevo');
  });
});

describe('order board on a phone', () => {
  it('shows one status at a time with tabs and counts', async () => {
    setPhoneWidth(true);
    const { user } = renderBoard();

    const pendingTab = await screen.findByRole('tab', { name: /Pendientes\s*1/ });
    expect(pendingTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Alistando\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /En camino\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Terminados hoy\s*2/ })).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('article', { name: '#0142' })).toBeInTheDocument();
    expect(within(panel).queryByRole('article', { name: '#0141' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Terminados/ }));
    expect(within(screen.getByRole('tabpanel')).getByRole('article', { name: '#0138' })).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getByRole('article', { name: '#0139' })).toBeInTheDocument();
  });
});

describe('order board in real time', () => {
  afterEach(() => clearHighlights());

  it('moves a card when another screen advances the order', async () => {
    const { queryClient } = renderBoard();
    await screen.findByRole('article', { name: '#0142' });
    expect(within(column(/Pendientes/)).getByRole('article', { name: '#0142' })).toBeInTheDocument();

    const later = new Date(Date.now() + 1_000).toISOString();
    act(() => {
      applyOrderEvent(queryClient, 1, {
        type: 'order.status_changed',
        event_id: 'e1',
        sent_at: later,
        actor_id: 8,
        branch_id: 1,
        order: { ...PENDING, status: 'preparing', status_label: 'Alistando', next_status: 'on_the_way', updated_at: later },
        from_status: 'pending',
        to_status: 'preparing',
      });
    });

    expect(await within(column(/Alistando/)).findByRole('article', { name: '#0142' })).toBeInTheDocument();
    expect(within(column(/Pendientes/)).queryByRole('article', { name: '#0142' })).not.toBeInTheDocument();
  });

  it('marks a new order from someone else with a "Nuevo" label', async () => {
    renderBoard();
    const card = await screen.findByRole('article', { name: '#0142' });
    expect(within(card).queryByText('Nuevo')).not.toBeInTheDocument();

    act(() => highlightOrder(PENDING.id));

    expect(within(card).getByText('Nuevo')).toBeInTheDocument();
  });
});
