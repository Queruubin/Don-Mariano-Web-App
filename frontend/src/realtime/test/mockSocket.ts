/** A scriptable stand-in for the browser WebSocket. */
export class MockSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockSocket[] = [];

  static reset(): void {
    MockSocket.instances = [];
  }

  static last(): MockSocket {
    const socket = MockSocket.instances.at(-1);
    if (!socket) throw new Error('No socket was opened');
    return socket;
  }

  readonly url: string;
  readyState: number = MockSocket.CONNECTING;
  sent: Record<string, unknown>[] = [];
  closedWith: number | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code?: number): void {
    this.readyState = MockSocket.CLOSED;
    this.closedWith = code ?? 1000;
  }

  // --- Server side -----------------------------------------------------------

  open(): void {
    this.readyState = MockSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  serverClose(code: number): void {
    this.readyState = MockSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code }));
  }

  /** Open and accept the auth message. */
  accept(branchId = 1): void {
    this.open();
    this.receive({ type: 'auth.ok', branch_id: branchId, user_id: 3 });
  }
}

export function createMockSocket(url: string): WebSocket {
  return new MockSocket(url) as unknown as WebSocket;
}
