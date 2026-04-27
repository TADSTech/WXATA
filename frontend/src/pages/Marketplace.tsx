import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Download, ArrowLeft, PlusCircle, ShieldAlert, Edit2, Search, Code2, BookOpen, X, ChevronDown, ChevronUp, Zap, Copy, Check } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface Extension {
  id: string;
  name: string;
  description: string;
  trigger: string;
  aliases: string[];
  type: string;
  target: string;
  response: string;
  code?: string;
  defaultArgument?: string;
  author: string;
  authorUid: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  downloads: number;
  tags?: string[];
  version?: string;
  untrusted?: boolean;
  disabled?: boolean;
}

const TYPES = ['tools', 'admin', 'group', 'fun', 'misc', 'core'];
const TYPE_COLORS: Record<string, string> = {
  core: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  tools: 'text-green-400 bg-green-400/10 border-green-400/30',
  admin: 'text-red-400 bg-red-400/10 border-red-400/30',
  group: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  fun: 'text-pink-400 bg-pink-400/10 border-pink-400/30',
  misc: 'text-text-muted bg-bg-panel-hover border-border-strong',
};

const TEMPLATES: { label: string; icon: string; code: string }[] = [
  {
    label: 'Echo',
    icon: '💬',
    code: `if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !{trigger} <text>');
await sendTrackedMessage(sock, remoteJid, argumentName);`,
  },
  {
    label: 'HTTP API',
    icon: '🌐',
    code: `const axios = require('axios');
if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !{trigger} <query>');
await sendTrackedMessage(sock, remoteJid, '🔍 Fetching...');
try {
  const res = await axios.get(\`https://api.example.com?q=\${encodeURIComponent(argumentName)}\`);
  await sendTrackedMessage(sock, remoteJid, \`Result: \${res.data}\`);
} catch (e) {
  await sendTrackedMessage(sock, remoteJid, '❌ Request failed.');
}`,
  },
  {
    label: 'Group Only',
    icon: '👥',
    code: `if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, '❌ This command can only be used in groups.');
const meta = await sock.groupMetadata(remoteJid);
// meta.participants → array of { id, admin }
await sendTrackedMessage(sock, remoteJid, \`Group: \${meta.subject} (\${meta.participants.length} members)\`);`,
  },
  {
    label: 'Admin Check',
    icon: '🛡️',
    code: `if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, '❌ Groups only.');
const meta = await sock.groupMetadata(remoteJid);
const senderJid = msg.key.participant || msg.key.remoteJid;
const isAdmin = meta.participants.find(p => p.id === senderJid)?.admin;
if (!isAdmin && !msg.key.fromMe) return sendTrackedMessage(sock, remoteJid, '❌ Admins only.');
// Admin-only logic below
await sendTrackedMessage(sock, remoteJid, '✅ Admin action executed.');`,
  },
  {
    label: 'Config File',
    icon: '⚙️',
    code: `const fs = require('fs');
const path = require('path');
const configFile = path.resolve(__rootdir, '{trigger}.json');
let config = { enabled: true, value: 'default' };
if (fs.existsSync(configFile)) {
  try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch(e) {}
}
const arg = argumentName?.trim().toLowerCase() || '';
if (arg.startsWith('set ')) {
  config.value = arg.slice(4).trim();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  return sendTrackedMessage(sock, remoteJid, \`✅ Value set to: \${config.value}\`);
}
await sendTrackedMessage(sock, remoteJid, \`Current value: \${config.value}\`);`,
  },
  {
    label: 'Reply to Quote',
    icon: '💭',
    code: `const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
if (!contextInfo?.quotedMessage) return sendTrackedMessage(sock, remoteJid, '⚠️ Reply to a message to use this.');
const quotedText = contextInfo.quotedMessage?.conversation
  || contextInfo.quotedMessage?.extendedTextMessage?.text
  || '(media)';
const quotedSender = contextInfo.participant;
await sendTrackedMessage(sock, remoteJid, \`You quoted @\${quotedSender?.split('@')[0]}: "\${quotedText}"\`);`,
  },
  {
    label: 'Send Image',
    icon: '🖼️',
    code: `if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !{trigger} <url>');
let url = argumentName.trim();
if (!url.startsWith('http')) url = 'https://' + url;
try {
  await sock.sendMessage(remoteJid, { image: { url }, caption: \`📸 \${url}\` });
} catch (e) {
  await sendTrackedMessage(sock, remoteJid, '❌ Failed to send image.');
}`,
  },
  {
    label: 'Tag All',
    icon: '📢',
    code: `if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, '❌ Groups only.');
const meta = await sock.groupMetadata(remoteJid);
const header = argumentName ? \`📢 *\${argumentName}*\n\n\` : \`✨ *ATTENTION* ✨\n\n\`;
let text = header;
const mentions = [];
for (const p of meta.participants) {
  text += \`@\${p.id.split('@')[0]} \`;
  mentions.push(p.id);
}
await sock.sendMessage(remoteJid, { text, mentions });`,
  },
];

