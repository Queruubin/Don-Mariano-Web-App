import { CircleCheck, House, LoaderCircle, MapPinPlus, UserPlus, UserRound } from 'lucide-react';
import type { Customer } from '../../../customers/types/customer.types';
import type { AddressChoice, OrderFormErrors, OrderFormValues } from '../../form/orderForm';
import { FieldError } from './FieldError';
import { SectionCard } from './SectionCard';

export interface LookupState {
  isSearching: boolean;
  isDone: boolean;
  isError: boolean;
  customer: Customer | null;
}

type CustomerField = 'phone' | 'name' | 'newAddress' | 'addressNotes';

interface CustomerSectionProps {
  values: Pick<OrderFormValues, 'phone' | 'name' | 'addressChoice' | 'newAddress' | 'addressNotes'>;
  errors: OrderFormErrors;
  lookup: LookupState;
  onChange: (field: CustomerField, value: string) => void;
  onChooseAddress: (choice: AddressChoice, notes?: string) => void;
}

function LookupStatus({ lookup }: { lookup: LookupState }) {
  if (lookup.isSearching) {
    return (
      <p className="mt-2 flex items-center gap-2 text-text-muted">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin desk:size-4" />
        Buscando cliente…
      </p>
    );
  }
  if (lookup.isError) {
    return <p className="mt-2 text-text-muted">No pudimos buscar el cliente. Escriba sus datos.</p>;
  }
  if (!lookup.isDone) return null;
  if (lookup.customer) {
    return (
      <p className="mt-2 flex items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 font-bold text-primary-hover desk:rounded-xl desk:py-1.5 desk:text-sm">
        <CircleCheck aria-hidden="true" className="size-6 shrink-0 desk:size-5" />
        Cliente encontrado
      </p>
    );
  }
  return (
    <p className="mt-2 flex items-center gap-2 rounded-2xl bg-accent-soft px-3 py-2 font-semibold desk:rounded-xl desk:py-1.5 desk:text-sm">
      <UserPlus aria-hidden="true" className="size-6 shrink-0 desk:size-5" />
      Cliente nuevo: escriba su nombre y dirección.
    </p>
  );
}

function AddressCard({
  checked,
  onSelect,
  icon: Icon,
  title,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: typeof House;
  title: string;
  detail?: string;
}) {
  return (
    <label
      className={`flex min-h-14 items-start gap-3 rounded-2xl border-2 p-3 desk:min-h-10 desk:gap-2.5 desk:rounded-xl desk:px-3 desk:py-2 ${checked ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-alt'}`}
    >
      <input type="radio" name="order-address-choice" className="mt-1 size-6 shrink-0 accent-primary desk:mt-0.5 desk:size-5" checked={checked} onChange={onSelect} />
      <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-text-muted desk:size-5" />
      <span className="min-w-0 break-words">
        <span className="block font-bold">{title}</span>
        {detail && <span className="block text-text-muted">{detail}</span>}
      </span>
    </label>
  );
}

/** Customer block (FR-13, FR-14): phone first, then name and address. */
export function CustomerSection({ values, errors, lookup, onChange, onChooseAddress }: CustomerSectionProps) {
  const addresses = lookup.customer?.addresses ?? [];
  const showNewAddress = values.addressChoice === 'new';

  return (
    <SectionCard title="Cliente" icon={UserRound} className="lg:col-start-2 lg:row-start-1">
      <div className="space-y-4 desk:space-y-3">
        <div>
          <label htmlFor="order-phone" className="field-label">
            Teléfono
          </label>
          <input
            id="order-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="Ej: 300 123 4567"
            className="input text-xl tabular-nums desk:text-lg"
            value={values.phone}
            onChange={(event) => onChange('phone', event.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? 'order-phone-error' : undefined}
          />
          <FieldError id="order-phone-error" message={errors.phone} />
          <div aria-live="polite">
            <LookupStatus lookup={lookup} />
          </div>
        </div>

        <div>
          <label htmlFor="order-name" className="field-label">
            Nombre
          </label>
          <input
            id="order-name"
            type="text"
            autoComplete="off"
            className="input"
            value={values.name}
            onChange={(event) => onChange('name', event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'order-name-error' : undefined}
          />
          <FieldError id="order-name-error" message={errors.name} />
        </div>

        {addresses.length > 0 && (
          <fieldset id="order-address-group" tabIndex={-1}>
            <legend className="field-label">Dirección de entrega</legend>
            <div className="space-y-2">
              {addresses.map((address, index) => (
                <AddressCard
                  key={address.id}
                  checked={values.addressChoice === address.id}
                  onSelect={() => onChooseAddress(address.id, address.notes)}
                  icon={House}
                  title={address.address}
                  detail={index === 0 ? 'La más reciente' : undefined}
                />
              ))}
              <AddressCard
                checked={showNewAddress}
                onSelect={() => onChooseAddress('new', '')}
                icon={MapPinPlus}
                title="Otra dirección"
              />
            </div>
            {!showNewAddress && <FieldError id="order-address-error" message={errors.address} />}
          </fieldset>
        )}

        {showNewAddress && (
          <div>
            <label htmlFor="order-address" className="field-label">
              {addresses.length > 0 ? 'Nueva dirección' : 'Dirección de entrega'}
            </label>
            <input
              id="order-address"
              type="text"
              autoComplete="off"
              placeholder="Ej: Cra 7 # 45-10"
              className="input"
              value={values.newAddress}
              onChange={(event) => onChange('newAddress', event.target.value)}
              aria-invalid={errors.address ? true : undefined}
              aria-describedby={errors.address ? 'order-address-error' : undefined}
            />
            <FieldError id="order-address-error" message={errors.address} />
          </div>
        )}

        <div>
          <label htmlFor="order-address-notes" className="field-label">
            Indicaciones de la dirección <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <input
            id="order-address-notes"
            type="text"
            autoComplete="off"
            placeholder="Ej: apto 302, timbre dañado"
            className="input"
            value={values.addressNotes}
            onChange={(event) => onChange('addressNotes', event.target.value)}
            aria-invalid={errors.addressNotes ? true : undefined}
          />
          <FieldError id="order-address-notes-error" message={errors.addressNotes} />
        </div>
      </div>
    </SectionCard>
  );
}
