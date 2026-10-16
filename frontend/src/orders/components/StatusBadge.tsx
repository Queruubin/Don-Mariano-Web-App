import { STATUS_META } from '../labels';
import type { OrderStatus } from '../types/order.types';

/** Status with icon, label and color: never color alone (PRD sections 5 and 6). */
export function StatusBadge({ status, size = 'md' }: { status: OrderStatus; size?: 'md' | 'lg' }) {
  const { label, icon: Icon, className } = STATUS_META[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 font-bold ${className} ${size === 'lg' ? 'px-4 py-1 text-lg desk:px-3 desk:py-0.5 desk:text-base' : 'px-3 py-0.5 desk:px-2.5 desk:text-sm'}`}
    >
      <Icon aria-hidden="true" className={size === 'lg' ? 'size-6 desk:size-5' : 'size-5 desk:size-4'} />
      {label}
    </span>
  );
}
