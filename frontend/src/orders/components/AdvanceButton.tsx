import { useIsMutating } from '@tanstack/react-query';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { orderKeys } from '../cache';
import { useAdvanceOrder } from '../hooks/useOrders';
import { formatOrderNumber, NEXT_ACTION_LABEL, nextStatus, STATUS_META } from '../labels';
import type { BoardOrder, Order } from '../types/order.types';

/**
 * The one-tap "next status" button (FR-28). Forward steps need no confirmation,
 * so the label always says exactly what will happen.
 */
export function AdvanceButton({ order, className = '' }: { order: BoardOrder | Order; className?: string }) {
  const { id: branchId } = useActiveBranch();
  const advance = useAdvanceOrder();
  // Any change of this order still on its way (it may have started on another card).
  const busy =
    useIsMutating({
      mutationKey: orderKeys.lifecycle(branchId),
      predicate: (mutation) => (mutation.state.variables as { id?: number } | undefined)?.id === order.id,
    }) > 0;

  const label = NEXT_ACTION_LABEL[order.status];
  const next = nextStatus(order.status);
  if (!label || !next) return null;
  const Icon = STATUS_META[next].icon;

  return (
    <button
      type="button"
      className={`btn btn-primary min-h-14 text-lg desk:min-h-10 desk:text-base ${className}`}
      disabled={busy}
      title={`${label}: domicilio ${formatOrderNumber(order.number)}`}
      onClick={() => advance.mutate(order)}
    >
      <Icon aria-hidden="true" className="size-6 desk:size-5" />
      {label}
    </button>
  );
}
