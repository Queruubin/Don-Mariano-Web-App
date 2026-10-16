import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionStatus } from './connectionStore';
import { CloseCode } from './protocol';
import {
  BACKOFF_MAX_MS,
  backoffDelay,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  RealtimeClient,
  type RealtimeClientOptions,
} from './RealtimeClient';
import { createMockSocket, MockSocket } from './test/mockSocket';

const URL = 'ws://localhost:8000/ws/branch/';

function setup(overrides: Partial<RealtimeClientOptions> = {}) {
  const statuses: ConnectionStatus[] = [];
  const options = {
    url: URL,
    branchId: 7,
    getToken: vi.fn(async () => 'access-1' as string | null),
    refreshToken: vi.fn(async () => 'access-2' as string | null),
    onEvent: vi.fn(),
    onStatus: vi.fn((status: ConnectionStatus) => statuses.push(status)),
    onLive: vi.fn(),
    createSocket: createMockSocket,
    // No jitter: every delay is half of the exponential ceiling.
    random: () => 0,
    ...overrides,
  };
  const client = new RealtimeClient(options);
  return { client, options, statuses, lastStatus: () => statuses.at(-1) };
}

/** Let pending promises (token lookups) settle and run timers due within `ms`. */
async function advance(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}

const ORDER_EVENT = {
  type: 'order.created',
  event_id: 'e1',
  sent_at: '2026-10-15T10:00:00-05:00',
  actor_id: 4,
  branch_id: 7,
  order: { id: 1 },
};

