import { describe, expect, it } from 'vitest';
import type { Product } from '../../catalog/types/catalog.types';
import type { Customer } from '../../customers/types/customer.types';
import type { Order } from '../types/order.types';
import {
  EMPTY_ORDER_FORM,
  firstErrorKey,
  freeTextLine,
  initialOrderFormState,
  lineErrorKey,
  lineFromProduct,
  mapServerErrors,
  MESSAGES,
  orderFormReducer,
  phoneDigits,
  toOrderInput,
  validateOrderForm,
  valuesFromOrder,
  type OrderFormValues,
} from './orderForm';

const avocado: Product = {
  id: 11,
  name: 'Aguacate Hass',
  default_unit: 'unidad',
  category: 'Frutas',
  is_active: true,
  created_at: '',
  updated_at: '',
};

const gloria: Customer = {
  id: 5,
  phone: '3001234567',
  name: 'Gloria Pérez',
  addresses: [
    { id: 21, address: 'Calle 80 #20-30', notes: 'casa azul', last_used_at: '2026-10-10T10:00:00Z' },
    { id: 20, address: 'Cra 7 #45-10', notes: '', last_used_at: '2026-09-01T10:00:00Z' },
  ],
  created_at: '',
  updated_at: '',
};

function validValues(overrides: Partial<OrderFormValues> = {}): OrderFormValues {
  return {
    ...EMPTY_ORDER_FORM,
    phone: '300 123 4567',
    name: 'Gloria',
    newAddress: 'Cra 7 #45-10',
    lines: [lineFromProduct(avocado)],
    paymentMethod: 'cash',
    total: '45000',
    ...overrides,
  };
}

describe('customer autofill', () => {
  it('fills the name and preselects the most recent saved address', () => {
    const state = orderFormReducer(initialOrderFormState(), { type: 'customerFound', customer: gloria });
    expect(state.values.name).toBe('Gloria Pérez');
    expect(state.values.addressChoice).toBe(21);
    expect(state.values.addressNotes).toBe('casa azul');
    expect(state.touched).toBe(false);
  });

  it('does not overwrite a name the user typed', () => {
    let state = orderFormReducer(initialOrderFormState(), { type: 'setField', field: 'name', value: 'Doña Gloria' });
    state = orderFormReducer(state, { type: 'customerFound', customer: gloria });
    expect(state.values.name).toBe('Doña Gloria');
  });

  it('selects the saved address matching the one already typed', () => {
    const start = initialOrderFormState({ ...EMPTY_ORDER_FORM, name: 'Gloria', newAddress: 'cra 7  #45-10' });
    const state = orderFormReducer(start, { type: 'customerFound', customer: gloria });
    expect(state.values.addressChoice).toBe(20);
  });

  it('clears autofilled data when the phone turns out to be a new customer', () => {
    let state = orderFormReducer(initialOrderFormState(), { type: 'customerFound', customer: gloria });
    state = orderFormReducer(state, { type: 'customerNotFound' });
    expect(state.values.name).toBe('');
    expect(state.values.addressChoice).toBe('new');
  });

  it('uses the same phone rule as the backend', () => {
    expect(phoneDigits('+57 300-123-4567')).toBe('3001234567');
    expect(phoneDigits('300 123 4567')).toBe('3001234567');
  });
});

describe('validation', () => {
  it('explains every missing field in plain words', () => {
    const errors = validateOrderForm(EMPTY_ORDER_FORM);
    expect(errors).toEqual({
      phone: MESSAGES.phoneRequired,
      name: MESSAGES.name,
      address: MESSAGES.address,
      lines: MESSAGES.lines,
      paymentMethod: MESSAGES.paymentMethod,
      total: MESSAGES.total,
    });
    expect(firstErrorKey(errors, EMPTY_ORDER_FORM)).toBe('phone');
  });

  it('checks line quantities and the cash amount', () => {
    const line = { ...freeTextLine('Cilantro'), quantity: '0' };
    const values = validValues({ lines: [line], paysWith: '40000' });
    expect(validateOrderForm(values)).toEqual({
      [lineErrorKey(line.key)]: MESSAGES.quantity,
      paysWith: MESSAGES.paysWith,
    });
  });

  it('ignores "paga con" for other payment methods', () => {
    expect(validateOrderForm(validValues({ paymentMethod: 'nequi', paysWith: '1000' }))).toEqual({});
  });

  it('does not need a typed address when a saved one is chosen', () => {
    expect(validateOrderForm(validValues({ newAddress: '', addressChoice: 20 }))).toEqual({});
  });
});

