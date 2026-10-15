/**
 * Order form state (PRD 4.5): a pure reducer plus validation and API mapping.
 * Components dispatch actions; nothing here touches React or the network.
 */
import type { Product, Unit } from '../../catalog/types/catalog.types';
import type { Customer } from '../../customers/types/customer.types';
import type { Order, OrderInput, PaymentMethod } from '../types/order.types';
import { changeDue, moneyToNumber, parseMoneyInput } from './money';
import {
  defaultQuantity,
  formatQuantity,
  parseQuantity,
  quantityForApi,
  quantityForUnitChange,
} from './quantity';

export interface CartLine {
  /** Client-only id, stable across renders and drafts. */
  key: string;
  /** Null for a free-text product (FR-18). */
  productId: number | null;
  name: string;
  /** What the user typed, e.g. "1,5". */
  quantity: string;
  unit: Unit;
  notes: string;
}

/** A saved address id, or a new address typed by hand. */
export type AddressChoice = number | 'new';

export interface OrderFormValues {
  phone: string;
  name: string;
  addressChoice: AddressChoice;
  newAddress: string;
  addressNotes: string;
  /** Chronological: the newest line is last. */
  lines: CartLine[];
  paymentMethod: PaymentMethod | null;
  /** Whole pesos as a digits string. */
  total: string;
  paysWith: string;
  notes: string;
}

export interface OrderFormState {
  values: OrderFormValues;
  /** The customer whose data was filled in automatically, if any. */
  foundCustomer: { id: number; name: string; addressIds: number[] } | null;
  /** True once the user changed something (autofill does not count). */
  touched: boolean;
}

export const EMPTY_ORDER_FORM: OrderFormValues = {
  phone: '',
  name: '',
  addressChoice: 'new',
  newAddress: '',
  addressNotes: '',
  lines: [],
  paymentMethod: null,
  total: '',
  paysWith: '',
  notes: '',
};

export function initialOrderFormState(values: OrderFormValues = EMPTY_ORDER_FORM): OrderFormState {
  return { values, foundCustomer: null, touched: false };
}

let lineCounter = 0;
export function newLineKey(): string {
  lineCounter += 1;
  return `line-${Date.now().toString(36)}-${lineCounter}`;
}

export function lineFromProduct(product: Product): CartLine {
  return {
    key: newLineKey(),
    productId: product.id,
    name: product.name,
    quantity: defaultQuantity(product.default_unit),
    unit: product.default_unit,
    notes: '',
  };
}

export function freeTextLine(name: string): CartLine {
  return {
    key: newLineKey(),
    productId: null,
    name: cleanText(name),
    quantity: defaultQuantity('unidad'),
    unit: 'unidad',
    notes: '',
  };
}

// --- Reducer -----------------------------------------------------------------

type EditableField = 'phone' | 'name' | 'newAddress' | 'addressNotes' | 'notes';

export type OrderFormAction =
  | { type: 'setField'; field: EditableField; value: string }
  | { type: 'chooseAddress'; choice: AddressChoice; notes?: string }
  | { type: 'customerFound'; customer: Customer }
  | { type: 'customerNotFound' }
  | { type: 'addLine'; line: CartLine }
  | { type: 'updateLine'; key: string; changes: Partial<Pick<CartLine, 'quantity' | 'notes'>> }
  | { type: 'changeUnit'; key: string; unit: Unit }
  | { type: 'removeLine'; key: string }
  | { type: 'setPaymentMethod'; method: PaymentMethod }
  | { type: 'setTotal'; raw: string }
  | { type: 'setPaysWith'; raw: string }
  | { type: 'reset'; values?: OrderFormValues; touched?: boolean };

function normalizeAddress(value: string): string {
  return cleanText(value).toLowerCase();
}

function withValues(state: OrderFormState, values: Partial<OrderFormValues>): OrderFormState {
  return { ...state, values: { ...state.values, ...values }, touched: true };
}

function mapLine(state: OrderFormState, key: string, update: (line: CartLine) => CartLine): OrderFormState {
  return withValues(state, {
    lines: state.values.lines.map((line) => (line.key === key ? update(line) : line)),
  });
}

