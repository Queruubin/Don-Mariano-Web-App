import type { Unit } from '../../catalog/types/catalog.types';

export type PaymentMethod = 'cash' | 'card' | 'nequi' | 'daviplata';
export type OrderStatus = 'pending' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: number;
  product: number | null;
  name: string;
  /** Decimal as a string, e.g. "1.50". */
  quantity: string;
  unit: Unit;
  notes: string;
  is_free_text: boolean;
}

export interface OrderSummary {
  id: number;
  number: number;
  status: OrderStatus;
  status_label: string;
  next_status: OrderStatus | null;
  is_editable: boolean;
  customer: { id: number; phone: string; name: string };
  address_snapshot: string;
  address_notes: string;
  payment_method: PaymentMethod;
  /** Whole pesos as a string, e.g. "45000". */
  total_amount: string;
  pays_with: string | null;
  change_due: string | null;
  notes: string;
  cancel_reason: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Order extends OrderSummary {
  items: OrderItem[];
}

export interface OrderItemInput {
  product?: number;
  name?: string;
  quantity: string;
  unit: Unit;
  notes: string;
}

export interface OrderCustomerInput {
  phone: string;
  name: string;
  address?: string;
  address_id?: number;
  address_notes: string;
}

export interface OrderInput {
  customer: OrderCustomerInput;
  items: OrderItemInput[];
  payment_method: PaymentMethod;
  total_amount: string;
  pays_with: string | null;
  notes: string;
}
