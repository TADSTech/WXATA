import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Shield, Activity, QrCode, Phone, Wifi, RefreshCw,
  LogOut, Save, X, BookOpen
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useTheme, KNOWN_THEMES, type Theme } from '../components/ThemeProvider';
import { useWXATASocket } from '../hooks/useWXATASocket';

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

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}



// ─── useToast hook ────────────────────────────────────────────────────────────

let toastIdCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2000);
  }, []);

  return { toasts, addToast };
}

// ─── ToastContainer ───────────────────────────────────────────────────────────

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`px-4 py-2 rounded text-xs font-bold font-mono border shadow-lg ${
              t.type === 'success'
                ? 'bg-bg-panel border-accent-primary text-accent-light'
                : 'bg-bg-panel border-danger-base text-danger-text'
            }`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
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
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-4">
      <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Bot Status</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Connection</span>
          <span className={isConnected ? 'text-accent-light' : 'text-danger-text'}>{connection}</span>
        </div>
        {isReconnecting && (
          <div className="flex items-center gap-2 text-xs text-warning-text border border-warning-subtle bg-warning-subtle/20 px-2 py-1 rounded">
            <RefreshCw className="w-3 h-3 animate-spin" />
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
    <div className="bg-bg-panel border border-border-strong rounded p-6 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
        {/* QR Method */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-4 bg-bg-panel border border-border-subtle rounded-xl">
            {qrData ? (
              <div className="p-2 bg-white rounded">
                <QRCodeSVG value={qrData} size={150} />
              </div>
            ) : (
              <div className="w-[150px] h-[150px] flex items-center justify-center border border-dashed border-border-subtle">
                {isConnecting && authMethod === 'QR'
                  ? <RefreshCw className="w-8 h-8 animate-spin text-accent-light" />
                  : <QrCode className="w-12 h-12 text-accent-primary" />}
              </div>
            )}
          </div>
          <button
            onClick={onConnectQR}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-base px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
          >
            <Wifi className="w-4 h-4" /> Connect QR
          </button>
        </div>

        <div className="hidden md:block h-32 w-px bg-border-subtle" />

        {/* Phone Method */}
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          {pairingCode ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs uppercase text-text-muted">Pairing Code</span>
              <div className="text-4xl font-mono font-black tracking-widest text-accent-light bg-bg-panel px-6 py-3 border border-border-strong rounded">
                {pairingCode}
              </div>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {showPhoneInput && (
                <input
                  type="text"
                  placeholder="Phone (e.g. 551199999999)"
                  className="w-full bg-bg-panel border border-border-strong p-2 text-accent-light text-center font-mono focus:border-border-strong outline-none placeholder:text-accent-primary/50"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                />
              )}
              <button
                onClick={handleConnectPhone}
                disabled={isConnecting || (showPhoneInput && !phoneNumber.trim())}
                className="w-full flex items-center justify-center gap-2 bg-bg-panel border border-border-strong hover:bg-accent-subtle disabled:border-border-strong disabled:text-text-muted text-accent-light px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
              >
                <Phone className="w-4 h-4" /> {showPhoneInput ? 'Link via Phone' : 'Connect Phone'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 justify-center mt-6 pt-4 border-t border-border-strong/10">
        <button
          onClick={onRestart}
          className="flex items-center gap-1.5 border border-border-strong hover:bg-accent-subtle px-3 py-1.5 text-xs rounded transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Restart
        </button>
        <button
          onClick={() => {
            if (confirm('Log out of WhatsApp? You will need to scan a new QR code.')) onLogout();
          }}
          className="flex items-center gap-1.5 border border-warning-subtle text-warning-text hover:bg-warning-subtle/20 px-3 py-1.5 text-xs rounded transition-colors"
        >
          <LogOut className="w-3 h-3" /> Logout
        </button>
        <button
          onClick={() => {
            if (confirm('Terminate the bot process? PM2 will stop it.')) onTerminate();
          }}
          className="flex items-center gap-1.5 border border-danger-subtle text-danger-text hover:bg-danger-subtle/20 px-3 py-1.5 text-xs rounded transition-colors"
        >
          <X className="w-3 h-3" /> Terminate
        </button>
      </div>
    </div>
  );
}

// ─── LogPanel ─────────────────────────────────────────────────────────────────

const LOG_TYPE_COLORS: Record<string, string> = {
  INFO: 'text-blue-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  SUCCESS: 'text-green-400',
  DEBUG: 'text-gray-400',
  MSG: 'text-white',
};

function LogPanel({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex-1 bg-bg-panel border border-border-subtle rounded p-4 flex flex-col gap-4 overflow-hidden min-h-[300px]">
      <div className="flex justify-between items-center border-b border-border-strong/10 pb-2">
        <span className="text-xs uppercase tracking-widest opacity-50">Real-time System Logs</span>
        <span className="text-[10px] text-accent-primary">BAILEYS_SOCKET_STREAM</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5 text-xs font-mono custom-scrollbar">
        {logs.map((log, i) => {
          const colorClass = LOG_TYPE_COLORS[log.type?.toUpperCase()] ?? 'text-text-muted';
          return (
            <motion.div
              key={i}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="hover:bg-accent-subtle px-1 py-0.5 rounded flex gap-2"
            >
              <span className="text-text-muted shrink-0">[{log.timestamp}]</span>
              <span className={`shrink-0 font-bold ${colorClass}`}>{log.type}:</span>
              <span className="text-text-main break-all">{log.message}</span>
            </motion.div>
          );
        })}
        {logs.length === 0 && (
          <div className="text-accent-primary opacity-30 text-center mt-20 italic">Waiting for backend data...</div>
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
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-4 text-xs">
      <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">TV Mode Configuration</h3>

      <div className="bg-accent-subtle/20 border border-accent-subtle p-3 rounded text-accent-light space-y-1">
        <span className="font-bold uppercase tracking-widest block mb-1">How it works</span>
        When TV Mode is active, all normal commands are ignored for non-root users. Instead, if a user sends a message starting with the <strong>Trigger Text</strong>, the bot will extract their name and reply with the <strong>Welcome Message</strong>.
      </div>

      <label className="block space-y-1">
        <span className="text-text-muted uppercase tracking-wider">Trigger Text (lowercase)</span>
        <input
          type="text"
          value={config.triggerText}
          onChange={e => onChange({ ...config, triggerText: e.target.value })}
          className="w-full bg-bg-panel border border-border-strong p-2 text-text-main outline-none focus:border-accent-primary transition-colors font-mono"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-text-muted uppercase tracking-wider">Welcome Message</span>
        <textarea
          value={config.welcomeMessage}
          onChange={e => onChange({ ...config, welcomeMessage: e.target.value })}
          rows={4}
          className="w-full bg-bg-panel border border-border-strong p-2 text-text-main outline-none focus:border-accent-primary font-mono whitespace-pre-wrap transition-colors"
        />
        <span className="text-[10px] text-text-muted mt-1 block">Use <code>{`{{name}}`}</code> to inject the user's extracted name.</span>
      </label>

      <button
        onClick={onSave}
        className="w-full border border-border-strong bg-success-subtle text-accent-light hover:bg-accent-subtle px-4 py-2 text-xs font-bold transition-colors"
      >
        <Save className="w-3 h-3 inline mr-1" /> Save TV Config
      </button>
    </div>
  );
}

// ─── TwitterGrabber ──────────────────────────────────────────────────────────

function TwitterGrabber() {
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [tweetData, setTweetData] = useState<{ text: string, imageUrls: string[] } | null>(null);
  const [error, setError] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyStickers, setApplyStickers] = useState(true);

  const getBackendUrl = () => {
    return ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:5000')
      .replace('ws://', 'http://')
      .replace('wss://', 'https://');
  };

  const handleFetch = async () => {
    if (!url) return;
    setFetching(true);
    setError('');
    try {
      console.log(`[TwitterGrabber] Fetching from: ${getBackendUrl()}/api/twitter/grab with URL:`, url);
      const res = await fetch(`${getBackendUrl()}/api/twitter/grab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      console.log(`[TwitterGrabber] Response status: ${res.status}`, data);
      if (!res.ok) {
        const errorMsg = data.error || `Server error: ${res.status}`;
        throw new Error(errorMsg);
      }
      // Ensure imageUrls is always an array
      const normalizedData = {
        text: data.text || '',
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : []
      };
      console.log(`[TwitterGrabber] Normalized data:`, normalizedData);
      setTweetData(normalizedData);
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      console.error(`[TwitterGrabber] Fetch error:`, errorMsg);
      setError(errorMsg);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!tweetData) return;
    setSaving(true);
    try {
      // Save to drafts or local storage
      const draft = {
        text: tweetData.text,
        imageUrls: tweetData.imageUrls,
        applyStickers,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('twitterGrabberDraft', JSON.stringify(draft));
      alert('✓ Draft saved successfully!');
      setTweetData(null);
      setUrl('');
    } catch (err: any) {
      alert('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePostNow = async () => {
    if (!tweetData) return;
    setPosting(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/twitter/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postAt: Date.now(),
          text: tweetData.text,
          imageUrls: tweetData.imageUrls,
          applyStickers
        })
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Failed to post');
      alert('✓ Tweet posted successfully!');
      setTweetData(null);
      setUrl('');
    } catch (err: any) {
      console.error('Post error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setPosting(false);
    }
  };

  const handleSchedule = async () => {
    if (!tweetData || !scheduledTime) return;
    setScheduling(true);
    try {
      const postAt = new Date(scheduledTime).getTime();
      console.log('Scheduling tweet with:', { postAt, text: tweetData.text, imageUrls: tweetData.imageUrls, applyStickers });
      
      const res = await fetch(`${getBackendUrl()}/api/twitter/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postAt,
          text: tweetData.text,
          imageUrls: tweetData.imageUrls,
          applyStickers
        })
      });
      
      const responseData = await res.json();
      if (!res.ok) {
        console.error('Schedule error response:', responseData);
        throw new Error(responseData.error || 'Failed to schedule');
      }
      
      alert('✓ Tweet scheduled successfully!');
      setTweetData(null);
      setUrl('');
      setScheduledTime('');
    } catch (err: any) {
      console.error('Schedule error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Paste Tweet URL..." 
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch()}
          className="flex-1 bg-bg-panel border border-border-strong p-2.5 text-text-main outline-none text-xs rounded hover:border-accent-primary/50 focus:border-accent-primary"
        />
        <button 
          onClick={handleFetch} 
          disabled={fetching || !url}
          className="border border-border-strong bg-accent-subtle hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-light px-4 py-2.5 text-xs font-bold rounded transition-colors"
        >
          {fetching ? '⟳ Fetching...' : '📥 Grab'}
        </button>
      </div>
      
      {error && (
        <div className="border border-danger-subtle bg-danger-subtle/30 text-danger-text p-2 rounded text-[10px]">
          ⚠ {error}
        </div>
      )}

      {tweetData && (
        <div className="border border-border-strong/50 rounded-lg overflow-hidden bg-bg-panel/50">
          {/* Preview Section */}
          <div className="border-b border-border-strong/30 p-4 space-y-3">
            <div className="text-xs uppercase tracking-widest text-text-muted font-bold">Preview</div>
            
            {/* Tweet Text Preview */}
            <div className="bg-bg-panel border border-border-strong/30 rounded p-3 space-y-2">
              <div className="text-xs text-text-muted">Tweet Text:</div>
              <textarea 
                value={tweetData?.text || ''} 
                onChange={e => setTweetData({ ...tweetData, text: e.target.value })}
                className="w-full bg-bg-base border border-border-strong/50 p-2 text-text-main text-xs h-20 rounded outline-none focus:border-accent-primary/50"
              />
              <div className="text-[10px] text-text-muted">
                {(tweetData?.text || '').length} / 280 characters
              </div>
            </div>

            {/* Images Preview */}
            {tweetData?.imageUrls && tweetData.imageUrls.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-text-muted">Images ({tweetData.imageUrls.length}):</div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {tweetData.imageUrls.map((imgUrl, idx) => (
                    <div key={idx} className="border border-border-strong/30 rounded overflow-hidden bg-bg-base aspect-square">
                      <img 
                        src={imgUrl} 
                        alt={`Tweet image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Options */}
            <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-accent-light transition-colors">
              <input 
                type="checkbox" 
                checked={applyStickers} 
                onChange={e => setApplyStickers(e.target.checked)}
                className="cursor-pointer"
              />
              <span>✨ Apply Stickers to images</span>
            </label>
          </div>

          {/* Schedule Section */}
          <div className="border-b border-border-strong/30 p-4 space-y-3">
            <div className="text-xs uppercase tracking-widest text-text-muted font-bold">Schedule</div>
            <input 
              type="datetime-local" 
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="w-full bg-bg-panel border border-border-strong/50 p-2.5 text-xs text-text-main rounded outline-none focus:border-accent-primary/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="p-4 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="border border-info-base bg-info-subtle hover:bg-info-base/20 disabled:opacity-50 disabled:cursor-not-allowed text-info-text px-3 py-2 text-xs font-bold rounded transition-colors"
              >
                {saving ? '⟳' : '💾'} Save
              </button>
              <button 
                onClick={handlePostNow}
                disabled={posting}
                className="border border-success-base bg-success-subtle hover:bg-success-base/20 disabled:opacity-50 disabled:cursor-not-allowed text-success-text px-3 py-2 text-xs font-bold rounded transition-colors"
              >
                {posting ? '⟳' : '🚀'} Post
              </button>
              <button 
                onClick={handleSchedule}
                disabled={scheduling || !scheduledTime}
                className="border border-warning-base bg-warning-subtle hover:bg-warning-base/20 disabled:opacity-50 disabled:cursor-not-allowed text-warning-text px-3 py-2 text-xs font-bold rounded transition-colors"
              >
                {scheduling ? '⟳' : '⏰'} Schedule
              </button>
            </div>
            <button 
              onClick={() => setTweetData(null)}
              className="w-full border border-border-strong text-text-muted hover:text-danger-text p-2 text-xs rounded transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ThemeSwitcher ────────────────────────────────────────────────────────────

const THEME_META: Record<string, { name: string; color: string }> = {
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
        className="flex items-center gap-2 text-accent-light hover:text-accent-hover transition-colors focus:outline-none"
      >
        <span className="uppercase text-xs hidden sm:inline">{theme}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-4 bg-bg-panel border border-border-strong rounded-xl shadow-2xl overflow-hidden z-50 min-w-[280px] p-4 backdrop-blur-md bg-opacity-90">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-3 border-b border-border-subtle pb-2">Select Visual Identity</div>
          <div className="grid grid-cols-2 gap-2">
            {KNOWN_THEMES.map(id => {
              const meta = THEME_META[id] ?? { name: id, color: '#888' };
              return (
                <button
                  key={id}
                  onClick={() => { setTheme(id); setOpen(false); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${theme === id ? 'bg-accent-subtle ring-1 ring-accent-primary' : 'hover:bg-bg-panel-hover'}`}
                >
                  <div className="w-4 h-4 rounded-full border border-border-strong shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className={`text-[11px] font-bold uppercase tracking-tight ${theme === id ? 'text-accent-light' : 'text-text-main'}`}>
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
    <div className="text-text-main font-mono p-6 flex flex-col gap-6 h-screen overflow-hidden">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="flex justify-between items-center border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tighter text-text-main">WXATA_TV_DASHBOARD v1.0.0</h1>
          {userData && (
            <span className="ml-4 text-sm text-text-muted">
              Welcome, {(userData.name as string) || (userData.username as string)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 border border-border-strong rounded px-2 py-1 bg-bg-panel">
            <span className="text-xs uppercase tracking-widest text-text-muted">Account:</span>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value as 'primary' | 'secondary')}
              className="bg-transparent text-accent-light outline-none text-xs font-bold uppercase cursor-pointer"
            >
              <option value="primary" className="bg-bg-panel text-accent-light">Primary</option>
              <option value="secondary" className="bg-bg-panel text-accent-light">Secondary</option>
            </select>
          </div>

          <button
            onClick={() => navigate('/docs')}
            className="flex items-center gap-2 text-text-muted hover:text-accent-light transition-colors uppercase text-xs tracking-widest border border-border-strong px-2 py-1 rounded"
          >
            <BookOpen className="w-3 h-3" /> Docs
          </button>

          <ThemeSwitcher theme={theme} setTheme={setTheme} open={showThemeMenu} setOpen={setShowThemeMenu} />

          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${botStatus.connection === 'CONNECTED' ? 'animate-pulse text-accent-light' : 'text-danger-base'}`} />
            <span className="hidden sm:inline">SYSTEM: {botStatus.connection}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent-light" />
            <span className="text-accent-light hidden sm:inline">ENCRYPTION: ACTIVE</span>
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
          <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-3 text-xs">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Global Config</h3>
            <label className="block space-y-1">
              <span className="text-text-muted uppercase tracking-wider">Command Prefix</span>
              <input
                type="text"
                value={botInfo.prefix}
                onChange={e => handlePrefixChange(e.currentTarget.value)}
                className="w-full bg-bg-panel border border-border-strong p-2 text-accent-light outline-none focus:border-border-strong"
              />
            </label>
            {(String(userData?.email || userData?.name || userData?.username || '').includes('motrenewed')) && (
              <label className="flex items-center justify-between gap-3 border border-border-subtle p-2 rounded cursor-pointer mt-2 bg-accent-subtle/10">
                <span className="text-accent-primary uppercase tracking-wider">Beta: TV Mode Automation</span>
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
                  className="w-4 h-4 accent-accent-primary"
                />
              </label>
            )}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-strong/10">
              <span className="text-[10px] text-accent-primary uppercase tracking-wider">{configStatus || 'Ready'}</span>
              <button
                onClick={saveBotInfo}
                className="border border-border-strong bg-success-subtle text-accent-light hover:bg-accent-subtle px-4 py-2 text-sm font-bold transition-colors shadow-[0_0_10px_var(--accent-subtle)]"
              >
                SAVE CONFIG
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
            className="w-full border border-border-strong hover:bg-accent-subtle px-4 py-2 text-xs font-bold transition-colors rounded uppercase tracking-widest bg-accent-subtle text-accent-light"
          >
            𝕏 X LINK GRABBER
          </button>
          {/* Quick Actions */}
          <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickAction('RESTART_BOT')}
                className="border border-border-strong hover:bg-accent-subtle p-2 text-xs transition-colors"
              >
                RESTART BOT
              </button>
              <button
                onClick={() => handleQuickAction('TERMINATE')}
                className="border border-danger-subtle text-danger-text hover:bg-danger-subtle p-2 text-xs transition-colors"
              >
                TERMINATE
              </button>
              <button
                onClick={() => handleQuickAction('CLEAR_LOGS')}
                className="border border-border-strong hover:bg-accent-subtle p-2 text-xs transition-colors"
              >
                CLEAR LOGS
              </button>
              <button
                onClick={() => handleQuickAction('EXPORT_DATA')}
                className="border border-accent-subtle hover:bg-accent-subtle p-2 text-xs transition-colors"
              >
                EXPORT DATA
              </button>
              <button
                onClick={() => {
                  if (confirm('Log out of WhatsApp? You will need to scan a new QR code.')) {
                    handleQuickAction('LOGOUT');
                  }
                }}
                className="border border-danger-subtle text-danger-text hover:bg-danger-subtle p-2 text-xs transition-colors col-span-2 font-bold"
              >
                RESET SESSION (NEW QR)
              </button>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="border border-danger-base hover:bg-danger-subtle text-danger-text p-2 text-xs transition-colors flex items-center justify-center gap-2 w-full rounded"
          >
            <LogOut size={14} /> SIGN OUT
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
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTwitterModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-panel border border-border-strong rounded max-h-[90vh] overflow-y-auto w-full max-w-lg custom-scrollbar"
            >
              <div className="sticky top-0 bg-bg-panel border-b border-border-strong flex justify-between items-center p-4 z-10">
                <h2 className="text-lg font-bold uppercase tracking-widest">𝕏 X Link Grabber</h2>
                <button onClick={() => setShowTwitterModal(false)} className="text-text-muted hover:text-accent-light transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <TwitterGrabber />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TvDashboard;
