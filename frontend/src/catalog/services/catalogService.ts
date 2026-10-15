import api from '../../shared/utils/api';
import type { Paginated } from '../../shared/types';
import type { ImportPreview, ImportResult, Product, ProductFilters, ProductInput } from '../types/catalog.types';

const BASE = '/api/products/';

function fileForm(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export const catalogService = {
  async list(filters: ProductFilters, page: number): Promise<Paginated<Product>> {
    const params: Record<string, string | number> = { page };
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.category) params.category = filters.category;
    if (filters.includeInactive) params.include_inactive = 'true';
    const { data } = await api.get<Paginated<Product>>(BASE, { params });
    return data;
  },

  /** Top active matches for the order cart, best first. */
  async autocomplete(query: string, limit = 8): Promise<Product[]> {
    const { data } = await api.get<Product[]>(`${BASE}autocomplete/`, { params: { q: query, limit } });
    return data;
  },

  async categories(): Promise<string[]> {
    const { data } = await api.get<string[]>(`${BASE}categories/`);
    return data;
  },

  async create(input: ProductInput): Promise<Product> {
    const { data } = await api.post<Product>(BASE, input);
    return data;
  },

  async update(id: number, input: ProductInput): Promise<Product> {
    const { data } = await api.patch<Product>(`${BASE}${id}/`, input);
    return data;
  },

  async deactivate(id: number): Promise<void> {
    await api.delete(`${BASE}${id}/`);
  },

  async activate(id: number): Promise<Product> {
    const { data } = await api.post<Product>(`${BASE}${id}/activate/`);
    return data;
  },

  async downloadTemplate(): Promise<Blob> {
    const { data } = await api.get<Blob>(`${BASE}import-template/`, { responseType: 'blob' });
    return data;
  },

  async previewImport(file: File): Promise<ImportPreview> {
    const { data } = await api.post<ImportPreview>(`${BASE}import/preview/`, fileForm(file));
    return data;
  },

  async applyImport(file: File): Promise<ImportResult> {
    const { data } = await api.post<ImportResult>(`${BASE}import/apply/`, fileForm(file));
    return data;
  },
};
