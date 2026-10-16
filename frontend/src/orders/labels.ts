import {
  Ban,
  Banknote,
  Bike,
  CircleCheck,
  Clock,
  CreditCard,
  PackageOpen,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { OrderStatus, PaymentMethod } from './types/order.types';

export const PAYMENT_METHODS: readonly { value: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'nequi', label: 'Nequi', icon: Smartphone },
  { value: 'daviplata', label: 'Daviplata', icon: Wallet },
];

export function paymentLabel(method: PaymentMethod | null): string {
  return paymentMeta(method)?.label ?? '';
}

export function paymentMeta(method: PaymentMethod | null) {
  return PAYMENT_METHODS.find((item) => item.value === method);
}

/** Statuses always show a label and an icon, never color alone (PRD section 5). */
export const STATUS_META: Record<OrderStatus, { label: string; icon: LucideIcon; className: string }> = {
  pending: { label: 'Pendiente', icon: Clock, className: 'bg-accent-soft text-text border-status-pending' },
  preparing: { label: 'Alistando', icon: PackageOpen, className: 'bg-surface-alt text-text border-status-preparing' },
  on_the_way: { label: 'En camino', icon: Bike, className: 'bg-surface text-status-on-the-way border-status-on-the-way' },
  delivered: { label: 'Entregado', icon: CircleCheck, className: 'bg-primary-soft text-primary-hover border-status-delivered' },
  cancelled: { label: 'Cancelado', icon: Ban, className: 'bg-surface text-status-cancelled border-status-cancelled' },
};

/** Short, human-friendly number per branch (FR-26): 142 -> "#0142". */
export function formatOrderNumber(number: number): string {
  return `#${String(number).padStart(4, '0')}`;
}

/** The main path of an order (FR-28). Cancelled can happen from any non-final status. */
export const STATUS_FLOW: readonly OrderStatus[] = ['pending', 'preparing', 'on_the_way', 'delivered'];
export const ACTIVE_STATUSES: readonly OrderStatus[] = ['pending', 'preparing', 'on_the_way'];
export const FINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled'];
const EDITABLE_STATUSES: readonly OrderStatus[] = ['pending', 'preparing'];

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = STATUS_FLOW.indexOf(status);
  return index >= 0 && index < STATUS_FLOW.length - 1 ? STATUS_FLOW[index + 1] : null;
}

export function isEditableStatus(status: OrderStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function isFinalStatus(status: OrderStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

/** The one-tap button that moves an order forward, by its current status. */
export const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Pasar a Alistando',
  preparing: 'Enviar',
  on_the_way: 'Marcar entregado',
};
