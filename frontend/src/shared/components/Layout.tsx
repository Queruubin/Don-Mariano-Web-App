import { Outlet } from 'react-router-dom';
import { useOrderRealtime } from '../../orders/hooks/useOrderRealtime';
import { AppHeader } from './AppHeader';
import { AppNav } from './AppNav';
import { Toaster } from './Toaster';

/** Tablet-first shell: header on top, side rail on tablet/desktop, bottom bar on phones. */
export function Layout() {
  // One real-time connection for every page of the app (FR-30).
  useOrderRealtime();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <div className="flex flex-1">
        <AppNav />
        {/* Bottom padding keeps content clear of the phone bottom bar. */}
        <main className="min-w-0 flex-1 px-4 pt-5 pb-32 md:px-8 md:pb-10 desk:px-6 desk:pt-4 desk:pb-8">
          {/* Desktop gets a wider page so the board columns have room. */}
          <div className="mx-auto max-w-5xl desk:max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
