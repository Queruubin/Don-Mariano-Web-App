import { HandCoins } from 'lucide-react';
import { formatCOP, quickPayAmounts } from '../../form/money';
import type { OrderFormErrors, OrderFormValues } from '../../form/orderForm';
import { PAYMENT_METHODS } from '../../labels';
import type { PaymentMethod } from '../../types/order.types';
import { FieldError } from './FieldError';
import { MoneyInput } from './MoneyInput';
import { SectionCard } from './SectionCard';

interface ClosingSectionProps {
  values: Pick<OrderFormValues, 'paymentMethod' | 'total' | 'paysWith' | 'notes'>;
  errors: OrderFormErrors;
  changeDue: number | null;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onTotalChange: (raw: string) => void;
  onPaysWithChange: (raw: string) => void;
  onNotesChange: (value: string) => void;
}

/** Closing block (FR-20..23): payment method, total, "paga con" and a general note. */
export function ClosingSection({
  values,
  errors,
  changeDue,
  onPaymentMethodChange,
  onTotalChange,
  onPaysWithChange,
  onNotesChange,
}: ClosingSectionProps) {
  const quickAmounts = quickPayAmounts(values.total);
  return (
    <SectionCard title="Pago" icon={HandCoins} className="lg:col-start-2 lg:row-start-2">
      <div className="space-y-5 desk:space-y-4">
        <div>
          <p id="order-payment-label" className="field-label">
            ¿Cómo paga?
          </p>
          <div
            role="group"
            aria-labelledby="order-payment-label"
            aria-describedby={errors.paymentMethod ? 'order-payment-error' : undefined}
            className="grid grid-cols-2 gap-2"
          >
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }, index) => {
              const selected = values.paymentMethod === value;
              return (
                <button
                  key={value}
                  id={index === 0 ? 'order-payment' : undefined}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPaymentMethodChange(value)}
                  className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 px-2 text-lg font-bold desk:min-h-11 desk:rounded-xl desk:text-base ${selected ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text hover:bg-surface-alt'}`}
                >
                  <Icon aria-hidden="true" className="size-6 shrink-0 desk:size-5" />
                  {label}
                </button>
              );
            })}
          </div>
          <FieldError id="order-payment-error" message={errors.paymentMethod} />
        </div>

        <MoneyInput
          id="order-total"
          label="Total del domicilio"
          value={values.total}
          error={errors.total}
          required
          onChange={onTotalChange}
        />

        {values.paymentMethod === 'cash' && (
          <div className="space-y-2 rounded-2xl bg-surface-alt/60 p-3 desk:rounded-xl">
            <MoneyInput
              id="order-pays-with"
              label="¿Con cuánto paga? (opcional)"
              hint="Para que el domiciliario lleve el cambio."
              value={values.paysWith}
              error={errors.paysWith}
              onChange={onPaysWithChange}
            />
            {quickAmounts.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Billetes frecuentes">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="chip"
                    aria-pressed={values.paysWith === String(amount)}
                    onClick={() => onPaysWithChange(String(amount))}
                  >
                    {formatCOP(amount)}
                  </button>
                ))}
              </div>
            )}
            <p aria-live="polite" className="text-lg">
              {changeDue != null && (
                <>
                  Cambio: <strong className="tabular-nums">{formatCOP(changeDue)}</strong>
                </>
              )}
            </p>
          </div>
        )}

        <div>
          <label htmlFor="order-notes" className="field-label">
            Nota general <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <textarea
            id="order-notes"
            rows={2}
            placeholder="Ej: llamar al llegar"
            className="input"
            value={values.notes}
            onChange={(event) => onNotesChange(event.target.value)}
            aria-invalid={errors.notes ? true : undefined}
          />
          <FieldError id="order-notes-error" message={errors.notes} />
        </div>
      </div>
    </SectionCard>
  );
}
