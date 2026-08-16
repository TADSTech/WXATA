import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Phone, Wifi, RefreshCw, LogOut, X, Trash2 } from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

interface StatusBarProps {
  connection: string;
  uptime: string;
  memory: string;
  wsStatus: string;
  wsAttempt: number;
}

export function StatusBar({ connection, uptime, memory, wsStatus, wsAttempt }: StatusBarProps) {
  const isConnected = connection === 'CONNECTED';
  const isReconnecting = wsStatus === 'reconnecting';

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-2xl p-5 space-y-4 shadow-sm">
      <h3 className="text-xs uppercase tracking-wide opacity-60 border-b border-border-subtle pb-2 font-medium">Bot Status</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Connection</span>
          <span className={`font-medium ${isConnected ? 'text-accent-light' : 'text-danger-text'}`}>{connection}</span>
        </div>
        {isReconnecting && (
          <div className="flex items-center gap-2 text-xs text-warning-text border border-warning-subtle bg-warning-subtle px-2.5 py-1.5 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Reconnecting... (attempt {wsAttempt})</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Uptime</span>
          <span>{uptime}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Memory</span>
          <span>{memory}</span>
        </div>
      </div>
    </div>
  );
}

// ─── ConnectionPanel ──────────────────────────────────────────────────────────

interface ConnectionPanelProps {
  qrData: string | null;
  pairingCode: string | null;
  authMethod: 'NONE' | 'QR' | 'PHONE';
  isConnecting: boolean;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  onConnectQR: () => void;
  onConnectPhone: () => void;
  onRestart: () => void;
  onLogout: () => void;
  onTerminate: () => void;
  onClearAuth: () => void;
}

export function ConnectionPanel({
  qrData, pairingCode, authMethod, isConnecting,
  phoneNumber, setPhoneNumber,
  onConnectQR, onConnectPhone, onRestart, onLogout, onTerminate, onClearAuth
}: ConnectionPanelProps) {
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const handleConnectPhone = () => {
    if (!showPhoneInput) {
      setShowPhoneInput(true);
      return;
    }
    if (!phoneNumber.trim()) return;
    onConnectPhone();
  };

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-2xl p-6 overflow-hidden shadow-sm">
      <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
        {/* QR Method */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-5 bg-bg-panel-hover border border-border-subtle rounded-2xl shadow-sm">
            {qrData ? (
              <div className="p-3 bg-white rounded-xl">
                <QRCodeSVG value={qrData} size={140} />
              </div>
            ) : (
              <div className="w-[140px] h-[140px] flex items-center justify-center border-2 border-dashed border-border-subtle rounded-xl">
                {isConnecting && authMethod === 'QR'
                  ? <RefreshCw className="w-8 h-8 animate-spin text-accent-light" />
                  : <QrCode className="w-12 h-12 text-accent-primary" />}
              </div>
            )}
          </div>
          <button
            onClick={onConnectQR}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-white px-7 py-3 rounded-xl font-semibold transition-all uppercase text-sm tracking-wide shadow-sm hover:shadow-md"
          >
            <Wifi className="w-4.5 h-4.5" /> Connect QR
          </button>
        </div>

        <div className="hidden md:block h-32 w-px bg-border-subtle" />

        {/* Phone Method */}
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          {pairingCode ? (
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs uppercase text-text-muted font-medium">Pairing Code</span>
              <div className="text-4xl font-mono font-bold tracking-widest text-accent-light bg-accent-subtle px-7 py-4 border border-border-subtle rounded-2xl">
                {pairingCode}
              </div>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {showPhoneInput && (
                <input
                  type="text"
                  placeholder="Phone (e.g. 551199999999)"
                  className="w-full bg-bg-panel-hover border border-border-subtle p-3 text-text-main text-center font-mono focus:border-accent-primary focus:ring-2 focus:ring-accent-subtle outline-none placeholder:text-text-muted rounded-xl transition-all"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                />
              )}
              <button
                onClick={handleConnectPhone}
                disabled={isConnecting || (showPhoneInput && !phoneNumber.trim())}
                className="w-full flex items-center justify-center gap-2 bg-bg-panel border border-border-subtle hover:bg-accent-subtle disabled:border-border-subtle disabled:text-text-muted text-accent-light px-6 py-3 rounded-xl font-semibold transition-all uppercase text-sm tracking-wide shadow-sm"
              >
                <Phone className="w-4.5 h-4.5" /> {showPhoneInput ? 'Link via Phone' : 'Connect Phone'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 justify-center mt-6 pt-4 border-t border-border-subtle">
        <button
          onClick={onRestart}
          className="flex items-center gap-1.5 border border-border-subtle hover:bg-bg-panel-hover px-4 py-2 text-xs rounded-xl transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Restart
        </button>
        <button
          onClick={() => {
            if (confirm('Log out of WhatsApp? You will need to scan a new QR code.')) onLogout();
          }}
          className="flex items-center gap-1.5 border border-warning-subtle text-warning-text hover:bg-warning-subtle px-4 py-2 text-xs rounded-xl transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
        <button
          onClick={() => {
            if (confirm('Force-wipe all auth files? You will need to re-pair.')) onClearAuth();
          }}
          className="flex items-center gap-1.5 border border-danger-subtle text-danger-text hover:bg-danger-subtle px-4 py-2 text-xs rounded-xl transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Auth
        </button>
        <button
          onClick={() => {
            if (confirm('Terminate the bot process? PM2 will stop it.')) onTerminate();
          }}
          className="flex items-center gap-1.5 border border-danger-subtle text-danger-text hover:bg-danger-subtle px-4 py-2 text-xs rounded-xl transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Terminate
        </button>
      </div>
    </div>
  );
}

// ─── LogPanel ─────────────────────────────────────────────────────────────────

const LOG_TYPE_COLORS: Record<string, string> = {
  INFO: 'text-blue-600',
  WARN: 'text-amber-600',
  ERROR: 'text-red-600',
  SUCCESS: 'text-green-600',
  DEBUG: 'text-gray-500',
  MSG: 'text-text-main',
};

export function LogPanel({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex-1 bg-bg-panel border border-border-subtle rounded-2xl p-5 flex flex-col gap-4 overflow-hidden min-h-[300px] shadow-sm">
      <div className="flex justify-between items-center border-b border-border-subtle pb-2">
        <span className="text-xs uppercase tracking-wide opacity-60 font-medium">Real-time System Logs</span>
        <span className="text-[10px] text-accent-primary">BAILEYS_SOCKET_STREAM</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 text-xs font-mono custom-scrollbar">
        {logs.map((log, i) => {
          const colorClass = LOG_TYPE_COLORS[log.type?.toUpperCase()] ?? 'text-text-muted';
          return (
            <motion.div
              key={i}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="hover:bg-bg-panel-hover px-2 py-1.5 rounded-lg flex gap-2 transition-colors"
            >
              <span className="text-text-muted shrink-0">[{log.timestamp}]</span>
              <span className={`shrink-0 font-semibold ${colorClass}`}>{log.type}:</span>
              <span className="text-text-main break-all">{log.message}</span>
            </motion.div>
          );
        })}
        {logs.length === 0 && (
          <div className="text-accent-primary opacity-40 text-center mt-20 italic">Waiting for backend data...</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
