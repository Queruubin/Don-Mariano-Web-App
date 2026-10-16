import { ChevronDown, CircleCheck, Plus, Search, WifiOff, type LucideIcon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { useNow } from '../../../shared/hooks/useNow';
import { ErrorState, ListSkeleton } from '../../../shared/components/StatusViews';
import { apiErrorMessage } from '../../../shared/utils/apiErrors';
import { BOARD_SECTIONS, groupBoard, type BoardSection } from '../../board';
import { useBoardOrders } from '../../hooks/useOrders';
import { STATUS_META } from '../../labels';
import type { BoardOrder } from '../../types/order.types';
import { OrderCard } from './OrderCard';
import { SoundPrompt } from './SoundPrompt';

export const NEW_ORDER_PATH = '/domicilios/nuevo';
/** Columns from the Tailwind `lg` breakpoint (tablet in landscape and desktop). */
export const WIDE_BOARD_QUERY = '(min-width: 64rem)';

const SECTION_META: Record<BoardSection, { title: string; icon: LucideIcon; empty: string; header: string }> = {
  pending: {
    title: 'Pendientes',
    icon: STATUS_META.pending.icon,
    empty: 'No hay domicilios pendientes.',
    header: 'border-status-pending bg-accent-soft',
  },
  preparing: {
    title: 'Alistando',
    icon: STATUS_META.preparing.icon,
    empty: 'No hay domicilios alistándose.',
    header: 'border-status-preparing bg-surface-alt',
  },
  on_the_way: {
    title: 'En camino',
    icon: STATUS_META.on_the_way.icon,
    empty: 'No hay domicilios en camino.',
    header: 'border-status-on-the-way bg-surface',
  },
  finished: {
    title: 'Terminados hoy',
    icon: CircleCheck,
    empty: 'Todavía no hay domicilios entregados ni cancelados hoy.',
    header: 'border-status-delivered bg-primary-soft',
  },
};

const NO_MATCH = 'Ningún domicilio coincide con la búsqueda.';

function CardList({ orders, now, empty, wide }: { orders: BoardOrder[]; now: number; empty: string; wide?: boolean }) {
  if (orders.length === 0) {
    return <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-text-muted desk:rounded-2xl desk:p-4 desk:text-sm">
        {empty}
      </p>;
  }
  return (
    <ul className={`grid gap-3 ${wide ? 'sm:grid-cols-2 lg:grid-cols-3 desk:grid-cols-4' : ''}`}>
      {orders.map((order) => (
        <li key={order.id} className="min-w-0">
          <OrderCard order={order} now={now} />
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ section, count, id }: { section: BoardSection; count: number; id: string }) {
  const { title, icon: Icon, header } = SECTION_META[section];
  return (
    <h2
      id={id}
      className={`mb-3 flex items-center gap-2 rounded-2xl border-b-4 px-4 py-2 text-xl desk:mb-2 desk:rounded-xl desk:px-3 desk:py-1.5 desk:text-base ${header}`}
    >
      <Icon aria-hidden="true" className="size-6 shrink-0 desk:size-5" />
      <span className="flex-1">{title}</span>
      <span className="rounded-full bg-surface px-3 font-sans tabular-nums desk:px-2.5 desk:text-sm">{count}</span>
    </h2>
  );
}

/** Tablet in landscape and desktop: one column per active status, finished orders below. */
function BoardColumns({ groups, now, filtered }: { groups: Record<BoardSection, BoardOrder[]>; now: number; filtered: boolean }) {
  const baseId = useId();
  const [showFinished, setShowFinished] = useState(false);
  const finishedOpen = showFinished || (filtered && groups.finished.length > 0);
  const finishedPanel = `${baseId}-finished`;
  const finishedMeta = SECTION_META.finished;

  return (
    <div className="space-y-6 desk:space-y-5">
      <div className="grid grid-cols-3 items-start gap-4 desk:gap-5">
        {(['pending', 'preparing', 'on_the_way'] as const).map((section) => (
          <section key={section} aria-labelledby={`${baseId}-${section}`} className="min-w-0">
            <SectionHeading section={section} count={groups[section].length} id={`${baseId}-${section}`} />
            <CardList orders={groups[section]} now={now} empty={filtered ? NO_MATCH : SECTION_META[section].empty} />
          </section>
        ))}
      </div>

      <section aria-labelledby={`${baseId}-finished-title`}>
        <h2 id={`${baseId}-finished-title`} className="text-xl desk:text-base">
          <button
            type="button"
            aria-expanded={finishedOpen}
            aria-controls={finishedPanel}
            onClick={() => setShowFinished((open) => !open)}
            className={`flex min-h-14 w-full items-center gap-2 rounded-2xl border-b-4 px-4 py-2 text-left desk:min-h-10 desk:rounded-xl desk:px-3 desk:py-1.5 ${finishedMeta.header}`}
          >
            <finishedMeta.icon aria-hidden="true" className="size-6 shrink-0 desk:size-5" />
            <span className="flex-1">{finishedMeta.title}</span>
            <span className="rounded-full bg-surface px-3 font-sans tabular-nums desk:px-2.5 desk:text-sm">
              {groups.finished.length}
            </span>
            <ChevronDown aria-hidden="true" className={`size-6 transition-transform desk:size-5 ${finishedOpen ? 'rotate-180' : ''}`} />
          </button>
        </h2>
        {finishedOpen && (
          <div id={finishedPanel} className="mt-3">
            <CardList orders={groups.finished} now={now} empty={filtered ? NO_MATCH : finishedMeta.empty} wide />
          </div>
        )}
      </section>
    </div>
  );
}

/** Phones and tablets in portrait: one tab per section, with counts. */
function BoardTabs({ groups, now, filtered }: { groups: Record<BoardSection, BoardOrder[]>; now: number; filtered: boolean }) {
  const baseId = useId();
  const [selected, setSelected] = useState<BoardSection>('pending');

  return (
    <div>
      <div role="tablist" aria-label="Estados de los domicilios" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BOARD_SECTIONS.map((section) => {
          const { title, icon: Icon } = SECTION_META[section];
          const isSelected = section === selected;
          return (
            <button
              key={section}
              type="button"
              role="tab"
              id={`${baseId}-tab-${section}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel`}
              onClick={() => setSelected(section)}
              className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-1.5 font-bold ${
                isSelected ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-muted hover:bg-surface-alt'
              }`}
            >
              <span className="max-w-full break-words text-center leading-tight">{title}</span>
              <span className="flex items-center gap-1.5">
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span
                  className={`rounded-full px-2 tabular-nums ${isSelected ? 'bg-white text-primary-hover' : 'bg-surface-alt text-text'}`}
                >
                  {groups[section].length}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${selected}`}>
        <CardList
          orders={groups[selected]}
          now={now}
          empty={filtered ? NO_MATCH : SECTION_META[selected].empty}
          wide
        />
      </div>
    </div>
  );
}

/** Branch home: every active order by status, plus today's finished ones (FR-27). */
export function OrderBoardPage() {
  const board = useBoardOrders();
  const wide = useMediaQuery(WIDE_BOARD_QUERY);
  const now = useNow();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupBoard(board.data ?? [], query), [board.data, query]);

  let content;
  if (board.isPending) {
    content = <ListSkeleton />;
  } else if (board.isError && !board.data) {
    content = (
      <ErrorState
        message={`No pudimos cargar los domicilios. ${apiErrorMessage(board.error)}`}
        onRetry={() => board.refetch()}
      />
    );
  } else {
    const filtered = query.trim() !== '';
    content = wide ? (
      <BoardColumns groups={groups} now={now} filtered={filtered} />
    ) : (
      <BoardTabs groups={groups} now={now} filtered={filtered} />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 desk:mb-3">
        <h1 className="text-3xl">Domicilios</h1>
        <Link
          to={NEW_ORDER_PATH}
          className="btn btn-primary min-h-16 w-full px-8 text-xl sm:w-auto desk:min-h-10 desk:px-5 desk:text-base"
        >
          <Plus aria-hidden="true" className="size-7 desk:size-5" />
          Nuevo domicilio
        </Link>
      </div>

      <SoundPrompt />

      <div className="relative mb-4">
        <label htmlFor="board-search" className="sr-only">
          Buscar domicilio
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-text-muted desk:left-3 desk:size-5" />
        <input
          id="board-search"
          type="search"
          className="input pl-12 desk:max-w-xl desk:pl-10"
          placeholder="Buscar por número, cliente o teléfono"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </div>

      {board.isError && board.data && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3 font-semibold text-danger desk:rounded-xl desk:py-2 desk:text-sm">
          <WifiOff aria-hidden="true" className="size-5 shrink-0" />
          No pudimos actualizar los domicilios. Lo intentaremos de nuevo en unos segundos.
        </p>
      )}

      {content}
    </div>
  );
}
