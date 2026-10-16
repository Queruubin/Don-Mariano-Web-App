/** Expiry of a JWT in milliseconds since the epoch, or null when it cannot be read. */
export function tokenExpiresAt(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token is expired or expires within `marginMs` (unreadable tokens count as expired). */
export function isTokenExpired(token: string, now = Date.now(), marginMs = 30_000): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt == null || expiresAt - marginMs <= now;
}
