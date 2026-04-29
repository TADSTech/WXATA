import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Shield, Activity, QrCode, Phone, Wifi, RefreshCw, LogOut, ChevronDown, ChevronUp, Plus, Trash2, Edit3, Save, X, Package, Download, ExternalLink, Palette, BookOpen } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useTheme } from '../components/ThemeProvider';

interface BotInfo {
  prefix: string;
  scripts: Record<string, BotScript>;
  root: BotRoot;
  welcome: BotWelcome;
  permissions: BotPermissions;
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

// ─── MiniMarketplace sub-component ───────────────────────────────────────────
interface MarketplaceExtension {
  id: string;
  name: string;
  description: string;
  trigger: string;
  aliases?: string[];
  type?: string;
  target?: string;
  response: string;
  code?: string;
  defaultArgument?: string;
  downloads: number;
  untrusted?: boolean;
  disabled?: boolean;
  author: string;
  authorUid: string;
}

interface MiniMarketplaceProps {
  installedKeys: string[];
  onInstall: (ext: MarketplaceExtension) => void;
  navigate: (path: string) => void;
}

function MiniMarketplace({ installedKeys, onInstall, navigate }: MiniMarketplaceProps) {
  const [extensions, setExtensions] = useState<MarketplaceExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchExtensions = async () => {
      try {
        const { data, error } = await supabase
          .from('marketplace_extensions')
          .select('*')
          .eq('status', 'approved');
        if (error) throw error;
        const list: MarketplaceExtension[] = (data || []).map((row: Record<string, any>) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          trigger: row.trigger,
          aliases: row.aliases,
          type: row.type,
          target: row.target,
          response: row.response,
          code: row.code,
          defaultArgument: row.default_argument,
          downloads: row.downloads,
          untrusted: row.untrusted,
          disabled: row.disabled,
          author: row.author,
          authorUid: row.author_uid,
        }));
        list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        setExtensions(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchExtensions();
  }, []);

  const handleInstall = async (ext: MarketplaceExtension) => {
    setInstalling(ext.id);
    try {
      await supabase
        .from('marketplace_extensions')
        .update({ downloads: (ext.downloads || 0) + 1 })
        .eq('id', ext.id);
      onInstall(ext);
      setInstalled(prev => new Set(prev).add(ext.id));
    } catch (e) {
      console.error(e);
    } finally {
      setInstalling(null);
    }
  };

  const keyFor = (ext: MarketplaceExtension) => ext.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const isAlreadyInstalled = (ext: MarketplaceExtension) =>
    installedKeys.includes(keyFor(ext)) || installed.has(ext.id);

