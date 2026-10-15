import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Warn before leaving a page with unsaved work: the browser's own prompt on
 * refresh or close, and a blocker for in-app navigation the page can confirm.
 */
export function useLeaveGuard(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a return value to show the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  return useBlocker(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
  );
}
