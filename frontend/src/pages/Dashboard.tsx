import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Shield, Activity, QrCode, Phone, Wifi, RefreshCw, LogOut, ChevronDown, ChevronUp, Plus, Trash2, Edit3, Save, X, Package, Download, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';

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
  response: string;
  code?: string;
  author: string;
  downloads: number;
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
    const fetch = async () => {
      try {
        const q = query(collection(db, 'extensions'), where('status', '==', 'approved'));
        const snap = await getDocs(q);
        const list: MarketplaceExtension[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as MarketplaceExtension));
        list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        setExtensions(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleInstall = async (ext: MarketplaceExtension) => {
    setInstalling(ext.id);
    try {
      await updateDoc(doc(db, 'extensions', ext.id), { downloads: (ext.downloads || 0) + 1 });
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
    <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-3">
      <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-blue-400" />
          <h3 className="text-xs uppercase tracking-widest opacity-50">Marketplace</h3>
        </div>
        <button onClick={() => navigate('/extensions')} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
          <ExternalLink className="w-3 h-3" /> Full page
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-slate-600 italic py-3 text-center">Loading extensions...</div>
      ) : extensions.length === 0 ? (
        <div className="text-xs text-slate-600 italic py-3 text-center border border-dashed border-slate-800 rounded">
          No approved extensions yet.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {extensions.map(ext => {
            const alreadyIn = isAlreadyInstalled(ext);
            return (
              <div key={ext.id} className="border border-emerald-500/10 rounded p-2.5 flex items-start justify-between gap-2 hover:bg-emerald-500/3 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-emerald-300">{ext.name}</span>
                    <span className="text-[10px] font-mono text-slate-600">!{ext.trigger}</span>
                    {ext.code && <span className="text-[9px] text-purple-400 border border-purple-500/30 px-1 rounded">JS</span>}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{ext.description}</p>
                  <span className="text-[9px] text-slate-700">by {ext.author} · {ext.downloads || 0} installs</span>
                </div>
                <button
                  onClick={() => !alreadyIn && handleInstall(ext)}
                  disabled={alreadyIn || installing === ext.id}
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                    alreadyIn
                      ? 'border-emerald-500/20 text-emerald-700 cursor-default'
                      : 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50'
                  }`}
                >
                  {alreadyIn ? '✓ Added' : installing === ext.id ? '...' : <><Download className="w-2.5 h-2.5" /> Add</>}
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
  newScriptKey: string;
  setNewScriptKey: (v: string) => void;
  newScriptDraft: BotScript;
  setNewScriptDraft: (fn: (d: BotScript) => BotScript) => void;
  handleScriptFieldChange: (key: string, field: keyof BotScript, value: string) => void;
  handleScriptArgumentChange: (argName: string, field: keyof BotScriptArgument, value: string) => void;
  handleDeleteScript: (key: string) => void;
  handleAddScript: () => void;
}

function ScriptManager({
  botInfo, expandedScript, setExpandedScript,
  addingScript, setAddingScript, newScriptKey, setNewScriptKey,
  newScriptDraft, setNewScriptDraft,
  handleScriptFieldChange, handleScriptArgumentChange,
  handleDeleteScript, handleAddScript
}: ScriptManagerProps) {
  const prefix = botInfo.prefix;
  return (
    <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-3">
      <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
        <h3 className="text-xs uppercase tracking-widest opacity-50">Scripts ({Object.keys(botInfo.scripts).length})</h3>
        <button onClick={() => { setAddingScript(true); setExpandedScript(null); }} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded">
          <Plus className="w-3 h-3" /> New Script
        </button>
      </div>

      {/* Add new script form */}
      <AnimatePresence>
        {addingScript && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border border-emerald-500/30 rounded p-3 space-y-2 text-xs bg-emerald-900/5">
              <div className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] mb-1">New Script</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-slate-400">Script Key</span>
                  <input value={newScriptKey} onChange={e => setNewScriptKey(e.target.value)} placeholder="e.g. weather" className="w-full bg-slate-900 border border-emerald-500/30 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400">Trigger</span>
                  <input value={newScriptDraft.trigger} onChange={e => setNewScriptDraft(d => ({ ...d, trigger: e.target.value }))} placeholder="e.g. weather" className="w-full bg-slate-900 border border-emerald-500/30 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-slate-400">Description</span>
                <input value={newScriptDraft.desc} onChange={e => setNewScriptDraft(d => ({ ...d, desc: e.target.value }))} placeholder="What does this script do?" className="w-full bg-slate-900 border border-emerald-500/30 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-slate-400">Target</span>
                  <select value={newScriptDraft.target} onChange={e => setNewScriptDraft(d => ({ ...d, target: e.target.value }))} className="w-full bg-slate-900 border border-emerald-500/30 p-1.5 text-emerald-400 outline-none focus:border-emerald-500">
                    <option value="chat">chat</option>
                    <option value="self">self</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400">Response</span>
                  <input value={newScriptDraft.response} onChange={e => setNewScriptDraft(d => ({ ...d, response: e.target.value }))} placeholder="or use JS below" className="w-full bg-slate-900 border border-emerald-500/30 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-slate-400">JS Code (optional)</span>
                <textarea rows={3} value={newScriptDraft.code} onChange={e => setNewScriptDraft(d => ({ ...d, code: e.target.value }))} placeholder="await sendTrackedMessage(sock, remoteJid, 'Hello!');" className="w-full bg-slate-900 border border-emerald-500/30 p-1.5 text-emerald-400 outline-none focus:border-emerald-500 font-mono text-[11px]" />
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddScript} disabled={!newScriptKey.trim() || !newScriptDraft.trigger.trim()} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black px-3 py-1.5 rounded font-bold text-xs">
                  <Save className="w-3 h-3" /> Add
                </button>
                <button onClick={() => setAddingScript(false)} className="flex items-center gap-1 border border-slate-600 hover:border-slate-400 text-slate-400 px-3 py-1.5 rounded text-xs">
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
          const isCore = ['menu', 'perm'].includes(key);
          const isExpanded = expandedScript === key;
          return (
            <div key={key} className="border border-emerald-500/15 rounded overflow-hidden">
              <button onClick={() => setExpandedScript(isExpanded ? null : key)} className="w-full flex items-center justify-between p-2.5 hover:bg-emerald-500/5 transition-colors text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <Edit3 className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span className="text-emerald-300 font-bold text-xs capitalize truncate">{script.name || key}</span>
                  <span className="text-slate-600 text-[10px] font-mono shrink-0">{prefix}{script.trigger}</span>
                  {script.code && <span className="text-[9px] text-purple-400 border border-purple-500/30 px-1 rounded shrink-0">JS</span>}
                  {isCore && <span className="text-[9px] text-yellow-600 border border-yellow-600/30 px-1 rounded shrink-0">core</span>}
                </div>
                {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-3 border-t border-emerald-500/10 space-y-2 text-xs bg-slate-950/50">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-slate-500 uppercase tracking-wider text-[10px]">Display Name</span>
                          <input value={script.name || key} onChange={e => handleScriptFieldChange(key, 'name', e.target.value)} className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-slate-500 uppercase tracking-wider text-[10px]">Trigger</span>
                          <input value={script.trigger} onChange={e => handleScriptFieldChange(key, 'trigger', e.target.value)} className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-slate-500 uppercase tracking-wider text-[10px]">Description</span>
                        <input value={script.desc || ''} onChange={e => handleScriptFieldChange(key, 'desc', e.target.value)} placeholder="Shows in !menu" className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-slate-500 uppercase tracking-wider text-[10px]">Target</span>
                          <select value={script.target} onChange={e => handleScriptFieldChange(key, 'target', e.target.value)} className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500">
                            <option value="chat">chat</option>
                            <option value="self">self</option>
                          </select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-slate-500 uppercase tracking-wider text-[10px]">Default Arg</span>
                          <input value={script.defaultArgument || ''} onChange={e => handleScriptFieldChange(key, 'defaultArgument', e.target.value)} placeholder="self" className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-slate-500 uppercase tracking-wider text-[10px]">Response Text</span>
                        <input value={script.response} onChange={e => handleScriptFieldChange(key, 'response', e.target.value)} placeholder="Leave blank if using JS code" className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-slate-500 uppercase tracking-wider text-[10px]">JS Code</span>
                        <textarea rows={6} value={script.code || ''} onChange={e => handleScriptFieldChange(key, 'code', e.target.value)} placeholder="await sendTrackedMessage(sock, remoteJid, 'Hello!');" className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500 font-mono text-[11px] resize-y" />
                      </label>
                      {key === 'summoner' && (
                        <div className="border border-emerald-500/15 rounded p-2 space-y-2">
                          <div className="text-slate-500 uppercase tracking-wider text-[10px]">Named Arguments</div>
                          {['here', 'self'].map(argName => (
                            <div key={argName} className="grid grid-cols-2 gap-2">
                              <label className="block space-y-1">
                                <span className="text-slate-600 text-[10px]">{argName}.target</span>
                                <input value={script.arguments?.[argName]?.target ?? ''} onChange={e => handleScriptArgumentChange(argName, 'target', e.target.value)} className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500" />
                              </label>
                              <label className="block space-y-1">
                                <span className="text-slate-600 text-[10px]">{argName}.response</span>
                                <input value={script.arguments?.[argName]?.response ?? ''} onChange={e => handleScriptArgumentChange(argName, 'response', e.target.value)} placeholder="optional" className="w-full bg-slate-900 border border-emerald-500/20 p-1.5 text-emerald-400 outline-none focus:border-emerald-500 placeholder:text-emerald-900" />
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      {!isCore && (
                        <button onClick={() => handleDeleteScript(key)} className="flex items-center gap-1 text-red-500 hover:text-red-400 border border-red-500/30 hover:border-red-400/50 px-2 py-1 rounded text-[10px] transition-colors">
                          <Trash2 className="w-3 h-3" /> Delete Script
                        </button>
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
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);

  const handleSignOut = () => {
    auth.signOut();
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
  const [newScriptKey, setNewScriptKey] = useState('');
  const [newScriptDraft, setNewScriptDraft] = useState<BotScript>({
    name: '', desc: '', trigger: '', response: '', target: 'chat', code: '', defaultArgument: ''
  });

  const wsRef = useRef<WebSocket | null>(null);

  // Check auth & fetch user data
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (!user) {
        navigate('/login');
      } else {
        // Verify username matched params (skip full check for speed but robust enough)
        getDoc(doc(db, 'users', username || '')).then(snap => {
          if (snap.exists() && snap.data().uid === user.uid) {
            setUserData(snap.data());
            setIsAuthenticated(true);
          } else if (username === 'user') { // Generic fallback
             setUserData({ name: user.email, username: username });
             setIsAuthenticated(true);
          } else {
            navigate('/login');
          }
        });
      }
    });
    return unsub;
  }, [username, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      const wsUrl = window.location.hostname === 'localhost' ? 'ws://localhost:4000' : 'wss://wxata.onrender.com';
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
  const handleScriptFieldChange = (scriptKey: string, field: keyof BotScript, value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        [scriptKey]: { ...prev.scripts[scriptKey]!, [field]: value }
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

  const handleMarketplaceInstall = (ext: MarketplaceExtension) => {
    const key = ext.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        [key]: {
          name: ext.name,
          desc: ext.description || `Installed: ${ext.name}`,
          trigger: ext.trigger,
          response: ext.response || '',
          code: ext.code || '',
          target: 'chat',
          defaultArgument: 'self'
        }
      }
    }));
    setConfigStatus(`"${ext.name}" added — remember to Save Config`);
  };

  const handleAddScript = () => {
    const key = newScriptKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key || botInfo.scripts[key]) return;
    setBotInfo((prev) => ({
      ...prev,
      scripts: { ...prev.scripts, [key]: { ...newScriptDraft, name: newScriptDraft.name || key } }
    }));
    setNewScriptKey('');
    setNewScriptDraft({ name: '', desc: '', trigger: '', response: '', target: 'chat', code: '', defaultArgument: '' });
    setAddingScript(false);
    setExpandedScript(key);
    setConfigStatus('Unsaved changes');
  };

  // Legacy handlers kept for the summoner-specific argument UI
  const handleScriptChange = (field: keyof BotScript, value: string) => handleScriptFieldChange('summoner', field, value);

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

  const handleDefaultArgumentChange = (value: string) => handleScriptFieldChange('summoner', 'defaultArgument', value);

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <Activity className="text-emerald-400 w-8 h-8 animate-pulse" />
          <h2 className="text-emerald-400 text-lg tracking-widest">AUTHENTICATING...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-emerald-400 font-mono p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-emerald-500/20 pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tighter">WXATA_DASHBOARD v1.0.0</h1>
          {userData && <span className="ml-4 text-sm text-emerald-400/50">Welcome, {userData.name || userData.username}</span>}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${status.connection === 'CONNECTED' ? 'animate-pulse text-emerald-300' : 'text-red-500'}`} />
            <span>SYSTEM: {status.connection}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400">ENCRYPTION: ACTIVE</span>
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
                className="bg-slate-800 border border-emerald-500/30 rounded p-6 overflow-hidden"
              >
                <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                  {/* QR Method */}
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-4 bg-slate-900 border border-emerald-500/20 rounded-xl">
                      {qrData ? (
                        <div className="p-2 bg-white rounded">
                          <QRCodeSVG value={qrData} size={150} />
                        </div>
                      ) : (
                        <div className="w-[150px] h-[150px] flex items-center justify-center border border-dashed border-emerald-500/20">
                          {isConnecting && authMethod === 'QR' ? <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" /> : <QrCode className="w-12 h-12 text-emerald-700" />}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => startConnection('QR')}
                      disabled={isConnecting}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 text-black px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
                    >
                      <Wifi className="w-4 h-4" /> Link via QR
                    </button>
                  </div>

                  <div className="hidden md:block h-32 w-px bg-green-500/10" />

                  {/* Phone Method */}
                  <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                    {pairingCode ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs uppercase text-slate-400">Pairing Code</span>
                        <div className="text-4xl font-mono font-black tracking-widest text-emerald-300 bg-slate-900 px-6 py-3 border border-emerald-500/30 rounded">
                          {pairingCode}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 w-full">
                        <input 
                          type="text" 
                          placeholder="Phone (e.g. 551199999999)"
                          className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 text-center font-mono focus:border-emerald-500 outline-none placeholder:text-emerald-700/50"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                        <button 
                          onClick={() => startConnection('PHONE')}
                          disabled={isConnecting || !phoneNumber}
                          className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-emerald-500 hover:bg-emerald-500/10 disabled:border-gray-800 disabled:text-gray-800 text-emerald-400 px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
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
          <div className="flex-1 bg-slate-900 border border-emerald-500/20 rounded p-4 flex flex-col gap-4 overflow-hidden min-h-[300px]">
          <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
            <span className="text-xs uppercase tracking-widest opacity-50">Real-time System Logs</span>
            <span className="text-[10px] text-emerald-700">BAILEYS_SOCKET_STREAM</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm font-mono custom-scrollbar">
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="hover:bg-emerald-500/5 p-1 rounded"
              >
                {log}
              </motion.div>
            ))}
            {logs.length === 0 && <div className="text-emerald-700 opacity-30 text-center mt-20 italic">Waiting for backend data...</div>}
          </div>
        </div>
        </div>

        {/* Status Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Bot Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Connection</span>
                <span className={status.connection === 'CONNECTED' ? 'text-emerald-300' : 'text-red-500'}>{status.connection}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Uptime</span>
                <span>{status.uptime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Memory</span>
                <span>{status.memory}</span>
              </div>
            </div>
          </div>

          {/* ── Global Config ── */}
          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-3 text-xs">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Global Config</h3>
            <label className="block space-y-1">
              <span className="text-slate-400 uppercase tracking-wider">Command Prefix</span>
              <input type="text" value={botInfo.prefix} onChange={(e) => handlePrefixChange(e.currentTarget.value)} className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500" />
            </label>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-500/10">
              <span className="text-[10px] text-emerald-700 uppercase tracking-wider">{configStatus || 'Ready'}</span>
              <button onClick={saveBotInfo} className="border border-emerald-500/30 bg-green-900/20 hover:bg-emerald-500/10 px-4 py-2 text-sm font-bold transition-colors shadow-[0_0_10px_rgba(34,197,94,0.1)]">SAVE CONFIG</button>
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
            newScriptKey={newScriptKey}
            setNewScriptKey={setNewScriptKey}
            newScriptDraft={newScriptDraft}
            setNewScriptDraft={setNewScriptDraft}
            handleScriptFieldChange={handleScriptFieldChange}
            handleScriptArgumentChange={handleScriptArgumentChange}
            handleDeleteScript={handleDeleteScript}
            handleAddScript={handleAddScript}
            navigate={navigate}
          />

          {/* ── Mini Marketplace ── */}
          <MiniMarketplace
            installedKeys={Object.keys(botInfo.scripts)}
            onInstall={handleMarketplaceInstall}
            navigate={navigate}
          />

          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Welcome On Connect</h3>
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between gap-3 border border-emerald-500/20 p-2 rounded">
                <span className="text-slate-400 uppercase tracking-wider">Enabled</span>
                <input
                  type="checkbox"
                  checked={botInfo.welcome.enabled}
                  onChange={(e) => handleWelcomeChange('enabled', e.currentTarget.checked)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Welcome text</span>
                <textarea
                  value={botInfo.welcome.text}
                  onChange={(e) => handleWelcomeChange('text', e.currentTarget.value)}
                  rows={5}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500 font-mono whitespace-pre-wrap"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Root target (self or phone number)</span>
                <input
                  type="text"
                  value={botInfo.root.target}
                  onChange={(e) => handleRootChange(e.currentTarget.value)}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
          </div>

          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleQuickAction('RESTART_BOT')}
                className="border border-emerald-500/30 hover:bg-emerald-500/10 p-2 text-xs transition-colors"
              >
                RESTART BOT
              </button>
              <button 
                onClick={() => handleQuickAction('TERMINATE')}
                className="border border-red-500/30 text-red-500 hover:bg-red-500/10 p-2 text-xs transition-colors"
              >
                TERMINATE
              </button>
              <button 
                onClick={() => handleQuickAction('CLEAR_LOGS')}
                className="border border-emerald-500/30 hover:bg-emerald-500/10 p-2 text-xs transition-colors"
              >
                CLEAR LOGS
              </button>
              <button 
                onClick={() => handleQuickAction('EXPORT_DATA')}
                className="border border-primary/30 hover:bg-primary/10 p-2 text-xs transition-colors"
              >
                EXPORT DATA
              </button>
              <button
                onClick={handleSignOut}
                className="border border-red-500/50 hover:bg-red-500/20 text-red-500 p-2 text-xs transition-colors flex items-center justify-center gap-2 mt-4 w-full"
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
