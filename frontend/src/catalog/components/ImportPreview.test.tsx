import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { describeChange, importableCount, productsLabel } from '../importSummary';
import type { ImportPreview as Preview } from '../types/catalog.types';
import { ImportPreview } from './ImportPreview';

const preview: Preview = {
  counts: { new: 2, updated: 1, unchanged: 1, invalid: 2, total: 6 },
  new: [
    { row: 2, name: 'Cebolla', unit: 'libra', category: 'Verduras' },
    { row: 3, name: 'Pan', unit: 'unidad', category: '' },
  ],
  updated: [
    {
      row: 4,
      name: 'Papaya',
      unit: 'kilo',
      category: 'Frutas',
      product_id: 7,
      reactivated: true,
      changes: [
        { field: 'default_unit', from: 'unidad', to: 'kilo' },
        { field: 'is_active', from: false, to: true },
      ],
    },
  ],
  unchanged: [{ row: 5, name: 'Tomate', unit: 'libra', category: 'Verduras', product_id: 8 }],
  invalid: [
    { row: 6, name: '', unit: 'und', category: '', errors: ['Falta el nombre del producto.'] },
    {
      row: 7,
      name: 'Arroz',
      unit: 'caja',
      category: '',
      errors: ['No reconocemos la unidad "caja". Use: unidad, libra, kilo, gramos, paquete, pesos.'],
    },
  ],
};

function group(name: RegExp) {
  return screen.getByRole('region', { name });
}

describe('ImportPreview', () => {
  it('shows the count of every group', () => {
    render(<ImportPreview preview={preview} />);
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(Object.fromEntries(terms.map((term, i) => [term, values[i]]))).toEqual({
      Nuevos: '2',
      'Se actualizan': '1',
      'Sin cambios': '1',
      'Con errores': '2',
    });
  });

  it('groups rows in order: new, updated, unchanged, errors', () => {
    render(<ImportPreview preview={preview} />);
    const regions = screen.getAllByRole('region').map((region) => region.getAttribute('aria-labelledby'));
    expect(regions).toEqual([
      'import-group-new',
      'import-group-updated',
      'import-group-unchanged',
      'import-group-invalid',
    ]);
    const newGroup = group(/Nuevos \(2\)/);
    expect(within(newGroup).getByText('Cebolla')).toBeInTheDocument();
    expect(within(newGroup).getByText('Pan')).toBeInTheDocument();
  });

  it('explains what changes in updated rows', () => {
    render(<ImportPreview preview={preview} />);
    const updated = group(/Se actualizan \(1\)/);
    expect(within(updated).getByText('Unidad: Unidad → Kilo')).toBeInTheDocument();
    expect(within(updated).getByText('Se vuelve a activar')).toBeInTheDocument();
  });

  it('lists the reason and row number of invalid rows', () => {
    render(<ImportPreview preview={preview} />);
    const invalid = group(/Con errores \(2\)/);
    expect(within(invalid).getByText('Fila 6')).toBeInTheDocument();
    expect(within(invalid).getByText('Falta el nombre del producto.')).toBeInTheDocument();
    expect(within(invalid).getByText(/No reconocemos la unidad "caja"/)).toBeInTheDocument();
  });

  it('hides empty groups', () => {
    render(<ImportPreview preview={{ ...preview, invalid: [], counts: { ...preview.counts, invalid: 0 } }} />);
    expect(screen.queryByRole('region', { name: /Con errores/ })).not.toBeInTheDocument();
  });

  it('shows long groups in pages', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      row: i + 2,
      name: `Producto ${i}`,
      unit: 'unidad',
      category: '',
    }));
    render(<ImportPreview preview={{ ...preview, new: many, counts: { ...preview.counts, new: 60 } }} />);
    const newGroup = group(/Nuevos \(60\)/);
    expect(within(newGroup).getAllByText(/^Producto /)).toHaveLength(50);
    await userEvent.click(within(newGroup).getByRole('button', { name: 'Ver las 10 filas restantes' }));
    expect(within(newGroup).getAllByText(/^Producto /)).toHaveLength(60);
  });
});

describe('import summary helpers', () => {
  it('counts only rows that change the catalog', () => {
    expect(importableCount(preview)).toBe(3);
  });

  it('describes changes in plain Spanish', () => {
    expect(describeChange({ field: 'category', from: '', to: 'Frutas' })).toBe('Categoría: vacío → "Frutas"');
    expect(describeChange({ field: 'name', from: 'papaya', to: 'Papaya' })).toBe('Nombre: "papaya" → "Papaya"');
  });

  it('pluralizes product counts', () => {
    expect(productsLabel(1)).toBe('1 producto');
    expect(productsLabel(3)).toBe('3 productos');
  });
});
