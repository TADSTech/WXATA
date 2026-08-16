import { useState, useEffect, useRef, useCallback } from 'react';

export const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WXATASocketState {
  socket: WebSocket | null;
  status: SocketStatus;
  attempt: number;
  send: (payload: unknown) => void;
  lastMessage: unknown;
}

/**
 * Upgrades a ws:// URL to wss:// when the page is served over HTTPS.
 */
function upgradeUrl(url: string): string {
  if (window.location.protocol === 'https:' && url.startsWith('ws://')) {
    return 'wss://' + url.slice(5);
  }
  return url;
}

export function useWXATASocket(url: string): WXATASocketState {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [attempt, setAttempt] = useState(0);
  const [lastMessage, setLastMessage] = useState<unknown>(null);

  // Refs so event handlers always see the latest values without stale closures
  const attemptRef = useRef(0);
  const intentionalClose = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    // Don't open a new connection if we're intentionally closed
    if (intentionalClose.current) return;

    const resolvedUrl = upgradeUrl(url);
    const ws = new WebSocket(resolvedUrl);
    socketRef.current = ws;
    setSocket(ws);
    setStatus('connecting');

    ws.onopen = () => {
      const password = localStorage.getItem('wxata_dashboard_password') || '';
      if (password) {
        ws.send(JSON.stringify({ type: 'auth', password }));
      } else {
        attemptRef.current = 0;
        setAttempt(0);
        setStatus('connected');
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data as string);
        setLastMessage(parsed);
        // First message from server after auth = confirmed connected
        if (status !== 'connected') {
          attemptRef.current = 0;
          setAttempt(0);
          setStatus('connected');
        }
      } catch {
        // If the message isn't JSON, pass it through as-is
        setLastMessage(event.data);
      }
    };

    ws.onclose = () => {
      setSocket(null);
      socketRef.current = null;

      // Only reconnect on unexpected closes (not triggered by unmount)
      if (intentionalClose.current) {
        setStatus('disconnected');
        return;
      }

      const currentAttempt = attemptRef.current;
      const delay = BACKOFF_DELAYS[Math.min(currentAttempt, BACKOFF_DELAYS.length - 1)];

      setStatus('reconnecting');
      attemptRef.current = currentAttempt + 1;
      setAttempt(currentAttempt + 1);

      reconnectTimer.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, so reconnect logic lives there
    };
  }, [url]);

  useEffect(() => {
    intentionalClose.current = false;

    // Small delay to avoid React StrictMode double-invoke closing the socket
    // before it has a chance to open
    const initTimer = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(initTimer);
      // Mark as intentional so the onclose handler skips reconnect
      intentionalClose.current = true;

      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      if (socketRef.current !== null) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((payload: unknown) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return { socket, status, attempt, send, lastMessage };
}
