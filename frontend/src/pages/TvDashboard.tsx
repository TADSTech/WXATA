import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, RefreshCw, LogOut, Save, X, BookOpen, Wifi, Phone, Activity, Terminal, Shield } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useTheme, KNOWN_THEMES, type Theme } from '../components/ThemeProvider';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { useWXATASocket } from '../hooks/useWXATASocket';
import { TwitterGrabber } from '../components/TwitterGrabber';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface BotTvConfig {
  triggerText: string;
  welcomeMessage: string;
}

interface BotInfo {
  prefix: string;
  scripts: Record<string, BotScript>;
  root: BotRoot;
  welcome: BotWelcome;
  permissions: BotPermissions;
  tvMode?: boolean;
  tvConfig?: BotTvConfig;
}

interface BotScript {
  name?: string;
  desc?: string;
  trigger: string;
  aliases?: string[];
  type?: string;
  response: string;
  target: string;
  code?: string;
  defaultArgument?: string;
  arguments?: Record<string, BotScriptArgument>;
}

interface BotScriptArgument {
  target?: string;
  response?: string;
}

interface BotWelcome {
  enabled: boolean;
  text: string;
}

interface BotRoot {
  target: string;
}

interface BotPermissions {
  allowAll: boolean;
  chats: string[];
  numbers: string[];
}

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

function StatusBar({ connection, uptime, memory, wsStatus, wsAttempt }: StatusBarProps) {
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
}

