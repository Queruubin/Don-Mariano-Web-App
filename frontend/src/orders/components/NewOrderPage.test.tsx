import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../auth/store/authStore';
import { catalogService } from '../../catalog/services/catalogService';
import type { Product } from '../../catalog/types/catalog.types';
import { customerService } from '../../customers/services/customerService';
import { draftKey, saveDraft } from '../form/draftStorage';
import { EMPTY_ORDER_FORM, freeTextLine } from '../form/orderForm';
import { orderService } from '../services/orderService';
import type { Order } from '../types/order.types';
import { NewOrderPage } from './NewOrderPage';

vi.mock('../../catalog/services/catalogService', () => ({ catalogService: { autocomplete: vi.fn() } }));
vi.mock('../../customers/services/customerService', () => ({ customerService: { lookup: vi.fn() } }));
vi.mock('../services/orderService', () => ({
  orderService: { create: vi.fn(), update: vi.fn(), get: vi.fn(), listRecent: vi.fn() },
}));

const USER_ID = 3;
const BRANCH_ID = 1;
const DRAFT_KEY = draftKey(USER_ID, BRANCH_ID);

function product(id: number, name: string, unit: Product['default_unit'] = 'unidad'): Product {
  return { id, name, default_unit: unit, category: '', is_active: true, created_at: '', updated_at: '' };
}

const CATALOG = [product(11, 'Aguacate Hass'), product(12, 'Papa criolla', 'libra')];

