import { FileSpreadsheet, PackageOpen, Plus, Search, SearchX, X } from 'lucide-react';
import { useId, useState } from 'react';
import { canManageCatalog } from '../../auth/roles';
import { useAuthStore } from '../../auth/store/authStore';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { EmptyState, ErrorState, ListSkeleton } from '../../shared/components/StatusViews';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { apiErrorMessage } from '../../shared/utils/apiErrors';
import { useCategories, useProducts, useSetProductActive } from '../hooks/useCatalog';
import { productsLabel } from '../importSummary';
import type { Product } from '../types/catalog.types';
import { ImportDialog } from './ImportDialog';
import { ProductFormDialog } from './ProductFormDialog';
import { ProductRow } from './ProductRow';

type Dialog =
  | { kind: 'none' }
  | { kind: 'form'; product: Product | null }
  | { kind: 'toggle'; product: Product }
  | { kind: 'import' };

export function CatalogPage() {
  const searchId = useId();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = canManageCatalog(role);
  const branch = useActiveBranch();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = { search: debouncedSearch, category, includeInactive: canEdit && includeInactive };
  const products = useProducts(filters);
  const { data: categories = [] } = useCategories();
  const setActive = useSetProductActive();

  const closeDialog = () => {
    setDialog({ kind: 'none' });
    setActive.reset();
  };

  const items = products.data?.pages.flatMap((page) => page.results) ?? [];
  const total = products.data?.pages[0]?.count ?? 0;
  const isFiltering = Boolean(debouncedSearch.trim() || category);

  const adminActions = canEdit && (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'form', product: null })}>
        <Plus aria-hidden="true" className="size-5" />
        Agregar producto
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setDialog({ kind: 'import' })}>
        <FileSpreadsheet aria-hidden="true" className="size-5" />
        Importar desde Excel
      </button>
    </>
  );

  let content;
  if (products.isPending) {
    content = <ListSkeleton />;
  } else if (products.isError) {
    content = (
      <ErrorState
        message={`No pudimos cargar el catálogo. ${apiErrorMessage(products.error)}`}
        onRetry={() => products.refetch()}
      />
    );
  } else if (items.length === 0 && isFiltering) {
    content = (
      <EmptyState icon={SearchX} title="No encontramos productos">
        {debouncedSearch.trim()
          ? `Nada coincide con "${debouncedSearch.trim()}". Revise cómo está escrito o pruebe con otra palabra.`
          : 'No hay productos en esta categoría.'}
      </EmptyState>
    );
  } else if (items.length === 0) {
    content = (
      <EmptyState icon={PackageOpen} title="Aún no hay productos" actions={adminActions}>
        {canEdit
          ? 'Agregue productos uno por uno o cárguelos todos desde un archivo de Excel.'
          : 'Cuando el administrador de la sede agregue productos, aparecerán aquí.'}
      </EmptyState>
    );
  } else {
    content = (
      <>
        <p className="mb-2 text-text-muted" aria-live="polite">
          {productsLabel(total)}
        </p>
        <ul className="space-y-3">
          {items.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              canEdit={canEdit}
              onEdit={(selected) => setDialog({ kind: 'form', product: selected })}
              onToggleActive={(selected) => setDialog({ kind: 'toggle', product: selected })}
            />
          ))}
        </ul>
        {products.hasNextPage && (
          <button
            type="button"
            className="btn btn-secondary mt-4 w-full"
            onClick={() => products.fetchNextPage()}
            disabled={products.isFetchingNextPage}
          >
            {products.isFetchingNextPage ? 'Cargando…' : 'Ver más productos'}
          </button>
        )}
      </>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Catálogo</h1>
          {branch.name && <p className="text-text-muted">Productos de la sede {branch.name}</p>}
        </div>
        {canEdit && <div className="flex flex-wrap gap-3">{adminActions}</div>}
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Buscar producto
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-text-muted" />
          <input
            id={searchId}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            className="input min-h-14 pr-14 pl-13 text-lg"
            placeholder="Buscar producto…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
          />
          {search && (
            <button
              type="button"
              className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-surface-alt"
              onClick={() => setSearch('')}
              aria-label="Borrar búsqueda"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div role="group" aria-label="Filtrar por categoría" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap">
            <button type="button" className="chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
              Todas
            </button>
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={category === name}
                onClick={() => setCategory(category === name ? null : name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {canEdit && (
          <label className="inline-flex min-h-12 items-center gap-3 font-semibold">
            <input
              type="checkbox"
              className="size-6 accent-primary"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Ver inactivos
          </label>
        )}
      </div>

      {content}

      {dialog.kind === 'form' && <ProductFormDialog product={dialog.product} onClose={closeDialog} />}
      {dialog.kind === 'import' && <ImportDialog onClose={closeDialog} />}
      {dialog.kind === 'toggle' && (
        <ConfirmDialog
          title={dialog.product.is_active ? '¿Desactivar este producto?' : '¿Activar este producto?'}
          confirmLabel={dialog.product.is_active ? 'Sí, desactivar' : 'Sí, activar'}
          tone={dialog.product.is_active ? 'danger' : 'primary'}
          busy={setActive.isPending}
          error={setActive.error ? apiErrorMessage(setActive.error) : null}
          onCancel={closeDialog}
          onConfirm={() =>
            setActive.mutate(
              { id: dialog.product.id, active: !dialog.product.is_active },
              { onSuccess: closeDialog },
            )
          }
        >
          <p className="font-bold">{dialog.product.name}</p>
          <p>
            {dialog.product.is_active
              ? 'Ya no aparecerá al tomar domicilios. Los domicilios anteriores no cambian y puede volver a activarlo cuando quiera.'
              : 'Volverá a aparecer al tomar domicilios.'}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
