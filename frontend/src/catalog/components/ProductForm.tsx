import { useId, useState, type FormEvent } from 'react';
import type { ApiErrors } from '../../shared/utils/apiErrors';
import {
  toProductInput,
  validateProductForm,
  type ProductFormErrors,
  type ProductFormValues,
} from '../productForm';
import type { ProductInput } from '../types/catalog.types';
import { UNITS } from '../units';

interface ProductFormProps {
  initialValues: ProductFormValues;
  categories: string[];
  submitting: boolean;
  serverErrors: ApiErrors | null;
  submitLabel: string;
  onSubmit: (input: ProductInput) => void;
  onCancel: () => void;
}

export function ProductForm({
  initialValues,
  categories,
  submitting,
  serverErrors,
  submitLabel,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const nameId = useId();
  const unitName = useId();
  const categoryId = useId();
  const categoriesListId = useId();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  // Server errors belong to the values that were sent; hide one once its field is edited.
  const [editedSinceSubmit, setEditedSinceSubmit] = useState<Set<keyof ProductFormValues>>(new Set());

  const fieldError = (field: keyof ProductFormValues) =>
    errors[field] ?? (editedSinceSubmit.has(field) ? undefined : serverErrors?.fields[field]);

  const update = <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setEditedSinceSubmit((current) => new Set(current).add(field));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateProductForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setEditedSinceSubmit(new Set());
    onSubmit(toProductInput(values));
  };

  const nameError = fieldError('name');
  const unitError = fieldError('default_unit');
  const categoryError = fieldError('category');

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverErrors?.message && (
        <p role="alert" className="rounded-2xl bg-danger-soft p-3 font-semibold text-danger">
          {serverErrors.message}
        </p>
      )}

      <div>
        <label htmlFor={nameId} className="field-label">
          Nombre del producto
        </label>
        <input
          id={nameId}
          className="input"
          value={values.name}
          onChange={(event) => update('name', event.target.value)}
          placeholder="Ej: Papa criolla"
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${nameId}-error` : undefined}
        />
        {nameError && (
          <p id={`${nameId}-error`} className="field-error">
            {nameError}
          </p>
        )}
      </div>

      <fieldset aria-describedby={unitError ? `${unitName}-error` : undefined}>
        <legend className="field-label">¿Cómo se vende normalmente?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {UNITS.map((unit) => (
            <label key={unit.value} className="relative">
              <input
                type="radio"
                name={unitName}
                value={unit.value}
                checked={values.default_unit === unit.value}
                onChange={() => update('default_unit', unit.value)}
                className="peer sr-only"
              />
              <span className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-border bg-surface px-3 text-center text-lg font-bold text-text-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-hover">
                {unit.label}
              </span>
            </label>
          ))}
        </div>
        {unitError && (
          <p id={`${unitName}-error`} className="field-error">
            {unitError}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={categoryId} className="field-label">
          Categoría <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <input
          id={categoryId}
          className="input"
          list={categoriesListId}
          value={values.category}
          onChange={(event) => update('category', event.target.value)}
          placeholder="Ej: Frutas y verduras"
          autoComplete="off"
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? `${categoryId}-error` : undefined}
        />
        <datalist id={categoriesListId}>
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        {categoryError && (
          <p id={`${categoryId}-error`} className="field-error">
            {categoryError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
