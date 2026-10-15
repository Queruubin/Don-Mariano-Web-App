import { ShoppingBasket } from 'lucide-react';
import type { Ref } from 'react';
import type { Unit } from '../../../catalog/types/catalog.types';
import { lineErrorKey, productsLabel, type CartLine, type OrderFormErrors } from '../../form/orderForm';
import { CartLineRow } from './CartLineRow';
import { FieldError } from './FieldError';
import { ProductSearch } from './ProductSearch';
import { SectionCard } from './SectionCard';

interface CartSectionProps {
  lines: CartLine[];
  errors: OrderFormErrors;
  /** The line added last, highlighted so it is easy to spot. */
  lastAddedKey: string | null;
  searchRef: Ref<HTMLInputElement>;
  onAdd: (line: CartLine) => void;
  onQuantityChange: (key: string, value: string) => void;
  onUnitChange: (key: string, unit: Unit) => void;
  onNotesChange: (key: string, value: string) => void;
  onRemove: (key: string) => void;
}

/** The cart (FR-16..19). The newest line is shown first, right under the search box. */
export function CartSection({
  lines,
  errors,
  lastAddedKey,
  searchRef,
  onAdd,
  onQuantityChange,
  onUnitChange,
  onNotesChange,
  onRemove,
}: CartSectionProps) {
  const newestFirst = [...lines].reverse();
  return (
    <SectionCard
      title="Productos"
      icon={ShoppingBasket}
      className="lg:col-start-1 lg:row-span-2 lg:row-start-1"
      aside={
        lines.length > 0 && (
          <span className="rounded-full bg-surface px-3 py-1 font-bold text-text-muted">{productsLabel(lines.length)}</span>
        )
      }
    >
      <ProductSearch inputRef={searchRef} error={errors.lines} onAdd={onAdd} />
      <FieldError id="order-lines-error" message={errors.lines} />

      {lines.length === 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center text-text-muted">
          <ShoppingBasket aria-hidden="true" className="mx-auto mb-2 size-10" />
          <p className="text-lg font-bold">Todavía no hay productos</p>
          <p>Escriba arriba el nombre del producto y tóquelo para agregarlo.</p>
        </div>
      ) : (
        <ul aria-label="Productos del domicilio" className="mt-4 space-y-3">
          {newestFirst.map((line) => (
            <CartLineRow
              key={line.key}
              line={line}
              error={errors[lineErrorKey(line.key)]}
              highlighted={line.key === lastAddedKey}
              onQuantityChange={(value) => onQuantityChange(line.key, value)}
              onUnitChange={(unit) => onUnitChange(line.key, unit)}
              onNotesChange={(value) => onNotesChange(line.key, value)}
              onRemove={() => onRemove(line.key)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
