import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isTokenExpired } from '../../auth/jwt';
import { useAuthStore } from '../../auth/store/authStore';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { websocketUrl } from '../../realtime/config';
import { useConnectionStore } from '../../realtime/connectionStore';
import { RealtimeClient } from '../../realtime/RealtimeClient';
import { showToast } from '../../shared/toast/toastStore';
import { refreshAccessToken } from '../../shared/utils/api';
import { clearUnseenOrders, highlightOrder, noteUnseenOrder } from '../alerts/newOrderAlerts';
import { playNewOrderSound, unlockSound, useSoundStore } from '../alerts/sound';
import { invalidateOrders } from '../cache';
import { orderPath } from '../format';
import { formatOrderNumber } from '../labels';
import { createOrderEventHandler } from '../realtime';
import type { BoardOrder } from '../types/order.types';

/** How long the "Nuevo domicilio" toast stays, as long as the card highlight. */
export const NEW_ORDER_TOAST_MS = 10_000;

/** The stored access token, refreshed first when it expired. Null when there is none to use. */
async function currentAccessToken(): Promise<string | null> {
  const access = useAuthStore.getState().tokens?.access;
  if (!access) return null;
  if (!isTokenExpired(access)) return access;
  return refreshAccessToken().catch(() => null);
}

function forceRefresh(): Promise<string | null> {
  return refreshAccessToken().catch(() => null);
}

/** Sound, highlight, tab-title count and toast for an order someone else just took (FR-30). */
export function useNewOrderAlert(): (order: BoardOrder) => void {
  const navigate = useNavigate();
  const soundEnabled = useSoundStore((s) => s.enabled);
  const audio = useSoundStore((s) => s.audio);

  // Back on the tab: drop the "(2)" from the title.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') clearUnseenOrders();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', clearUnseenOrders);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', clearUnseenOrders);
    };
  }, []);

  // Sound was enabled on an earlier visit: unlock audio on the first tap or key press.
  useEffect(() => {
    if (!soundEnabled || audio !== 'locked') return;
    const unlock = () => void unlockSound({ remember: false });
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [soundEnabled, audio]);

  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Stable, so the socket is not reopened when the route changes.
  return useCallback((order: BoardOrder) => {
    playNewOrderSound();
    highlightOrder(order.id);
    noteUnseenOrder();
    showToast(`Nuevo domicilio ${formatOrderNumber(order.number)} — ${order.customer.name}`, 'info', {
      durationMs: NEW_ORDER_TOAST_MS,
      action: { label: 'Ver', onClick: () => void navigateRef.current(orderPath(order.id)) },
    });
  }, []);
}

/**
 * One real-time connection per tab while a user is logged in and a branch is
 * active (PRD FR-30). It reopens on branch change and closes on logout. Events
 * patch the order cache; each (re)connection refetches once to catch up.
 */
export function useOrderRealtime(): void {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => (s.isAuthenticated ? (s.user?.id ?? null) : null));
  const { id: branchId } = useActiveBranch();
  const onNewOrder = useNewOrderAlert();

  useEffect(() => {
    const connection = useConnectionStore.getState();
    if (userId == null || branchId == null) {
      connection.setActive(false);
      return;
    }
    connection.setActive(true);
    const client = new RealtimeClient({
      url: websocketUrl(),
      branchId,
      getToken: currentAccessToken,
      refreshToken: forceRefresh,
      onEvent: createOrderEventHandler(queryClient, branchId, { currentUserId: userId, onNewOrder }),
      onStatus: connection.setStatus,
      onLive: () => void invalidateOrders(queryClient, branchId),
    });
    client.start();
    return () => {
      client.stop();
      useConnectionStore.getState().setActive(false);
    };
  }, [queryClient, userId, branchId, onNewOrder]);
}
