import { Send } from 'lucide-react';
import { formatCOP } from '../../form/money';
import { productsLabel } from '../../form/orderForm';

interface OrderSummaryBarProps {
  lineCount: number;
  total: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: () => void;
}

/** Always-visible footer: what is in the order and the big publish button (FR-24). */
export function OrderSummaryBar({ lineCount, total, submitLabel, busy, onSubmit }: OrderSummaryBarProps) {
  return (
    // Sits above the phone bottom navigation; at the window bottom from tablet up.
    <div className="sticky bottom-[4.25rem] z-20 -mx-4 mt-4 border-t-2 border-border bg-surface/95 px-4 py-2 md:py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-3xl md:border-2 md:shadow-lg desk:bottom-3 desk:rounded-2xl desk:py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg desk:text-base">
          <strong>{productsLabel(lineCount)}</strong>
          {total && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">Total {formatCOP(total)}</span>
            </>
          )}
        </p>
        <button
          type="button"
          className="btn btn-primary min-h-14 flex-1 px-6 text-xl whitespace-nowrap sm:flex-none sm:px-8 desk:min-h-10 desk:px-6 desk:text-base"
          onClick={onSubmit}
          disabled={busy}
        >
          <Send aria-hidden="true" className="size-6 desk:size-5" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
