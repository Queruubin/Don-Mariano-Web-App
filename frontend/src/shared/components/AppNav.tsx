import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../auth/store/authStore';
import { navItemsFor } from '../navigation';

export function AppNav() {
  const role = useAuthStore((s) => s.user?.role);
  const items = navItemsFor(role);

  return (
    <nav
      aria-label="Menú principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:sticky md:top-[4.5rem] md:h-[calc(100dvh-4.5rem)] md:w-32 md:shrink-0 md:border-t-0 md:border-r md:bg-bg desk:top-14 desk:h-[calc(100dvh-3.5rem)] desk:w-24"
    >
      <ul className="flex justify-around md:flex-col md:justify-start md:gap-2 md:p-3 desk:gap-1 desk:p-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1 md:flex-none">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-sm font-bold md:rounded-2xl md:py-3 desk:min-h-14 desk:gap-0.5 desk:rounded-xl desk:py-2 desk:text-xs',
                  isActive
                    ? 'text-primary-hover md:bg-primary-soft'
                    : 'text-text-muted hover:bg-surface-alt',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-9 w-14 items-center justify-center rounded-full desk:h-7 ${isActive ? 'bg-primary-soft md:bg-transparent' : ''}`}
                  >
                    <Icon aria-hidden="true" className="size-6 desk:size-5" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
