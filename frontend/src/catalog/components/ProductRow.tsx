import { Pencil, Power, RotateCcw } from 'lucide-react';
import type { Product } from '../types/catalog.types';
import { unitLabel } from '../units';

interface ProductRowProps {
  product: Product;
  canEdit: boolean;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
}

export function ProductRow({ product, canEdit, onEdit, onToggleActive }: ProductRowProps) {
  return (
    <li
      className={`card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 ${product.is_active ? '' : 'border-dashed bg-surface-alt/40'}`}
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-lg font-bold break-words">{product.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-soft px-3 py-0.5 text-sm font-bold text-primary-hover">
            {unitLabel(product.default_unit)}
          </span>
          {product.category && <span className="text-text-muted">{product.category}</span>}
          {!product.is_active && (
            <span className="rounded-full bg-text-muted px-3 py-0.5 text-sm font-bold text-white">Inactivo</span>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          {product.is_active && (
            <button
              type="button"
              className="btn btn-secondary px-4"
              onClick={() => onEdit(product)}
              aria-label={`Editar ${product.name}`}
            >
              <Pencil aria-hidden="true" className="size-5" />
              <span>Editar</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost px-4"
            onClick={() => onToggleActive(product)}
            aria-label={`${product.is_active ? 'Desactivar' : 'Activar'} ${product.name}`}
          >
            {product.is_active ? (
              <Power aria-hidden="true" className="size-5" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-5" />
            )}
            <span>{product.is_active ? 'Desactivar' : 'Activar'}</span>
          </button>
        </div>
      )}
    </li>
  );
}
