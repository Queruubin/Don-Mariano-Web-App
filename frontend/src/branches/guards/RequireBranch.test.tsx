import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../auth/types/auth.types';
import { useAuthStore } from '../../auth/store/authStore';
import { orderService } from '../../orders/services/orderService';
import { routes } from '../../routes';
import type { Branch } from '../types/branch.types';
import { branchService } from '../services/branchService';
import { useBranchStore } from '../store/branchStore';

vi.mock('../services/branchService', () => ({ branchService: { listAll: vi.fn() } }));
vi.mock('../../orders/services/orderService', () => ({
  orderService: { listBoard: vi.fn(), get: vi.fn(), advance: vi.fn(), cancel: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock('../../catalog/services/catalogService', () => ({
  catalogService: { list: vi.fn(), categories: vi.fn(), autocomplete: vi.fn() },
}));

const SUPER_ADMIN = {
  id: 1,
  email: 'root@donmariano.co',
  name: 'Dueño',
  role: 'super_admin',
  branch: null,
  branch_name: null,
  is_active: true,
  date_joined: '2026-01-01T00:00:00Z',
} as unknown as User;

const BRANCH_PATHS = [
  '/domicilios',
  '/domicilios/nuevo',
  '/domicilios/7',
  '/domicilios/7/editar',
  '/domicilios/7/imprimir',
  '/catalog',
];

function renderAt(path: string, user: User = SUPER_ADMIN) {
  useAuthStore.setState({ isAuthenticated: true, user });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // No active branch to pick: the header selector cannot choose one by itself.
  vi.mocked(branchService.listAll).mockResolvedValue([]);
  vi.mocked(orderService.listBoard).mockResolvedValue([]);
  useBranchStore.setState({ selectedBranchId: null });
});

describe('branch-scoped pages without an active branch', () => {
  it.each(BRANCH_PATHS)('%s asks the super admin to pick a branch instead of loading', async (path) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { name: 'Seleccione una sede para continuar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Cargando')).not.toBeInTheDocument();
    expect(orderService.listBoard).not.toHaveBeenCalled();
    expect(orderService.get).not.toHaveBeenCalled();
  });

  it('offers a way back from the print view, which has no header', async () => {
    // Nothing picked yet, and the print view has no selector to pick one.
    vi.mocked(branchService.listAll).mockResolvedValue([{ id: 1, name: 'Centro', is_active: true } as Branch]);
    renderAt('/domicilios/7/imprimir');
    expect(await screen.findByRole('link', { name: 'Ir a domicilios' })).toHaveAttribute('href', '/domicilios');
  });

  it('tells a branch user without a branch to ask an admin', async () => {
    renderAt('/domicilios', { ...SUPER_ADMIN, role: 'branch_staff' } as User);
    expect(await screen.findByRole('heading', { name: 'Su usuario no tiene una sede' })).toBeInTheDocument();
    expect(branchService.listAll).not.toHaveBeenCalled();
  });

  it('shows the page once a branch is selected', async () => {
    vi.mocked(branchService.listAll).mockResolvedValue([{ id: 1, name: 'Centro', is_active: true } as Branch]);
    useBranchStore.setState({ selectedBranchId: 1 });
    renderAt('/domicilios');
    expect(await screen.findByRole('heading', { name: 'Domicilios' })).toBeInTheDocument();
    expect(screen.queryByText('Seleccione una sede para continuar')).not.toBeInTheDocument();
    expect(orderService.listBoard).toHaveBeenCalled();
  });
});
