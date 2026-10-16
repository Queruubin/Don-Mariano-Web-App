import {
  ArrowLeft,
  Ban,
  FileQuestion,
  ListChecks,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  Printer,
  ShoppingBasket,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, ListSkeleton } from '../../../shared/components/StatusViews';
import { apiErrorMessage } from '../../../shared/utils/apiErrors';
import { describeQuantity } from '../../form/quantity';
import { money, orderPrintPath } from '../../format';
import { useOrder } from '../../hooks/useOrders';
import { formatOrderNumber, isFinalStatus, paymentMeta } from '../../labels';
import { formatDateTime } from '../../time';
import type { Order } from '../../types/order.types';
import { AdvanceButton } from '../AdvanceButton';
import { ORDERS_PATH } from '../OrderForm';
import { StatusBadge } from '../StatusBadge';
import { CancelOrderDialog } from './CancelOrderDialog';
import { StatusTimeline } from './StatusTimeline';

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xl">
        <Icon aria-hidden="true" className="size-6 text-text-muted" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ItemList({ items }: { items: Order['items'] }) {
  return (
    <ul aria-label="Productos" className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="py-3 first:pt-0 last:pb-0">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-bold tabular-nums">{describeQuantity(item.quantity, item.unit)}</span>
            <span className="text-lg break-words">{item.name}</span>
            {item.is_free_text && (
              <span className="rounded-full border-2 border-border px-2 text-sm font-bold text-text-muted">
                Producto libre
              </span>
            )}
          </p>
          {item.notes && (
            <p className="mt-1 rounded-xl bg-accent-soft px-3 py-1 font-bold break-words">Observación: {item.notes}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const [cancelling, setCancelling] = useState(false);
  const payment = paymentMeta(order.payment_method);
  const PaymentIcon = payment?.icon ?? Wallet;
  const phoneHref = `tel:+57${order.customer.phone}`;

  return (
    <div className="space-y-5">
      <Link to={ORDERS_PATH} className="btn btn-ghost -ml-3 px-3">
        <ArrowLeft aria-hidden="true" className="size-6" />
        Volver a domicilios
      </Link>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl tabular-nums">Domicilio {formatOrderNumber(order.number)}</h1>
          <StatusBadge status={order.status} size="lg" />
        </div>
        <p className="text-text-muted">
          Creado el {formatDateTime(order.created_at)} por {order.created_by_name}
        </p>
        {order.status === 'cancelled' && order.cancel_reason && (
          <p className="flex items-start gap-2 rounded-2xl bg-surface-alt p-3 text-lg font-bold">
            <Ban aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-status-cancelled" />
            <span className="break-words">Cancelado. Motivo: {order.cancel_reason}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <AdvanceButton order={order} className="w-full px-8 sm:w-auto" />
          {order.is_editable && (
            <Link to={`/domicilios/${order.id}/editar`} className="btn btn-secondary min-h-14 flex-1 sm:flex-none">
              <Pencil aria-hidden="true" className="size-5" />
              Editar
            </Link>
          )}
          <Link to={orderPrintPath(order.id)} className="btn btn-secondary min-h-14 flex-1 sm:flex-none">
            <Printer aria-hidden="true" className="size-5" />
            Imprimir
          </Link>
          {!isFinalStatus(order.status) && (
            <button
              type="button"
              className="btn min-h-14 flex-1 border-2 border-danger bg-surface text-danger hover:bg-danger-soft sm:flex-none"
              onClick={() => setCancelling(true)}
            >
              <Ban aria-hidden="true" className="size-5" />
              Cancelar domicilio
            </button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <Section title={`Productos (${order.items.length})`} icon={ShoppingBasket}>
            <ItemList items={order.items} />
          </Section>
          {order.notes && (
            <Section title="Nota general" icon={MessageSquareText}>
              <p className="text-lg break-words whitespace-pre-line">{order.notes}</p>
            </Section>
          )}
          <Section title="Historial" icon={ListChecks}>
            <StatusTimeline order={order} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Cliente" icon={User}>
            <p className="text-lg font-bold break-words">{order.customer.name}</p>
            <a href={phoneHref} className="btn btn-ghost -ml-3 px-3 text-lg text-primary-hover underline">
              <Phone aria-hidden="true" className="size-5" />
              {order.customer.phone}
            </a>
            <p className="mt-2 flex items-start gap-2 text-lg break-words">
              <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-text-muted" />
              <span>{order.address_snapshot}</span>
            </p>
            {order.address_notes && (
              <p className="mt-1 pl-7 break-words text-text-muted">Indicaciones: {order.address_notes}</p>
            )}
          </Section>

          <Section title="Pago" icon={PaymentIcon}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-lg [&_dd]:whitespace-nowrap">
              <dt className="text-text-muted">Forma de pago</dt>
              <dd className="font-bold">{payment?.label}</dd>
              <dt className="text-text-muted">Total</dt>
              <dd className="text-2xl font-bold tabular-nums">{money(order.total_amount)}</dd>
              {order.pays_with && (
                <>
                  <dt className="text-text-muted">Paga con</dt>
                  <dd className="font-bold tabular-nums">{money(order.pays_with)}</dd>
                  <dt className="text-text-muted">Cambio</dt>
                  <dd className="font-bold tabular-nums">{money(order.change_due ?? '0')}</dd>
                </>
              )}
            </dl>
          </Section>
        </div>
      </div>

      {cancelling && <CancelOrderDialog order={order} onClose={() => setCancelling(false)} />}
    </div>
  );
}

/** Everything about one order, its history and its actions (FR-31). */
export function OrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const order = useOrder(orderId, { live: true });

  if (!Number.isInteger(orderId)) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No encontramos ese domicilio"
        actions={
          <Link to={ORDERS_PATH} className="btn btn-primary">
            Ver domicilios
          </Link>
        }
      />
    );
  }
  if (order.isPending) return <ListSkeleton rows={4} />;
  if (order.isError) {
    return (
      <ErrorState
        message={`No pudimos cargar el domicilio. ${apiErrorMessage(order.error)}`}
        onRetry={() => order.refetch()}
      />
    );
  }
  return <OrderDetail order={order.data} />;
}