function renderPage() {
  useAuthStore.setState({
    isAuthenticated: true,
    user: {
      id: USER_ID,
      email: 'gloria@donmariano.co',
      name: 'Gloria',
      role: 'branch_staff',
      branch: BRANCH_ID,
      branch_name: 'Sede Centro',
      is_active: true,
      date_joined: '2026-01-01T00:00:00Z',
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/domicilios/nuevo', element: <NewOrderPage /> },
      { path: '/domicilios', element: <h1>Lista de domicilios</h1> },
    ],
    { initialEntries: ['/domicilios/nuevo'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  // No per-keystroke delay: these flows type long strings and only debounce matters.
  return { user: userEvent.setup({ delay: null }), router };
}

const search = () => screen.getByRole('combobox', { name: 'Agregar producto' });
const cart = () => screen.getByRole('list', { name: 'Productos del domicilio' });

beforeEach(() => {
  vi.mocked(catalogService.autocomplete).mockReset();
  vi.mocked(catalogService.autocomplete).mockImplementation(async (query: string) =>
    CATALOG.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
  );
  vi.mocked(customerService.lookup).mockReset().mockResolvedValue(null);
  vi.mocked(orderService.create).mockReset();
});

describe('adding products to the cart', () => {
  it('adds a match with Enter, then clears and keeps focus for the next product', async () => {
    const { user } = renderPage();
    await user.type(search(), 'agua');
    expect(await screen.findByRole('option', { name: /Aguacate Hass/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');

    expect(within(cart()).getByText('Aguacate Hass')).toBeInTheDocument();
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
    expect(screen.getAllByText('1 producto').length).toBeGreaterThan(0);
  });

  it('moves through matches with the arrow keys', async () => {
    const { user } = renderPage();
    await user.type(search(), 'pa');
    await screen.findByRole('option', { name: /Papa criolla/ });
    await user.keyboard('{ArrowDown}{Enter}');
    // The second option is the free-text one.
    expect(within(cart()).getByText('pa')).toBeInTheDocument();
    expect(within(cart()).getByText('Producto libre')).toBeInTheDocument();
  });

  it('offers a free-text product when nothing matches', async () => {
    const { user } = renderPage();
    await user.type(search(), 'cilantro fresco');
    const option = await screen.findByRole('option', { name: 'Agregar «cilantro fresco» como producto libre' });
    await user.click(option);

    expect(within(cart()).getByText('cilantro fresco')).toBeInTheDocument();
    expect(within(cart()).getByText('Producto libre')).toBeInTheDocument();
    expect(search()).toHaveFocus();
  });

  it('steps quantities by unit and accepts typed decimals', async () => {
    const { user } = renderPage();
    await user.type(search(), 'papa');
    await user.click(await screen.findByRole('option', { name: /Papa criolla/ }));

    const quantity = screen.getByLabelText('Cantidad de Papa criolla');
    expect(screen.getByLabelText('Unidad de Papa criolla')).toHaveValue('libra');
    await user.click(screen.getByRole('button', { name: 'Aumentar cantidad de Papa criolla' }));
    expect(quantity).toHaveValue('1,5');

    await user.clear(quantity);
    await user.type(quantity, '2.255');
    expect(quantity).toHaveValue('2,25');

    await user.selectOptions(screen.getByLabelText('Unidad de Papa criolla'), 'gramos');
    expect(quantity).toHaveValue('2,25');
  });

  it('keeps notes behind a button until needed and removes lines', async () => {
    const { user } = renderPage();
    await user.type(search(), 'agua');
    await user.click(await screen.findByRole('option', { name: /Aguacate Hass/ }));

    await user.click(screen.getByRole('button', { name: 'Agregar observación' }));
    await user.type(screen.getByLabelText('Observación'), 'bien verde');
    expect(screen.getByLabelText('Observación')).toHaveValue('bien verde');

    await user.click(screen.getByRole('button', { name: 'Quitar Aguacate Hass' }));
    expect(screen.getByText('Todavía no hay productos')).toBeInTheDocument();
  });
});

describe('customer lookup', () => {
  it('fills in a known customer and preselects the most recent address', async () => {
    vi.mocked(customerService.lookup).mockResolvedValue({
      id: 5,
      phone: '3001234567',
      name: 'Gloria Pérez',
      addresses: [
        { id: 21, address: 'Calle 80 #20-30', notes: 'casa azul', last_used_at: '' },
        { id: 20, address: 'Cra 7 #45-10', notes: '', last_used_at: '' },
      ],
      created_at: '',
      updated_at: '',
    });
    const { user } = renderPage();
    await user.type(screen.getByLabelText('Teléfono'), '+57 300 123 4567');

    expect(await screen.findByText('Cliente encontrado')).toBeInTheDocument();
    expect(customerService.lookup).toHaveBeenLastCalledWith('3001234567');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gloria Pérez');
    expect(screen.getByRole('radio', { name: /Calle 80 #20-30/ })).toBeChecked();
    expect(screen.getByLabelText(/Indicaciones de la dirección/)).toHaveValue('casa azul');

    await user.click(screen.getByRole('radio', { name: 'Otra dirección' }));
    expect(screen.getByLabelText('Nueva dirección')).toHaveValue('');
  });

  it('asks for name and address of a new customer', async () => {
    const { user } = renderPage();
    await user.type(screen.getByLabelText('Teléfono'), '3109998888');
    expect(await screen.findByText('Cliente nuevo: escriba su nombre y dirección.')).toBeInTheDocument();
    expect(screen.getByLabelText('Dirección de entrega')).toBeInTheDocument();
  });
});

describe('closing and publishing', () => {
  it('shows friendly messages next to each missing field and focuses the first one', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Publicar domicilio' }));

    expect(screen.getByText('Escriba el teléfono del cliente.')).toBeInTheDocument();
    expect(screen.getByText('Escriba el nombre del cliente.')).toBeInTheDocument();
    expect(screen.getByText('Escriba la dirección de entrega.')).toBeInTheDocument();
    expect(screen.getByText('Agregue al menos un producto.')).toBeInTheDocument();
    expect(screen.getByText('Elija cómo va a pagar el cliente.')).toBeInTheDocument();
    expect(screen.getByText('Escriba el total del domicilio.')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Teléfono')).toHaveFocus();

    await user.type(screen.getByLabelText('Teléfono'), '3109998888');
    expect(screen.queryByText('Escriba el teléfono del cliente.')).not.toBeInTheDocument();
  });

  it('formats the total as pesos and computes the change for cash', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Efectivo' }));
    await user.type(screen.getByLabelText('Total del domicilio'), '45000');
    expect(screen.getByLabelText('Total del domicilio')).toHaveValue('$ 45.000');

    await user.click(screen.getByRole('button', { name: '$ 50.000' }));
    expect(screen.getByLabelText('¿Con cuánto paga? (opcional)')).toHaveValue('$ 50.000');
    expect(screen.getByText('Cambio:').parentElement).toHaveTextContent('Cambio: $ 5.000');

    await user.click(screen.getByRole('button', { name: 'Nequi' }));
    expect(screen.queryByLabelText('¿Con cuánto paga? (opcional)')).not.toBeInTheDocument();
  });

  it('confirms, publishes the mapped payload and shows the order number', async () => {
    vi.mocked(orderService.create).mockResolvedValue({ id: 99, number: 142 } as Order);
    const { user, router } = renderPage();

    await user.type(screen.getByLabelText('Teléfono'), '310 999 8888');
    await screen.findByText('Cliente nuevo: escriba su nombre y dirección.');
    await user.type(screen.getByLabelText('Nombre'), 'Mario');
    await user.type(screen.getByLabelText('Dirección de entrega'), 'Calle 1 #2-3');
    await user.type(search(), 'agua');
    await user.click(await screen.findByRole('option', { name: /Aguacate Hass/ }));
    await user.type(search(), 'cilantro');
    await user.click(await screen.findByRole('option', { name: /como producto libre/ }));
    await user.click(screen.getByRole('button', { name: 'Efectivo' }));
    await user.type(screen.getByLabelText('Total del domicilio'), '45000');
    await user.type(screen.getByLabelText('¿Con cuánto paga? (opcional)'), '100000');

    await user.click(screen.getByRole('button', { name: 'Publicar domicilio' }));
    const dialog = screen.getByRole('dialog', { name: '¿Publicar este domicilio?' });
    expect(within(dialog).getByText('2 productos')).toBeInTheDocument();
    expect(within(dialog).getByText('$ 45.000')).toBeInTheDocument();
    expect(orderService.create).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Sí, publicar' }));

    expect(await screen.findByRole('heading', { name: 'Domicilio #0142 publicado' })).toBeInTheDocument();
    expect(orderService.create).toHaveBeenCalledWith({
      customer: { phone: '3109998888', name: 'Mario', address: 'Calle 1 #2-3', address_notes: '' },
      items: [
        { product: 11, quantity: '1', unit: 'unidad', notes: '' },
        { name: 'cilantro', quantity: '1', unit: 'unidad', notes: '' },
      ],
      payment_method: 'cash',
      total_amount: '45000',
      pays_with: '100000',
      notes: '',
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ver domicilios' }));
    expect(router.state.location.pathname).toBe('/domicilios');
  });

  it('shows backend field errors next to the field', async () => {
    const { AxiosError } = await import('axios');
    const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      data: { items: ['Uno o más productos no existen en esta sede.'], code: 'invalid' },
    } as never);
    vi.mocked(orderService.create).mockRejectedValue(error);
    saveDraft(DRAFT_KEY, {
      ...EMPTY_ORDER_FORM,
      phone: '3109998888',
      name: 'Mario',
      newAddress: 'Calle 1',
      lines: [freeTextLine('Pan')],
      paymentMethod: 'card',
      total: '10000',
    });
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Publicar domicilio' }));
    await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
    expect(await screen.findByText('Uno o más productos no existen en esta sede.')).toBeInTheDocument();
    expect(search()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('draft autosave', () => {
  it('saves the order in progress for this user and branch', async () => {
    const { user } = renderPage();
    await user.type(screen.getByLabelText('Teléfono'), '3109998888');
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toContain('3109998888'));
  });

  it('restores a draft with a banner and can discard it', async () => {
    saveDraft(DRAFT_KEY, { ...EMPTY_ORDER_FORM, phone: '3109998888', lines: [freeTextLine('Pan')] });
    const { user } = renderPage();

    expect(screen.getByText('Tiene un domicilio sin terminar')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toHaveValue('3109998888');
    expect(within(cart()).getByText('Pan')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByText('Tiene un domicilio sin terminar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toHaveValue('');
    expect(screen.getByText('Todavía no hay productos')).toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('asks before leaving with unsaved work', async () => {
    const { user, router } = renderPage();
    await user.type(screen.getByLabelText('Nombre'), 'Mario');
    void router.navigate('/domicilios');

    const dialog = await screen.findByRole('dialog', { name: '¿Salir sin publicar?' });
    await user.click(within(dialog).getByRole('button', { name: 'Seguir aquí' }));
    expect(router.state.location.pathname).toBe('/domicilios/nuevo');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Mario');
  });
});
