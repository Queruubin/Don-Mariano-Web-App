import { ArrowLeft, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActiveBranch } from '../../../branches/hooks/useBranches';
import { ErrorState, ListSkeleton } from '../../../shared/components/StatusViews';
import { apiErrorMessage } from '../../../shared/utils/apiErrors';
import { describeQuantity } from '../../form/quantity';
import { money, orderPath } from '../../format';
import { useOrder } from '../../hooks/useOrders';
import { formatOrderNumber, paymentLabel, STATUS_META } from '../../labels';
import { formatDateTime } from '../../time';
import type { Order } from '../../types/order.types';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="text-right font-bold">{children}</span>
    </p>
  );
}

/**
 * Ticket for the picker or the driver (FR-31). Narrow enough for an 80mm
 * thermal printer, and still readable on A4. Black on white only.
 */
export function OrderTicket({ order, branchName }: { order: Order; branchName: string | null }) {
  return (
    <article
      aria-label={`Ticket del domicilio ${formatOrderNumber(order.number)}`}
      className="ticket mx-auto w-full max-w-sm space-y-3 bg-white p-4 text-[11pt] leading-snug text-black print:max-w-none print:p-0"
    >
      <header className="border-b-2 border-dashed border-black pb-2 text-center">
        <p className="font-bold">{branchName ?? 'Tiendas Don Mariano'}</p>
        <p className="font-display text-[28pt] leading-tight font-bold">{formatOrderNumber(order.number)}</p>
        <p>{formatDateTime(order.created_at)}</p>
        <p>Estado: {STATUS_META[order.status].label}</p>
      </header>

      <section className="space-y-0.5 border-b-2 border-dashed border-black pb-2">
        <p className="text-[13pt] font-bold break-words">{order.customer.name}</p>
        <p>Tel: {order.customer.phone}</p>
        <p className="font-bold break-words">{order.address_snapshot}</p>
        {order.address_notes && <p className="break-words">Indicaciones: {order.address_notes}</p>}
      </section>

      <section className="border-b-2 border-dashed border-black pb-2">
        <h2 className="mb-1 font-sans text-[11pt] font-bold uppercase">Productos ({order.items.length})</h2>
        <ul className="space-y-1.5">
          {order.items.map((item) => (
            <li key={item.id} className="break-words">
              <p>
                <span className="font-bold">{describeQuantity(item.quantity, item.unit)}</span> {item.name}
                {item.is_free_text && <span> (libre)</span>}
              </p>
              {item.notes && (
                <p className="mt-0.5 border-2 border-black px-1.5 text-[12pt] font-bold uppercase">» {item.notes}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-0.5">
        <Row label="Pago">{paymentLabel(order.payment_method)}</Row>
        <Row label="Total">
          <span className="text-[14pt]">{money(order.total_amount)}</span>
        </Row>
        {order.pays_with && (
          <>
            <Row label="Paga con">{money(order.pays_with)}</Row>
            <Row label="Cambio">{money(order.change_due ?? '0')}</Row>
          </>
        )}
      </section>

      {order.notes && (
        <section className="border-t-2 border-dashed border-black pt-2">
          <p className="font-bold">Nota:</p>
          <p className="break-words whitespace-pre-line">{order.notes}</p>
        </section>
      )}
      <p className="pt-1 text-center text-[9pt]">Tomado por {order.created_by_name}</p>
    </article>
  );
}

/** Print view without the app header and menu. Printing starts only from the button. */
export function OrderPrintPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const order = useOrder(orderId);
  const branch = useActiveBranch();

  let content;
  if (order.isPending) content = <ListSkeleton rows={3} />;
  else if (order.isError) {
    content = (
      <ErrorState
        message={`No pudimos cargar el domicilio. ${apiErrorMessage(order.error)}`}
        onRetry={() => order.refetch()}
      />
    );
  } else content = <OrderTicket order={order.data} branchName={branch.name} />;

  return (
    <div className="min-h-dvh bg-bg px-4 py-4 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-sm flex-wrap gap-3 print:hidden">
        <Link to={orderPath(orderId)} className="btn btn-ghost flex-1 px-3">
          <ArrowLeft aria-hidden="true" className="size-6" />
          Volver
        </Link>
        <button
          type="button"
          className="btn btn-primary min-h-14 flex-1 px-6 text-lg"
          disabled={!order.isSuccess}
          onClick={() => window.print()}
        >
          <Printer aria-hidden="true" className="size-6" />
          Imprimir
        </button>
      </div>
      {content}
    </div>
  );
}
