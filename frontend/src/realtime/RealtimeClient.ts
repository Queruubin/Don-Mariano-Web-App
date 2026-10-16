import type { ConnectionStatus } from './connectionStore';
import { CloseCode, isOrderEvent, type OrderEvent } from './protocol';

export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;
/** After this many failed attempts in a row the indicator says "Sin conexión" (retries go on). */
export const OFFLINE_AFTER_FAILURES = 3;
export const PING_INTERVAL_MS = 25_000;
export const PONG_TIMEOUT_MS = 10_000;

export interface RealtimeClientOptions {
  url: string;
  /** Sent in the auth message. The server ignores it for branch users. */
  branchId: number | null;
  /** A usable access token (refreshed first if it expired), or null to retry later. */
  getToken: () => Promise<string | null>;
  /** A new access token after the server rejected ours, or null if refreshing failed. */
  refreshToken: () => Promise<string | null>;
  onEvent: (event: OrderEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** Every time the socket is authenticated, so the caller can refetch what it missed. */
  onLive?: () => void;
  createSocket?: (url: string) => WebSocket;
  random?: () => number;
}

/** Exponential backoff with "equal jitter": between half and all of min(cap, base * 2^attempt). */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * One WebSocket to `/ws/branch/` that keeps itself alive (PRD FR-30).
 *
 * Authenticates with a message (never a token in the URL), pings to detect dead
 * connections, reconnects with backoff, and reconnects right away when the
 * network or the tab comes back. Close codes decide whether and how to retry.
 */
export class RealtimeClient {
  private readonly options: RealtimeClientOptions;
  private readonly createSocket: (url: string) => WebSocket;
  private readonly random: () => number;
  private socket: WebSocket | null = null;
  private running = false;
  private live = false;
  /** Failed attempts in a row, for the backoff. */
  private failures = 0;
  /** Already refreshed the token after an auth failure; a second one waits for the backoff. */
  private refreshedAfterAuthFailure = false;
  /** Bumped on every connect/stop, so late async work of an older attempt is ignored. */
  private generation = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RealtimeClientOptions) {
    this.options = options;
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.random = options.random ?? Math.random;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    document.addEventListener('visibilitychange', this.handleVisibility);
    void this.connect();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.generation += 1;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.clearRetry();
    this.dropSocket();
    this.options.onStatus('offline');
  }

  // --- Connection ----------------------------------------------------------

  private async connect(): Promise<void> {
    this.clearRetry();
    this.dropSocket();
    const generation = ++this.generation;
    this.setWaitingStatus();

    const token = await this.options.getToken().catch(() => null);
    if (!this.running || generation !== this.generation) return;
    if (!token) {
      this.scheduleRetry();
      return;
    }

    let socket: WebSocket;
    try {
      socket = this.createSocket(this.options.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token, branch_id: this.options.branchId }));
    };
    socket.onmessage = (message: MessageEvent) => this.handleMessage(message.data);
    socket.onclose = (event: CloseEvent) => this.handleClose(event.code);
  }

  private handleMessage(raw: unknown): void {
    let message: { type?: unknown };
    try {
      message = JSON.parse(String(raw)) as { type?: unknown };
    } catch {
      return;
    }
    // Any message proves the connection is alive.
    this.clearPongTimer();
    if (message.type === 'auth.ok') {
      this.live = true;
      this.failures = 0;
      this.refreshedAfterAuthFailure = false;
      this.options.onStatus('live');
      this.startPing();
      this.options.onLive?.();
    } else if (isOrderEvent(message)) {
      this.options.onEvent(message);
    }
  }

  private handleClose(code: number): void {
    this.dropSocket();
    if (!this.running) return;

    if (code === CloseCode.FORBIDDEN) {
      // Not allowed in this branch: wait for a branch change (a new client).
      this.options.onStatus('offline');
      return;
    }
    if (code === CloseCode.AUTH_EXPIRED) {
      void this.refreshAndReconnect();
      return;
    }
    if (code === CloseCode.AUTH_FAILED && !this.refreshedAfterAuthFailure) {
      this.refreshedAfterAuthFailure = true;
      void this.refreshAndReconnect();
      return;
    }
    this.scheduleRetry();
  }

  private async refreshAndReconnect(): Promise<void> {
    const generation = this.generation;
    this.setWaitingStatus();
    const token = await this.options.refreshToken().catch(() => null);
    if (!this.running || generation !== this.generation) return;
    if (token) void this.connect();
    else this.scheduleRetry();
  }

  private scheduleRetry(): void {
    this.clearRetry();
    const delay = backoffDelay(this.failures, this.random);
    this.failures += 1;
    this.setWaitingStatus();
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  /** Not live: "Reconectando…" for the first attempts, then "Sin conexión". */
  private setWaitingStatus(): void {
    const offline = isBrowserOffline() || this.failures >= OFFLINE_AFTER_FAILURES;
    this.options.onStatus(offline ? 'offline' : 'connecting');
  }

  /** Forget the current socket without triggering its close handler. */
  private dropSocket(): void {
    this.stopPing();
    this.live = false;
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close(CloseCode.NORMAL);
    }
  }

  // --- Heartbeat -------------------------------------------------------------

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
  }

  private ping(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN || this.pongTimer) return;
    socket.send(JSON.stringify({ type: 'ping' }));
    this.pongTimer = setTimeout(() => {
      // No answer: the connection is dead even if the browser has not noticed yet.
      this.pongTimer = null;
      this.handleClose(CloseCode.IDLE_TIMEOUT);
    }, PONG_TIMEOUT_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.clearPongTimer();
  }

  private clearPongTimer(): void {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  // --- Network and tab changes ----------------------------------------------

  private readonly handleOnline = () => {
    if (this.live) return;
    this.failures = 0;
    void this.connect();
  };

  private readonly handleOffline = () => {
    if (this.live) this.ping();
    else this.options.onStatus('offline');
  };

  private readonly handleVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    if (this.live) this.ping();
    else if (this.retryTimer) void this.connect();
  };
}
