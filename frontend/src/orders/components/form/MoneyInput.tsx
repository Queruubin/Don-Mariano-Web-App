import { formatMoneyInput } from '../../form/money';
import { FieldError } from './FieldError';

interface MoneyInputProps {
  id: string;
  label: string;
  hint?: string;
  /** Digits only, e.g. "45000". */
  value: string;
  error?: string;
  required?: boolean;
  onChange: (raw: string) => void;
}

/** Peso amount formatted while typing: "45000" shows as "$ 45.000". */
export function MoneyInput({ id, label, hint, value, error, required, onChange }: MoneyInputProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mb-1 text-text-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="$ 0"
        className="input text-xl font-bold tabular-nums"
        value={formatMoneyInput(value)}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
