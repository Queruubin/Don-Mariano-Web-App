import { useState } from 'react';
import { useAuthStore } from '../../auth/store/authStore';
import { useActiveBranch } from '../../branches/hooks/useBranches';
import { NoBranchState } from '../../shared/components/StatusViews';
import { draftKey, loadDraft } from '../form/draftStorage';
import { EMPTY_ORDER_FORM } from '../form/orderForm';
import { OrderForm } from './OrderForm';

/** Loads the draft of this user and branch, if any, then shows the form. */
function NewOrderForm({ storageKey }: { storageKey: string }) {
  const [draft] = useState(() => loadDraft(storageKey));
  return (
    <OrderForm
      mode="create"
      title="Nuevo domicilio"
      initialValues={draft ?? EMPTY_ORDER_FORM}
      draftKey={storageKey}
      restoredDraft={draft != null}
    />
  );
}

export function NewOrderPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const branch = useActiveBranch();

  // RequireBranch only renders this page with an active branch.
  if (branch.id == null || userId == null) return <NoBranchState />;
  const storageKey = draftKey(userId, branch.id);
  // A new key (another branch) starts a fresh form with that branch's draft.
  return <NewOrderForm key={storageKey} storageKey={storageKey} />;
}
