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
  return PAYMENT_METHODS.find((item) => item.value === method)?.label ?? '';
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
