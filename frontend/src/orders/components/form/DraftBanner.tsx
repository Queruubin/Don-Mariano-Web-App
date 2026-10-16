import { History, Trash2 } from 'lucide-react';

/** Shown when a half-taken order was recovered from this device (FR-25). */
export function DraftBanner({ onDiscard, onDismiss }: { onDiscard: () => void; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border-2 border-accent bg-accent-soft px-4 py-3 desk:rounded-2xl desk:py-2.5"
    >
      <History aria-hidden="true" className="size-7 shrink-0 text-text-muted desk:size-6" />
      <p className="min-w-0 flex-1 basis-56 text-lg desk:text-base">
        <strong className="block">Tiene un domicilio sin terminar</strong>
        Lo recuperamos para que pueda seguir donde iba.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={onDismiss}>
          Seguir con este
        </button>
        <button type="button" className="btn btn-ghost text-danger hover:bg-danger-soft" onClick={onDiscard}>
          <Trash2 aria-hidden="true" className="size-5 desk:size-4" />
          Descartar
        </button>
      </div>
    </div>
  );
}
