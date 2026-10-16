import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Unit } from '../../../catalog/types/catalog.types';
import { UNITS } from '../../../catalog/units';
import type { CartLine } from '../../form/orderForm';
import { FieldError } from './FieldError';
import { QuantityStepper } from './QuantityStepper';

interface CartLineRowProps {
  line: CartLine;
  error?: string;
  highlighted: boolean;
  onQuantityChange: (value: string) => void;
  onUnitChange: (unit: Unit) => void;
  onNotesChange: (value: string) => void;
  onRemove: () => void;
}

/** One cart line (FR-17): quantity, unit, an optional note and a remove button. */
export function CartLineRow({
  line,
  error,
  highlighted,
  onQuantityChange,
  onUnitChange,
  onNotesChange,
  onRemove,
}: CartLineRowProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const showNotes = notesOpen || line.notes !== '';
  const baseId = `order-line-${line.key}`;
  const errorId = `${baseId}-error`;

  return (
    <li
      className={`rounded-2xl border-2 p-3 transition-colors desk:rounded-xl desk:px-3 desk:py-2 ${highlighted ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold break-words">{line.name}</p>
          {line.productId == null && (
            <span className="mt-0.5 inline-block rounded-full bg-surface-alt px-2.5 py-0.5 text-sm font-bold text-text-muted">
              Producto libre
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost size-12 shrink-0 px-0 text-danger hover:bg-danger-soft desk:size-9 desk:min-h-9"
          aria-label={`Quitar ${line.name}`}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-6 desk:size-5" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <QuantityStepper
          id={`${baseId}-quantity`}
          itemName={line.name}
          value={line.quantity}
          unit={line.unit}
          invalid={Boolean(error)}
          describedBy={error ? errorId : undefined}
          onChange={onQuantityChange}
        />
        <label htmlFor={`${baseId}-unit`} className="sr-only">
          Unidad de {line.name}
        </label>
        <select
          id={`${baseId}-unit`}
          className="input w-auto min-w-0 flex-1 basis-32 py-2 font-semibold desk:max-w-56 desk:py-1.5"
          value={line.unit}
          onChange={(event) => onUnitChange(event.target.value as Unit)}
        >
          {UNITS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>
      <FieldError id={errorId} message={error} />

      {showNotes ? (
        <div className="mt-2">
          <label htmlFor={`${baseId}-notes`} className="mb-1 block font-semibold text-text-muted desk:text-sm">
            Observación
          </label>
          <input
            id={`${baseId}-notes`}
            type="text"
            autoComplete="off"
            maxLength={255}
            placeholder="Ej: muy madura"
            className="input"
            value={line.notes}
            // Opened on purpose: focus it so the note can be typed right away.
            autoFocus={notesOpen && line.notes === ''}
            onChange={(event) => onNotesChange(event.target.value)}
            onBlur={() => setNotesOpen(false)}
          />
        </div>
      ) : (
        <button type="button" className="btn btn-ghost mt-1 -ml-2 px-3 text-base desk:min-h-8 desk:text-sm" onClick={() => setNotesOpen(true)}>
          <MessageSquarePlus aria-hidden="true" className="size-5 desk:size-4" />
          Agregar observación
        </button>
      )}
    </li>
  );
}
