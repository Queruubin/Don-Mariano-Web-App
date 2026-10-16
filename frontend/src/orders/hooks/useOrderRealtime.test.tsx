import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../auth/store/authStore';
import { useConnectionStore } from '../../realtime/connectionStore';
import { CloseCode } from '../../realtime/protocol';
import { MockSocket } from '../../realtime/test/mockSocket';
import { useToastStore } from '../../shared/toast/toastStore';
import { clearHighlights, useHighlightStore } from '../alerts/newOrderAlerts';
import { orderKeys } from '../cache';
import { makeBoardOrder } from '../test/fixtures';
import { BOARD_REFRESH_MS, LIVE_REFRESH_MS, useOrderRefreshInterval } from './useOrders';
import { useOrderRealtime } from './useOrderRealtime';

const branch = vi.hoisted(() => ({ id: 1 as number | null }));

vi.mock('../../branches/hooks/useBranches', () => ({
  useActiveBranch: () => ({ id: branch.id, name: 'Sede', isLoading: false }),
}));

const ME = 3;

/** An unsigned JWT that expires in an hour; only `exp` is read on the client. */
function accessToken(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.signature`;
}

function logIn() {
  useAuthStore.setState({
    isAuthenticated: true,
    tokens: { access: accessToken(), refresh: 'refresh' },
    user: {
      id: ME,
      email: 'gloria@donmariano.co',
      name: 'Gloria',
      role: 'super_admin',
      branch: null,
      branch_name: null,
      is_active: true,
      date_joined: '2026-01-01T00:00:00Z',
    },
  });
}

function renderRealtime() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useOrderRealtime(), { wrapper });
  return { ...hook, queryClient };
}

/** Let the token lookup resolve so the socket opens. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  MockSocket.reset();
  vi.stubGlobal('WebSocket', MockSocket);
  branch.id = 1;
  useToastStore.setState({ toasts: [] });
  logIn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearHighlights();
  useAuthStore.setState({ isAuthenticated: false, tokens: null, user: null });
});

describe('useOrderRealtime', () => {
  it('connects for the active branch, goes live and refetches to catch up', async () => {
    const { queryClient, unmount } = renderRealtime();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await flush();

    const socket = MockSocket.last();
    expect(socket.url).toBe('ws://localhost:8000/ws/branch/');
    act(() => socket.open());
    expect(socket.sent[0]).toMatchObject({ type: 'auth', branch_id: 1 });

    act(() => socket.receive({ type: 'auth.ok', branch_id: 1, user_id: ME }));
    expect(useConnectionStore.getState()).toMatchObject({ active: true, status: 'live' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orderKeys.all(1) });
    unmount();
  });

  it('closes and reopens the socket when the branch changes', async () => {
    const { rerender, unmount } = renderRealtime();
    await flush();
    const first = MockSocket.last();
    act(() => first.accept(1));

    branch.id = 2;
    rerender();
    await flush();

    expect(first.closedWith).toBe(CloseCode.NORMAL);
    const second = MockSocket.last();
    expect(second).not.toBe(first);
    act(() => second.open());
    expect(second.sent[0]).toMatchObject({ type: 'auth', branch_id: 2 });
    unmount();
  });

  it('closes the socket on logout', async () => {
    const { unmount } = renderRealtime();
    await flush();
    const socket = MockSocket.last();
    act(() => socket.accept(1));

    act(() => useAuthStore.getState().logout());

    expect(socket.closedWith).toBe(CloseCode.NORMAL);
    expect(useConnectionStore.getState()).toMatchObject({ active: false, status: 'offline' });
    unmount();
  });

  it('does not connect without a branch', async () => {
    branch.id = null;
    const { unmount } = renderRealtime();
    await flush();
    expect(MockSocket.instances).toHaveLength(0);
    expect(useConnectionStore.getState().active).toBe(false);
    unmount();
  });

  it("announces another user's new order with a toast and a highlight", async () => {
    const { unmount } = renderRealtime();
    await flush();
    const socket = MockSocket.last();
    act(() => socket.accept(1));
    const order = makeBoardOrder({ id: 43, number: 143, customer: { id: 9, phone: '3001112233', name: 'Andrés Rojas' } });

    act(() =>
      socket.receive({ type: 'order.created', event_id: 'a', sent_at: order.updated_at, actor_id: 8, branch_id: 1, order }),
    );

    const [toast] = useToastStore.getState().toasts;
    expect(toast.message).toBe('Nuevo domicilio #0143 — Andrés Rojas');
    expect(toast.action?.label).toBe('Ver');
    expect(useHighlightStore.getState().ids[43]).toBe(true);
    unmount();
  });

  it('stays quiet about my own new orders', async () => {
    const { unmount } = renderRealtime();
    await flush();
    const socket = MockSocket.last();
    act(() => socket.accept(1));
    const order = makeBoardOrder({ id: 44 });

    act(() =>
      socket.receive({ type: 'order.created', event_id: 'b', sent_at: order.updated_at, actor_id: ME, branch_id: 1, order }),
    );

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(useHighlightStore.getState().ids[44]).toBeUndefined();
    unmount();
  });
});

describe('useOrderRefreshInterval', () => {
  afterEach(() => useConnectionStore.setState({ status: 'offline', active: false }));

  it('polls every 15s without real time and every 60s while live', () => {
    const { result, rerender } = renderHook(() => useOrderRefreshInterval());
    expect(result.current).toBe(BOARD_REFRESH_MS);

    act(() => useConnectionStore.setState({ status: 'live', active: true }));
    rerender();
    expect(result.current).toBe(LIVE_REFRESH_MS);

    act(() => useConnectionStore.setState({ status: 'connecting' }));
    expect(result.current).toBe(BOARD_REFRESH_MS);
  });
});
