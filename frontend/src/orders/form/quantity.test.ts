import { describe, expect, it } from 'vitest';
import {
  canDecrease,
  decreaseQuantity,
  defaultQuantity,
  describeQuantity,
  increaseQuantity,
  parseQuantity,
  quantityForApi,
  quantityForUnitChange,
  quantityStep,
  sanitizeQuantityInput,
} from './quantity';

describe('quantity steps', () => {
  it.each([
    ['unidad', 1],
    ['paquete', 1],
    ['libra', 0.5],
    ['kilo', 0.5],
    ['gramos', 50],
    ['pesos', 1000],
  ] as const)('%s moves by %s', (unit, step) => {
    expect(quantityStep(unit)).toBe(step);
  });

  it('adds and removes half pounds with a decimal comma', () => {
    expect(increaseQuantity('1', 'libra')).toBe('1,5');
    expect(increaseQuantity('1,5', 'libra')).toBe('2');
    expect(decreaseQuantity('1,5', 'libra')).toBe('1');
  });

  it('never goes to zero with the minus button', () => {
    expect(decreaseQuantity('1', 'unidad')).toBe('1');
    expect(canDecrease('1', 'unidad')).toBe(false);
    expect(canDecrease('2', 'unidad')).toBe(true);
    expect(decreaseQuantity('0,5', 'libra')).toBe('0,5');
  });

  it('uses sensible starting amounts', () => {
    expect(defaultQuantity('unidad')).toBe('1');
    expect(defaultQuantity('gramos')).toBe('250');
    expect(defaultQuantity('pesos')).toBe('2000');
    expect(increaseQuantity('2000', 'pesos')).toBe('3000');
  });
});

describe('typed quantities', () => {
  it('accepts a comma or a dot as decimal separator', () => {
    expect(parseQuantity('1,5')).toBe(1.5);
    expect(parseQuantity('1.5')).toBe(1.5);
    expect(parseQuantity(' 2 ')).toBe(2);
    expect(parseQuantity('0,25')).toBe(0.25);
  });

  it('rejects empty, zero and text', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('dos')).toBeNull();
  });

  it('keeps typing clean: digits and one decimal comma with two decimals', () => {
    expect(sanitizeQuantityInput('1.5')).toBe('1,5');
    expect(sanitizeQuantityInput('1,555')).toBe('1,55');
    expect(sanitizeQuantityInput('2 lb')).toBe('2');
    expect(sanitizeQuantityInput('1,')).toBe('1,');
  });

  it('sends a dot decimal to the API', () => {
    expect(quantityForApi('1,5')).toBe('1.5');
    expect(quantityForApi('3')).toBe('3');
  });
});

describe('changing the unit', () => {
  it('replaces an untouched default with the new unit default', () => {
    expect(quantityForUnitChange('1', 'unidad', 'pesos')).toBe('2000');
    expect(quantityForUnitChange('2000', 'pesos', 'libra')).toBe('1');
  });

  it('keeps a quantity the user chose', () => {
    expect(quantityForUnitChange('3', 'unidad', 'libra')).toBe('3');
  });
});

describe('describing a quantity', () => {
  it('reads naturally in the summary', () => {
    expect(describeQuantity('1', 'unidad')).toBe('1 unidad');
    expect(describeQuantity('1,5', 'libra')).toBe('1,5 libras');
    expect(describeQuantity('250', 'gramos')).toBe('250 gramos');
    expect(describeQuantity('2000', 'pesos')).toBe('$ 2.000');
  });
});
