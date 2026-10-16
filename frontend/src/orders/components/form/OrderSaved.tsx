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
    <div role="status" className="card flex flex-col items-center gap-4 px-6 py-12 text-center desk:gap-3 desk:py-10">
      <span className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary desk:size-16">
        <CircleCheck aria-hidden="true" className="size-12 desk:size-10" />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl">
        Domicilio {formatOrderNumber(number)} {mode === 'create' ? 'publicado' : 'actualizado'}
      </h1>
      <p className="max-w-md text-lg text-text-muted desk:text-base">
        {mode === 'create'
          ? 'El equipo ya lo puede ver para alistarlo.'
          : 'Los cambios quedaron guardados.'}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {onCreateAnother && (
          <button type="button" className="btn btn-primary min-h-14 px-8 text-lg desk:min-h-10 desk:px-5 desk:text-base" onClick={onCreateAnother}>
            <Plus aria-hidden="true" className="size-6 desk:size-5" />
            Crear otro
          </button>
        )}
        <button type="button" className="btn btn-secondary min-h-14 px-8 text-lg desk:min-h-10 desk:px-5 desk:text-base" onClick={onViewOrders}>
          <ClipboardList aria-hidden="true" className="size-6 desk:size-5" />
          Ver domicilios
        </button>
        {onPrint && (
          <button type="button" className="btn btn-secondary min-h-14 px-8 text-lg desk:min-h-10 desk:px-5 desk:text-base" onClick={onPrint}>
            <Printer aria-hidden="true" className="size-6 desk:size-5" />
            Imprimir
          </button>
        )}
      </div>
    </div>
  );
}