/** Autofill from a phone lookup (FR-13) without overwriting what the user typed. */
function applyFoundCustomer(state: OrderFormState, customer: Customer): OrderFormState {
  const { values, foundCustomer } = state;
  const next: OrderFormValues = { ...values };
  const nameWasAutofilled = foundCustomer != null && values.name === foundCustomer.name;
  if (!values.name.trim() || nameWasAutofilled) next.name = customer.name;

  const ids = customer.addresses.map((address) => address.id);
  const choiceIsForeign = values.addressChoice !== 'new' && !ids.includes(values.addressChoice);
  if (values.addressChoice === 'new' || choiceIsForeign) {
    const typed = normalizeAddress(values.newAddress);
    const match = typed
      ? customer.addresses.find((address) => normalizeAddress(address.address) === typed)
      : customer.addresses[0];
    if (match) {
      next.addressChoice = match.id;
      if (!values.addressNotes.trim() || choiceIsForeign) next.addressNotes = match.notes;
      if (match.address === values.newAddress || !typed) next.newAddress = '';
    } else if (choiceIsForeign) {
      next.addressChoice = 'new';
    }
  }
  return {
    ...state,
    values: next,
    foundCustomer: { id: customer.id, name: customer.name, addressIds: ids },
  };
}

function applyCustomerNotFound(state: OrderFormState): OrderFormState {
  const { values, foundCustomer } = state;
  if (!foundCustomer) return state;
  // The phone changed to an unknown customer: drop what belonged to the previous one.
  const next: OrderFormValues = { ...values };
  if (values.name === foundCustomer.name) next.name = '';
  if (values.addressChoice !== 'new') {
    next.addressChoice = 'new';
    next.addressNotes = '';
  }
  return { ...state, values: next, foundCustomer: null };
}

export function orderFormReducer(state: OrderFormState, action: OrderFormAction): OrderFormState {
  switch (action.type) {
    case 'setField':
      return withValues(state, { [action.field]: action.value });
    case 'chooseAddress':
      return withValues(state, {
        addressChoice: action.choice,
        ...(action.notes !== undefined ? { addressNotes: action.notes } : {}),
      });
    case 'customerFound':
      return applyFoundCustomer(state, action.customer);
    case 'customerNotFound':
      return applyCustomerNotFound(state);
    case 'addLine':
      return withValues(state, { lines: [...state.values.lines, action.line] });
    case 'updateLine':
      return mapLine(state, action.key, (line) => ({ ...line, ...action.changes }));
    case 'changeUnit':
      return mapLine(state, action.key, (line) => ({
        ...line,
        unit: action.unit,
        quantity: quantityForUnitChange(line.quantity, line.unit, action.unit),
      }));
    case 'removeLine':
      return withValues(state, { lines: state.values.lines.filter((line) => line.key !== action.key) });
    case 'setPaymentMethod':
      return withValues(state, { paymentMethod: action.method });
    case 'setTotal':
      return withValues(state, { total: parseMoneyInput(action.raw) });
    case 'setPaysWith':
      return withValues(state, { paysWith: parseMoneyInput(action.raw) });
    case 'reset':
      return { values: action.values ?? EMPTY_ORDER_FORM, foundCustomer: null, touched: action.touched ?? false };
  }
}

// --- Derived values ----------------------------------------------------------

export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Same rule as the backend: "+57 300 123 4567" is "3001234567".
  for (const prefix of ['0057', '57']) {
    if (digits.startsWith(prefix) && digits.length === prefix.length + 10) return digits.slice(prefix.length);
  }
  return digits;
}

export const MIN_PHONE_DIGITS = 7;

export function isFormEmpty(values: OrderFormValues): boolean {
  return (
    !values.phone.trim() &&
    !values.name.trim() &&
    !values.newAddress.trim() &&
    !values.addressNotes.trim() &&
    values.lines.length === 0 &&
    values.paymentMethod == null &&
    !values.total &&
    !values.paysWith &&
    !values.notes.trim()
  );
}