beforeEach(() => {
  vi.useFakeTimers();
  MockSocket.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('backoffDelay', () => {
  it('doubles from one second, with jitter, up to 30 seconds', () => {
    expect([0, 1, 2, 3].map((attempt) => backoffDelay(attempt, () => 0))).toEqual([500, 1000, 2000, 4000]);
    expect([0, 1, 2, 3].map((attempt) => backoffDelay(attempt, () => 1))).toEqual([1000, 2000, 4000, 8000]);
    expect(backoffDelay(20, () => 1)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(20, () => 0)).toBe(BACKOFF_MAX_MS / 2);
  });
});

describe('RealtimeClient handshake', () => {
  it('authenticates with a message, never with the token in the URL', async () => {
    const { client, options, lastStatus } = setup();
    client.start();
    await advance();

    const socket = MockSocket.last();
    expect(socket.url).toBe(URL);
    expect(lastStatus()).toBe('connecting');

    socket.open();
    expect(socket.sent).toEqual([{ type: 'auth', token: 'access-1', branch_id: 7 }]);

    socket.receive({ type: 'auth.ok', branch_id: 7, user_id: 3 });
    expect(lastStatus()).toBe('live');
    expect(options.onLive).toHaveBeenCalledTimes(1);
    client.stop();
  });

  it('forwards order events and ignores anything else', async () => {
    const { client, options } = setup();
    client.start();
    await advance();
    const socket = MockSocket.last();
    socket.accept(7);

    socket.receive(ORDER_EVENT);
    socket.receive({ type: 'something.else' });
    socket.onmessage?.(new MessageEvent('message', { data: '{not json' }));

    expect(options.onEvent).toHaveBeenCalledTimes(1);
    expect(options.onEvent).toHaveBeenCalledWith(ORDER_EVENT);
    client.stop();
  });

  it('waits and retries when there is no token to send', async () => {
    const getToken = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null).mockResolvedValue('access-1');
    const { client } = setup({ getToken });
    client.start();
    await advance();
    expect(MockSocket.instances).toHaveLength(0);

    await advance(500);
    expect(MockSocket.instances).toHaveLength(1);
    client.stop();
  });
});

describe('RealtimeClient reconnection', () => {
  it('backs off exponentially and says "offline" after repeated failures', async () => {
    const { client, lastStatus } = setup();
    client.start();
    await advance();

    const delays = [500, 1000, 2000, 4000];
    for (const [index, delay] of delays.entries()) {
      MockSocket.last().serverClose(1006);
      expect(lastStatus()).toBe(index + 1 >= 3 ? 'offline' : 'connecting');
      await advance(delay - 1);
      expect(MockSocket.instances).toHaveLength(index + 1);
      await advance(1);
      expect(MockSocket.instances).toHaveLength(index + 2);
    }
    client.stop();
  });

  it('starts the backoff over after a successful connection', async () => {
    const { client } = setup();
    client.start();
    await advance();
    MockSocket.last().serverClose(1006);
    await advance(500);
    MockSocket.last().serverClose(1006);
    await advance(1000);

    MockSocket.last().accept(7);
    MockSocket.last().serverClose(1006);
    await advance(500);
    expect(MockSocket.instances).toHaveLength(4);
    client.stop();
  });

  it('refreshes the token once after an auth failure, then backs off', async () => {
    const { client, options } = setup();
    client.start();
    await advance();
    MockSocket.last().open();
    MockSocket.last().serverClose(CloseCode.AUTH_FAILED);
    await advance();

    expect(options.refreshToken).toHaveBeenCalledTimes(1);
    expect(MockSocket.instances).toHaveLength(2);

    MockSocket.last().open();
    MockSocket.last().serverClose(CloseCode.AUTH_FAILED);
    await advance();
    expect(options.refreshToken).toHaveBeenCalledTimes(1);
    expect(MockSocket.instances).toHaveLength(2);
    await advance(500);
    expect(MockSocket.instances).toHaveLength(3);
    client.stop();
  });

  it('refreshes and reconnects right away when the token expires', async () => {
    const { client, options, lastStatus } = setup();
    client.start();
    await advance();
    MockSocket.last().accept(7);

    MockSocket.last().serverClose(CloseCode.AUTH_EXPIRED);
    expect(lastStatus()).toBe('connecting');
    await advance();

    expect(options.refreshToken).toHaveBeenCalledTimes(1);
    expect(MockSocket.instances).toHaveLength(2);
    client.stop();
  });

  it('does not retry when the branch is forbidden', async () => {
    const { client, lastStatus } = setup();
    client.start();
    await advance();
    MockSocket.last().open();
    MockSocket.last().serverClose(CloseCode.FORBIDDEN);

    await advance(60_000);
    expect(MockSocket.instances).toHaveLength(1);
    expect(lastStatus()).toBe('offline');
    client.stop();
  });

  it('reconnects at once when the network comes back', async () => {
    const { client } = setup();
    client.start();
    await advance();
    MockSocket.last().serverClose(1006);

    window.dispatchEvent(new Event('online'));
    await advance();
    expect(MockSocket.instances).toHaveLength(2);
    client.stop();
  });

  it('reconnects at once when the tab becomes visible again', async () => {
    const { client } = setup();
    client.start();
    await advance();
    MockSocket.last().serverClose(1006);

    document.dispatchEvent(new Event('visibilitychange'));
    await advance();
    expect(MockSocket.instances).toHaveLength(2);
    client.stop();
  });
});

describe('RealtimeClient heartbeat', () => {
  it('pings while live and reconnects when no pong arrives', async () => {
    const { client, lastStatus } = setup();
    client.start();
    await advance();
    const socket = MockSocket.last();
    socket.accept(7);

    await advance(PING_INTERVAL_MS);
    expect(socket.sent.at(-1)).toEqual({ type: 'ping' });
    socket.receive({ type: 'pong' });

    await advance(PING_INTERVAL_MS);
    expect(socket.sent.filter((message) => message.type === 'ping')).toHaveLength(2);
    await advance(PONG_TIMEOUT_MS);

    expect(socket.closedWith).toBe(CloseCode.NORMAL);
    expect(lastStatus()).toBe('connecting');
    await advance(500);
    expect(MockSocket.instances).toHaveLength(2);
    client.stop();
  });
});

describe('RealtimeClient stop', () => {
  it('closes the socket, stops retrying and reports offline', async () => {
    const { client, lastStatus } = setup();
    client.start();
    await advance();
    const socket = MockSocket.last();
    socket.accept(7);

    client.stop();
    expect(socket.closedWith).toBe(CloseCode.NORMAL);
    expect(lastStatus()).toBe('offline');

    socket.serverClose(1006);
    await advance(60_000);
    expect(MockSocket.instances).toHaveLength(1);
  });

  it('ignores a token that arrives after stopping', async () => {
    let resolveToken!: (token: string) => void;
    const getToken = vi.fn(() => new Promise<string | null>((resolve) => (resolveToken = resolve)));
    const { client } = setup({ getToken });
    client.start();
    client.stop();
    resolveToken('access-1');
    await advance();
    expect(MockSocket.instances).toHaveLength(0);
  });
});