describe('API payload', () => {
  it('maps catalog and free-text lines, cash and a new address', () => {
    const free = { ...freeTextLine('  Cilantro  '), unit: 'pesos' as const, quantity: '2000', notes: ' fresco ' };
    const catalog = { ...lineFromProduct(avocado), quantity: '1,5', notes: 'bien verde' };
    const input = toOrderInput(
      validValues({ lines: [catalog, free], paysWith: '50000', addressNotes: ' apto 302 ', notes: ' Tocar ' }),
    );
    expect(input).toEqual({
      customer: { phone: '3001234567', name: 'Gloria', address: 'Cra 7 #45-10', address_notes: 'apto 302' },
      items: [
        { product: 11, quantity: '1.5', unit: 'unidad', notes: 'bien verde' },
        { name: 'Cilantro', quantity: '2000', unit: 'pesos', notes: 'fresco' },
      ],
      payment_method: 'cash',
      total_amount: '45000',
      pays_with: '50000',
      notes: 'Tocar',
    });
  });

  it('sends a saved address by id and drops "paga con" for card', () => {
    const input = toOrderInput(validValues({ addressChoice: 21, paymentMethod: 'card', paysWith: '50000' }));
    expect(input.customer).toEqual({ phone: '3001234567', name: 'Gloria', address_id: 21, address_notes: '' });
    expect(input.pays_with).toBeNull();
  });

  it('loads an existing order for editing', () => {
    const order = {
      customer: { id: 5, phone: '3001234567', name: 'Gloria' },
      address_snapshot: 'Cra 7 #45-10',
      address_notes: 'apto 302',
      payment_method: 'cash',
      total_amount: '45000',
      pays_with: '50000',
      notes: '',
      items: [{ id: 1, product: null, name: 'Papaya', quantity: '1.50', unit: 'kilo', notes: 'madura', is_free_text: true }],
    } as unknown as Order;
    const values = valuesFromOrder(order);
    expect(values).toMatchObject({ phone: '3001234567', newAddress: 'Cra 7 #45-10', total: '45000', paysWith: '50000' });
    expect(values.lines[0]).toMatchObject({ productId: null, name: 'Papaya', quantity: '1,5', unit: 'kilo' });
  });
});

describe('server errors', () => {
  it('puts nested customer, item and payment errors next to their fields', () => {
    const lines = [freeTextLine('Pan'), freeTextLine('Leche')];
    const mapped = mapServerErrors(
      {
        customer: { phone: ['Ingrese un teléfono válido.'] },
        items: { '1': { quantity: ['La cantidad debe ser mayor que cero.'] } },
        pays_with: ['"Paga con" no puede ser menor que el total.'],
        code: 'invalid',
      },
      lines,
    );
    expect(mapped.fields).toEqual({
      phone: 'Ingrese un teléfono válido.',
      [lineErrorKey(lines[1].key)]: 'La cantidad debe ser mayor que cero.',
      paysWith: '"Paga con" no puede ser menor que el total.',
    });
    expect(mapped.message).toBeNull();
  });

  it('maps list-level item errors and general messages', () => {
    const mapped = mapServerErrors(
      { items: ['Uno o más productos no existen en esta sede.'], detail: 'Este pedido ya no se puede editar.' },
      [],
    );
    expect(mapped.fields).toEqual({ lines: 'Uno o más productos no existen en esta sede.' });
    expect(mapped.message).toBe('Este pedido ya no se puede editar.');
  });
});