const CONTEXT_VARS = [
  { name: 'sock', type: 'WASocket', desc: 'Baileys socket — send messages, get group info, kick users, etc.', example: "await sock.sendMessage(remoteJid, { text: 'Hello!' });" },
  { name: 'msg', type: 'WAMessage', desc: 'Full incoming message object with key, message, pushName.', example: "msg.key.fromMe // true if sent by bot\nmsg.pushName   // sender display name" },
  { name: 'remoteJid', type: 'string', desc: 'Chat JID where command was triggered. Already resolved from @lid.', example: "remoteJid.endsWith('@g.us') // true if group" },
  { name: 'argumentName', type: 'string | undefined', desc: 'Everything the user typed after the trigger word.', example: "// !weather Lagos → argumentName = 'Lagos'\nconst arg = argumentName?.trim() || '';" },
  { name: 'sendTrackedMessage', type: 'function', desc: 'Send text + log to dashboard. Prevents echo loops.', example: "await sendTrackedMessage(sock, remoteJid, 'Hello!');" },
  { name: 'botInfo', type: 'BotInfo', desc: 'Current bot config: prefix, scripts, permissions, root.', example: "botInfo.prefix // '!'\nbotInfo.permissions.numbers" },
  { name: 'dashboard', type: 'DashboardServer', desc: 'Log to dashboard UI.', example: "dashboard.log('INFO', 'Plugin started');" },
  { name: 'require', type: 'function', desc: 'Node.js require. Use for axios, fs, path, os, baileys, etc.', example: "const axios = require('axios');\nconst fs = require('fs');" },
  { name: '__rootdir', type: 'string', desc: 'Path to persistent data directory. Store config files here.', example: "const p = path.resolve(__rootdir, 'myplugin.json');" },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="bg-bg-base border border-border-strong rounded p-3 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">{code}</pre>
      <button onClick={copy} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-panel-hover border border-border-strong rounded p-1">
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-text-muted" />}
      </button>
    </div>
  );
}

