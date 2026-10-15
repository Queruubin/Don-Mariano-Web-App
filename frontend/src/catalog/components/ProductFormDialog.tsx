import { Modal } from '../../shared/components/Modal';
import { parseApiError } from '../../shared/utils/apiErrors';
import { useCategories, useSaveProduct } from '../hooks/useCatalog';
import { EMPTY_PRODUCT_FORM } from '../productForm';
import type { Product } from '../types/catalog.types';
import { ProductForm } from './ProductForm';

interface ProductFormDialogProps {
  /** The product to edit, or null to create one. */
  product: Product | null;
  onClose: () => void;
}

export function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  const { data: categories = [] } = useCategories();
  const save = useSaveProduct();
  const initialValues = product
    ? { name: product.name, default_unit: product.default_unit, category: product.category }
    : EMPTY_PRODUCT_FORM;

  return (
    <Modal title={product ? 'Editar producto' : 'Agregar producto'} onClose={onClose}>
      <ProductForm
        initialValues={initialValues}
        categories={categories}
        submitting={save.isPending}
        serverErrors={save.error ? parseApiError(save.error) : null}
        submitLabel={product ? 'Guardar cambios' : 'Agregar producto'}
        onCancel={onClose}
        onSubmit={(input) => save.mutate({ id: product?.id, input }, { onSuccess: onClose })}
      />
    </Modal>
  );
}
