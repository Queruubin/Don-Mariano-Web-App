import { formatCOP } from './form/money';

export function orderPath(id: number): string {
  return `/domicilios/${id}`;
}

export function orderPrintPath(id: number): string {
  return `/domicilios/${id}/imprimir`;
}

/** Whole pesos from the API ("45000" or "45000.00") as "$ 45.000". */
export function money(value: string): string {
  return formatCOP(value.split('.')[0]);
}

export function itemCountLabel(count: number): string {
  return count === 1 ? '1 producto' : `${count} productos`;
}
