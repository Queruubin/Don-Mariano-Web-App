import { Minus, Plus } from 'lucide-react';
import type { Unit } from '../../../catalog/types/catalog.types';
import { canDecrease, decreaseQuantity, increaseQuantity, sanitizeQuantityInput } from '../../form/quantity';

interface QuantityStepperProps {
  id: string;
  /** Product name, for the accessible labels ("Cantidad de Papaya"). */
  itemName: string;
  value: string;
  unit: Unit;
  invalid?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

/** Big − / + buttons plus direct typing; decimals allowed (FR-17). */
export function QuantityStepper({ id, itemName, value, unit, invalid, describedBy, onChange }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="btn btn-secondary size-12 shrink-0 px-0 desk:size-10"
        aria-label={`Disminuir cantidad de ${itemName}`}
        disabled={!canDecrease(value, unit)}
        onClick={() => onChange(decreaseQuantity(value, unit))}
      >
        <Minus aria-hidden="true" className="size-6 desk:size-5" />
      </button>
      <label htmlFor={id} className="sr-only">
        Cantidad de {itemName}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="input w-24 px-2 text-center text-xl font-bold tabular-nums desk:w-20 desk:text-lg"
        value={value}
        onChange={(event) => onChange(sanitizeQuantityInput(event.target.value))}
        onFocus={(event) => event.target.select()}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        className="btn btn-secondary size-12 shrink-0 px-0 desk:size-10"
        aria-label={`Aumentar cantidad de ${itemName}`}
        onClick={() => onChange(increaseQuantity(value, unit))}
      >
        <Plus aria-hidden="true" className="size-6 desk:size-5" />
      </button>
    </div>
  );
}