export function productsLabel(count: number): string {
  return count === 1 ? '1 producto' : `${count} productos`;
}

/** `paysWith` only counts for cash (FR-22). */
export function effectivePaysWith(values: OrderFormValues): string {
  return values.paymentMethod === 'cash' ? values.paysWith : '';
}

export function orderChangeDue(values: OrderFormValues): number | null {
  return changeDue(values.total, effectivePaysWith(values));
}

// --- Validation --------------------------------------------------------------

/** Error keys. Line errors use `line:<key>`. */
export type OrderFormErrors = Record<string, string>;

export const lineErrorKey = (key: string) => `line:${key}`;

export const MESSAGES = {
  phoneRequired: 'Escriba el teléfono del cliente.',
  phoneShort: `El teléfono debe tener al menos ${MIN_PHONE_DIGITS} números.`,
  name: 'Escriba el nombre del cliente.',
  address: 'Escriba la dirección de entrega.',
  lines: 'Agregue al menos un producto.',
  quantity: 'Escriba una cantidad mayor que cero.',
  paymentMethod: 'Elija cómo va a pagar el cliente.',
  total: 'Escriba el total del domicilio.',
  paysWith: 'Debe ser igual o mayor que el total.',
} as const;

/** Friendly checks before calling the API (FR-24). The backend still validates everything. */
export function validateOrderForm(values: OrderFormValues): OrderFormErrors {
  const errors: OrderFormErrors = {};
  const digits = phoneDigits(values.phone);
  if (!digits) errors.phone = MESSAGES.phoneRequired;
  else if (digits.length < MIN_PHONE_DIGITS) errors.phone = MESSAGES.phoneShort;
  if (!cleanText(values.name)) errors.name = MESSAGES.name;
  if (values.addressChoice === 'new' && !cleanText(values.newAddress)) errors.address = MESSAGES.address;

  if (values.lines.length === 0) errors.lines = MESSAGES.lines;
  for (const line of values.lines) {
    if (parseQuantity(line.quantity) == null) errors[lineErrorKey(line.key)] = MESSAGES.quantity;
  }

  if (!values.paymentMethod) errors.paymentMethod = MESSAGES.paymentMethod;
  const total = moneyToNumber(values.total);
  if (!total) errors.total = MESSAGES.total;
  const paysWith = moneyToNumber(effectivePaysWith(values));
  if (total && paysWith != null && paysWith < total) errors.paysWith = MESSAGES.paysWith;
  return errors;
}

/** Top-to-bottom order of the fields, to scroll to the first error. */
export function firstErrorKey(errors: OrderFormErrors, values: OrderFormValues): string | null {
  const order = [
    'phone',
    'name',
    'address',
    'addressNotes',
    'lines',
    ...values.lines.map((line) => lineErrorKey(line.key)),
    'paymentMethod',
    'total',
    'paysWith',
    'notes',
  ];
  return order.find((key) => errors[key]) ?? Object.keys(errors)[0] ?? null;
}

// --- API mapping -------------------------------------------------------------

export function toOrderInput(values: OrderFormValues): OrderInput {
  const customer: OrderInput['customer'] = {
    phone: phoneDigits(values.phone),
    name: cleanText(values.name),
    address_notes: cleanText(values.addressNotes),
  };
  if (values.addressChoice === 'new') customer.address = cleanText(values.newAddress);
  else customer.address_id = values.addressChoice;

  const paysWith = effectivePaysWith(values);
  return {
    customer,
    items: values.lines.map((line) => ({
      ...(line.productId != null ? { product: line.productId } : { name: cleanText(line.name) }),
      quantity: quantityForApi(line.quantity),
      unit: line.unit,
      notes: cleanText(line.notes),
    })),
    payment_method: values.paymentMethod ?? 'cash',
    total_amount: values.total,
    pays_with: paysWith || null,
    notes: values.notes.trim(),
  };
}

