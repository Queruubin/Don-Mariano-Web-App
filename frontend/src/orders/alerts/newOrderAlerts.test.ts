import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHighlights,
  clearUnseenOrders,
  HIGHLIGHT_MS,
  highlightOrder,
  noteUnseenOrder,
  useIsHighlighted,
} from './newOrderAlerts';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

describe('card highlight', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    clearHighlights();
    vi.useRealTimers();
  });

  it('lasts ten seconds', () => {
    const { result } = renderHook(() => useIsHighlighted(5));
    act(() => highlightOrder(5));
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(HIGHLIGHT_MS - 1));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });

  it('starts over when the same order is highlighted again', () => {
    const { result } = renderHook(() => useIsHighlighted(5));
    act(() => highlightOrder(5));
    act(() => vi.advanceTimersByTime(HIGHLIGHT_MS - 1_000));
    act(() => highlightOrder(5));
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current).toBe(true);
  });
});

describe('tab title badge', () => {
  const TITLE = 'Don Mariano · Domicilios';

  beforeEach(() => {
    document.title = TITLE;
  });

  afterEach(() => {
    clearUnseenOrders();
    setVisibility('visible');
  });

  it('counts new orders while the tab is hidden and clears on return', () => {
    setVisibility('hidden');
    noteUnseenOrder();
    noteUnseenOrder();
    expect(document.title).toBe(`(2) ${TITLE}`);

    setVisibility('visible');
    clearUnseenOrders();
    expect(document.title).toBe(TITLE);
  });

  it('does nothing while the tab is visible', () => {
    setVisibility('visible');
    noteUnseenOrder();
    expect(document.title).toBe(TITLE);
  });
});
