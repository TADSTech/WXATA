import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, BookOpen, Activity, Shield, ChevronRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme, KNOWN_THEMES, type Theme } from '../components/ThemeProvider';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { useWXATASocket } from '../hooks/useWXATASocket';
import { TwitterGrabber } from '../components/TwitterGrabber';

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

function ConnectionStatus({ connection, uptime, memory, wsStatus, wsAttempt }: {
  connection: string;
  uptime: string;
  memory: string;
  wsStatus: string;
  wsAttempt: number;
}) {
  const isConnected = connection === 'CONNECTED';
  const isReconnecting = wsStatus === 'reconnecting';

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-2xl p-5 space-y-4 shadow-sm">
      <h3 className="text-xs uppercase tracking-wide opacity-60 border-b border-border-subtle pb-2 font-medium">Connected Account</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Status</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-text animate-pulse' : 'bg-danger-text'}`} />
            <span className={`font-medium ${isConnected ? 'text-success-text' : 'text-danger-text'}`}>{connection}</span>
          </div>
        </div>
        {isReconnecting && (
          <div className="flex items-center gap-2 text-xs text-warning-text border border-warning-subtle bg-warning-subtle px-2.5 py-1.5 rounded-xl">
            <Activity className="w-3.5 h-3.5 animate-spin" />
            <span>Reconnecting... (attempt {wsAttempt})</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Uptime</span>
          <span className="font-mono text-sm">{uptime}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Memory</span>
          <span className="font-mono text-sm">{memory}</span>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ icon, title, description, children, defaultOpen = false }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 hover:bg-bg-panel-hover transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center text-accent-light">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: open ? 'auto' : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="px-5 pb-5 border-t border-border-subtle pt-4">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// ─── AutoReplyManager ──────────────────────────────────────────────────────────

interface AutoReplyRule {
  trigger: string;
  response: string;
  enabled: boolean;
}

interface AutoReplyManagerProps {
  rules: AutoReplyRule[];
  onChange: (rules: AutoReplyRule[]) => void;
  onSave: () => void;
  status: string;
}

function AutoReplyManager({ rules, onChange, onSave, status }: AutoReplyManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');

  const resetForm = () => {
    setTrigger('');
    setResponse('');
    setEditIndex(null);
    setShowForm(false);
  };

  const handleEdit = (index: number) => {
    setTrigger(rules[index].trigger);
    setResponse(rules[index].response);
    setEditIndex(index);
    setShowForm(true);
  };

  const handleSaveRule = () => {
    if (!trigger.trim() || !response.trim()) return;
    const newRules = [...rules];
    if (editIndex !== null) {
      newRules[editIndex] = { trigger: trigger.trim(), response: response.trim(), enabled: rules[editIndex].enabled };
    } else {
      newRules.push({ trigger: trigger.trim(), response: response.trim(), enabled: true });
    }
    onChange(newRules);
    resetForm();
  };

  const handleDelete = (index: number) => {
    if (confirm('Delete this auto-reply rule?')) {
      onChange(rules.filter((_, i) => i !== index));
    }
  };

  const handleToggle = (index: number) => {
    const newRules = rules.map((r, i) => i === index ? { ...r, enabled: !r.enabled } : r);
    onChange(newRules);
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
        <h3 className="text-xs uppercase tracking-wide opacity-60 font-medium">Auto Reply Rules</h3>
        <span className="text-[10px] text-accent-primary font-mono">{enabledCount}/{rules.length} active</span>
      </div>

      {rules.length === 0 && !showForm && (
        <div className="text-xs text-text-muted text-center py-4 border border-dashed border-border-subtle rounded-xl">
          No auto-reply rules yet.
        </div>
      )}

      {rules.map((rule, i) => (
        <div key={i} className={`border rounded-xl p-3 space-y-2 transition-all ${rule.enabled ? 'border-border-subtle' : 'border-dashed border-border-subtle opacity-50'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono bg-accent-subtle text-accent-light px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                  {rule.trigger}
                </span>
                <span className="text-[10px] text-text-muted">&rarr;</span>
              </div>
              <p className="text-xs text-text-main truncate">{rule.response}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleToggle(i)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${rule.enabled ? 'bg-success-subtle text-success-text' : 'bg-bg-panel-hover text-text-muted'}`}
                title={rule.enabled ? 'Disable' : 'Enable'}
              >
                {rule.enabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => handleEdit(i)}
                className="w-7 h-7 rounded-lg bg-bg-panel-hover hover:bg-accent-subtle text-text-muted hover:text-accent-light flex items-center justify-center text-xs transition-colors"
                title="Edit"
              >
                ✎
              </button>
              <button
                onClick={() => handleDelete(i)}
                className="w-7 h-7 rounded-lg bg-bg-panel-hover hover:bg-danger-subtle text-text-muted hover:text-danger-text flex items-center justify-center text-xs transition-colors"
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="border border-accent-subtle rounded-xl p-3 space-y-3 bg-accent-subtle/20">
          <input
            type="text"
            placeholder="Trigger text (message contains...)"
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            className="w-full bg-bg-panel-hover border border-border-subtle p-2.5 text-text-main text-xs outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-subtle rounded-xl transition-all"
          />
          <textarea
            placeholder="Response message..."
            value={response}
            onChange={e => setResponse(e.target.value)}
            rows={3}
            className="w-full bg-bg-panel-hover border border-border-subtle p-2.5 text-text-main text-xs outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-subtle rounded-xl transition-all"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveRule}
              disabled={!trigger.trim() || !response.trim()}
              className="flex-1 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            >
              {editIndex !== null ? 'Update' : 'Add'} Rule
            </button>
            <button
              onClick={resetForm}
              className="border border-border-subtle hover:bg-bg-panel-hover px-3 py-2 rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-1.5 border border-dashed border-border-subtle hover:border-accent-subtle hover:text-accent-light text-text-muted w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
          >
            + Add Rule
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-subtle">
        <span className="text-[10px] text-accent-primary">{status || `${rules.length} rules`}</span>
        <button
          onClick={onSave}
          disabled={rules.length === 0}
          className="bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
        >
          Save Rules
        </button>
      </div>
    </div>
  );
}

const backendUrl = (localStorage.getItem('wxata_backend_url') || import.meta.env.VITE_BACKEND_URL as string || 'ws://localhost:5000').replace(/\/+$/, '');

const TvTools = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toasts, addToast } = useToast();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const { status: wsStatus, attempt: wsAttempt, lastMessage, send } = useWXATASocket(backendUrl);

  const [selectedAccountId, setSelectedAccountId] = useState<'primary' | 'secondary'>(() => {
    return (localStorage.getItem('selectedAccountId') as 'primary' | 'secondary') || 'primary';
  });
  const [botStatus, setBotStatus] = useState({ connection: 'DISCONNECTED', uptime: '00h 00m 00s', memory: '0MB / 512MB' });
  const [autoReplyRules, setAutoReplyRules] = useState<{ trigger: string; response: string; enabled: boolean }[]>([]);
  const [autoReplyStatus, setAutoReplyStatus] = useState('');

  useEffect(() => {
    localStorage.setItem('selectedAccountId', selectedAccountId);
  }, [selectedAccountId]);

  useEffect(() => {
    if (wsStatus === 'connected') {
      send({ command: 'GET_AUTOREPLY', accountId: selectedAccountId });
    }
  }, [wsStatus, send, selectedAccountId]);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as Record<string, unknown>;
    const event = msg.event as string;
    const data = msg.data;

    if (event === 'autoreply' && data) {
      setAutoReplyRules(data as { trigger: string; response: string; enabled: boolean }[]);
      setAutoReplyStatus('Rules synced');
    }

    if (event === 'status' && data && typeof data === 'object') {
      const s = data as Record<string, unknown>;
      const connections = s.connection as Record<string, string>;
      const conn = connections?.[selectedAccountId] ?? 'DISCONNECTED';
      setBotStatus({
        connection: conn,
        uptime: (s.uptime as string) ?? '00h 00m 00s',
        memory: (s.memory as string) ?? '0MB / 512MB',
      });
    }
  }, [lastMessage, selectedAccountId]);

  const sendCommand = (command: string, data?: unknown) => {
    if (wsStatus !== 'connected') return;
    send({ command, data, accountId: selectedAccountId });
  };

  const saveAutoReply = () => {
    sendCommand('UPDATE_AUTOREPLY', autoReplyRules);
    setAutoReplyStatus('Saving...');
  };

  if (false) {
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

  return (
    <div className="text-text-main p-4 md:p-6 flex flex-col gap-6 min-h-screen" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <ToastContainer toasts={toasts} />

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 text-accent-primary" />
          <h1 className="text-xl font-bold tracking-tight text-text-main">TV Tools</h1>
        </div>
        <div className="flex items-center gap-3 text-sm flex-wrap">
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
            onClick={() => navigate(`/tv/${username}`)}
            className="flex items-center gap-2 text-text-muted hover:text-accent-light transition-colors uppercase text-xs tracking-wide border border-border-subtle px-3 py-2 rounded-xl hover:bg-bg-panel-hover"
          >
            TV Dashboard
          </button>

          <button
            onClick={() => navigate(`/dashboard/${username}`)}
            className="flex items-center gap-2 text-text-muted hover:text-accent-light transition-colors uppercase text-xs tracking-wide border border-border-subtle px-3 py-2 rounded-xl hover:bg-bg-panel-hover"
          >
            <Activity className="w-3.5 h-3.5" /> Dashboard
          </button>

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        <div className="lg:col-span-3 flex flex-col gap-6">

          <ToolCard
            icon={<span className="text-lg font-bold">𝕏</span>}
            title="X Link Grabber"
            description="Paste a tweet URL to generate a branded content card — save to PC or send to WhatsApp"
            defaultOpen={true}
          >
            <TwitterGrabber addToast={addToast} selectedAccountId={selectedAccountId} />
          </ToolCard>

          <ToolCard
            icon={<Activity className="w-5 h-5" />}
            title="Status Scheduler"
            description="Schedule automated status posts with memes, quotes, and branded content"
          >
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-accent-light" />
              </div>
              <p className="text-text-muted text-sm mb-2">Coming Soon</p>
              <p className="text-xs text-text-muted opacity-60 max-w-md">
                This tool will let you schedule and manage automated status posts
                directly from the dashboard. Stay tuned.
              </p>
            </div>
          </ToolCard>

          <ToolCard
            icon={<span className="text-lg">🎨</span>}
            title="Content Studio"
            description="Create and edit branded media content for WhatsApp status and broadcasts"
          >
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mb-4">
                <span className="text-2xl">🎨</span>
              </div>
              <p className="text-text-muted text-sm mb-2">Coming Soon</p>
              <p className="text-xs text-text-muted opacity-60 max-w-md">
                A full media editor for creating professional branded content
                with stickers, templates, and text overlays.
              </p>
            </div>
          </ToolCard>
        </div>

        <div className="flex flex-col gap-6">
          <ConnectionStatus
            connection={botStatus.connection}
            uptime={botStatus.uptime}
            memory={botStatus.memory}
            wsStatus={wsStatus}
            wsAttempt={wsAttempt}
          />

          <AutoReplyManager
            rules={autoReplyRules}
            onChange={setAutoReplyRules}
            onSave={saveAutoReply}
            status={autoReplyStatus}
          />

          <div className="bg-bg-panel border border-border-subtle rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs uppercase tracking-wide opacity-60 border-b border-border-subtle pb-2 font-medium">Navigation</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => navigate(`/tv/${username}`)}
                className="border border-border-subtle hover:bg-bg-panel-hover p-3 rounded-xl text-sm font-medium transition-colors text-left flex items-center gap-2"
              >
                <Activity className="w-4 h-4 text-accent-light" /> TV Mode Dashboard
              </button>
              <button
                onClick={() => navigate(`/dashboard/${username}`)}
                className="border border-border-subtle hover:bg-bg-panel-hover p-3 rounded-xl text-sm font-medium transition-colors text-left flex items-center gap-2"
              >
                <Terminal className="w-4 h-4 text-accent-light" /> Main Dashboard
              </button>
              <button
                onClick={() => navigate('/docs')}
                className="border border-border-subtle hover:bg-bg-panel-hover p-3 rounded-xl text-sm font-medium transition-colors text-left flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-accent-light" /> Documentation
              </button>
            </div>
          </div>

        </div>
      </div>

      <footer className="border-t border-border-subtle pt-4 mt-auto">
        <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] opacity-40 text-center">
          Powered by WXATA Engine &bull; TV Tools Suite
        </p>
      </footer>
    </div>
  );
};

export default TvTools;
