import { useId, useState } from 'react';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { apiErrorMessage } from '../../../shared/utils/apiErrors';
import { CANCEL_REASONS, isStaleStatusError, useCancelOrder } from '../../hooks/useOrders';
import { formatOrderNumber } from '../../labels';
import type { Order } from '../../types/order.types';

const REASON_REQUIRED = 'Elija o escriba el motivo de la cancelación.';

/** Cancelling asks for confirmation and a reason (FR-28). */
export function CancelOrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const cancel = useCancelOrder();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const confirm = () => {
    const text = reason.trim();
    if (!text) {
      setError(REASON_REQUIRED);
      return;
    }
    setError(null);
    cancel.mutate(
      { order, reason: text },
      {
        onSuccess: onClose,
        onError: (failure) => {
          if (isStaleStatusError(failure)) {
            // The detail view refreshes behind the dialog; there is nothing to retry.
            onClose();
            return;
          }
          setError(apiErrorMessage(failure));
        },
      },
    );
  };

  return (
    <ConfirmDialog
      title={`¿Cancelar el domicilio ${formatOrderNumber(order.number)}?`}
      confirmLabel="Sí, cancelar domicilio"
      cancelLabel="No, volver"
      tone="danger"
      busy={cancel.isPending}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <p>El domicilio no se podrá volver a activar.</p>
      <fieldset>
        <legend className="field-label">¿Por qué se cancela?</legend>
        <div className="flex flex-wrap gap-2">
          {CANCEL_REASONS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={reason === option}
              onClick={() => {
                setReason(option);
                setError(null);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={inputId} className="field-label">
          Motivo
        </label>
        <input
          id={inputId}
          className="input"
          maxLength={255}
          placeholder="Escriba otro motivo"
          value={reason}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
        />
        {error && (
          <p id={errorId} role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
