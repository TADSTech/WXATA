import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Shield, Activity, QrCode, Phone, Wifi, RefreshCw,
  LogOut, ChevronDown, ChevronUp, Plus, Trash2, Edit3, Save, X,
  Package, Download, ExternalLink, Palette, BookOpen, GripVertical
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

// ─── ScriptManager ────────────────────────────────────────────────────────────

interface ScriptManagerProps {
  botInfo: BotInfo;
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
  onReorder: (newOrder: string[]) => void;
}

function ScriptManager({
  botInfo, expandedScript, setExpandedScript,
  addingScript, setAddingScript,
  newScriptDraft, setNewScriptDraft,
  handleScriptFieldChange, handleScriptArgumentChange,
  handleDeleteScript, handleAddScript, handlePublishScript,
  onReorder
}: ScriptManagerProps) {
  const prefix = botInfo.prefix;
  const scriptKeys = Object.keys(botInfo.scripts);
  const dragKey = useRef<string | null>(null);

  const handleDragStart = (key: string) => {
    dragKey.current = key;
  };

  const handleDragOver = (e: React.DragEvent, _key: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = dragKey.current;
    if (!sourceKey || sourceKey === targetKey) return;

    const keys = [...scriptKeys];
    const fromIdx = keys.indexOf(sourceKey);
    const toIdx = keys.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;

    keys.splice(fromIdx, 1);
    keys.splice(toIdx, 0, sourceKey);
    onReorder(keys);
    dragKey.current = null;
  };

  return (
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-3">
      <div className="flex justify-between items-center border-b border-border-strong/10 pb-2">
        <h3 className="text-xs uppercase tracking-widest opacity-50">Scripts ({scriptKeys.length})</h3>
        <button
          onClick={() => { setAddingScript(true); setExpandedScript(null); }}
          className="flex items-center gap-1 text-xs text-accent-light hover:text-accent-light border border-border-strong px-2 py-1 rounded"
        >
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
                  <span className="text-text-muted">Trigger *</span>
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
                <button
                  onClick={handleAddScript}
                  disabled={!newScriptDraft.trigger.trim()}
                  className="flex items-center gap-1 bg-accent-primary hover:bg-accent-hover disabled:opacity-40 text-bg-base px-3 py-1.5 rounded font-bold text-xs"
                >
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

      {/* Script list with drag-reorder */}
      <div className="space-y-1">
        {scriptKeys.map(key => {
          const script = botInfo.scripts[key]!;
          const isExpanded = expandedScript === key;
          const isCore = script.type === 'core';
          return (
            <div
              key={key}
              draggable
              onDragStart={() => handleDragStart(key)}
              onDragOver={e => handleDragOver(e, key)}
              onDrop={e => handleDrop(e, key)}
              className="border border-border-strong/15 rounded overflow-hidden"
            >
              <div className="w-full flex items-center hover:bg-accent-subtle transition-colors">
                {/* Drag handle */}
                <div className="px-2 py-2.5 cursor-grab active:cursor-grabbing text-text-muted hover:text-accent-light shrink-0" title="Drag to reorder">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
                {/* Expand/collapse toggle */}
                <button
                  onClick={() => setExpandedScript(isExpanded ? null : key)}
                  className="flex-1 flex items-center justify-between p-2.5 text-left min-w-0"
                >
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
              </div>

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
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Trigger</span>
                          <input value={script.trigger} onChange={e => handleScriptFieldChange(key, 'trigger', e.target.value)} className="w-full bg-bg-panel border border-border-subtle p-1.5 text-accent-light outline-none focus:border-border-strong" />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-text-muted uppercase tracking-wider text-[10px]">Aliases (comma separated)</span>
                          <input
                            value={script.aliases?.join(', ') || ''}
                            onChange={e => handleScriptFieldChange(key, 'aliases' as keyof BotScript, e.target.value)}
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

// ─── PermissionsEditor ────────────────────────────────────────────────────────

interface PermissionsEditorProps {
  permissions: BotPermissions;
  onChange: (p: BotPermissions) => void;
  onSave: () => void;
}

function PermissionsEditor({ permissions, onChange, onSave }: PermissionsEditorProps) {
  const [newChat, setNewChat] = useState('');
  const [newNumber, setNewNumber] = useState('');

  const addChat = () => {
    const v = newChat.trim();
    if (!v || permissions.chats.includes(v)) return;
    onChange({ ...permissions, chats: [...permissions.chats, v] });
    setNewChat('');
  };

  const removeChat = (c: string) => {
    onChange({ ...permissions, chats: permissions.chats.filter(x => x !== c) });
  };

  const addNumber = () => {
    const v = newNumber.trim();
    if (!v || permissions.numbers.includes(v)) return;
    onChange({ ...permissions, numbers: [...permissions.numbers, v] });
    setNewNumber('');
  };

  const removeNumber = (n: string) => {
    onChange({ ...permissions, numbers: permissions.numbers.filter(x => x !== n) });
  };

  return (
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-4 text-xs">
      <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Permissions</h3>

      {/* allowAll toggle */}
      <label className="flex items-center justify-between gap-3 border border-border-subtle p-2 rounded cursor-pointer">
        <span className="text-text-muted uppercase tracking-wider">Allow All Chats</span>
        <input
          type="checkbox"
          checked={permissions.allowAll}
          onChange={e => onChange({ ...permissions, allowAll: e.target.checked })}
          className="w-4 h-4 accent-accent-primary"
        />
      </label>

      {/* Chats list */}
      <div className="space-y-2">
        <span className="text-text-muted uppercase tracking-wider">Allowed Chats</span>
        <div className="flex gap-1">
          <input
            value={newChat}
            onChange={e => setNewChat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addChat()}
            placeholder="chat-id or group JID"
            className="flex-1 bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong"
          />
          <button onClick={addChat} className="border border-border-strong px-2 py-1 hover:bg-accent-subtle transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
          {permissions.chats.map(c => (
            <div key={c} className="flex items-center justify-between gap-2 border border-border-strong/10 px-2 py-1 rounded">
              <span className="font-mono text-[10px] text-text-main truncate">{c}</span>
              <button onClick={() => removeChat(c)} className="text-danger-text hover:text-danger-base shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {permissions.chats.length === 0 && <div className="text-text-muted italic text-[10px]">No chats added</div>}
        </div>
      </div>

      {/* Numbers list */}
      <div className="space-y-2">
        <span className="text-text-muted uppercase tracking-wider">Allowed Numbers</span>
        <div className="flex gap-1">
          <input
            value={newNumber}
            onChange={e => setNewNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNumber()}
            placeholder="e.g. 551199999999"
            className="flex-1 bg-bg-panel border border-border-strong p-1.5 text-accent-light outline-none focus:border-border-strong"
          />
          <button onClick={addNumber} className="border border-border-strong px-2 py-1 hover:bg-accent-subtle transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
          {permissions.numbers.map(n => (
            <div key={n} className="flex items-center justify-between gap-2 border border-border-strong/10 px-2 py-1 rounded">
              <span className="font-mono text-[10px] text-text-main">{n}</span>
              <button onClick={() => removeNumber(n)} className="text-danger-text hover:text-danger-base shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {permissions.numbers.length === 0 && <div className="text-text-muted italic text-[10px]">No numbers added</div>}
        </div>
      </div>

      <button
        onClick={onSave}
        className="w-full border border-border-strong bg-success-subtle text-accent-light hover:bg-accent-subtle px-4 py-2 text-xs font-bold transition-colors"
      >
        <Save className="w-3 h-3 inline mr-1" /> Save Permissions
      </button>
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

// ─── TVCommandsReference ──────────────────────────────────────────────────────

function TVCommandsReference({ prefix }: { prefix: string }) {
  return (
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-3">
      <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Root TV Commands</h3>
      <div className="space-y-2">
        <div className="border border-border-strong/10 rounded p-2.5 bg-bg-panel-hover">
          <div className="text-xs font-bold text-accent-light mb-1"><code>{prefix}vcf</code></div>
          <p className="text-[10px] text-text-muted">Generates and sends a .vcf file containing all intercepted TV contacts. Each contact is prefixed with TTV.</p>
        </div>
        <div className="border border-border-strong/10 rounded p-2.5 bg-bg-panel-hover">
          <div className="text-xs font-bold text-accent-light mb-1"><code>{prefix}vcf clear</code></div>
          <p className="text-[10px] text-text-muted">Wipes the internally saved list of TV contacts. (Make sure you've generated your VCF first!)</p>
        </div>
      </div>
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
  const [applyStickers, setApplyStickers] = useState(true);

  const handleFetch = async () => {
    if (!url) return;
    setFetching(true);
    setError('');
    try {
      const backendUrlApi = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:5000').replace('ws://', 'http://').replace('wss://', 'https://');
      const res = await fetch(`${backendUrlApi}/api/twitter/grab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setTweetData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleSchedule = async () => {
    if (!tweetData || !scheduledTime) return;
    setScheduling(true);
    try {
      const postAt = new Date(scheduledTime).getTime();
      const backendUrlApi = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:5000').replace('ws://', 'http://').replace('wss://', 'https://');
      const res = await fetch(`${backendUrlApi}/api/twitter/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postAt,
          text: tweetData.text,
          imageUrls: tweetData.imageUrls,
          applyStickers
        })
      });
      if (!res.ok) throw new Error('Failed to schedule');
      alert("Tweet scheduled successfully!");
      setTweetData(null);
      setUrl('');
      setScheduledTime('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-3">
      <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        X (Twitter) Grabber
      </h3>
      
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Paste Tweet URL..." 
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="flex-1 bg-bg-panel border border-border-strong p-2 text-text-main outline-none text-xs"
        />
        <button 
          onClick={handleFetch} 
          disabled={fetching}
          className="border border-border-strong bg-accent-subtle hover:bg-accent-hover text-accent-light px-3 py-1 text-xs"
        >
          {fetching ? 'Fetching...' : 'Grab'}
        </button>
      </div>
      
      {error && <div className="text-danger-text text-[10px]">{error}</div>}

      {tweetData && (
        <div className="border border-border-strong/30 p-3 rounded space-y-3 mt-2">
          <textarea 
            value={tweetData.text} 
            onChange={e => setTweetData({ ...tweetData, text: e.target.value })}
            className="w-full bg-bg-base border border-border-strong p-2 text-text-main text-xs h-24"
          />
          {tweetData.imageUrls.length > 0 && (
            <div className="text-[10px] text-text-muted">
              Found {tweetData.imageUrls.length} image(s).
            </div>
          )}
          
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={applyStickers} onChange={e => setApplyStickers(e.target.checked)} />
            Apply Stickers to images
          </label>
          
          <div className="flex gap-2 mt-2">
            <input 
              type="datetime-local" 
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="bg-bg-panel border border-border-strong p-1 text-xs flex-1 text-text-main"
            />
            <button 
              onClick={handleSchedule}
              disabled={scheduling || !scheduledTime}
              className="border border-border-strong bg-success-subtle text-accent-light px-3 py-1 text-xs"
            >
              {scheduling ? 'Scheduling...' : 'Schedule Status'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WelcomeEditor ────────────────────────────────────────────────────────────

interface WelcomeEditorProps {
  welcome: BotWelcome;
  root: BotRoot;
  onChange: (w: BotWelcome) => void;
  onRootChange: (v: string) => void;
  onSave: () => void;
}

function WelcomeEditor({ welcome, root, onChange, onRootChange, onSave }: WelcomeEditorProps) {
  return (
    <div className="bg-bg-panel border border-border-subtle rounded p-4 space-y-4 text-xs">
      <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-border-strong/10 pb-2">Welcome On Connect</h3>

      <label className="flex items-center justify-between gap-3 border border-border-subtle p-2 rounded cursor-pointer">
        <span className="text-text-muted uppercase tracking-wider">Enabled</span>
        <input
          type="checkbox"
          checked={welcome.enabled}
          onChange={e => onChange({ ...welcome, enabled: e.target.checked })}
          className="w-4 h-4 accent-accent-primary"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-text-muted uppercase tracking-wider">Welcome Text</span>
        <textarea
          value={welcome.text}
          onChange={e => onChange({ ...welcome, text: e.target.value })}
          rows={5}
          className="w-full bg-bg-panel border border-border-strong p-2 text-text-main outline-none focus:border-accent-primary font-mono whitespace-pre-wrap transition-colors"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-text-muted uppercase tracking-wider">Root Target (self or phone number)</span>
        <input
          type="text"
          value={root.target}
          onChange={e => onRootChange(e.target.value)}
          className="w-full bg-bg-panel border border-border-strong p-2 text-text-main outline-none focus:border-accent-primary transition-colors"
        />
      </label>

      <button
        onClick={onSave}
        className="w-full border border-border-strong bg-success-subtle text-accent-light hover:bg-accent-subtle px-4 py-2 text-xs font-bold transition-colors"
      >
        <Save className="w-3 h-3 inline mr-1" /> Save Welcome Config
      </button>
    </div>
  );
}

// ─── MiniMarketplace ──────────────────────────────────────────────────────────

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
          .eq('status', 'approved')
          .order('downloads', { ascending: false });
        if (error) throw error;
        const list: MarketplaceExtension[] = (data || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          description: row.description as string,
          trigger: row.trigger as string,
          aliases: row.aliases as string[] | undefined,
          type: row.type as string | undefined,
          target: row.target as string | undefined,
          response: row.response as string,
          code: row.code as string | undefined,
          defaultArgument: row.default_argument as string | undefined,
          downloads: row.downloads as number,
          untrusted: row.untrusted as boolean | undefined,
          disabled: row.disabled as boolean | undefined,
          author: row.author as string,
          authorUid: row.author_uid as string,
        }));
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
                    {ext.untrusted && (
                      <span className="text-[9px] text-warning-text border border-warning-subtle bg-warning-subtle px-1 rounded flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> Untrusted
                      </span>
                    )}
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
                        : 'border-border-strong/40 text-accent-light hover:bg-accent-subtle disabled:opacity-50'
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
        <Palette className="w-4 h-4" />
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

const Dashboard = () => {
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
  const [selectedAccountId, setSelectedAccountId] = useState<'primary' | 'secondary'>('primary');
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

  // ── Script editor state ─────────────────────────────────────────────────────
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [addingScript, setAddingScript] = useState(false);
  const [newScriptDraft, setNewScriptDraft] = useState<BotScript>({
    name: '', desc: '', trigger: '', aliases: [], type: 'misc', response: '', target: 'chat', code: '', defaultArgument: '',
  });

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

  // ── Send GET_BOT_INFO on connect & account switch ─────────────────────────────
  useEffect(() => {
    if (isAuthenticated && wsStatus === 'connected') {
      setLogs([]);
      setQrData(null);
      setPairingCode(null);
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
  }, [lastMessage, addToast, selectedAccountId]);

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

  const handleScriptFieldChange = (scriptKey: string, field: keyof BotScript, value: string) => {
    let finalValue: unknown = value;
    if (field === 'aliases' && typeof value === 'string') {
      finalValue = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    setBotInfo(prev => ({
      ...prev,
      scripts: { ...prev.scripts, [scriptKey]: { ...prev.scripts[scriptKey]!, [field]: finalValue } },
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleScriptArgumentChange = (argumentName: string, field: keyof BotScriptArgument, value: string) => {
    setBotInfo(prev => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        summoner: {
          ...prev.scripts.summoner!,
          arguments: {
            ...prev.scripts.summoner?.arguments,
            [argumentName]: { ...prev.scripts.summoner?.arguments?.[argumentName], [field]: value },
          },
        },
      },
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleDeleteScript = (scriptKey: string) => {
    const next = { ...botInfo.scripts };
    delete next[scriptKey];
    setBotInfo(prev => ({ ...prev, scripts: next }));
    setExpandedScript(null);
    setConfigStatus('Unsaved changes');
  };

  const handleAddScript = () => {
    const key = newScriptDraft.trigger.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key || botInfo.scripts[key]) return;
    setBotInfo(prev => ({
      ...prev,
      scripts: { ...prev.scripts, [key]: { ...newScriptDraft, name: newScriptDraft.name || key } },
    }));
    setNewScriptDraft({ name: '', desc: '', trigger: '', aliases: [], type: 'misc', response: '', target: 'chat', code: '', defaultArgument: '' });
    setAddingScript(false);
    setExpandedScript(key);
    setConfigStatus('Unsaved changes');
  };

  const handleScriptReorder = (newOrder: string[]) => {
    const reordered: Record<string, BotScript> = {};
    for (const k of newOrder) {
      if (botInfo.scripts[k]) reordered[k] = botInfo.scripts[k]!;
    }
    const updated = { ...botInfo, scripts: reordered };
    setBotInfo(updated);
    send({ command: 'UPDATE_BOT_INFO', data: updated });
  };

  const handlePublishScript = async (_key: string, script: BotScript) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { addToast('Must be logged in to publish', 'error'); return; }
    if (!script.name || !script.desc) { addToast('Add a name and description first', 'error'); return; }
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
          downloads: 0,
        });
        if (error) throw error;
        addToast('Extension submitted for review', 'success');
      } catch (err: unknown) {
        addToast('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
      }
    }
  };

  const handleMarketplaceInstall = (ext: MarketplaceExtension) => {
    const key = ext.trigger.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || ext.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    setBotInfo(prev => ({
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
        },
      },
    }));
    setConfigStatus(`"${ext.name}" added — remember to Save Config`);
  };

  const saveBotInfo = () => {
    if (wsStatus !== 'connected') { addToast('Not connected', 'error'); return; }
    send({ command: 'UPDATE_BOT_INFO', data: botInfo });
    setConfigStatus('Saving...');
    addToast('Config saved', 'success');
  };

  const handlePermissionsSave = () => {
    if (wsStatus !== 'connected') { addToast('Not connected', 'error'); return; }
    send({ command: 'UPDATE_BOT_INFO', data: botInfo });
    addToast('Saved', 'success');
  };

  const handleWelcomeSave = () => {
    if (wsStatus !== 'connected') { addToast('Not connected', 'error'); return; }
    send({ command: 'UPDATE_BOT_INFO', data: botInfo });
    addToast('Saved', 'success');
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
    <div className="text-text-main font-mono p-6 flex flex-col gap-6">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="flex justify-between items-center border-b border-border-subtle pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tighter text-text-main">WXATA_DASHBOARD v1.0.0</h1>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">

        {/* Left/Middle: Connection & Logs */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">

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
        <div className="flex flex-col gap-6">

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
                    setBotInfo(prev => ({ ...prev, tvMode: e.target.checked }));
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

          {botInfo.tvMode ? (
            <>
              <TVConfigEditor
                tvConfig={botInfo.tvConfig}
                onChange={c => { setBotInfo(prev => ({ ...prev, tvConfig: c })); setConfigStatus('Unsaved changes'); }}
                onSave={saveBotInfo}
              />
              <TVCommandsReference prefix={botInfo.prefix} />
              <TwitterGrabber />
            </>
          ) : (
            <>
              {/* Script Manager */}
              <ScriptManager
                botInfo={botInfo}
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
                onReorder={handleScriptReorder}
              />

              {/* Permissions Editor */}
              <PermissionsEditor
                permissions={botInfo.permissions}
                onChange={p => { setBotInfo(prev => ({ ...prev, permissions: p })); setConfigStatus('Unsaved changes'); }}
                onSave={handlePermissionsSave}
              />

              {/* Welcome Editor */}
              <WelcomeEditor
                welcome={botInfo.welcome}
                root={botInfo.root}
                onChange={w => { setBotInfo(prev => ({ ...prev, welcome: w })); setConfigStatus('Unsaved changes'); }}
                onRootChange={v => { setBotInfo(prev => ({ ...prev, root: { ...prev.root, target: v } })); setConfigStatus('Unsaved changes'); }}
                onSave={handleWelcomeSave}
              />

              {/* Mini Marketplace */}
              <MiniMarketplace
                installedKeys={Object.keys(botInfo.scripts)}
                onInstall={handleMarketplaceInstall}
                navigate={navigate}
              />
            </>
          )}

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
    </div>
  );
};

export default Dashboard;
