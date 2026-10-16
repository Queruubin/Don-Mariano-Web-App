import { describe, expect, it } from 'vitest';
import { groupBoard, matchesSearch } from './board';
import { makeBoardOrder } from './test/fixtures';
import { timeAgo } from './time';

describe('groupBoard', () => {
  it('puts each order in its status section and finished ones together', () => {
    const orders = [
      makeBoardOrder({ id: 1, status: 'pending' }),
      makeBoardOrder({ id: 2, status: 'preparing' }),
      makeBoardOrder({ id: 3, status: 'pending' }),
      makeBoardOrder({ id: 4, status: 'on_the_way' }),
      makeBoardOrder({ id: 5, status: 'delivered' }),
      makeBoardOrder({ id: 6, status: 'cancelled' }),
    ];
    const groups = groupBoard(orders);
    expect(groups.pending.map((o) => o.id)).toEqual([1, 3]);
    expect(groups.preparing.map((o) => o.id)).toEqual([2]);
    expect(groups.on_the_way.map((o) => o.id)).toEqual([4]);
    expect(groups.finished.map((o) => o.id)).toEqual([5, 6]);
  });

  it('applies the search to every section', () => {
    const orders = [
      makeBoardOrder({ id: 1, customer: { id: 1, name: 'Gloria Pérez', phone: '3001234567' } }),
      makeBoardOrder({ id: 2, customer: { id: 2, name: 'Andrés Rojas', phone: '3109876543' } }),
    ];
    expect(groupBoard(orders, 'andres').pending.map((o) => o.id)).toEqual([2]);
  });
});

describe('matchesSearch', () => {
  const order = makeBoardOrder({ number: 142, customer: { id: 1, name: 'Gloria Pérez', phone: '3001234567' } });

  it.each(['142', '#0142', '# 142', 'perez', 'GLORIA', '  gloria   pérez ', '4567', '300 123'])('finds "%s"', (query) => {
    expect(matchesSearch(order, query)).toBe(true);
  });

  it.each(['143', 'andrés', '9999'])('does not find "%s"', (query) => {
    expect(matchesSearch(order, query)).toBe(false);
  });

  it('matches everything when the search is empty', () => {
    expect(matchesSearch(order, '   ')).toBe(true);
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-10-15T15:00:00Z');
  it.each([
    ['2026-10-15T14:59:30Z', 'hace un momento'],
    ['2026-10-15T14:55:00Z', 'hace 5 min'],
    ['2026-10-15T12:00:00Z', 'hace 3 h'],
  ])('%s -> %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});
