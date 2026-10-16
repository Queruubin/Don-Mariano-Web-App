import { CircleAlert, CircleCheck, CirclePlus, RefreshCw, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { describeChange } from '../importSummary';
import type { ImportPreview as Preview, ImportRow } from '../types/catalog.types';
import { unitLabel } from '../units';

type GroupKey = 'new' | 'updated' | 'unchanged' | 'invalid';

interface GroupConfig {
  key: GroupKey;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}

const GROUPS: readonly GroupConfig[] = [
  {
    key: 'new',
    title: 'Nuevos',
    description: 'Se agregan al catálogo.',
    icon: CirclePlus,
    iconClass: 'text-primary',
  },
  {
    key: 'updated',
    title: 'Se actualizan',
    description: 'Ya existen y van a cambiar.',
    icon: RefreshCw,
    iconClass: 'text-text-muted',
  },
  {
    key: 'unchanged',
    title: 'Sin cambios',
    description: 'Ya están iguales en el catálogo.',
    icon: CircleCheck,
    iconClass: 'text-text-muted',
  },
  {
    key: 'invalid',
    title: 'Con errores',
    description: 'No se van a importar. Corríjalos en el Excel si los necesita.',
    icon: CircleAlert,
    iconClass: 'text-danger',
  },
];

/** Rows rendered per group before asking to show the rest (files can have 5,000 rows). */
const VISIBLE_ROWS = 50;

function RowItem({ row, group }: { row: ImportRow; group: GroupKey }) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-3 desk:rounded-xl desk:px-3 desk:py-2 desk:text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-bold text-text-muted">Fila {row.row}</span>
        <span className="font-bold">{row.name || 'Sin nombre'}</span>
        {row.unit && (
          <span className="rounded-full bg-surface-alt px-2 text-sm font-semibold text-text-muted">
            {unitLabel(row.unit)}
          </span>
        )}
        {row.category && <span className="text-sm text-text-muted">{row.category}</span>}
      </div>
      {group === 'updated' && row.changes && (
        <ul className="mt-1 list-disc pl-6 text-text-muted">
          {row.changes.map((change) => (
            <li key={change.field}>{describeChange(change)}</li>
          ))}
        </ul>
      )}
      {row.errors && (
        <ul className="mt-1 space-y-1">
          {row.errors.map((error) => (
            <li key={error} className="flex items-start gap-2 font-semibold text-danger">
              <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
              {error}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Group({ config, rows }: { config: GroupConfig; rows: ImportRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, VISIBLE_ROWS);
  const Icon = config.icon;
  const headingId = `import-group-${config.key}`;

  return (
    <section aria-labelledby={headingId} className="rounded-3xl bg-surface-alt/60 p-3 desk:rounded-2xl desk:p-2.5">
      <details open={config.key !== 'unchanged'}>
        <summary className="flex min-h-12 items-center gap-3 rounded-2xl px-2 desk:min-h-10 desk:gap-2.5 desk:rounded-xl">
          <Icon aria-hidden="true" className={`size-6 shrink-0 desk:size-5 ${config.iconClass}`} />
          <span>
            <span id={headingId} className="block text-lg font-bold desk:text-base">
              {config.title} ({rows.length})
            </span>
            <span className="block text-text-muted desk:text-sm">{config.description}</span>
          </span>
        </summary>
        <ul className="mt-2 space-y-2">
          {visible.map((row) => (
            <RowItem key={row.row} row={row} group={config.key} />
          ))}
        </ul>
        {rows.length > visible.length && (
          <button type="button" className="btn btn-ghost mt-2 w-full" onClick={() => setShowAll(true)}>
            Ver las {rows.length - visible.length} filas restantes
          </button>
        )}
      </details>
    </section>
  );
}

export function ImportPreview({ preview }: { preview: Preview }) {
  return (
    <div className="space-y-4 desk:space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GROUPS.map((group) => (
          <div key={group.key} className="card p-3 text-center desk:py-2">
            <dt className="text-text-muted desk:text-sm">{group.title}</dt>
            <dd className="font-display text-2xl font-bold">{preview.counts[group.key]}</dd>
          </div>
        ))}
      </dl>
      {GROUPS.filter((group) => preview[group.key].length > 0).map((group) => (
        <Group key={group.key} config={group} rows={preview[group.key]} />
      ))}
    </div>
  );
}
