export type Unit = 'unidad' | 'libra' | 'kilo' | 'gramos' | 'paquete' | 'pesos';

export interface Product {
  id: number;
  name: string;
  default_unit: Unit;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  default_unit: Unit;
  category: string;
}

export interface ProductFilters {
  search: string;
  category: string | null;
  includeInactive: boolean;
}

export interface ImportChange {
  field: 'name' | 'default_unit' | 'category' | 'is_active';
  from: string | boolean;
  to: string | boolean;
}

export interface ImportRow {
  row: number;
  name: string;
  unit: string;
  category: string;
  product_id?: number;
  changes?: ImportChange[];
  reactivated?: boolean;
  errors?: string[];
}

export interface ImportPreview {
  counts: { new: number; updated: number; unchanged: number; invalid: number; total: number };
  new: ImportRow[];
  updated: ImportRow[];
  unchanged: ImportRow[];
  invalid: ImportRow[];
}

export interface ImportResult {
  counts: { created: number; updated: number; reactivated: number; unchanged: number; invalid: number };
  invalid: ImportRow[];
}
