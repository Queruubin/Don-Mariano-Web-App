import { create } from 'zustand';

/** How long a new order's card stays highlighted. */
export const HIGHLIGHT_MS = 10_000;

interface HighlightState {
  ids: Record<number, true>;
}

export const useHighlightStore = create<HighlightState>(() => ({ ids: {} }));

const highlightTimers = new Map<number, ReturnType<typeof setTimeout>>();

function unhighlight(orderId: number): void {
  highlightTimers.delete(orderId);
  useHighlightStore.setState((state) => {
    const { [orderId]: _removed, ...ids } = state.ids;
    return { ids };
  });
}

/** Highlight a card for `HIGHLIGHT_MS` (again from the start if it already was). */
export function highlightOrder(orderId: number): void {
  const previous = highlightTimers.get(orderId);
  if (previous) clearTimeout(previous);
  highlightTimers.set(orderId, setTimeout(() => unhighlight(orderId), HIGHLIGHT_MS));
  useHighlightStore.setState((state) => ({ ids: { ...state.ids, [orderId]: true } }));
}

export function clearHighlights(): void {
  highlightTimers.forEach((timer) => clearTimeout(timer));
  highlightTimers.clear();
  useHighlightStore.setState({ ids: {} });
}

export function useIsHighlighted(orderId: number): boolean {
  return useHighlightStore((state) => Boolean(state.ids[orderId]));
}

// --- Tab title badge --------------------------------------------------------

let baseTitle: string | null = null;
let unseen = 0;

/** While the tab is hidden, count new orders in the title: "(2) Don Mariano · Domicilios". */
export function noteUnseenOrder(): void {
  if (document.visibilityState !== 'hidden') return;
  baseTitle ??= document.title;
  unseen += 1;
  document.title = `(${unseen}) ${baseTitle}`;
}

/** Back on the tab: remove the count. */
export function clearUnseenOrders(): void {
  if (baseTitle != null) document.title = baseTitle;
  baseTitle = null;
  unseen = 0;
}
