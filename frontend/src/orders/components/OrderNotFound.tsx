import { FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../shared/components/StatusViews';
import { ORDERS_PATH } from './OrderForm';

/** Shown when an order id does not exist or belongs to another branch. */
export function OrderNotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="No encontramos este domicilio"
      actions={
        <Link to={ORDERS_PATH} className="btn btn-primary">
          Volver a domicilios
        </Link>
      }
    >
      Puede que el número esté mal escrito o que el domicilio sea de otra sede.
    </EmptyState>
  );
}
