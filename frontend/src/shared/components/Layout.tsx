import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppNav } from './AppNav';
import { Toaster } from './Toaster';

/** Tablet-first shell: header on top, side rail on tablet/desktop, bottom bar on phones. */
export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <div className="flex flex-1">
        <AppNav />
        {/* Bottom padding keeps content clear of the phone bottom bar. */}
        <main className="min-w-0 flex-1 px-4 pt-5 pb-32 md:px-8 md:pb-10">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
