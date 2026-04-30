import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// WebSocket mock — jsdom does not provide a native WebSocket implementation.
// The Dashboard component uses useWXATASocket which creates a WebSocket.
// We provide a minimal mock so Dashboard tests don't throw.
// The mock stays in CONNECTING state indefinitely to avoid reconnect loops.
// ---------------------------------------------------------------------------
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(_url: string) {
    // Stay in CONNECTING state — do not fire onclose to avoid reconnect loops
  }

  send(_data: string) {}
  close() {
    this.readyState = MockWebSocket.CLOSED;
    // Do NOT call onclose here to avoid triggering reconnect logic
  }
}

// @ts-expect-error — assigning mock to global
global.WebSocket = MockWebSocket;
