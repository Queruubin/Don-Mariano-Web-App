import { useConnectionStore, type ConnectionStatus } from './connectionStore';

const STATUS_META: Record<ConnectionStatus, { label: string; hint: string; dot: string }> = {
  live: {
    label: 'En vivo',
    hint: 'Los domicilios nuevos y los cambios aparecen al instante.',
    dot: 'bg-primary',
  },
  connecting: {
    label: 'Reconectando…',
    hint: 'Estamos recuperando la conexión. Mientras tanto, la lista se actualiza cada 15 segundos.',
    dot: 'bg-accent motion-safe:animate-pulse',
  },
  offline: {
    label: 'Sin conexión',
    hint: 'Sin conexión en vivo. La lista se actualiza cada 15 segundos.',
    dot: 'bg-status-cancelled',
  },
};

/** Real-time connection state in the header: a dot plus a label, never color alone. */
export function ConnectionIndicator() {
  const active = useConnectionStore((s) => s.active);
  const status = useConnectionStore((s) => s.status);
  if (!active) return null;
  const { label, hint, dot } = STATUS_META[status];

  return (
    <p role="status" title={hint} className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-0.5 text-sm font-bold text-text-muted desk:text-xs">
      <span aria-hidden="true" className={`size-3 shrink-0 rounded-full desk:size-2.5 ${dot}`} />
      {label}
      <span className="sr-only">. {hint}</span>
    </p>
  );
}
