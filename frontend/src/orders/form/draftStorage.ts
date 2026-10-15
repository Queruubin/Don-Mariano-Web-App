/**
 * Local draft of a half-taken order (FR-25), one per user and branch, so a
 * refresh or an accidental navigation never loses it. Storage can be blocked
 * or full: every access is best effort.
 */
import { EMPTY_ORDER_FORM, isFormEmpty, type OrderFormValues } from './orderForm';

const VERSION = 1;

interface StoredDraft {
  version: number;
  savedAt: string;
  values: OrderFormValues;
}

export function draftKey(userId: number, branchId: number): string {
  return `don-mariano-order-draft:${userId}:${branchId}`;
}

export function saveDraft(key: string, values: OrderFormValues): void {
  try {
    if (isFormEmpty(values)) {
      localStorage.removeItem(key);
      return;
    }
    const draft: StoredDraft = { version: VERSION, savedAt: new Date().toISOString(), values };
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Private mode or full storage: the form keeps working without a draft.
  }
}

function isDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<StoredDraft>;
  return draft.version === VERSION && !!draft.values && Array.isArray(draft.values.lines);
}

/** The saved draft, or null when there is none or it cannot be read. */
export function loadDraft(key: string): OrderFormValues | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed)) return null;
    // Fill fields added after the draft was saved.
    const values = { ...EMPTY_ORDER_FORM, ...parsed.values };
    return isFormEmpty(values) ? null : values;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
}
