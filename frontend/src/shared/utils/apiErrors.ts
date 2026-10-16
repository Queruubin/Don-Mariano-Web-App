import { isAxiosError } from 'axios';

export interface ApiErrors {
  /** First message per field, e.g. `{ name: 'Ya existe un producto…' }`. */
  fields: Record<string, string>;
  /** A general message to show above the form, if any. */
  message: string | null;
}

const NETWORK_MESSAGE = 'No hay conexión con el servidor. Revise el internet e intente de nuevo.';
const SERVER_MESSAGE = 'Algo salió mal en el servidor. Intente de nuevo en un momento.';
const FORBIDDEN_MESSAGE = 'No tiene permiso para hacer esto.';
const NOT_FOUND_MESSAGE = 'No encontramos lo que busca. Puede que ya no exista.';
const GENERIC_MESSAGE = 'No pudimos completar la acción. Intente de nuevo.';

function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

/** Turn a DRF error response into friendly, displayable Spanish messages. */
export function parseApiError(error: unknown): ApiErrors {
  if (!isAxiosError(error)) return { fields: {}, message: GENERIC_MESSAGE };
  if (!error.response) return { fields: {}, message: NETWORK_MESSAGE };

  const { status, data } = error.response;
  if (status >= 500) return { fields: {}, message: SERVER_MESSAGE };
  // DRF 404 details are generic English text ("No Order matches the given query.").
  if (status === 404) return { fields: {}, message: NOT_FOUND_MESSAGE };

  const fields: Record<string, string> = {};
  let message: string | null = null;
  if (data && typeof data === 'object' && !(data instanceof Blob)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === 'code') continue;
      const text = firstMessage(value);
      if (!text) continue;
      if (key === 'detail' || key === 'non_field_errors') message = text;
      else fields[key] = text;
    }
  }
  if (status === 403 && !message) message = FORBIDDEN_MESSAGE;
  if (!message && Object.keys(fields).length === 0) message = GENERIC_MESSAGE;
  return { fields, message };
}

/** True when the server answered 404: the record does not exist (or is not visible here). */
export function isNotFoundError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}

/** A single message for places that cannot show field errors. */
export function apiErrorMessage(error: unknown): string {
  const { fields, message } = parseApiError(error);
  return message ?? Object.values(fields)[0] ?? GENERIC_MESSAGE;
}
