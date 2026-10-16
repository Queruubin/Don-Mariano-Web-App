import { Clock, MessageSquareText, ShoppingBasket, Sparkles } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useIsHighlighted } from '../../alerts/newOrderAlerts';
import { itemCountLabel, money, orderPath } from '../../format';
import { formatOrderNumber, paymentMeta } from '../../labels';
import { timeAgo } from '../../time';
import type { BoardOrder, OrderStatus } from '../../types/order.types';
import { AdvanceButton } from '../AdvanceButton';
import { StatusBadge } from '../StatusBadge';

/** Thick left edge in the status color, as a second cue next to the badge. */
const EDGE: Record<OrderStatus, string> = {
  pending: 'border-l-status-pending',
  preparing: 'border-l-status-preparing',
  on_the_way: 'border-l-status-on-the-way',
  delivered: 'border-l-status-delivered',
  cancelled: 'border-l-status-cancelled',
};

export function OrderCard({ order, now }: { order: BoardOrder; now: number }) {
  const titleId = useId();
  const payment = paymentMeta(order.payment_method);
  const PaymentIcon = payment?.icon;
  // A new order from someone else glows for a few seconds (FR-30).
  const isNew = useIsHighlighted(order.id);

  return (
    <article
      aria-labelledby={titleId}
      data-new={isNew || undefined}
      className={`card flex min-w-0 flex-col gap-3 border-l-8 p-4 desk:gap-2 desk:border-l-[6px] desk:p-3 ${EDGE[order.status]} ${
        isNew ? 'ring-4 ring-accent motion-safe:animate-new-order' : ''
      }`}
    >
      {isNew && (
        <p className="-mb-1 inline-flex items-center gap-1.5 self-start rounded-full bg-accent px-3 font-bold text-text desk:mb-0 desk:text-sm">
          <Sparkles aria-hidden="true" className="size-5 desk:size-4" />
          Nuevo
        </p>
      )}
      <Link to={orderPath(order.id)} className="-m-2 block min-w-0 rounded-2xl p-2 hover:bg-surface-alt desk:-m-1.5 desk:rounded-xl desk:p-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} className="text-3xl tabular-nums desk:text-2xl">
            {formatOrderNumber(order.number)}
          </h3>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-lg font-bold break-words desk:mt-0.5 desk:text-base">{order.customer.name}</p>
        <p className="line-clamp-2 break-words text-text-muted desk:text-sm">{order.address_snapshot}</p>
      </Link>

      <div className="space-y-1 desk:space-y-0.5 desk:text-sm">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 desk:gap-x-3">
          <span className="inline-flex items-center gap-1.5">
            <ShoppingBasket aria-hidden="true" className="size-5 text-text-muted desk:size-4" />
            {itemCountLabel(order.item_count)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {PaymentIcon && <PaymentIcon aria-hidden="true" className="size-5 text-text-muted desk:size-4" />}
            {payment?.label}
          </span>
          <span className="text-xl font-bold tabular-nums desk:text-lg">{money(order.total_amount)}</span>
        </p>
        {order.payment_method === 'cash' && order.pays_with && (
          <p className="font-semibold">
            Paga con {money(order.pays_with)}
            {order.change_due && order.change_due !== '0' && <> · Cambio {money(order.change_due)}</>}
          </p>
        )}
        {order.status === 'cancelled' && order.cancel_reason && (
          <p className="flex items-start gap-1.5 font-semibold text-status-cancelled">
            <MessageSquareText aria-hidden="true" className="mt-0.5 size-5 shrink-0 desk:size-4" />
            <span className="break-words">Motivo: {order.cancel_reason}</span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-base text-text-muted desk:text-sm">
          <Clock aria-hidden="true" className="size-5 shrink-0 desk:size-4" />
          <span>
            {timeAgo(order.created_at, now)} · {order.created_by_name}
          </span>
        </p>
      </div>

      {/* Full width for touch; a compact action on desktop. */}
      <AdvanceButton order={order} className="w-full gap-1.5 px-3 desk:mt-0.5 desk:w-auto desk:self-start desk:px-4" />
    </article>
  );
}