  return (
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-3">
      <div className="flex justify-between items-center border-b border-border-strong/10 pb-2">
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-accent-light" />
          <h3 className="text-xs uppercase tracking-widest opacity-50">Marketplace</h3>
        </div>
        <button onClick={() => navigate('/extensions')} className="flex items-center gap-1 text-xs text-accent-light hover:text-accent-light">
          <ExternalLink className="w-3 h-3" /> Full page
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-text-muted italic py-3 text-center">Loading extensions...</div>
      ) : extensions.length === 0 ? (
        <div className="text-xs text-text-muted italic py-3 text-center border border-dashed border-border-strong rounded">
          No approved extensions yet.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {extensions.map(ext => {
            const alreadyIn = isAlreadyInstalled(ext);
            return (
              <div key={ext.id} className="border border-border-strong/10 rounded p-2.5 flex items-start justify-between gap-2 hover:bg-accent-subtle transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-accent-light">{ext.name}</span>
                    <span className="text-[10px] font-mono text-text-muted">!{ext.trigger}</span>
                    {ext.untrusted && <span className="text-[9px] text-warning-text border border-warning-subtle bg-warning-subtle px-1 rounded flex items-center gap-0.5"><Shield className="w-2.5 h-2.5"/>Untrusted</span>}
                    {ext.code && <span className="text-[9px] text-info-text border border-info-subtle px-1 rounded">JS</span>}
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{ext.description}</p>
                  <span className="text-[9px] text-text-muted">by {ext.author} · {ext.downloads || 0} installs</span>
                </div>
                <button
                  onClick={() => !alreadyIn && !ext.disabled && handleInstall(ext)}
                  disabled={alreadyIn || installing === ext.id || ext.disabled}
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                    ext.disabled
                      ? 'border-danger-subtle text-danger-text bg-danger-subtle cursor-not-allowed'
                      : alreadyIn
                        ? 'border-border-subtle text-accent-primary cursor-default'
                        : 'border-border-strong/40 text-accent-light hover:bg-accent-subtle transition-colors disabled:opacity-50'
                  }`}
                >
                  {ext.disabled ? 'Disabled' : alreadyIn ? '✓ Added' : installing === ext.id ? '...' : <><Download className="w-2.5 h-2.5" /> Add</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ScriptManager sub-component ─────────────────────────────────────────────
interface ScriptManagerProps {
  botInfo: BotInfo;
  configStatus: string;
  expandedScript: string | null;
  setExpandedScript: (k: string | null) => void;
  addingScript: boolean;
  setAddingScript: (v: boolean) => void;
  newScriptDraft: BotScript;
  setNewScriptDraft: (fn: (d: BotScript) => BotScript) => void;
  handleScriptFieldChange: (key: string, field: keyof BotScript, value: string) => void;
  handleScriptArgumentChange: (argName: string, field: keyof BotScriptArgument, value: string) => void;
  handleDeleteScript: (key: string) => void;
  handleAddScript: () => void;
  handlePublishScript: (key: string, script: BotScript) => void;
}

function ScriptManager({
  botInfo, expandedScript, setExpandedScript,
  addingScript, setAddingScript,
  newScriptDraft, setNewScriptDraft,
  handleScriptFieldChange, handleScriptArgumentChange,
  handleDeleteScript, handleAddScript, handlePublishScript
}: ScriptManagerProps) {
  const prefix = botInfo.prefix;
  return (
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-3">
      <div className="flex justify-between items-center border-b border-border-strong/10 pb-2">
        <h3 className="text-xs uppercase tracking-widest opacity-50">Scripts ({Object.keys(botInfo.scripts).length})</h3>
        <button onClick={() => { setAddingScript(true); setExpandedScript(null); }} className="flex items-center gap-1 text-xs text-accent-light hover:text-accent-light border border-border-strong px-2 py-1 rounded">
          <Plus className="w-3 h-3" /> New Script
        </button>
      </div>

      {/* Add new script form */}
      <AnimatePresence>
        {addingScript && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border border-border-strong rounded p-3 space-y-2 text-xs bg-bg-panel">
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-text-muted">Display Name</span>
                  <input value={newScriptDraft.name} onChange={e => setNewScriptDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Get Weather" className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong" />
                </label>
                <label className="block space-y-1">
                  <span className="text-text-muted">Trigger</span>
                  <input value={newScriptDraft.trigger} onChange={e => setNewScriptDraft(d => ({ ...d, trigger: e.target.value }))} placeholder="e.g. wt" className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-text-muted">Aliases (comma separated)</span>
                  <input value={newScriptDraft.aliases?.join(', ')} onChange={e => setNewScriptDraft(d => ({ ...d, aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="weather, temp" className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong" />
                </label>
                <label className="block space-y-1">
                  <span className="text-text-muted">Type</span>
                  <select value={newScriptDraft.type || 'misc'} onChange={e => setNewScriptDraft(d => ({ ...d, type: e.target.value }))} className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong">
                    <option value="core">core</option>
                    <option value="tools">tools</option>
                    <option value="admin">admin</option>
                    <option value="group">group</option>
                    <option value="fun">fun</option>
                    <option value="misc">misc</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-text-muted">Description</span>
                <input value={newScriptDraft.desc} onChange={e => setNewScriptDraft(d => ({ ...d, desc: e.target.value }))} placeholder="What does this script do?" className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-text-muted">Target</span>
                  <select value={newScriptDraft.target} onChange={e => setNewScriptDraft(d => ({ ...d, target: e.target.value }))} className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong">
                    <option value="chat">chat</option>
                    <option value="self">self</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-text-muted">Response</span>
                  <input value={newScriptDraft.response} onChange={e => setNewScriptDraft(d => ({ ...d, response: e.target.value }))} placeholder="or use JS below" className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong" />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-text-muted">JS Code (optional)</span>
                <textarea rows={3} value={newScriptDraft.code} onChange={e => setNewScriptDraft(d => ({ ...d, code: e.target.value }))} placeholder="await sendTrackedMessage(sock, remoteJid, 'Hello!');" className="w-full bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong font-mono text-[11px]" />
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddScript} disabled={!newScriptDraft.trigger.trim()} className="flex items-center gap-1 bg-accent-primary hover:bg-accent-hover disabled:opacity-40 text-bg-base px-3 py-1.5 rounded font-bold text-xs">
                  <Save className="w-3 h-3" /> Add
                </button>
                <button onClick={() => setAddingScript(false)} className="flex items-center gap-1 border border-border-strong hover:border-border-subtle text-text-muted px-3 py-1.5 rounded text-xs">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Script list */}
      <div className="space-y-1">
        {Object.entries(botInfo.scripts).map(([key, script]) => {
          const isExpanded = expandedScript === key;
          const isCore = script.type === 'core';
          return (
            <div key={key} className="border border-border-strong/15 rounded overflow-hidden">
              <button onClick={() => setExpandedScript(isExpanded ? null : key)} className="w-full flex items-center justify-between p-2.5 hover:bg-accent-subtle transition-colors text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <Edit3 className="w-3 h-3 text-accent-primary shrink-0" />
                  <span className="text-accent-light font-bold text-xs capitalize truncate">{script.name || key}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-text-muted text-[10px] font-mono">{prefix}{script.trigger}</span>
                    {script.aliases && script.aliases.length > 0 && (
                      <span className="text-[9px] text-text-muted/50 font-mono">({script.aliases.join(', ')})</span>
                    )}
                  </div>
                  {script.code && <span className="text-[9px] text-info-text border border-info-subtle px-1 rounded shrink-0">JS</span>}
                  {script.type && <span className="text-[9px] text-warning-text border border-warning-subtle px-1 rounded shrink-0">{script.type}</span>}
                </div>
                {isExpanded ? <ChevronUp className="w-3 h-3 text-text-muted shrink-0" /> : <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-3 border-t border-border-strong/10 space-y-2 text-xs bg-bg-panel-hover">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Full Name</span>
                          <input value={script.name || key} onChange={e => handleScriptFieldChange(key, 'name', e.target.value)} className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Trigger (Alias)</span>
                          <input value={script.trigger} onChange={e => handleScriptFieldChange(key, 'trigger', e.target.value)} className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Aliases (comma separated)</span>
                          <input 
                            value={script.aliases?.join(', ') || ''} 
                            onChange={e => handleScriptFieldChange(key, 'aliases' as any, e.target.value)} 
                            className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" 
                            placeholder="e.g. menu, m"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Type</span>
                          <select value={script.type || 'misc'} onChange={e => handleScriptFieldChange(key, 'type', e.target.value)} className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong">
                            <option value="core">core</option>
                            <option value="tools">tools</option>
                            <option value="admin">admin</option>
                            <option value="group">group</option>
                            <option value="fun">fun</option>
                            <option value="misc">misc</option>
                          </select>
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-text-muted uppercase tracking-wider text-[10px]">Description</span>
                        <input value={script.desc || ''} onChange={e => handleScriptFieldChange(key, 'desc', e.target.value)} placeholder="Shows in !menu" className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Target</span>
                          <select value={script.target} onChange={e => handleScriptFieldChange(key, 'target', e.target.value)} className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong">
                            <option value="chat">chat</option>
                            <option value="self">self</option>
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Default Arg</span>
                          <input value={script.defaultArgument || ''} onChange={e => handleScriptFieldChange(key, 'defaultArgument', e.target.value)} placeholder="self" className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" />
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-text-muted uppercase tracking-wider text-[10px]">Response Text</span>
                        <input value={script.response} onChange={e => handleScriptFieldChange(key, 'response', e.target.value)} placeholder="Leave blank if using JS code" className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-text-muted uppercase tracking-wider text-[10px]">JS Code</span>
                        <textarea rows={6} value={script.code || ''} onChange={e => handleScriptFieldChange(key, 'code', e.target.value)} placeholder="await sendTrackedMessage(sock, remoteJid, 'Hello!');" className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong font-mono text-[11px] resize-y" />
                      </label>
                      {key === 'summoner' && (
                        <div className="border border-border-strong/15 rounded p-2 space-y-2">
                          <div className="text-text-muted uppercase tracking-wider text-[10px]">Named Arguments</div>
                          {['here', 'self'].map(argName => (
                            <div key={argName} className="grid grid-cols-2 gap-2">
                              <label className="block space-y-1">
                                <span className="text-text-muted text-[10px]">{argName}.target</span>
                                <input value={script.arguments?.[argName]?.target ?? ''} onChange={e => handleScriptArgumentChange(argName, 'target', e.target.value)} className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-text-muted text-[10px]">{argName}.response</span>
                                <input value={script.arguments?.[argName]?.response ?? ''} onChange={e => handleScriptArgumentChange(argName, 'response', e.target.value)} placeholder="optional" className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong placeholder:text-text-muted/30" />
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      {!isCore && (
                        <div className="flex gap-2">
                          <button onClick={() => handlePublishScript(key, script)} className="flex items-center gap-1 text-accent-light hover:text-accent-hover border border-border-strong hover:border-accent-subtle px-2 py-1 rounded text-[10px] transition-colors">
                            <Package className="w-3 h-3" /> Publish to Marketplace
                          </button>
                          <button onClick={() => handleDeleteScript(key)} className="flex items-center gap-1 text-danger-text hover:text-danger-base border border-danger-subtle hover:border-danger-base px-2 py-1 rounded text-[10px] transition-colors">
                            <Trash2 className="w-3 h-3" /> Delete Script
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const handleSignOut = () => {
    supabase.auth.signOut();
    navigate('/');
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState({
    connection: 'DISCONNECTED',
    uptime: '00h 00m 00s',
    memory: '0MB / 512MB'
  });

  const [authMethod, setAuthMethod] = useState<'NONE' | 'QR' | 'PHONE'>('NONE');
  const [qrData, setQrData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [botInfo, setBotInfo] = useState<BotInfo>({
    prefix: '!',
    scripts: {
      summoner: {
        trigger: 'summon',
        response: 'WXATA summoned successfully.',
        target: 'self',
        defaultArgument: 'self',
        arguments: { here: { target: 'chat' }, self: { target: 'self' } }
      }
    },
    root: { target: 'self' },
    welcome: { enabled: false, text: '' },
    permissions: { allowAll: false, chats: [], numbers: [] }
  });

  const [configStatus, setConfigStatus] = useState('');
  // Script editor state
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [addingScript, setAddingScript] = useState(false);
  const [newScriptDraft, setNewScriptDraft] = useState<BotScript>({
    name: '', desc: '', trigger: '', aliases: [], type: 'misc', response: '', target: 'chat', code: '', defaultArgument: ''
  });

  const wsRef = useRef<WebSocket | null>(null);

  // Check auth & fetch user data
  useEffect(() => {
    // One-time session check on mount — avoids race conditions with onAuthStateChange
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('username', username || '')
        .maybeSingle();
      if (userRow && userRow.uid === session.user.id) {
        setUserData(userRow);
        setIsAuthenticated(true);
      } else if (username === 'user') {
        setUserData({ name: session.user.email, username: username });
        setIsAuthenticated(true);
      } else {
        navigate('/login');
      }
    };

    checkSession();

    // Only listen for SIGNED_OUT to redirect — don't react to token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [username, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      // Auto-upgrade to wss:// when the page is served over HTTPS.
      // VITE_BACKEND_URL should be set in Vercel env vars (e.g. wss://wxata.tadstech.dev/ws).
      // Fallback: same host as the page, port 5000, correct protocol.
      const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
      const wsUrl = envUrl
        ? envUrl
        : window.location.hostname === 'localhost'
          ? 'ws://localhost:5000'
          : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5000`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        
        if (payload.event === 'log') {
          const { timestamp, type, message } = payload.data;
          const formattedLog = `[${timestamp}] ${type}: ${message}`;
          setLogs(prev => [...prev, formattedLog].slice(-50));
        }

        if (payload.event === 'status') {
          setStatus(payload.data);
          if (payload.data.connection === 'CONNECTED') {
            setAuthMethod('NONE');
            setQrData(null);
            setPairingCode(null);
            setIsConnecting(false);
          }
        }

        if (payload.event === 'qr') {
          setQrData(payload.data);
          setIsConnecting(false);
        }

        if (payload.event === 'pairing-code') {
          setPairingCode(payload.data);
          setIsConnecting(false);
        }

        if (payload.event === 'bot-info') {
          setBotInfo(payload.data);
          setConfigStatus('Config synced');
        }
      };

      socket.onopen = () => {
        console.log('Connected to WXATA backend');
        socket.send(JSON.stringify({ command: 'GET_BOT_INFO' }));
      };

      socket.onclose = () => {
        console.log('Disconnected from WXATA backend');
        setStatus(prev => ({ ...prev, connection: 'DISCONNECTED' }));
      };

      return () => socket.close();
    }
  }, [isAuthenticated]);

