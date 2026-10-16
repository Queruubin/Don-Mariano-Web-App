import { Clock, MessageSquareText, ShoppingBasket } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
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

  return (
    <article
      aria-labelledby={titleId}
      className={`card flex min-w-0 flex-col gap-3 border-l-8 p-4 ${EDGE[order.status]}`}
    >
      <Link to={orderPath(order.id)} className="-m-2 block min-w-0 rounded-2xl p-2 hover:bg-surface-alt">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={titleId} className="text-3xl tabular-nums">
            {formatOrderNumber(order.number)}
          </h3>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-lg font-bold break-words">{order.customer.name}</p>
        <p className="line-clamp-2 break-words text-text-muted">{order.address_snapshot}</p>
      </Link>

      <div className="space-y-1">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <ShoppingBasket aria-hidden="true" className="size-5 text-text-muted" />
            {itemCountLabel(order.item_count)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {PaymentIcon && <PaymentIcon aria-hidden="true" className="size-5 text-text-muted" />}
            {payment?.label}
          </span>
          <span className="text-xl font-bold tabular-nums">{money(order.total_amount)}</span>
        </p>
        {order.payment_method === 'cash' && order.pays_with && (
          <p className="font-semibold">
            Paga con {money(order.pays_with)}
            {order.change_due && order.change_due !== '0' && <> · Cambio {money(order.change_due)}</>}
          </p>
        )}
        {order.status === 'cancelled' && order.cancel_reason && (
          <p className="flex items-start gap-1.5 font-semibold text-status-cancelled">
            <MessageSquareText aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <span className="break-words">Motivo: {order.cancel_reason}</span>
          </p>
        )}
        <p className="flex items-center gap-1.5 text-base text-text-muted">
          <Clock aria-hidden="true" className="size-5 shrink-0" />
          <span>
            {timeAgo(order.created_at, now)} · {order.created_by_name}
          </span>
        </p>
      </div>

      <AdvanceButton order={order} className="w-full gap-1.5 px-3" />
    </article>
  );
}
