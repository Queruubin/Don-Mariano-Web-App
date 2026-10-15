import { ClipboardList, Pencil, Plus, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { EmptyState, ErrorState, ListSkeleton } from '../../shared/components/StatusViews';
import { apiErrorMessage } from '../../shared/utils/apiErrors';
import { formatCOP } from '../form/money';
import { useRecentOrders } from '../hooks/useOrders';
import { formatOrderNumber, paymentLabel, STATUS_META } from '../labels';
import type { OrderSummary } from '../types/order.types';

const timeFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export const NEW_ORDER_PATH = '/domicilios/nuevo';

function StatusBadge({ status }: { status: OrderSummary['status'] }) {
  const { label, icon: Icon, className } = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-0.5 font-bold ${className}`}>
      <Icon aria-hidden="true" className="size-5" />
      {label}
    </span>
  );
}

function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <li className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-xl font-bold">{formatOrderNumber(order.number)}</span>
          <StatusBadge status={order.status} />
        </p>
        <p className="mt-1 text-lg font-semibold break-words">{order.customer.name}</p>
        <p className="text-text-muted break-words">{order.address_snapshot}</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold tabular-nums">{formatCOP(order.total_amount.split('.')[0])}</p>
        <p className="text-text-muted">
          {paymentLabel(order.payment_method)} · {timeFormat.format(new Date(order.created_at))}
        </p>
      </div>
      {order.is_editable && (
        <Link
          to={`/domicilios/${order.id}/editar`}
          className="btn btn-secondary px-4"
          aria-label={`Editar domicilio ${formatOrderNumber(order.number)}`}
        >
          <Pencil aria-hidden="true" className="size-5" />
          Editar
        </Link>
      )}
    </li>
  );
}

/**
 * Domicilios home. The full order board comes in a later milestone; for now
 * it lists the latest orders under the main "Nuevo domicilio" button.
 */
export function OrderListPage() {
  const branch = useActiveBranch();
  const orders = useRecentOrders();

  const newOrderButton = (
    <Link to={NEW_ORDER_PATH} className="btn btn-primary min-h-16 w-full px-8 text-xl sm:w-auto">
      <Plus aria-hidden="true" className="size-7" />
      Nuevo domicilio
    </Link>
  );

  if (branch.isLoading) return <ListSkeleton />;
  if (branch.id == null) {
    return (
      <EmptyState icon={Store} title="Elija una sede">
        Seleccione arriba la sede para ver sus domicilios.
      </EmptyState>
    );
  }

  let content;
  if (orders.isPending) {
    content = <ListSkeleton />;
  } else if (orders.isError) {
    content = (
      <ErrorState
        message={`No pudimos cargar los domicilios. ${apiErrorMessage(orders.error)}`}
        onRetry={() => orders.refetch()}
      />
    );
  } else if (orders.data.results.length === 0) {
    content = (
      <EmptyState icon={ClipboardList} title="Todavía no hay domicilios">
        Cuando un cliente llame, toque «Nuevo domicilio» para tomar el pedido.
      </EmptyState>
    );
  } else {
    content = (
      <ul aria-label="Últimos domicilios" className="space-y-3">
        {orders.data.results.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </ul>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Domicilios</h1>
        {newOrderButton}
      </div>
      <h2 className="mb-3 text-xl text-text-muted">Últimos domicilios</h2>
      {content}
    </div>
  );
}
