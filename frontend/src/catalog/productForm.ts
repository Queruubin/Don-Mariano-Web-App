import type { ProductInput, Unit } from './types/catalog.types';

export const NAME_MAX_LENGTH = 200;
export const CATEGORY_MAX_LENGTH = 100;

export interface ProductFormValues {
  name: string;
  default_unit: Unit;
  category: string;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = { name: '', default_unit: 'unidad', category: '' };

function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Friendly checks before calling the API. The backend still validates everything. */
export function validateProductForm(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const name = clean(values.name);
  if (!name) errors.name = 'Escriba el nombre del producto.';
  else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `El nombre es muy largo. Use máximo ${NAME_MAX_LENGTH} letras.`;
  }
  if (!values.default_unit) errors.default_unit = 'Elija una unidad.';
  if (clean(values.category).length > CATEGORY_MAX_LENGTH) {
    errors.category = `La categoría es muy larga. Use máximo ${CATEGORY_MAX_LENGTH} letras.`;
  }
  return errors;
}

export function toProductInput(values: ProductFormValues): ProductInput {
  return { name: clean(values.name), default_unit: values.default_unit, category: clean(values.category) };
}
