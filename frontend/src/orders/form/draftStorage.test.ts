import { describe, expect, it } from 'vitest';
import { clearDraft, draftKey, loadDraft, saveDraft } from './draftStorage';
import { EMPTY_ORDER_FORM, freeTextLine } from './orderForm';

const values = { ...EMPTY_ORDER_FORM, phone: '3001234567', lines: [freeTextLine('Cilantro')] };

describe('order drafts', () => {
  it('is kept per user and branch', () => {
    expect(draftKey(7, 2)).toBe('don-mariano-order-draft:7:2');
    saveDraft(draftKey(7, 2), values);
    expect(loadDraft(draftKey(7, 2))).toEqual(values);
    expect(loadDraft(draftKey(7, 3))).toBeNull();
    expect(loadDraft(draftKey(8, 2))).toBeNull();
  });

  it('is removed when cleared or when the form is empty', () => {
    const key = draftKey(1, 1);
    saveDraft(key, values);
    clearDraft(key);
    expect(loadDraft(key)).toBeNull();

    saveDraft(key, values);
    saveDraft(key, EMPTY_ORDER_FORM);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('ignores unreadable or outdated drafts', () => {
    localStorage.setItem('broken', '{not json');
    expect(loadDraft('broken')).toBeNull();
    localStorage.setItem('old', JSON.stringify({ version: 0, values }));
    expect(loadDraft('old')).toBeNull();
  });
});
