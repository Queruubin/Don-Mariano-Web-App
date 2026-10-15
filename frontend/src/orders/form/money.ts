/** Colombian pesos have no cents in practice: amounts are whole numbers. */
const MAX_DIGITS = 12;

/** Group thousands with dots: 45000 -> "45.000". */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `$ 45.000` (PRD section 5). Accepts a number or a digits string. */
export function formatCOP(value: number | string): string {
  const digits = typeof value === 'number' ? String(Math.round(Math.abs(value))) : onlyDigits(value);
  return `$ ${groupThousands(digits || '0')}`;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/** Keep what the user typed as a clean digits string ("$ 45.0001" -> "450001"). */
export function parseMoneyInput(raw: string): string {
  const digits = onlyDigits(raw).slice(0, MAX_DIGITS);
  return digits === '0' ? '' : digits;
}

/** How the money input shows a digits string while typing: "" stays empty. */
export function formatMoneyInput(digits: string): string {
  return digits ? formatCOP(digits) : '';
}

export function moneyToNumber(digits: string): number | null {
  return digits ? Number(digits) : null;
}

/** Change due for a cash payment, or null when it cannot be computed. */
export function changeDue(totalDigits: string, paysWithDigits: string): number | null {
  const total = moneyToNumber(totalDigits);
  const paysWith = moneyToNumber(paysWithDigits);
  if (total == null || paysWith == null || paysWith < total) return null;
  return paysWith - total;
}

const ROUND_STEPS = [10_000, 20_000, 50_000, 100_000];

/**
 * Bills the customer is likely to pay with: the total rounded up to the next
 * 10.000, 20.000, 50.000 and 100.000. At most `count` distinct amounts.
 */
export function quickPayAmounts(totalDigits: string, count = 3): number[] {
  const total = moneyToNumber(totalDigits);
  if (total == null || total <= 0) return [];
  const amounts = new Set(ROUND_STEPS.map((step) => Math.ceil(total / step) * step));
  return [...amounts].sort((a, b) => a - b).slice(0, count);
}
