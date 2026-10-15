import type { ReactNode } from 'react';
import { Modal } from '../../../shared/components/Modal';
import { formatCOP } from '../../form/money';
import { cleanText, productsLabel, type OrderFormValues } from '../../form/orderForm';
import { describeQuantity } from '../../form/quantity';
import { paymentLabel } from '../../labels';

interface ConfirmOrderDialogProps {
  title: string;
  confirmLabel: string;
  busyLabel: string;
  values: OrderFormValues;
  /** The address that will be used, saved or typed. */
  address: string;
  changeDue: number | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <dt className="font-bold text-text-muted">{label}</dt>
      <dd className="text-lg break-words">{children}</dd>
    </div>
  );
}

/** Last check before publishing: one screen with everything that matters. */
export function ConfirmOrderDialog({
  title,
  confirmLabel,
  busyLabel,
  values,
  address,
  changeDue,
  busy,
  onConfirm,
  onCancel,
}: ConfirmOrderDialogProps) {
  const notes = cleanText(values.addressNotes);
  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Volver
          </button>
          <button type="button" className="btn btn-primary min-h-14 px-8 text-lg" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      <dl>
        <Row label="Cliente">
          {cleanText(values.name)} · <span className="tabular-nums">{values.phone.trim()}</span>
        </Row>
        <Row label="Dirección">
          {address}
          {notes && <span className="block text-text-muted">{notes}</span>}
        </Row>
        <Row label={productsLabel(values.lines.length)}>
          <ul className="list-disc pl-5">
            {values.lines.map((line) => (
              <li key={line.key}>
                {describeQuantity(line.quantity, line.unit)} de {line.name}
                {line.notes.trim() && <span className="text-text-muted"> ({line.notes.trim()})</span>}
              </li>
            ))}
          </ul>
        </Row>
        <Row label="Pago">
          {paymentLabel(values.paymentMethod)}
          {values.paymentMethod === 'cash' && values.paysWith && (
            <span className="block text-text-muted">
              Paga con {formatCOP(values.paysWith)}
              {changeDue != null && ` · Cambio ${formatCOP(changeDue)}`}
            </span>
          )}
        </Row>
        <Row label="Total">
          <strong className="text-2xl tabular-nums">{formatCOP(values.total)}</strong>
        </Row>
      </dl>
    </Modal>
  );
}