  const sendCommand = (command: string, data?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }
    wsRef.current.send(JSON.stringify({ command, data }));
  };

  const startConnection = (method: 'QR' | 'PHONE') => {
    setIsConnecting(true);
    setAuthMethod(method);
    sendCommand('START_CONNECTION', {
      method,
      phoneNumber: method === 'PHONE' ? phoneNumber : undefined
    });
  };

  const handleQuickAction = (action: string) => {
    if (action === 'CLEAR_LOGS') {
      setLogs([]);
      return;
    }
    sendCommand('QUICK_ACTION', { action });
  };

  const handlePrefixChange = (value: string) => {
    setBotInfo((prev) => ({ ...prev, prefix: value }));
    setConfigStatus('Unsaved changes');
  };

  // Generic: update any field on any script by key
  const handleScriptFieldChange = (scriptKey: string, field: keyof BotScript, value: any) => {
    let finalValue = value;
    if (field === 'aliases' && typeof value === 'string') {
      finalValue = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        [scriptKey]: { ...prev.scripts[scriptKey]!, [field]: finalValue }
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleDeleteScript = (scriptKey: string) => {
    const next = { ...botInfo.scripts };
    delete next[scriptKey];
    setBotInfo((prev) => ({ ...prev, scripts: next }));
    setExpandedScript(null);
    setConfigStatus('Unsaved changes');
  };

  const handlePublishScript = async (_key: string, script: BotScript) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("You must be logged in to publish scripts.");
      return;
    }
    if (!script.name || !script.desc) {
      alert("Please provide a Display Name and Description before publishing.");
      return;
    }
    if (confirm(`Publish "${script.name}" to the Marketplace? It will undergo admin review.`)) {
      try {
        const { error } = await supabase.from('marketplace_extensions').insert({
          name: script.name,
          description: script.desc,
          trigger: script.trigger,
          response: script.response || '',
          code: script.code || '',
          author: session.user.email?.split('@')[0] || 'Unknown',
          author_uid: session.user.id,
          status: 'pending',
          created_at: new Date().toISOString(),
          downloads: 0
        });
        if (error) throw error;
        alert('Extension submitted successfully! Awaiting admin approval.');
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleMarketplaceInstall = (ext: MarketplaceExtension) => {
    const key = ext.trigger.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || ext.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        [key]: {
          name: ext.name,
          desc: ext.description || `Installed: ${ext.name}`,
          trigger: ext.trigger,
          aliases: ext.aliases || [],
          type: ext.type || 'misc',
          target: ext.target || 'chat',
          response: ext.response || '',
          code: ext.code || '',
          defaultArgument: ext.defaultArgument || 'self',
        }
      }
    }));
    setConfigStatus(`"${ext.name}" added — remember to Save Config`);
  };

  const handleAddScript = () => {
    const key = newScriptDraft.trigger.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key || botInfo.scripts[key]) return;
    setBotInfo((prev) => ({
      ...prev,
      scripts: { ...prev.scripts, [key]: { ...newScriptDraft, name: newScriptDraft.name || key } }
    }));
    setNewScriptDraft({ name: '', desc: '', trigger: '', aliases: [], type: 'misc', response: '', target: 'chat', code: '', defaultArgument: '' });
    setAddingScript(false);
    setExpandedScript(key);
    setConfigStatus('Unsaved changes');
  };

  // Legacy handlers kept for the summoner-specific argument UI
  const handleScriptArgumentChange = (argumentName: string, field: keyof BotScriptArgument, value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        summoner: {
          ...prev.scripts.summoner!,
          arguments: {
            ...prev.scripts.summoner?.arguments,
            [argumentName]: { ...prev.scripts.summoner?.arguments?.[argumentName], [field]: value }
          }
        }
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleWelcomeChange = (field: keyof BotWelcome, value: string | boolean) => {
    setBotInfo((prev) => ({
      ...prev,
      welcome: {
        ...prev.welcome,
        [field]: value
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleRootChange = (value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      root: {
        ...prev.root,
        target: value
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const saveBotInfo = () => {
    sendCommand('UPDATE_BOT_INFO', botInfo);
    setConfigStatus('Saving...');
  };

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

  return (
    <div className="text-text-main font-mono p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tighter text-text-main">WXATA_DASHBOARD v1.0.0</h1>
          {userData && <span className="ml-4 text-sm text-text-muted">Welcome, {userData.name || userData.username}</span>}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <button 
            onClick={() => navigate('/docs')}
            className="flex items-center gap-2 text-text-muted hover:text-accent-light transition-colors uppercase text-xs tracking-widest border border-border-strong px-2 py-1 rounded"
          >
            <BookOpen className="w-3 h-3" /> Docs
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-2 text-accent-light hover:text-accent-hover transition-colors focus:outline-none"
            >
              <Palette className="w-4 h-4" />
              <span className="uppercase text-xs hidden sm:inline">{theme}</span>
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-4 bg-bg-panel border border-border-strong rounded-xl shadow-2xl overflow-hidden z-50 min-w-[280px] p-4 backdrop-blur-md bg-opacity-90">
                <div className="text-[10px] uppercase tracking-widest text-text-muted mb-3 border-b border-border-subtle pb-2">Select Visual Identity</div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'midnight', name: 'Midnight', color: '#8b5cf6' },
                    { id: 'nord', name: 'Nord', color: '#88c0d0' },
                    { id: 'cyberpunk', name: 'Cyberpunk', color: '#ff00ff' },
                    { id: 'rose', name: 'Rose Pine', color: '#ebbcba' },
                    { id: 'ocean', name: 'Oceanic', color: '#0ea5e9' },
                    { id: 'forest', name: 'Deep Forest', color: '#10b981' },
                    { id: 'minimal', name: 'Minimal', color: '#000000' },
                    { id: 'sepia', name: 'Vintage', color: '#7c2d12' },
                    { id: 'hacker', name: 'Hacker', color: '#00ff41' },
                    { id: 'sunset', name: 'Sunset', color: '#f59e0b' }
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${theme === t.id ? 'bg-accent-subtle ring-1 ring-accent-primary' : 'hover:bg-bg-panel-hover'}`}
                    >
                      <div className="w-4 h-4 rounded-full border border-border-strong shrink-0" style={{ backgroundColor: t.color }} />
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold uppercase tracking-tight ${theme === t.id ? 'text-accent-light' : 'text-text-main'}`}>{t.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${status.connection === 'CONNECTED' ? 'animate-pulse text-accent-light' : 'text-danger-base'}`} />
            <span className="hidden sm:inline">SYSTEM: {status.connection}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent-light" />
            <span className="text-accent-light hidden sm:inline">ENCRYPTION: ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Left/Middle: Connection & Logs */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">
          
          {/* Connection Controls (Visible until fully connected) */}
          <AnimatePresence>
            {status.connection !== 'CONNECTED' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-bg-panel border border-border-strong rounded p-6 overflow-hidden"
              >
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
                          {isConnecting && authMethod === 'QR' ? <RefreshCw className="w-8 h-8 animate-spin text-accent-light" /> : <QrCode className="w-12 h-12 text-accent-primary" />}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => startConnection('QR')}
                      disabled={isConnecting}
                      className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-base px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
                    >
                      <Wifi className="w-4 h-4" /> Link via QR
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
                      <div className="space-y-4 w-full">
                        <input 
                          type="text" 
                          placeholder="Phone (e.g. 551199999999)"
                          className="w-full bg-bg-panel border border-border-strong p-2 text-accent-light text-center font-mono focus:border-border-strong outline-none placeholder:text-accent-primary/50"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                        <button 
                          onClick={() => startConnection('PHONE')}
                          disabled={isConnecting || !phoneNumber}
                          className="w-full flex items-center justify-center gap-2 bg-bg-panel border border-border-strong hover:bg-accent-subtle disabled:border-border-strong disabled:text-text-muted text-accent-light px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
                        >
                          <Phone className="w-4 h-4" /> Link via Phone
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logs Panel */}
          <div className="flex-1 bg-bg-panel border border-border-subtle rounded p-4 flex flex-col gap-4 overflow-hidden min-h-[300px]">
          <div className="flex justify-between items-center border-b border-border-strong/10 pb-2">
            <span className="text-xs uppercase tracking-widest opacity-50">Real-time System Logs</span>
            <span className="text-[10px] text-accent-primary">BAILEYS_SOCKET_STREAM</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm font-mono custom-scrollbar">
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="hover:bg-accent-subtle p-1 rounded"
              >
                {log}
              </motion.div>
            ))}
            {logs.length === 0 && <div className="text-accent-primary opacity-30 text-center mt-20 italic">Waiting for backend data...</div>}
          </div>
        </div>
        </div>

        {/* Status Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Bot Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Connection</span>
                <span className={status.connection === 'CONNECTED' ? 'text-accent-light' : 'text-danger-text'}>{status.connection}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Uptime</span>
                <span>{status.uptime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Memory</span>
                <span>{status.memory}</span>
              </div>
            </div>
          </div>

          {/* ── Global Config ── */}
          <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-3 text-xs">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Global Config</h3>
            <label className="block space-y-1">
              <span className="text-text-muted uppercase tracking-wider">Command Prefix</span>
              <input type="text" value={botInfo.prefix} onChange={(e) => handlePrefixChange(e.currentTarget.value)} className="w-full bg-bg-panel border border-border-strong p-2 text-accent-light outline-none focus:border-border-strong" />
            </label>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-strong/10">
              <span className="text-[10px] text-accent-primary uppercase tracking-wider">{configStatus || 'Ready'}</span>
              <button onClick={saveBotInfo} className="border border-border-strong bg-success-subtle text-accent-light hover:bg-accent-subtle px-4 py-2 text-sm font-bold transition-colors shadow-[0_0_10px_var(--accent-subtle)]">SAVE CONFIG</button>
            </div>
          </div>

          {/* ── Script Manager ── */}
          <ScriptManager
            botInfo={botInfo}
            configStatus={configStatus}
            expandedScript={expandedScript}
            setExpandedScript={setExpandedScript}
            addingScript={addingScript}
            setAddingScript={setAddingScript}
            newScriptDraft={newScriptDraft}
            setNewScriptDraft={setNewScriptDraft}
            handleScriptFieldChange={handleScriptFieldChange}
            handleScriptArgumentChange={handleScriptArgumentChange}
            handleDeleteScript={handleDeleteScript}
            handleAddScript={handleAddScript}
            handlePublishScript={handlePublishScript}
          />

          {/* ── Mini Marketplace ── */}
          <MiniMarketplace
            installedKeys={Object.keys(botInfo.scripts)}
            onInstall={handleMarketplaceInstall}
            navigate={navigate}
          />

          <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Welcome On Connect</h3>
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between gap-3 border border-border-subtle p-2 rounded">
                <span className="text-text-muted uppercase tracking-wider">Enabled</span>
                <input
                  type="checkbox"
                  checked={botInfo.welcome.enabled}
                  onChange={(e) => handleWelcomeChange('enabled', e.currentTarget.checked)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-text-muted uppercase tracking-wider">Welcome text</span>
                <textarea
                  value={botInfo.welcome.text}
                  onChange={(e) => handleWelcomeChange('text', e.currentTarget.value)}
                  rows={5}
                  className="w-full bg-bg-panel border border-border-strong p-2 text-text-main outline-none focus:border-accent-primary font-mono whitespace-pre-wrap transition-colors"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-text-muted uppercase tracking-wider">Root target (self or phone number)</span>
                <input
                  type="text"
                  value={botInfo.root.target}
                  onChange={(e) => handleRootChange(e.currentTarget.value)}
                  className="w-full bg-bg-panel border border-border-strong p-2 text-text-main outline-none focus:border-accent-primary transition-colors"
                />
              </label>
            </div>
          </div>

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
                  if (confirm("Are you sure? This will delete the current WhatsApp session and you will need to scan a new QR code to reconnect!")) {
                    handleQuickAction('LOGOUT');
                  }
                }}
                className="border border-danger-subtle text-danger-text hover:bg-danger-subtle p-2 text-xs transition-colors col-span-2 font-bold"
              >
                RESET SESSION (NEW QR)
              </button>
              <button
                onClick={handleSignOut}
                className="border border-danger-base hover:bg-danger-subtle text-danger-text p-2 text-xs transition-colors flex items-center justify-center gap-2 mt-4 w-full"
              >
                <LogOut size={14} /> SIGN OUT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
