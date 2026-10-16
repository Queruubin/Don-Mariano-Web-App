import { isAxiosError } from 'axios';
import { CircleAlert } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { useLeaveGuard } from '../../shared/hooks/useLeaveGuard';
import { apiErrorMessage } from '../../shared/utils/apiErrors';
import { clearDraft, saveDraft } from '../form/draftStorage';
import {
  affectedErrorKeys,
  cleanText,
  fieldIdForError,
  firstErrorKey,
  initialOrderFormState,
  isFormEmpty,
  mapServerErrors,
  orderChangeDue,
  orderFormReducer,
  toOrderInput,
  validateOrderForm,
  type OrderFormAction,
  type OrderFormErrors,
  type OrderFormValues,
} from '../form/orderForm';
import { orderPrintPath } from '../format';
import { useCustomerLookup, useSaveOrder } from '../hooks/useOrders';
import type { Order } from '../types/order.types';
import { CartSection } from './form/CartSection';
import { ClosingSection } from './form/ClosingSection';
import { ConfirmOrderDialog } from './form/ConfirmOrderDialog';
import { CustomerSection } from './form/CustomerSection';
import { DraftBanner } from './form/DraftBanner';
import { OrderSaved } from './form/OrderSaved';
import { OrderSummaryBar } from './form/OrderSummaryBar';

export const ORDERS_PATH = '/domicilios';
const DRAFT_SAVE_DELAY_MS = 400;
const MESSAGE_ID = 'order-form-message';

interface OrderFormProps {
  mode: 'create' | 'edit';
  title: string;
  initialValues: OrderFormValues;
  /** Edit mode only. */
  orderId?: number;
  /** Where the draft is kept (create mode). Null disables drafts. */
  draftKey: string | null;
  /** True when `initialValues` came from a saved draft. */
  restoredDraft?: boolean;
}

function findField(key: string): HTMLElement | null {
  // With a saved address chosen there is no address input, only the cards.
  const fallback = key === 'address' ? document.getElementById('order-address-group') : null;
  const id = fieldIdForError(key);
  if (id === MESSAGE_ID) return null;
  return document.getElementById(id) ?? fallback;
}

function focusField(key: string) {
  const element = findField(key) ?? document.getElementById(MESSAGE_ID);
  if (!element) return;
  element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  element.focus({ preventScroll: true });
}

/**
 * The whole create/edit order screen (PRD 4.5): one reducer for the form,
 * presentational sections for each block, a confirmation step and drafts.
 */
