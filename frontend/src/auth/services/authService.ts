import api from '../../shared/utils/api';
import type { AuthTokens, LoginCredentials, User } from '../types/auth.types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const { data } = await api.post<AuthTokens>('/api/auth/login/', credentials);
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/api/auth/me/');
    return data;
  },
};
