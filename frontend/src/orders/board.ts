import type { BoardOrder, OrderStatus } from './types/order.types';

/** Board sections: one per active status, plus the orders finished today. */
export type BoardSection = 'pending' | 'preparing' | 'on_the_way' | 'finished';

export const BOARD_SECTIONS: readonly BoardSection[] = ['pending', 'preparing', 'on_the_way', 'finished'];

export function sectionOf(status: OrderStatus): BoardSection {
  return status === 'delivered' || status === 'cancelled' ? 'finished' : status;
}

/** Lowercase, without accents or extra spaces: "Gloria  Pérez" -> "gloria perez". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Client-side search by order number ("142", "#0142"), customer name
 * (accent-insensitive) or phone digits.
 */
export function matchesSearch(order: BoardOrder, query: string): boolean {
  const text = normalize(query);
  if (!text) return true;

  const digits = text.replace(/\D/g, '');
  const isNumberLike = /^#?\s*\d+$/.test(text);
  if (isNumberLike) {
    const wanted = Number(digits);
    if (order.number === wanted) return true;
    if (digits.length >= 3 && order.customer.phone.includes(digits)) return true;
    return String(order.number).padStart(4, '0').includes(digits);
  }
  if (digits.length >= 3 && order.customer.phone.includes(digits)) return true;
  return normalize(order.customer.name).includes(text);
}

/** Group the board orders by section, keeping the server order (newest first). */
export function groupBoard(orders: readonly BoardOrder[], query = ''): Record<BoardSection, BoardOrder[]> {
  const groups: Record<BoardSection, BoardOrder[]> = { pending: [], preparing: [], on_the_way: [], finished: [] };
  for (const order of orders) {
    if (matchesSearch(order, query)) groups[sectionOf(order.status)].push(order);
  }
  return groups;
}
