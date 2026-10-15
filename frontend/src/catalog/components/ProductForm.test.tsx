import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_PRODUCT_FORM, validateProductForm } from '../productForm';
import { ProductForm } from './ProductForm';

function renderForm(overrides: Partial<ComponentProps<typeof ProductForm>> = {}) {
  const onSubmit = vi.fn();
  render(
    <ProductForm
      initialValues={EMPTY_PRODUCT_FORM}
      categories={['Frutas', 'Lácteos']}
      submitting={false}
      serverErrors={null}
      submitLabel="Agregar producto"
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('validateProductForm', () => {
  it('requires a name', () => {
    expect(validateProductForm({ ...EMPTY_PRODUCT_FORM, name: '   ' }).name).toBe(
      'Escriba el nombre del producto.',
    );
  });

  it('limits name and category length', () => {
    const errors = validateProductForm({
      name: 'a'.repeat(201),
      default_unit: 'unidad',
      category: 'b'.repeat(101),
    });
    expect(errors.name).toMatch(/muy largo/);
    expect(errors.category).toMatch(/muy larga/);
  });

  it('accepts a valid product', () => {
    expect(validateProductForm({ name: 'Papaya', default_unit: 'unidad', category: '' })).toEqual({});
  });
});

describe('ProductForm', () => {
  it('shows an inline error and does not submit without a name', async () => {
    const { onSubmit, user } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(screen.getByText('Escriba el nombre del producto.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del producto')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits cleaned values with the chosen unit', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText('Nombre del producto'), '  Papa   criolla ');
    await user.click(screen.getByRole('radio', { name: 'Libra' }));
    await user.type(screen.getByLabelText(/Categoría/), 'Verduras');
    await user.click(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Papa criolla',
      default_unit: 'libra',
      category: 'Verduras',
    });
  });

  it('offers every unit with a Spanish label', () => {
    renderForm();
    const labels = screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent);
    expect(labels).toEqual(['Unidad', 'Libra', 'Kilo', 'Gramos', 'Paquete', 'Pesos ($)']);
  });

  it('shows backend errors next to the field and hides them once edited', async () => {
    const duplicate = 'Ya existe un producto con este nombre en la sede.';
    const { user } = renderForm({
      initialValues: { name: 'Papaya', default_unit: 'unidad', category: '' },
      serverErrors: { fields: { name: duplicate }, message: null },
    });
    expect(screen.getByText(duplicate)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombre del producto'), ' roja');
    expect(screen.queryByText(duplicate)).not.toBeInTheDocument();
  });

  it('shows a general backend message', () => {
    renderForm({ serverErrors: { fields: {}, message: 'No tiene permiso para hacer esto.' } });
    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permiso para hacer esto.');
  });
});
