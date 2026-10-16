import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../auth/store/authStore';
import { useBranchStore } from '../../branches/store/branchStore';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const baseURL = API_BASE_URL;

const api = axios.create({ baseURL });

let refreshing: Promise<string> | null = null;

/**
 * Trade the refresh token for a new access token and store both. Concurrent
 * callers (an HTTP retry and the real-time socket) share one request.
 * Rejects when there is no refresh token or the server refuses it.
 */
export function refreshAccessToken(): Promise<string> {
  if (refreshing) return refreshing;
  const tokens = useAuthStore.getState().tokens;
  if (!tokens?.refresh) return Promise.reject(new Error('No refresh token'));
  // A bare axios call, so a failing refresh does not loop through the interceptor below.
  refreshing = axios
    .post<{ access: string; refresh?: string }>(`${baseURL}/api/auth/refresh/`, { refresh: tokens.refresh })
    .then(({ data }) => {
      useAuthStore.getState().setTokens({ access: data.access, refresh: data.refresh ?? tokens.refresh });
      return data.access;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

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
        const access = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  },
);

export default api;
