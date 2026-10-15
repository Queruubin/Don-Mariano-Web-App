import type { ImportChange, ImportPreview } from './types/catalog.types';
import { unitLabel } from './units';

/** How many products an import will add or change. */
export function importableCount(preview: ImportPreview): number {
  return preview.counts.new + preview.counts.updated;
}

function show(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Activo' : 'Inactivo';
  return value ? `"${value}"` : 'vacío';
}

/** One plain-Spanish line per change, e.g. "Unidad: Libra → Kilo". */
export function describeChange(change: ImportChange): string {
  switch (change.field) {
    case 'is_active':
      return 'Se vuelve a activar';
    case 'default_unit':
      return `Unidad: ${unitLabel(String(change.from))} → ${unitLabel(String(change.to))}`;
    case 'category':
      return `Categoría: ${show(change.from)} → ${show(change.to)}`;
    case 'name':
      return `Nombre: ${show(change.from)} → ${show(change.to)}`;
  }
}

export function productsLabel(count: number): string {
  return count === 1 ? '1 producto' : `${count} productos`;
}
