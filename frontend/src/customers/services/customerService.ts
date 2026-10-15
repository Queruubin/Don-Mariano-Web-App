import { isAxiosError } from 'axios';
import api from '../../shared/utils/api';
import type { Customer } from '../types/customer.types';

export const customerService = {
  /** The branch customer with this phone, or null when there is none (FR-13). */
  async lookup(phone: string): Promise<Customer | null> {
    try {
      const { data } = await api.get<Customer>('/api/customers/lookup/', { params: { phone } });
      return data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
};
