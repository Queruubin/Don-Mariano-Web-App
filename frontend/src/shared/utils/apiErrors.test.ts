import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { apiErrorMessage, isNotFoundError, parseApiError } from './apiErrors';

function apiError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } } as AxiosResponse;
  return new AxiosError('Request failed', String(status), undefined, undefined, response);
}

describe('api error messages', () => {
  it('never shows the raw English 404 detail from the server', () => {
    const error = apiError(404, { detail: 'No Order matches the given query.' });
    expect(apiErrorMessage(error)).toBe('No encontramos lo que busca. Puede que ya no exista.');
    expect(isNotFoundError(error)).toBe(true);
  });

  it('keeps Spanish business messages from other client errors', () => {
    const error = apiError(409, { detail: 'Este domicilio ya cambió de estado.', code: 'stale_status' });
    expect(apiErrorMessage(error)).toBe('Este domicilio ya cambió de estado.');
    expect(isNotFoundError(error)).toBe(false);
  });

  it('keeps field messages on validation errors', () => {
    expect(parseApiError(apiError(400, { name: ['Ya existe.'] }))).toEqual({ fields: { name: 'Ya existe.' }, message: null });
  });
});