function ConnectionPanel({
  qrData, pairingCode, authMethod, isConnecting,
  phoneNumber, setPhoneNumber,
  onConnectQR, onConnectPhone, onRestart, onLogout, onTerminate
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

function LogPanel({ logs }: { logs: LogEntry[] }) {
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

// ─── TVConfigEditor ──────────────────────────────────────────────────────────

interface TVConfigEditorProps {
  tvConfig?: BotTvConfig;
  onChange: (c: BotTvConfig) => void;
  onSave: () => void;
}

function TVConfigEditor({ tvConfig, onChange, onSave }: TVConfigEditorProps) {
  const config = tvConfig || DEFAULT_BOT_INFO.tvConfig!;
  return (
    <div className="bg-bg-panel border border-border-subtle rounded-2xl p-5 space-y-4 text-xs shadow-sm">
      <h3 className="text-xs uppercase tracking-wide opacity-60 border-b border-border-subtle pb-2 font-medium">TV Mode Configuration</h3>

      <div className="bg-accent-subtle border border-accent-subtle p-4 rounded-xl text-accent-light space-y-1.5">
        <span className="font-semibold uppercase tracking-wide block mb-1">How it works</span>
        When TV Mode is active, all normal commands are ignored for non-root users. Instead, if a user sends a message starting with the <strong>Trigger Text</strong>, the bot will extract their name and reply with the <strong>Welcome Message</strong>.
      </div>

      <label className="block space-y-2">
        <span className="text-text-muted uppercase tracking-wide font-medium">Trigger Text (lowercase)</span>
        <input
          type="text"
          value={config.triggerText}
          onChange={e => onChange({ ...config, triggerText: e.target.value })}
          className="w-full bg-bg-panel-hover border border-border-subtle p-3 text-text-main outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-subtle transition-all font-mono rounded-xl"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-text-muted uppercase tracking-wide font-medium">Welcome Message</span>
        <textarea
          value={config.welcomeMessage}
          onChange={e => onChange({ ...config, welcomeMessage: e.target.value })}
          rows={4}
          className="w-full bg-bg-panel-hover border border-border-subtle p-3 text-text-main outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-subtle font-mono whitespace-pre-wrap transition-all rounded-xl"
        />
        <span className="text-[11px] text-text-muted mt-1 block">Use <code>{`{{name}}`}</code> to inject the user's extracted name.</span>
      </label>

      <button
        onClick={onSave}
        className="w-full border border-success-subtle bg-success-subtle text-success-text hover:bg-accent-subtle px-4 py-3 text-sm font-semibold transition-all rounded-xl shadow-sm"
      >
        <Save className="w-4 h-4 inline mr-1.5" /> Save TV Config
      </button>
    </div>
  );
}

// ─── ThemeSwitcher ────────────────────────────────────────────────────────────

const THEME_META: Record<string, { name: string; color: string }> = {
  soft: { name: 'Soft & Friendly', color: '#a78bfa' },
  midnight: { name: 'Midnight', color: '#8b5cf6' },
  nord: { name: 'Nord', color: '#88c0d0' },
  cyberpunk: { name: 'Cyberpunk', color: '#ff00ff' },
  rose: { name: 'Rose Pine', color: '#ebbcba' },
  ocean: { name: 'Oceanic', color: '#0ea5e9' },
  forest: { name: 'Deep Forest', color: '#10b981' },
  minimal: { name: 'Minimal', color: '#000000' },
  sepia: { name: 'Vintage', color: '#7c2d12' },
  hacker: { name: 'Hacker', color: '#00ff41' },
  sunset: { name: 'Sunset', color: '#f59e0b' },
};

interface ThemeSwitcherProps {
  theme: string;
  setTheme: (t: Theme) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

function ThemeSwitcher({ theme, setTheme, open, setOpen }: ThemeSwitcherProps) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-text-main hover:text-accent-primary transition-colors focus:outline-none border border-border-subtle bg-bg-panel px-3 py-2 rounded-xl hover:bg-bg-panel-hover shadow-sm"
      >
        <span className="text-xs font-medium">{theme}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-3 bg-bg-panel border border-border-subtle rounded-2xl shadow-xl overflow-hidden z-50 min-w-[280px] p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted mb-3 border-b border-border-subtle pb-2 font-medium">Select Visual Identity</div>
          <div className="grid grid-cols-2 gap-2">
            {KNOWN_THEMES.map(id => {
              const meta = THEME_META[id] ?? { name: id, color: '#888' };
              return (
                <button
                  key={id}
                  onClick={() => { setTheme(id); setOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${theme === id ? 'bg-accent-subtle ring-1 ring-accent-primary' : 'hover:bg-bg-panel-hover'}`}
                >
                  <div className="w-4.5 h-4.5 rounded-full border border-border-subtle shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className={`text-sm font-semibold ${theme === id ? 'text-accent-light' : 'text-text-main'}`}>
                    {meta.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard (main component) ───────────────────────────────────────────────

const backendUrl = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'ws://localhost:5000').replace(/\/+$/, '');

const DEFAULT_BOT_INFO: BotInfo = {
  prefix: '!',
  scripts: {
    summoner: {
      trigger: 'summon',
      response: 'WXATA summoned successfully.',
      target: 'self',
      defaultArgument: 'self',
      arguments: { here: { target: 'chat' }, self: { target: 'self' } },
    },
  },
  root: { target: 'self' },
  welcome: { enabled: false, text: '' },
  permissions: { allowAll: false, chats: [], numbers: [] },
  tvMode: false,
  tvConfig: {
    triggerText: "hey, i want to join tadstech. my name is ",
    welcomeMessage: "Welcome! I’ve saved your number as {{name}}. To see my daily statuses, updates, and giveaways, save my number as 'Tadstech' right now and reply 'DONE'.",
  },
};

const TvDashboard = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toasts, addToast } = useToast();

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // ── WebSocket (useWXATASocket) ───────────────────────────────────────────────
  const { status: wsStatus, attempt: wsAttempt, send, lastMessage } = useWXATASocket(backendUrl);

  // ── Bot state ───────────────────────────────────────────────────────────────
  const [selectedAccountId, setSelectedAccountId] = useState<'primary' | 'secondary'>(() => {
    return (localStorage.getItem('selectedAccountId') as 'primary' | 'secondary') || 'primary';
  });
  const [botStatus, setBotStatus] = useState({ connection: 'DISCONNECTED', uptime: '00h 00m 00s', memory: '0MB / 512MB' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [qrData, setQrData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo>(DEFAULT_BOT_INFO);
  const [configStatus, setConfigStatus] = useState('');

  // ── Connection UI state ─────────────────────────────────────────────────────
  const [authMethod, setAuthMethod] = useState<'NONE' | 'QR' | 'PHONE'>('NONE');
  const [isConnecting, setIsConnecting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [showTwitterModal, setShowTwitterModal] = useState(false);

  // ── Script editor state ─────────────────────────────────────────────────────

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      // Try to find the user row — if found, use it; otherwise just allow access
      // with the session (avoids blocking users whose metadata doesn't match URL)
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('uid', session.user.id)
        .maybeSingle();
      if (userRow) {
        setUserData(userRow as Record<string, unknown>);
      } else {
        setUserData({ name: session.user.email, username });
      }
      setIsAuthenticated(true);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') navigate('/login');
    });

    return () => subscription.unsubscribe();
  }, [username, navigate]);

  // ── Persist account selection & Send GET_BOT_INFO on connect & account switch ─────────────────────────────
  useEffect(() => {
    localStorage.setItem('selectedAccountId', selectedAccountId);
  }, [selectedAccountId]);

  useEffect(() => {
    if (isAuthenticated && wsStatus === 'connected') {
      setLogs([]);
      setQrData(null);
      setPairingCode(null);
      setAuthMethod('NONE');
      setIsConnecting(false);
      setPhoneNumber('');
      setBotInfo(DEFAULT_BOT_INFO);
      send({ command: 'GET_BOT_INFO', accountId: selectedAccountId });
    }
  }, [isAuthenticated, wsStatus, send, selectedAccountId]);

  // ── Route lastMessage by event field ────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as Record<string, unknown>;
    const event = msg.event as string;
    const data = msg.data;
    const msgAccountId = msg.accountId as string | undefined;

    if (event === 'status' && data && typeof data === 'object') {
      const s = data as Record<string, unknown>;
      const connections = s.connection as Record<string, string>;
      const conn = connections?.[selectedAccountId] ?? 'DISCONNECTED';
      setBotStatus({
        connection: conn,
        uptime: (s.uptime as string) ?? '00h 00m 00s',
        memory: (s.memory as string) ?? '0MB / 512MB',
      });
      if (conn === 'CONNECTED') {
        setAuthMethod('NONE');
        setQrData(null);
        setPairingCode(null);
        setIsConnecting(false);
      }
    } else {
      // For all other events, filter by selectedAccountId
      if (msgAccountId && msgAccountId !== selectedAccountId) return;

      if (event === 'log' && data && typeof data === 'object') {
        const l = data as Record<string, unknown>;
        const entry: LogEntry = {
          timestamp: (l.timestamp as string) ?? '',
          type: (l.type as string) ?? 'INFO',
          message: (l.message as string) ?? '',
        };
        setLogs(prev => [...prev, entry].slice(-50));
      } else if (event === 'qr') {
        setQrData(data as string);
        setIsConnecting(false);
      } else if (event === 'pairing-code') {
        setPairingCode(data as string);
        setIsConnecting(false);
      } else if (event === 'bot-info' && data) {
        setBotInfo(data as BotInfo);
        setConfigStatus('Config synced');
        addToast('Config synced', 'success');
      }
    }
  }, [lastMessage, addToast, selectedAccountId, setAuthMethod, setIsConnecting]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const sendCommand = (command: string, data?: unknown) => {
    if (wsStatus !== 'connected') {
      addToast('Not connected', 'error');
      return;
    }
    send({ command, data, accountId: selectedAccountId });
  };

  const startConnection = (method: 'QR' | 'PHONE') => {
    setIsConnecting(true);
    setAuthMethod(method);
    send({
      command: 'START_CONNECTION',
      accountId: selectedAccountId,
      data: { method, phoneNumber: method === 'PHONE' ? phoneNumber : undefined },
    });
  };

  const handleQuickAction = (action: string) => {
    if (action === 'CLEAR_LOGS') { setLogs([]); return; }
    sendCommand('QUICK_ACTION', { action });
  };

  const handlePrefixChange = (value: string) => {
    setBotInfo(prev => ({ ...prev, prefix: value }));
    setConfigStatus('Unsaved changes');
  };





  const saveBotInfo = () => {
    sendCommand('UPDATE_BOT_INFO', botInfo);
    setConfigStatus('Saving...');
  };


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center font-mono relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--theme-accent-subtle)_0%,transparent_70%)] opacity-50" />
        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-accent-primary opacity-20 animate-pulse" />
            <Activity className="text-accent-primary w-12 h-12 relative animate-spin-slow" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-accent-light text-xl font-black tracking-[0.4em] uppercase">SYSTEM_AUTH</h2>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-accent-primary"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="text-text-main p-6 flex flex-col gap-6 h-screen overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="flex justify-between items-center border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 text-accent-primary" />
          <h1 className="text-xl font-bold tracking-tight text-text-main">WXATA TV Dashboard</h1>
          {userData && (
            <span className="ml-4 text-sm text-text-muted">
              Welcome, {(userData.name as string) || (userData.username as string)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 border border-border-subtle rounded-xl px-3 py-2 bg-bg-panel shadow-sm">
            <span className="text-xs uppercase tracking-wide text-text-muted font-medium">Account:</span>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value as 'primary' | 'secondary')}
              className="bg-transparent text-accent-light outline-none text-xs font-semibold uppercase cursor-pointer"
            >
              <option value="primary" className="bg-bg-panel text-accent-light">Primary</option>
              <option value="secondary" className="bg-bg-panel text-accent-light">Secondary</option>
            </select>
          </div>

          <button
            onClick={() => navigate('/docs')}
            className="flex items-center gap-2 text-text-muted hover:text-accent-light transition-colors uppercase text-xs tracking-wide border border-border-subtle px-3 py-2 rounded-xl hover:bg-bg-panel-hover"
          >
            <BookOpen className="w-4 h-4" /> Docs
          </button>

          <ThemeSwitcher theme={theme} setTheme={setTheme} open={showThemeMenu} setOpen={setShowThemeMenu} />

          <div className="flex items-center gap-2">
            <Activity className={`w-4.5 h-4.5 ${botStatus.connection === 'CONNECTED' ? 'animate-pulse text-success-text' : 'text-danger-text'}`} />
            <span className="hidden sm:inline font-medium">SYSTEM: {botStatus.connection}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4.5 h-4.5 text-accent-light" />
            <span className="text-accent-light hidden sm:inline font-medium">ENCRYPTION: ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">

        {/* Left/Middle: Connection & Logs */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden min-h-0">

          {/* Connection Panel (visible until connected) */}
          <AnimatePresence>
            {botStatus.connection !== 'CONNECTED' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ConnectionPanel
                  qrData={qrData}
                  pairingCode={pairingCode}
                  authMethod={authMethod}
                  isConnecting={isConnecting}
                  phoneNumber={phoneNumber}
                  setPhoneNumber={setPhoneNumber}
                  onConnectQR={() => startConnection('QR')}
                  onConnectPhone={() => startConnection('PHONE')}
                  onRestart={() => handleQuickAction('RESTART_BOT')}
                  onLogout={() => handleQuickAction('LOGOUT')}
                  onTerminate={() => handleQuickAction('TERMINATE')}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Log Panel */}
          <LogPanel logs={logs} />
        </div>

        {/* Right: Status + Config panels */}
        <div className="flex flex-col gap-6 overflow-y-auto min-h-0 custom-scrollbar">

          {/* Status Bar */}
          <StatusBar
            connection={botStatus.connection}
            uptime={botStatus.uptime}
            memory={botStatus.memory}
            wsStatus={wsStatus}
            wsAttempt={wsAttempt}
          />

          {/* Global Config */}
          <div className="bg-bg-panel border border-border-subtle rounded-2xl p-5 space-y-4 text-sm shadow-sm">
            <h3 className="text-xs uppercase tracking-wide opacity-60 border-b border-border-subtle pb-2 font-medium">Global Config</h3>
            <label className="block space-y-2">
              <span className="text-text-muted uppercase tracking-wide font-medium">Command Prefix</span>
              <input
                type="text"
                value={botInfo.prefix}
                onChange={e => handlePrefixChange(e.currentTarget.value)}
                className="w-full bg-bg-panel-hover border border-border-subtle p-3 text-text-main outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-subtle rounded-xl transition-all"
              />
            </label>
            {(String(userData?.email || userData?.name || userData?.username || '').includes('motrenewed')) && (
              <label className="flex items-center justify-between gap-3 border border-border-subtle p-3 rounded-xl cursor-pointer bg-accent-subtle/30 hover:bg-accent-subtle transition-colors">
                <span className="text-accent-primary font-medium">Beta: TV Mode Automation</span>
                <input
                  type="checkbox"
                  checked={!!botInfo.tvMode}
                  onChange={e => {
                    const isTv = e.target.checked;
                    setBotInfo(prev => ({ ...prev, tvMode: isTv }));
                    if (!isTv) {
                       localStorage.setItem(`tvModeEnabled_${selectedAccountId}`, 'false');
                       navigate(`/dashboard/${username}`);
                    } else {
                       localStorage.setItem(`tvModeEnabled_${selectedAccountId}`, 'true');
                    }
                    setConfigStatus('Unsaved changes');
                  }}
                  className="w-5 h-5 accent-accent-primary"
                />
              </label>
            )}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle">
              <span className="text-xs text-accent-primary font-medium">{configStatus || 'Ready'}</span>
              <button
                onClick={saveBotInfo}
                className="bg-accent-primary hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
              >
                Save Config
              </button>
            </div>
          </div>

          
          <TVConfigEditor
            tvConfig={botInfo.tvConfig}
            onChange={c => { setBotInfo(prev => ({ ...prev, tvConfig: c })); setConfigStatus('Unsaved changes'); }}
            onSave={saveBotInfo}
          />

          <button
            onClick={() => setShowTwitterModal(true)}
            className="w-full bg-accent-subtle border border-border-subtle hover:bg-accent-subtle/80 text-accent-light px-4 py-3 font-semibold transition-all rounded-xl shadow-sm hover:shadow-md"
          >
            𝕏 X Link Grabber
          </button>
          <button
            onClick={() => navigate(`/tv/tools/${username}`)}
            className="w-full bg-bg-panel border border-accent-subtle hover:bg-accent-subtle text-accent-light px-4 py-3 font-semibold transition-all rounded-xl shadow-sm hover:shadow-md"
          >
            🛠 TV Tools Suite
          </button>
          {/* Quick Actions */}
          <div className="bg-bg-panel border border-border-subtle rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs uppercase tracking-wide opacity-60 border-b border-border-subtle pb-2 font-medium">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleQuickAction('RESTART_BOT')}
                className="border border-border-subtle hover:bg-bg-panel-hover p-3 rounded-xl text-sm font-medium transition-colors"
              >
                Restart Bot
              </button>
              <button
                onClick={() => handleQuickAction('TERMINATE')}
                className="border border-danger-subtle text-danger-text hover:bg-danger-subtle p-3 rounded-xl text-sm font-medium transition-colors"
              >
                Terminate
              </button>
              <button
                onClick={() => handleQuickAction('CLEAR_LOGS')}
                className="border border-border-subtle hover:bg-bg-panel-hover p-3 rounded-xl text-sm font-medium transition-colors"
              >
                Clear Logs
              </button>
              <button
                onClick={() => handleQuickAction('EXPORT_DATA')}
                className="border border-accent-subtle text-accent-light hover:bg-accent-subtle p-3 rounded-xl text-sm font-medium transition-colors"
              >
                Export Data
              </button>
              <button
                onClick={() => {
                  if (confirm('Log out of WhatsApp? You will need to scan a new QR code.')) {
                    handleQuickAction('LOGOUT');
                  }
                }}
                className="border border-danger-subtle text-danger-text hover:bg-danger-subtle p-3 rounded-xl text-sm font-semibold transition-colors col-span-2"
              >
                Reset Session (New QR)
              </button>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="border border-danger-subtle hover:bg-danger-subtle text-danger-text p-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 w-full"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>

      {/* X (Twitter) Grabber Modal */}
      <AnimatePresence>
        {showTwitterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTwitterModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-panel border border-border-subtle rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto w-full max-w-lg custom-scrollbar"
            >
              <div className="sticky top-0 bg-bg-panel border-b border-border-subtle flex justify-between items-center px-5 py-4 z-10">
                <h2 className="text-lg font-bold">𝕏 X Link Grabber</h2>
                <button onClick={() => setShowTwitterModal(false)} className="text-text-muted hover:text-text-main transition-colors p-1 rounded-lg hover:bg-bg-panel-hover">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-5">
                <TwitterGrabber addToast={addToast} selectedAccountId={selectedAccountId} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TvDashboard;
