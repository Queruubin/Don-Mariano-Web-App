import { CircleCheck, ClipboardList, Plus, Printer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatOrderNumber } from '../../labels';

interface OrderSavedProps {
  number: number;
  mode: 'create' | 'edit';
  onCreateAnother?: () => void;
  onViewOrders: () => void;
  /** Opens the ticket of the saved order. */
  onPrint?: () => void;
}

/** Success screen after publishing or saving an order. */
export function OrderSaved({ number, mode, onCreateAnother, onViewOrders, onPrint }: OrderSavedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div role="status" className="card flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary">
        <CircleCheck aria-hidden="true" className="size-12" />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl">
        Domicilio {formatOrderNumber(number)} {mode === 'create' ? 'publicado' : 'actualizado'}
      </h1>
      <p className="max-w-md text-lg text-text-muted">
        {mode === 'create'
          ? 'El equipo ya lo puede ver para alistarlo.'
          : 'Los cambios quedaron guardados.'}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {onCreateAnother && (
          <button type="button" className="btn btn-primary min-h-14 px-8 text-lg" onClick={onCreateAnother}>
            <Plus aria-hidden="true" className="size-6" />
            Crear otro
          </button>
        )}
        <button type="button" className="btn btn-secondary min-h-14 px-8 text-lg" onClick={onViewOrders}>
          <ClipboardList aria-hidden="true" className="size-6" />
          Ver domicilios
        </button>
        {onPrint && (
          <button type="button" className="btn btn-secondary min-h-14 px-8 text-lg" onClick={onPrint}>
            <Printer aria-hidden="true" className="size-6" />
            Imprimir
          </button>
        )}
      </div>
    </div>
  );
}
