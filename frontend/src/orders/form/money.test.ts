import { describe, expect, it } from 'vitest';
import { changeDue, formatCOP, formatMoneyInput, parseMoneyInput, quickPayAmounts } from './money';

describe('COP formatting', () => {
  it.each([
    [45000, '$ 45.000'],
    [0, '$ 0'],
    [999, '$ 999'],
    [1250000, '$ 1.250.000'],
    ['45000', '$ 45.000'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatCOP(value)).toBe(expected);
  });

  it('keeps only digits while typing, without leading zeros', () => {
    expect(parseMoneyInput('$ 45.0001')).toBe('450001');
    expect(parseMoneyInput('0045000')).toBe('45000');
    expect(parseMoneyInput('$ ')).toBe('');
    expect(parseMoneyInput('0')).toBe('');
  });

  it('re-formats what the user typed', () => {
    expect(formatMoneyInput(parseMoneyInput('$ 4.5000'))).toBe('$ 45.000');
    expect(formatMoneyInput('')).toBe('');
  });
});

describe('change due', () => {
  it('is the difference when the customer pays with enough', () => {
    expect(changeDue('45000', '50000')).toBe(5000);
    expect(changeDue('45000', '45000')).toBe(0);
  });

  it('is unknown when an amount is missing or too low', () => {
    expect(changeDue('45000', '')).toBeNull();
    expect(changeDue('', '50000')).toBeNull();
    expect(changeDue('45000', '40000')).toBeNull();
  });
});

describe('quick pay amounts', () => {
  it('suggests the next round bills', () => {
    expect(quickPayAmounts('45000')).toEqual([50000, 60000, 100000]);
    expect(quickPayAmounts('8500')).toEqual([10000, 20000, 50000]);
  });

  it('includes the exact amount when it is already round', () => {
    expect(quickPayAmounts('50000')).toEqual([50000, 60000, 100000]);
  });

  it('suggests nothing without a total', () => {
    expect(quickPayAmounts('')).toEqual([]);
  });
});
