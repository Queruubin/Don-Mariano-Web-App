import { API_BASE_URL } from '../shared/utils/api';

export const WS_PATH = '/ws/branch/';

/**
 * Socket URL: `VITE_WS_URL` when set, otherwise the API host with ws:// or wss://
 * (http://localhost:8000 -> ws://localhost:8000/ws/branch/).
 */
export function websocketUrl(
  configured: string | undefined = import.meta.env.VITE_WS_URL,
  apiBase: string = API_BASE_URL,
  pageUrl: string = window.location.href,
): string {
  if (configured) return configured;
  const url = new URL(WS_PATH, new URL(apiBase, pageUrl));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
