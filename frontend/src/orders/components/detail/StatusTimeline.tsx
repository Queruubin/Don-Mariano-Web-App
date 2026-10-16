import { isFinalStatus, STATUS_FLOW, STATUS_META } from '../../labels';
import { formatDateTime } from '../../time';
import type { Order, OrderStatus } from '../../types/order.types';

interface Step {
  key: string;
  status: OrderStatus;
  done: boolean;
  by?: string;
  at?: string;
  reason?: string;
}

/** What happened (who and when), then the steps still to come. */
function timelineSteps(order: Pick<Order, 'status' | 'status_events'>): Step[] {
  const done: Step[] = order.status_events.map((event, index) => ({
    key: `event-${index}`,
    status: event.to_status,
    done: true,
    by: event.changed_by_name,
    at: event.changed_at,
    reason: event.reason || undefined,
  }));
  if (isFinalStatus(order.status)) return done;
  const upcoming = STATUS_FLOW.slice(STATUS_FLOW.indexOf(order.status) + 1).map((status) => ({
    key: `next-${status}`,
    status,
    done: false,
  }));
  return [...done, ...upcoming];
}

const DOT: Record<OrderStatus, string> = {
  pending: 'border-status-pending bg-accent-soft',
  preparing: 'border-status-preparing bg-surface-alt',
  on_the_way: 'border-status-on-the-way bg-surface text-status-on-the-way',
  delivered: 'border-status-delivered bg-primary-soft text-primary-hover',
  cancelled: 'border-status-cancelled bg-surface text-status-cancelled',
};

/** Status history with who changed it and when (FR-31). */
export function StatusTimeline({ order }: { order: Pick<Order, 'status' | 'status_events'> }) {
  const steps = timelineSteps(order);
  return (
    <ol aria-label="Historial del domicilio" className="space-y-0">
      {steps.map((step, index) => {
        const { label, icon: Icon } = STATUS_META[step.status];
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 ${
                  step.done ? DOT[step.status] : 'border-dashed border-border bg-surface text-text-muted'
                }`}
              >
                <Icon aria-hidden="true" className="size-6" />
              </span>
              {!isLast && <span aria-hidden="true" className="w-0.5 flex-1 bg-border" />}
            </div>
            <div className={`min-w-0 pb-4 ${step.done ? '' : 'text-text-muted'}`}>
              <p className="text-lg font-bold">{label}</p>
              {step.done ? (
                <p className="text-text-muted">
                  {step.at && formatDateTime(step.at)}
                  {step.by && ` · por ${step.by}`}
                </p>
              ) : (
                <p>Falta</p>
              )}
              {step.reason && <p className="font-semibold break-words">Motivo: {step.reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