/** Form values to edit an existing order (FR-29). */
export function valuesFromOrder(order: Order): OrderFormValues {
  return {
    phone: order.customer.phone,
    name: order.customer.name,
    addressChoice: 'new',
    newAddress: order.address_snapshot,
    addressNotes: order.address_notes,
    lines: order.items.map((item) => ({
      key: newLineKey(),
      productId: item.product,
      name: item.name,
      quantity: formatQuantity(Number(item.quantity)),
      unit: item.unit,
      notes: item.notes,
    })),
    paymentMethod: order.payment_method,
    total: parseMoneyInput(order.total_amount.split('.')[0]),
    paysWith: order.pays_with ? parseMoneyInput(order.pays_with.split('.')[0]) : '',
    notes: order.notes,
  };
}

const SERVER_FIELD_KEYS: Record<string, string> = {
  phone: 'phone',
  name: 'name',
  address: 'address',
  address_id: 'address',
  address_notes: 'addressNotes',
  payment_method: 'paymentMethod',
  total_amount: 'total',
  pays_with: 'paysWith',
  notes: 'notes',
  items: 'lines',
};

function firstText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = firstText(entry);
      if (text) return text;
    }
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      const text = firstText(entry);
      if (text) return text;
    }
  }
  return null;
}

/**
 * Per-line errors as [index, errors]. DRF sends `{"0": {...}}` for a ListField
 * and `[{...}, {}]` for a list serializer; a plain message list has no entries.
 */
function itemErrorEntries(value: unknown): [number, object][] {
  if (!value || typeof value !== 'object') return [];
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  return entries
    .filter(([index, errors]) => /^\d+$/.test(index) && errors && typeof errors === 'object')
    .filter(([, errors]) => Object.keys(errors as object).length > 0)
    .map(([index, errors]) => [Number(index), errors as object]);
}

/**
 * Map a DRF error body to form error keys. Nested customer errors and
 * per-line item errors land next to the right field.
 */
export function mapServerErrors(
  data: unknown,
  lines: CartLine[],
): { fields: OrderFormErrors; message: string | null } {
  const fields: OrderFormErrors = {};
  let message: string | null = null;
  if (!data || typeof data !== 'object') return { fields, message };

  const assign = (key: string, value: unknown) => {
    const text = firstText(value);
    if (text && !fields[key]) fields[key] = text;
  };

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key === 'code') continue;
    if (key === 'detail' || key === 'non_field_errors') {
      message = firstText(value);
    } else if (key === 'customer' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        assign(SERVER_FIELD_KEYS[inner] ?? inner, innerValue);
      }
    } else if (key === 'items' && itemErrorEntries(value).length) {
      for (const [index, itemErrors] of itemErrorEntries(value)) {
        const line = lines[index];
        assign(line ? lineErrorKey(line.key) : 'lines', itemErrors);
      }
    } else {
      assign(SERVER_FIELD_KEYS[key] ?? key, value);
    }
  }
  return { fields, message };
}

/** Error keys a user action may fix, so stale server messages disappear while editing. */
export function affectedErrorKeys(action: OrderFormAction): string[] {
  switch (action.type) {
    case 'setField':
      return [action.field === 'newAddress' ? 'address' : action.field];
    case 'chooseAddress':
      return ['address', 'addressNotes'];
    case 'addLine':
    case 'removeLine':
      return ['lines'];
    case 'updateLine':
    case 'changeUnit':
      return [lineErrorKey(action.key), 'lines'];
    case 'setPaymentMethod':
      return ['paymentMethod', 'paysWith'];
    case 'setTotal':
      return ['total', 'paysWith'];
    case 'setPaysWith':
      return ['paysWith'];
    default:
      return [];
  }
}

/** DOM id of the input that shows each error, to scroll to and focus it. */
export function fieldIdForError(key: string): string {
  if (key.startsWith('line:')) return `order-${key.replace(':', '-')}-quantity`;
  const ids: Record<string, string> = {
    phone: 'order-phone',
    name: 'order-name',
    address: 'order-address',
    addressNotes: 'order-address-notes',
    lines: 'order-product-search',
    paymentMethod: 'order-payment',
    total: 'order-total',
    paysWith: 'order-pays-with',
    notes: 'order-notes',
  };
  return ids[key] ?? 'order-form-message';
}
