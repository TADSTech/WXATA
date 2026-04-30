/**
 * Tests for useWXATASocket hook
 * Tasks 14.1, 14.2
 * Requirements: 1.3, 1.9, 8.1, 8.2, 8.4, 8.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { BACKOFF_DELAYS, useWXATASocket } from '../hooks/useWXATASocket';

// ---------------------------------------------------------------------------
// Controllable WebSocket mock for unit tests
// ---------------------------------------------------------------------------

type WsEventHandler = ((event?: unknown) => void) | null;

interface MockWsInstance {
  url: string;
  readyState: number;
  onopen: WsEventHandler;
  onclose: WsEventHandler;
  onmessage: WsEventHandler;
  onerror: WsEventHandler;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  /** Simulate the server accepting the connection */
  simulateOpen(): void;
  /** Simulate an unexpected close (e.g. network drop) */
  simulateClose(code?: number): void;
}

let wsInstances: MockWsInstance[] = [];

class ControllableMockWebSocket implements MockWsInstance {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = ControllableMockWebSocket.CONNECTING;
  onopen: WsEventHandler = null;
  onclose: WsEventHandler = null;
  onmessage: WsEventHandler = null;
  onerror: WsEventHandler = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = ControllableMockWebSocket.CLOSED;
    // Do NOT fire onclose — intentional close from unmount should not reconnect
  });

  constructor(url: string) {
    this.url = url;
    wsInstances.push(this);
  }

  simulateOpen() {
    this.readyState = ControllableMockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateClose(code = 1006) {
    this.readyState = ControllableMockWebSocket.CLOSED;
    (this.onclose as ((e: { code: number; reason: string }) => void) | null)?.({
      code,
      reason: '',
    });
  }
}

// ---------------------------------------------------------------------------
// Task 14.1 — Property 4: WebSocket reconnect backoff is non-decreasing and bounded
// Feature: wxata-production-ready, Property 4: WebSocket reconnect backoff is non-decreasing and bounded
// Validates: Requirements 1.9, 8.2
// ---------------------------------------------------------------------------

/**
 * Pure helper that mirrors the delay logic in useWXATASocket:
 *   BACKOFF_DELAYS[Math.min(attempt, BACKOFF_DELAYS.length - 1)]
 */
function getDelay(attempt: number): number {
  return BACKOFF_DELAYS[Math.min(attempt, BACKOFF_DELAYS.length - 1)];
}

describe('Property 4: WebSocket reconnect backoff is non-decreasing and bounded', () => {
  it('delay(N) matches Math.min(1000 * 2^N, 30000) for N in [0..5]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        (n) => {
          const expected = Math.min(1000 * Math.pow(2, n), 30000);
          return getDelay(n) === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delay is non-decreasing: delay(N) >= delay(N-1) for all N >= 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (n) => getDelay(n) >= getDelay(n - 1)
      ),
      { numRuns: 100 }
    );
  });

  it('delay is bounded: delay(N) <= 30000 for all N in [0..20]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (n) => getDelay(n) <= 30000
      ),
      { numRuns: 100 }
    );
  });

  it('delay stays at 30000 for N > 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 20 }),
        (n) => getDelay(n) === 30000
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 14.2 — Unit tests for useWXATASocket
// Requirements: 1.3, 8.1, 8.4, 8.5
// ---------------------------------------------------------------------------

describe('useWXATASocket unit tests', () => {
  beforeEach(() => {
    wsInstances = [];
    vi.useFakeTimers();
    // @ts-expect-error — replace global WebSocket with controllable mock
    global.WebSocket = ControllableMockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Status transitions
  // -------------------------------------------------------------------------

  it("status transitions from 'connecting' to 'connected' on open", () => {
    const { result } = renderHook(() => useWXATASocket('ws://localhost:4000'));

    expect(result.current.status).toBe('connecting');

    act(() => {
      wsInstances[0].simulateOpen();
    });

    expect(result.current.status).toBe('connected');
  });

  it("status transitions to 'reconnecting' on unexpected close", () => {
    const { result } = renderHook(() => useWXATASocket('ws://localhost:4000'));

    act(() => {
      wsInstances[0].simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    act(() => {
      wsInstances[0].simulateClose(1006);
    });

    expect(result.current.status).toBe('reconnecting');
  });

  // -------------------------------------------------------------------------
  // Attempt counter resets on successful reconnect
  // -------------------------------------------------------------------------

  it('attempt counter resets to 0 on successful reconnect', () => {
    const { result } = renderHook(() => useWXATASocket('ws://localhost:4000'));

    // First connection opens then drops
    act(() => {
      wsInstances[0].simulateOpen();
    });
    act(() => {
      wsInstances[0].simulateClose(1006);
    });

    // attempt should be 1 now (first reconnect scheduled)
    expect(result.current.attempt).toBe(1);

    // Advance timers so the reconnect fires
    act(() => {
      vi.advanceTimersByTime(BACKOFF_DELAYS[0] + 100);
    });

    // A second WebSocket instance should have been created
    expect(wsInstances.length).toBeGreaterThanOrEqual(2);

    // Simulate the reconnect succeeding
    act(() => {
      wsInstances[wsInstances.length - 1].simulateOpen();
    });

    expect(result.current.attempt).toBe(0);
    expect(result.current.status).toBe('connected');
  });

  // -------------------------------------------------------------------------
  // No reconnect on intentional close (unmount)
  // -------------------------------------------------------------------------

  it('does not reconnect when the hook is unmounted (intentional close)', () => {
    const { unmount } = renderHook(() => useWXATASocket('ws://localhost:4000'));

    act(() => {
      wsInstances[0].simulateOpen();
    });

    const instanceCountBefore = wsInstances.length;

    // Unmount triggers intentional close
    act(() => {
      unmount();
    });

    // Advance timers well past any backoff delay
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // No new WebSocket instances should have been created
    expect(wsInstances.length).toBe(instanceCountBefore);
  });

  // -------------------------------------------------------------------------
  // ws:// → wss:// upgrade when protocol is https:
  // -------------------------------------------------------------------------

  it('upgrades ws:// to wss:// when window.location.protocol is https:', () => {
    // Mock window.location.protocol
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, protocol: 'https:' },
      writable: true,
      configurable: true,
    });

    renderHook(() => useWXATASocket('ws://localhost:4000'));

    expect(wsInstances[0].url).toBe('wss://localhost:4000');

    // Restore original location
    if (originalDescriptor) {
      Object.defineProperty(window, 'location', originalDescriptor);
    } else {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'http:' },
        writable: true,
        configurable: true,
      });
    }
  });

  it('does NOT upgrade ws:// when window.location.protocol is http:', () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, protocol: 'http:' },
      writable: true,
      configurable: true,
    });

    renderHook(() => useWXATASocket('ws://localhost:4000'));

    expect(wsInstances[0].url).toBe('ws://localhost:4000');
  });
});
