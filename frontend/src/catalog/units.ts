import type { Unit } from './types/catalog.types';

export const UNITS: readonly { value: Unit; label: string }[] = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'libra', label: 'Libra' },
  { value: 'kilo', label: 'Kilo' },
  { value: 'gramos', label: 'Gramos' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'pesos', label: 'Pesos ($)' },
];

export function unitLabel(value: string): string {
  return UNITS.find((unit) => unit.value === value)?.label ?? value;
}
