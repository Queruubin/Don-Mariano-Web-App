import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, ListSkeleton } from '../../shared/components/StatusViews';
import { apiErrorMessage, isNotFoundError } from '../../shared/utils/apiErrors';
import { valuesFromOrder } from '../form/orderForm';
import { useOrder } from '../hooks/useOrders';
import { formatOrderNumber, STATUS_META } from '../labels';
import type { Order } from '../types/order.types';
import { ORDERS_PATH, OrderForm } from './OrderForm';
import { OrderNotFound } from './OrderNotFound';

function EditForm({ order }: { order: Order }) {
  // Snapshot once: refetches must not reset what the user is typing.
  const [initialValues] = useState(() => valuesFromOrder(order));
  return (
    <OrderForm
      mode="edit"
      title={`Editar domicilio ${formatOrderNumber(order.number)}`}
      initialValues={initialValues}
      orderId={order.id}
      draftKey={null}
    />
  );
}

/** Edit an order while it is pending or preparing (FR-29). */
export function EditOrderPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const order = useOrder(orderId);

  if (order.isPending) return <ListSkeleton rows={4} />;
  if (order.isError) {
    if (isNotFoundError(order.error)) return <OrderNotFound />;
    return (
      <ErrorState
        message={`No pudimos cargar el domicilio. ${apiErrorMessage(order.error)}`}
        onRetry={() => order.refetch()}
      />
    );
  }
  if (!order.data.is_editable) {
    return (
      <EmptyState
        icon={Lock}
        title={`El domicilio ${formatOrderNumber(order.data.number)} ya no se puede editar`}
        actions={
          <Link to={ORDERS_PATH} className="btn btn-primary">
            Ver domicilios
          </Link>
        }
      >
        Está «{STATUS_META[order.data.status].label}». Solo se pueden editar los domicilios pendientes o en alistamiento.
      </EmptyState>
    );
  }
  return <EditForm key={order.data.id} order={order.data} />;
}
