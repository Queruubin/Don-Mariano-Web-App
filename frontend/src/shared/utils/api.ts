import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../auth/store/authStore';
import { useBranchStore } from '../../branches/store/branchStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL });

export const BRANCH_HEADER = 'X-Branch-Id';

api.interceptors.request.use((config) => {
  const { tokens, user } = useAuthStore.getState();
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  // Super admins act inside the branch picked in the header selector (PRD FR-3).
  // The backend ignores this header for branch users.
  const branchId = useBranchStore.getState().selectedBranchId;
  if (user?.role === 'super_admin' && branchId != null) {
    config.headers[BRANCH_HEADER] = String(branchId);
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const tokens = useAuthStore.getState().tokens;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      tokens?.refresh &&
      !originalRequest.url?.includes('/api/auth/')
    ) {
      originalRequest._retry = true;
      try {
        // A bare axios call, so a failing refresh does not loop through this interceptor.
        const { data } = await axios.post<{ access: string; refresh?: string }>(
          `${baseURL}/api/auth/refresh/`,
          { refresh: tokens.refresh },
        );
        useAuthStore.getState().setTokens({ access: data.access, refresh: data.refresh ?? tokens.refresh });
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
