import { LoaderCircle, Plus, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import type { Product } from '../../../catalog/types/catalog.types';
import { unitLabel } from '../../../catalog/units';
import { cleanText, freeTextLine, lineFromProduct, type CartLine } from '../../form/orderForm';
import { AUTOCOMPLETE_MIN_CHARS, useProductAutocomplete } from '../../hooks/useOrders';

type Option = { kind: 'product'; product: Product } | { kind: 'free'; name: string };

interface ProductSearchProps {
  inputRef: Ref<HTMLInputElement>;
  error?: string;
  onAdd: (line: CartLine) => void;
}

/**
 * The cart's search box (FR-16, FR-18): type 2+ letters, then tap a match or
 * use the arrows and Enter. The last option always adds the text as a free product.
 * After adding, the box is cleared and keeps focus for the next product.
 */
export function ProductSearch({ inputRef, error, onAdd }: ProductSearchProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Enter pressed while results were loading: add the first match once they arrive.
  const [pendingEnter, setPendingEnter] = useState(false);
  const { products, isFresh, isSearching, isError } = useProductAutocomplete(query);

  const text = cleanText(query);
  const hasQuery = text.length >= AUTOCOMPLETE_MIN_CHARS;
  const canChoose = hasQuery && (isFresh || isError);
  const options: Option[] = hasQuery
    ? [...products.map((product) => ({ kind: 'product' as const, product })), { kind: 'free', name: text }]
    : [];
  const showList = open && hasQuery;
  const optionId = (index: number) => `${listId}-option-${index}`;

  const choose = (option: Option | undefined) => {
    if (!option) return;
    onAdd(option.kind === 'product' ? lineFromProduct(option.product) : freeTextLine(option.name));
    setQuery('');
    setActive(0);
    setPendingEnter(false);
  };

  const chooseFirst = useRef(() => {});
  chooseFirst.current = () => choose(options[0]);
  useEffect(() => {
    if (pendingEnter && canChoose) chooseFirst.current();
  }, [pendingEnter, canChoose]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive((index) => Math.min(index + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (!hasQuery) return;
        if (canChoose) choose(options[active]);
        else setPendingEnter(true);
        break;
      case 'Escape':
        if (showList) {
          event.preventDefault();
          setOpen(false);
        } else if (query) {
          event.preventDefault();
          setQuery('');
        }
        break;
    }
  };

  return (
    <div className="relative">
      <label htmlFor="order-product-search" className="field-label">
        Agregar producto
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-text-muted desk:left-3 desk:size-5" />
        <input
          ref={inputRef}
          id="order-product-search"
          type="text"
          role="combobox"
          autoComplete="off"
          enterKeyHint="enter"
          placeholder="Escriba el producto, ej: aguacate"
          className="input min-h-14 pr-12 pl-12 text-lg desk:min-h-11 desk:pr-10 desk:pl-10 desk:text-base"
          value={query}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'order-lines-error' : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
            setPendingEnter(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {hasQuery && isSearching && (
          <LoaderCircle
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 size-6 -translate-y-1/2 animate-spin text-text-muted desk:right-3 desk:size-5"
          />
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Productos encontrados"
        hidden={!showList}
        className="absolute inset-x-0 z-20 mt-1 max-h-[22rem] overflow-y-auto rounded-2xl border-2 border-border bg-surface py-1 shadow-lg desk:rounded-xl"
      >
        {options.map((option, index) => (
          <li
            key={option.kind === 'product' ? option.product.id : 'free'}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // Keep focus in the search box so the next product can be typed right away.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
            onMouseEnter={() => setActive(index)}
            className={`flex min-h-12 items-center gap-3 px-4 py-2 text-lg desk:min-h-9 desk:px-3 desk:py-1.5 desk:text-base ${index === active ? 'bg-primary-soft' : ''} ${option.kind === 'free' ? 'border-t border-border font-semibold text-primary-hover' : ''}`}
          >
            {option.kind === 'product' ? (
              <>
                <span className="min-w-0 flex-1 break-words font-semibold">{option.product.name}</span>
                <span className="shrink-0 text-base text-text-muted desk:text-sm">{unitLabel(option.product.default_unit)}</span>
              </>
            ) : (
              <>
                <Plus aria-hidden="true" className="size-5 shrink-0 desk:size-4" />
                <span className="min-w-0 break-words">Agregar «{option.name}» como producto libre</span>
              </>
            )}
          </li>
        ))}
      </ul>

      <p className="sr-only" aria-live="polite">
        {showList && canChoose
          ? products.length
            ? `${products.length} productos encontrados`
            : 'No está en el catálogo. Puede agregarlo como producto libre.'
          : ''}
      </p>
    </div>
  );
}
