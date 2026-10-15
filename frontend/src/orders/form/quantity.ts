import type { Unit } from '../../catalog/types/catalog.types';
import { formatCOP } from './money';

/** How much one tap on − / + changes the quantity, per unit. */
const STEPS: Record<Unit, number> = {
  unidad: 1,
  paquete: 1,
  libra: 0.5,
  kilo: 0.5,
  gramos: 50,
  pesos: 1000,
};

/** Quantity of a freshly added line. */
const DEFAULTS: Record<Unit, number> = {
  unidad: 1,
  paquete: 1,
  libra: 1,
  kilo: 1,
  gramos: 250,
  pesos: 2000,
};

export function quantityStep(unit: Unit): number {
  return STEPS[unit];
}

export function defaultQuantity(unit: Unit): string {
  return formatQuantity(DEFAULTS[unit]);
}

/** Two decimals at most, like the backend. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** "1,5", "1.5" and " 2 " are all valid. Returns null for anything else or <= 0. */
export function parseQuantity(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? round(value) : null;
}

/** Spanish decimal comma, no thousands separator: 1.5 -> "1,5". */
export function formatQuantity(value: number): string {
  return String(round(value)).replace('.', ',');
}

/** Keep only what can become a decimal number while the user is typing. */
export function sanitizeQuantityInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace('.', ',');
  const [whole, ...rest] = cleaned.split(',');
  return rest.length ? `${whole},${rest.join('').slice(0, 2)}` : whole;
}

export function increaseQuantity(raw: string, unit: Unit): string {
  const current = parseQuantity(raw) ?? 0;
  return formatQuantity(current + quantityStep(unit));
}

/** One step down, but never to zero or below: removing a line is a separate action. */
export function decreaseQuantity(raw: string, unit: Unit): string {
  const current = parseQuantity(raw);
  if (current == null) return defaultQuantity(unit);
  const next = round(current - quantityStep(unit));
  return next > 0 ? formatQuantity(next) : formatQuantity(current);
}

export function canDecrease(raw: string, unit: Unit): boolean {
  const current = parseQuantity(raw);
  return current != null && round(current - quantityStep(unit)) > 0;
}

/**
 * Switching unit keeps a quantity the user chose, but replaces the untouched
 * default (1 unidad -> 2000 pesos, not 1 peso).
 */
export function quantityForUnitChange(raw: string, from: Unit, to: Unit): string {
  const current = parseQuantity(raw);
  if (current == null || formatQuantity(current) === defaultQuantity(from)) return defaultQuantity(to);
  return raw;
}

/** "1.5" for the API. */
export function quantityForApi(raw: string): string {
  const value = parseQuantity(raw);
  return value == null ? '' : String(value);
}

const UNIT_WORDS: Record<Exclude<Unit, 'pesos'>, [singular: string, plural: string]> = {
  unidad: ['unidad', 'unidades'],
  libra: ['libra', 'libras'],
  kilo: ['kilo', 'kilos'],
  gramos: ['gramo', 'gramos'],
  paquete: ['paquete', 'paquetes'],
};

/** Read-aloud quantity: "1,5 libras", "1 unidad", "$ 2.000". */
export function describeQuantity(raw: string, unit: Unit): string {
  const value = parseQuantity(raw);
  if (value == null) return raw;
  if (unit === 'pesos') return formatCOP(value);
  const [singular, plural] = UNIT_WORDS[unit];
  return `${formatQuantity(value)} ${value === 1 ? singular : plural}`;
}