export function OrderForm({ mode, title, initialValues, orderId, draftKey, restoredDraft = false }: OrderFormProps) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(orderFormReducer, initialValues, (values) => ({
    ...initialOrderFormState(values),
    touched: restoredDraft,
  }));
  const { values } = state;
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<OrderFormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState<Order | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(restoredDraft);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const saveOrder = useSaveOrder(orderId);

  // Client checks re-run on every change once the user tried to publish.
  const errors: OrderFormErrors = { ...serverErrors, ...(submitAttempted ? validateOrderForm(values) : {}) };
  const changeDue = orderChangeDue(values);

  const update = useCallback((action: OrderFormAction) => {
    dispatch(action);
    const keys = affectedErrorKeys(action);
    if (keys.length) {
      setServerErrors((current) => {
        if (!keys.some((key) => key in current)) return current;
        const next = { ...current };
        for (const key of keys) delete next[key];
        return next;
      });
    }
  }, []);

  // --- Customer lookup (FR-13) ---
  const lookup = useCustomerLookup(values.phone);
  useEffect(() => {
    if (!lookup.isDone) return;
    dispatch(lookup.customer ? { type: 'customerFound', customer: lookup.customer } : { type: 'customerNotFound' });
  }, [lookup.isDone, lookup.customer, lookup.phone]);

  // --- Draft autosave (FR-25) ---
  const latestValues = useRef(values);
  latestValues.current = values;
  const canSaveDraft = draftKey != null && state.touched && saved == null;
  useEffect(() => {
    if (!canSaveDraft) return;
    const timer = setTimeout(() => saveDraft(draftKey, values), DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canSaveDraft, draftKey, values]);
  const canSaveDraftRef = useRef(canSaveDraft);
  canSaveDraftRef.current = canSaveDraft;
  useEffect(() => {
    if (draftKey == null) return;
    // Flush the pending save when the tab is closed or the page is left.
    const flush = () => {
      if (canSaveDraftRef.current) saveDraft(draftKey, latestValues.current);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [draftKey]);

  // --- Leaving with unsaved work ---
  const hasUnsavedWork = state.touched && saved == null && !isFormEmpty(values);
  const blocker = useLeaveGuard(hasUnsavedWork && !saveOrder.isPending);

  const resetForm = (focusPhone: boolean) => {
    dispatch({ type: 'reset' });
    setSubmitAttempted(false);
    setServerErrors({});
    setGeneralError(null);
    setLastAddedKey(null);
    if (draftKey) clearDraft(draftKey);
    if (focusPhone) requestAnimationFrame(() => document.getElementById('order-phone')?.focus());
  };

  const discardDraft = () => {
    setShowDraftBanner(false);
    resetForm(true);
  };

  const submit = () => {
    setSubmitAttempted(true);
    setGeneralError(null);
    const clientErrors = validateOrderForm(values);
    const merged = { ...serverErrors, ...clientErrors };
    const first = firstErrorKey(merged, values);
    if (first) {
      focusField(first);
      return;
    }
    setConfirming(true);
  };

  const confirm = () => {
    saveOrder.mutate(toOrderInput(values), {
      onSuccess: (order) => {
        if (draftKey) clearDraft(draftKey);
        setConfirming(false);
        setShowDraftBanner(false);
        setSaved(order);
      },
      onError: (error) => {
        setConfirming(false);
        if (isAxiosError(error) && error.response?.status === 400) {
          const mapped = mapServerErrors(error.response.data, values.lines);
          setServerErrors(mapped.fields);
          // A message for a field that is not on screen must still be seen.
          const offScreen = Object.entries(mapped.fields).find(([key]) => !findField(key));
          setGeneralError(mapped.message ?? offScreen?.[1] ?? null);
          const first = firstErrorKey(mapped.fields, values);
          requestAnimationFrame(() => focusField(first ?? 'message'));
        } else {
          setGeneralError(apiErrorMessage(error));
          requestAnimationFrame(() => focusField('message'));
        }
      },
    });
  };

  if (saved) {
    return (
      <OrderSaved
        number={saved.number}
        mode={mode}
        onCreateAnother={
          mode === 'create'
            ? () => {
                setSaved(null);
                resetForm(true);
              }
            : undefined
        }
        onViewOrders={() => navigate(ORDERS_PATH)}
        onPrint={() => navigate(orderPrintPath(saved.id))}
      />
    );
  }

  const savedAddress =
    values.addressChoice === 'new'
      ? null
      : lookup.customer?.addresses.find((address) => address.id === values.addressChoice);
  const confirmAddress = savedAddress?.address ?? cleanText(values.newAddress);
  const isCreate = mode === 'create';

  return (
    <div>
      <h1 className="mb-4 text-3xl">{title}</h1>

      {showDraftBanner && <DraftBanner onDiscard={discardDraft} onDismiss={() => setShowDraftBanner(false)} />}

      <div id={MESSAGE_ID} tabIndex={-1} aria-live="assertive">
        {generalError && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-lg font-semibold text-danger">
            <CircleAlert aria-hidden="true" className="mt-1 size-5 shrink-0" />
            {generalError}
          </p>
        )}
      </div>

      <form
        noValidate
        aria-label={title}
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start"
      >
        <CustomerSection
          values={values}
          errors={errors}
          lookup={lookup}
          onChange={(field, value) => update({ type: 'setField', field, value })}
          onChooseAddress={(choice, notes) => update({ type: 'chooseAddress', choice, notes })}
        />
        <CartSection
          lines={values.lines}
          errors={errors}
          lastAddedKey={lastAddedKey}
          searchRef={searchRef}
          onAdd={(line) => {
            update({ type: 'addLine', line });
            setLastAddedKey(line.key);
            searchRef.current?.focus();
          }}
          onQuantityChange={(key, quantity) => update({ type: 'updateLine', key, changes: { quantity } })}
          onUnitChange={(key, unit) => update({ type: 'changeUnit', key, unit })}
          onNotesChange={(key, notes) => update({ type: 'updateLine', key, changes: { notes } })}
          onRemove={(key) => update({ type: 'removeLine', key })}
        />
        <ClosingSection
          values={values}
          errors={errors}
          changeDue={changeDue}
          onPaymentMethodChange={(method) => update({ type: 'setPaymentMethod', method })}
          onTotalChange={(raw) => update({ type: 'setTotal', raw })}
          onPaysWithChange={(raw) => update({ type: 'setPaysWith', raw })}
          onNotesChange={(value) => update({ type: 'setField', field: 'notes', value })}
        />
      </form>

      <OrderSummaryBar
        lineCount={values.lines.length}
        total={values.total}
        submitLabel={isCreate ? 'Publicar domicilio' : 'Guardar cambios'}
        busy={saveOrder.isPending}
        onSubmit={submit}
      />

      {confirming && (
        <ConfirmOrderDialog
          title={isCreate ? '¿Publicar este domicilio?' : '¿Guardar los cambios?'}
          confirmLabel={isCreate ? 'Sí, publicar' : 'Sí, guardar'}
          busyLabel={isCreate ? 'Publicando…' : 'Guardando…'}
          values={values}
          address={confirmAddress}
          changeDue={changeDue}
          busy={saveOrder.isPending}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        />
      )}

      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title={isCreate ? '¿Salir sin publicar?' : '¿Salir sin guardar?'}
          confirmLabel="Sí, salir"
          cancelLabel="Seguir aquí"
          tone="danger"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        >
          {isCreate && draftKey ? (
            <p>El domicilio queda guardado en este equipo y lo puede terminar después.</p>
          ) : (
            <p>Los cambios que hizo no se van a guardar.</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
