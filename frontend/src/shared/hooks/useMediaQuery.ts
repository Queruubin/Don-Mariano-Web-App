import { useCallback, useSyncExternalStore } from 'react';

const hasMatchMedia = () => typeof window.matchMedia === 'function';

/**
 * True while the media query matches. Without `matchMedia` (tests, very old
 * browsers) it returns `fallback`.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!hasMatchMedia()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      // Some embedded browsers and emulators resize without a "change" event.
      window.addEventListener('resize', onChange);
      return () => {
        list.removeEventListener('change', onChange);
        window.removeEventListener('resize', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (hasMatchMedia() ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}