// ── Browse Tab ────────────────────────────────────────────────────────────────
function BrowseTab({ user, navigate }: { user: any; navigate: (p: string, o?: any) => void }) {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sort, setSort] = useState<'downloads' | 'newest'>('downloads');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'extensions'), where('status', '==', 'approved'));
        const snap = await getDocs(q);
        const list: Extension[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as Extension));
        setExtensions(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = extensions
    .filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.trigger.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q));
      const matchType = filterType === 'all' || e.type === filterType;
      return matchSearch && matchType;
    })
    .sort((a, b) => sort === 'downloads' ? (b.downloads || 0) - (a.downloads || 0) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleInstall = async (ext: Extension) => {
    if (!user) { navigate('/login'); return; }
    setInstalling(ext.id);
    try {
      await updateDoc(doc(db, 'extensions', ext.id), { downloads: (ext.downloads || 0) + 1 });
      setInstalled(prev => new Set([...prev, ext.id]));
      const username = user.email?.split('@')[0] || 'user';
      navigate(`/dashboard/${username}`, { state: { installExtension: ext } });
    } catch (e) { console.error(e); }
    finally { setInstalling(null); }
  };

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plugins..." className="w-full bg-bg-panel border border-border-strong pl-9 pr-3 py-2 text-sm text-text-main outline-none focus:border-accent-primary rounded" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="bg-bg-panel border border-border-strong text-text-muted text-sm px-3 py-2 outline-none rounded">
          <option value="downloads">Most Downloaded</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      <div className="flex gap-2 flex-wrap">
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${filterType === t ? 'bg-accent-primary border-accent-primary text-white' : 'bg-bg-panel border-border-strong text-text-muted hover:border-accent-primary'}`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-text-muted py-16">Loading plugins...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-text-muted py-16">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No plugins found. Be the first to publish one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ext => (
            <motion.div key={ext.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-bg-panel border border-border-strong hover:border-accent-primary/50 transition-colors rounded-lg p-5 flex flex-col">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-accent-light text-sm leading-tight">{ext.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${TYPE_COLORS[ext.type] || TYPE_COLORS.misc}`}>{ext.type || 'misc'}</span>
                </div>
                <p className="text-xs text-text-muted mb-3 line-clamp-2">{ext.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="text-[10px] font-mono bg-bg-base border border-border-strong px-2 py-0.5 rounded text-accent-light">!{ext.trigger}</span>
                  {ext.aliases?.map(a => <span key={a} className="text-[10px] font-mono bg-bg-base border border-border-subtle px-2 py-0.5 rounded text-text-muted">!{a}</span>)}
                </div>
                {ext.tags && ext.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {ext.tags.map(t => <span key={t} className="text-[10px] bg-accent-subtle text-accent-light px-2 py-0.5 rounded">#{t}</span>)}
                  </div>
                )}
                {ext.code && <div className="flex items-center gap-1 text-[10px] text-green-400 mb-2"><Code2 className="w-3 h-3" /> Custom JS</div>}
                <div className="flex justify-between items-center text-[10px] text-text-muted">
                  <span>by {ext.author}</span>
                  <div className="flex items-center gap-2">
                    {ext.untrusted && <span className="flex items-center gap-1 text-orange-400"><ShieldAlert className="w-3 h-3" /> UNTRUSTED</span>}
                    <span>{ext.downloads || 0} installs</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border-subtle flex gap-2">
                <button onClick={() => handleInstall(ext)} disabled={!!ext.disabled || installing === ext.id || installed.has(ext.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold transition-colors border ${ext.disabled ? 'opacity-40 cursor-not-allowed border-border-subtle text-text-muted' : installed.has(ext.id) ? 'border-green-500/50 text-green-400 bg-green-400/10' : 'border-accent-primary/50 text-accent-light hover:bg-accent-subtle'}`}>
                  {installed.has(ext.id) ? <><Check className="w-3 h-3" /> Installed</> : installing === ext.id ? 'Installing...' : <><Download className="w-3 h-3" /> {user ? 'Install' : 'Login to Install'}</>}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Build Tab ─────────────────────────────────────────────────────────────────
function BuildTab({ user, onPublished }: { user: any; onPublished: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [trigger, setTrigger] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [type, setType] = useState('misc');
  const [target, setTarget] = useState('chat');
  const [defaultArg, setDefaultArg] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [response, setResponse] = useState('');
  const [code, setCode] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [showContext, setShowContext] = useState(false);

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setCode(tpl.code.replace(/\{trigger\}/g, trigger || 'cmd'));
  };

  const addAlias = () => {
    const v = aliasInput.trim().toLowerCase().replace(/\s+/g, '');
    if (v && !aliases.includes(v)) setAliases(prev => [...prev, v]);
    setAliasInput('');
  };

  const addTag = () => {
    const v = tagInput.trim().toLowerCase();
    if (v && !tags.includes(v)) setTags(prev => [...prev, v]);
    setTagInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setStatusMsg('You must be logged in.'); setStatus('error'); return; }
    if (!trigger.trim() || !name.trim()) { setStatusMsg('Name and trigger are required.'); setStatus('error'); return; }
    setStatus('submitting');
    try {
      const payload = { name, description: desc, trigger: trigger.trim().toLowerCase(), aliases, type, target, response, code, defaultArgument: defaultArg, tags, version: '1.0.0', author: user.email?.split('@')[0] || 'Unknown', authorUid: user.uid, status: 'pending', createdAt: new Date().toISOString(), downloads: 0 };
      if (editingId) {
        await updateDoc(doc(db, 'extensions', editingId), { ...payload, status: 'pending' });
        setStatusMsg('Updated! Awaiting re-approval.');
      } else {
        await addDoc(collection(db, 'extensions'), payload);
        setStatusMsg('Submitted for review! It will appear in the marketplace once approved.');
      }
      setStatus('success');
      setName(''); setDesc(''); setTrigger(''); setAliases([]); setType('misc'); setTarget('chat'); setDefaultArg(''); setTags([]); setResponse(''); setCode(''); setEditingId(null);
      onPublished();
    } catch (err: any) {
      setStatusMsg('Error: ' + err.message);
      setStatus('error');
    }
  };

  // Preview card
  const preview = { name: name || 'My Plugin', description: desc || 'Plugin description', trigger: trigger || 'cmd', aliases, type, code, tags };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form — 3 cols */}
      <div className="lg:col-span-3 space-y-4">
        <h2 className="text-sm font-bold text-accent-light uppercase tracking-widest">Plugin Builder</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Display Name *</span>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Weather Bot" className="w-full bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Trigger * (no prefix)</span>
              <input value={trigger} onChange={e => setTrigger(e.target.value.toLowerCase().replace(/\s/g, ''))} required placeholder="weather" className="w-full bg-bg-base border border-border-strong p-2 text-sm text-accent-light font-mono outline-none focus:border-accent-primary rounded" />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-text-muted">Description</span>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="What does this plugin do?" className="w-full bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded resize-none" />
          </label>

          {/* Aliases */}
          <div className="space-y-1">
            <span className="text-xs text-text-muted">Aliases</span>
            <div className="flex gap-2">
              <input value={aliasInput} onChange={e => setAliasInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addAlias(); }}} placeholder="Add alias, press Enter" className="flex-1 bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded" />
              <button type="button" onClick={addAlias} className="px-3 py-2 bg-bg-panel-hover border border-border-strong rounded text-xs text-text-muted hover:text-text-main">Add</button>
            </div>
            {aliases.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{aliases.map(a => <span key={a} className="flex items-center gap-1 text-xs bg-accent-subtle text-accent-light px-2 py-0.5 rounded border border-accent-primary/30">!{a}<button type="button" onClick={() => setAliases(p => p.filter(x => x !== a))}><X className="w-3 h-3" /></button></span>)}</div>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Type</span>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Target</span>
              <select value={target} onChange={e => setTarget(e.target.value)} className="w-full bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded">
                <option value="chat">chat</option>
                <option value="self">self</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-text-muted">Default Arg</span>
              <input value={defaultArg} onChange={e => setDefaultArg(e.target.value)} placeholder="self" className="w-full bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded" />
            </label>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <span className="text-xs text-text-muted">Tags</span>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }}} placeholder="Add tag, press Enter" className="flex-1 bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded" />
              <button type="button" onClick={addTag} className="px-3 py-2 bg-bg-panel-hover border border-border-strong rounded text-xs text-text-muted hover:text-text-main">Add</button>
            </div>
            {tags.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{tags.map(t => <span key={t} className="flex items-center gap-1 text-xs bg-bg-panel-hover text-text-muted px-2 py-0.5 rounded border border-border-strong">#{t}<button type="button" onClick={() => setTags(p => p.filter(x => x !== t))}><X className="w-3 h-3" /></button></span>)}</div>}
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-text-muted">Static Response (optional if JS code is used)</span>
            <input value={response} onChange={e => setResponse(e.target.value)} placeholder="Leave empty if using JS code below" className="w-full bg-bg-base border border-border-strong p-2 text-sm text-text-main outline-none focus:border-accent-primary rounded" />
          </label>

          {/* Templates */}
          <div className="space-y-2">
            <span className="text-xs text-text-muted">Quick Templates</span>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map(tpl => (
                <button key={tpl.label} type="button" onClick={() => applyTemplate(tpl)} className="flex items-center gap-1 text-xs bg-bg-panel-hover hover:bg-accent-subtle border border-border-strong hover:border-accent-primary/50 text-text-muted hover:text-accent-light px-2 py-1 rounded transition-colors">
                  <span>{tpl.icon}</span> {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Code editor */}
          <label className="block space-y-1">
            <span className="text-xs text-text-muted">JavaScript Code</span>
            <textarea value={code} onChange={e => setCode(e.target.value)} rows={12} placeholder="// Your plugin code here&#10;// All context variables are pre-injected: sock, msg, remoteJid, argumentName, sendTrackedMessage, botInfo, dashboard, require, __rootdir&#10;&#10;await sendTrackedMessage(sock, remoteJid, 'Hello!');" className="w-full bg-bg-base border border-border-strong p-3 text-sm text-green-400 font-mono outline-none focus:border-accent-primary rounded resize-y" spellCheck={false} />
          </label>

          {/* Context reference toggle */}
          <button type="button" onClick={() => setShowContext(p => !p)} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-main transition-colors">
            {showContext ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Execution Context Reference
          </button>
          <AnimatePresence>
            {showContext && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-bg-base border border-border-strong rounded p-3 space-y-2">
                  {CONTEXT_VARS.map(v => (
                    <div key={v.name} className="text-xs">
                      <span className="text-accent-light font-mono">{v.name}</span>
                      <span className="text-text-muted"> : {v.type} — {v.desc}</span>
                      <pre className="text-green-400 font-mono text-[10px] mt-0.5 opacity-70">{v.example}</pre>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={status === 'submitting' || !user} className="w-full bg-accent-primary hover:bg-accent-hover disabled:opacity-40 text-white font-bold py-2.5 rounded text-sm transition-colors">
            {status === 'submitting' ? 'Submitting...' : editingId ? 'Update & Resubmit' : 'Submit for Review'}
          </button>

          {status !== 'idle' && status !== 'submitting' && (
            <div className={`p-3 rounded text-xs text-center border ${status === 'success' ? 'bg-green-400/10 border-green-400/30 text-green-400' : 'bg-red-400/10 border-red-400/30 text-red-400'}`}>
              {statusMsg}
            </div>
          )}
          {!user && <p className="text-xs text-text-muted text-center">You must be logged in to publish plugins.</p>}
        </form>
      </div>

      {/* Preview — 2 cols */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-sm font-bold text-accent-light uppercase tracking-widest">Live Preview</h2>
        {/* Marketplace card preview */}
        <div className="bg-bg-panel border border-border-strong rounded-lg p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-bold text-accent-light text-sm">{preview.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${TYPE_COLORS[preview.type] || TYPE_COLORS.misc}`}>{preview.type}</span>
          </div>
          <p className="text-xs text-text-muted mb-3">{preview.description || 'No description yet.'}</p>
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="text-[10px] font-mono bg-bg-base border border-border-strong px-2 py-0.5 rounded text-accent-light">!{preview.trigger}</span>
            {preview.aliases.map(a => <span key={a} className="text-[10px] font-mono bg-bg-base border border-border-subtle px-2 py-0.5 rounded text-text-muted">!{a}</span>)}
          </div>
          {preview.tags.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{preview.tags.map(t => <span key={t} className="text-[10px] bg-accent-subtle text-accent-light px-2 py-0.5 rounded">#{t}</span>)}</div>}
          {preview.code && <div className="flex items-center gap-1 text-[10px] text-green-400"><Code2 className="w-3 h-3" /> Custom JS</div>}
        </div>

        {/* WhatsApp message preview */}
        <div className="bg-bg-panel border border-border-strong rounded-lg p-4 space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-widest">WhatsApp Preview</p>
          <div className="bg-[#1a2a1a] rounded-lg p-3 text-xs font-mono text-green-300 border border-green-900/30">
            <div className="text-green-500 text-[10px] mb-1">You → !{preview.trigger || 'cmd'}</div>
            <div className="text-green-200">
              {preview.code ? '⚡ Runs custom JavaScript code' : (response || '(no response set)')}
            </div>
          </div>
        </div>

        {/* JSON export */}
        <div className="space-y-1">
          <p className="text-xs text-text-muted uppercase tracking-widest">Plugin JSON</p>
          <CodeBlock code={JSON.stringify({ name: preview.name, desc: preview.description, trigger: preview.trigger, aliases: preview.aliases, type: preview.type, target, response, code: code || undefined, defaultArgument: defaultArg || undefined, tags: preview.tags.length ? preview.tags : undefined }, null, 2)} />
        </div>
      </div>
    </div>
  );
}

// ── Docs Tab ──────────────────────────────────────────────────────────────────
function DocsTab() {
  const [openSection, setOpenSection] = useState<string | null>('context');
  const toggle = (s: string) => setOpenSection(p => p === s ? null : s);

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border border-border-strong rounded overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-4 py-3 bg-bg-panel hover:bg-bg-panel-hover text-sm font-bold text-text-main transition-colors">
        {title}
        {openSection === id ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>
      <AnimatePresence>
        {openSection === id && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 py-4 bg-bg-base space-y-3 text-sm text-text-muted">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-3">
      <Section id="what" title="What is a Plugin?">
        <p>A WXATA plugin is a JavaScript snippet that runs inside the bot when a user sends a specific command in WhatsApp. Plugins are stored in <code className="text-accent-light bg-bg-panel px-1 rounded">botinfo.json</code> and can be installed from the Marketplace or built in the Dashboard.</p>
        <p>Each plugin has a <strong className="text-text-main">trigger</strong> (the command word), optional <strong className="text-text-main">aliases</strong>, and either a static <strong className="text-text-main">response</strong> or a JavaScript <strong className="text-text-main">code</strong> block that runs with full access to the WhatsApp socket.</p>
      </Section>

      <Section id="schema" title="Plugin Schema">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="border-b border-border-strong">{['Field','Required','Description'].map(h => <th key={h} className="text-left py-2 pr-4 text-text-main font-bold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border-subtle">
              {[
                ['trigger','✅','Command word. User types !trigger to run it.'],
                ['response','✅','Static text. Can be empty string if code is used.'],
                ['target','✅','"chat" sends to current chat. "self" sends to your DM.'],
                ['name','recommended','Display name in menus.'],
                ['desc','recommended','Description shown in !mn detailed and !hp.'],
                ['aliases','optional','Extra triggers. e.g. ["weather", "w"]'],
                ['type','optional','Category: core | tools | admin | group | fun | misc'],
                ['code','optional','JavaScript code. Overrides response if present.'],
                ['defaultArgument','optional','Used when user runs command with no argument.'],
                ['arguments','optional','Named argument overrides for target/response.'],
              ].map(([f,r,d]) => (
                <tr key={f as string}><td className="py-1.5 pr-4 font-mono text-accent-light">{f}</td><td className="py-1.5 pr-4">{r}</td><td className="py-1.5">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="context" title="Execution Context — Injected Variables">
        <p className="text-xs mb-3">These variables are automatically available in your plugin code. You do not need to declare them.</p>
        <div className="space-y-3">
          {CONTEXT_VARS.map(v => (
            <div key={v.name} className="bg-bg-panel border border-border-strong rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-accent-light text-xs">{v.name}</span>
                <span className="text-[10px] text-text-muted bg-bg-base px-1.5 py-0.5 rounded border border-border-subtle">{v.type}</span>
              </div>
              <p className="text-xs text-text-muted mb-2">{v.desc}</p>
              <CodeBlock code={v.example} />
            </div>
          ))}
        </div>
      </Section>

      <Section id="templates" title="Code Templates">
        <div className="space-y-4">
          {TEMPLATES.map(tpl => (
            <div key={tpl.label}>
              <p className="text-xs font-bold text-text-main mb-1">{tpl.icon} {tpl.label}</p>
              <CodeBlock code={tpl.code} />
            </div>
          ))}
        </div>
      </Section>

      <Section id="rules" title="Rules & Best Practices">
        <ul className="space-y-1.5 text-xs list-none">
          {[
            ['Always handle missing arguments','Check if (!argumentName) and return usage instructions.'],
            ['Wrap API calls in try/catch','Network requests can fail. Always send an error message.'],
            ['Use sendTrackedMessage for text','It logs to dashboard and prevents echo loops.'],
            ['Use sock.sendMessage for media','Images, videos, stickers, reactions.'],
            ['Don\'t block the event loop','Use await for all async operations.'],
            ['Config files go in __rootdir','Use path.resolve(__rootdir, \'myplugin.json\').'],
            ['Check group context','Use remoteJid.endsWith(\'@g.us\') before group operations.'],
            ['Respect permissions','Check msg.key.fromMe or botInfo.permissions for sensitive actions.'],
          ].map(([title, desc]) => (
            <li key={title as string} className="flex gap-2"><span className="text-accent-light shrink-0">→</span><span><strong className="text-text-main">{title}</strong> — {desc}</span></li>
          ))}
        </ul>
      </Section>

      <Section id="ai" title="For AI Agents">
        <p className="text-xs mb-3">If you are an AI agent generating a WXATA plugin, follow these rules:</p>
        <ul className="space-y-1 text-xs list-none mb-4">
          {[
            'Output a valid JSON object matching the Plugin Schema above.',
            'The code field must be a single JavaScript string — no outer function wrapper. The code runs as the body of an async function.',
            'All variables in the Execution Context are pre-injected — do not declare them.',
            'Use await for all async operations.',
            'Always include error handling with try/catch for network calls.',
            'The require function is available for: axios, @whiskeysockets/baileys, wa-sticker-formatter, fs, path, os.',
          ].map((r, i) => <li key={i} className="flex gap-2"><span className="text-accent-light">{i+1}.</span>{r}</li>)}
        </ul>
        <p className="text-xs font-bold text-text-main mb-2">Example AI Prompt:</p>
        <CodeBlock code={`"Create a WXATA plugin that fetches a random joke from JokeAPI. Trigger: joke. Aliases: jk. Type: fun."`} />
        <p className="text-xs font-bold text-text-main mt-3 mb-2">Expected Output:</p>
        <CodeBlock code={JSON.stringify({name:"Random Joke",desc:"Fetch a random joke from JokeAPI",trigger:"joke",aliases:["jk"],type:"fun",target:"chat",response:"",code:`const axios = require('axios');\nawait sendTrackedMessage(sock, remoteJid, '😂 Fetching a joke...');\ntry {\n  const res = await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=single');\n  await sendTrackedMessage(sock, remoteJid, \`😂 \${res.data.joke}\`);\n} catch (e) {\n  await sendTrackedMessage(sock, remoteJid, '❌ Failed to fetch joke.');\n}`},null,2)} />
      </Section>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Marketplace() {
  const [tab, setTab] = useState<'browse' | 'build' | 'docs'>('browse');
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUser(u));
    return unsub;
  }, []);

  const tabs = [
    { id: 'browse', label: 'Browse', icon: Package },
    { id: 'build', label: 'Build', icon: Code2 },
    { id: 'docs', label: 'Docs', icon: BookOpen },
  ] as const;

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-mono">
      {/* Header */}
      <div className="border-b border-border-strong bg-bg-panel">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-text-muted hover:text-text-main transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-light" />
              <span className="font-bold text-accent-light tracking-tight">WXATA Plugin Marketplace</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <span className="text-xs text-text-muted">{user.email?.split('@')[0]}</span>
            ) : (
              <button onClick={() => navigate('/login')} className="text-xs bg-accent-primary hover:bg-accent-hover text-white px-3 py-1.5 rounded font-bold transition-colors">Login to Publish</button>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${tab === id ? 'border-accent-primary text-accent-light' : 'border-transparent text-text-muted hover:text-text-main'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {tab === 'browse' && <BrowseTab user={user} navigate={navigate} />}
            {tab === 'build' && <BuildTab user={user} onPublished={() => setTab('browse')} />}
            {tab === 'docs' && <DocsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
