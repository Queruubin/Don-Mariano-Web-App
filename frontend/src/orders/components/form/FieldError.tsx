import { CircleAlert } from 'lucide-react';

/** Inline, friendly validation message next to a field (FR-24). */
export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error flex items-start gap-1">
      <CircleAlert aria-hidden="true" className="mt-1 size-5 shrink-0 desk:mt-0.5 desk:size-4" />
      <span>{message}</span>
    </p>
  );
}
