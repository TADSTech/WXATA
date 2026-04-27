import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight, Menu, X, ExternalLink, Copy, Check, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// ── Markdown source files embedded as strings ─────────────────────────────────
// We embed them here so they work on Vercel without a file server.

const DOC_OVERVIEW = `# WXATA Documentation

Welcome to the official documentation for **WXATA** — the WhatsApp Automation & Tactical Assistant.

WXATA is built on Baileys and Bun, designed for high-performance automation and a premium user experience. Connect your WhatsApp account, install plugins from the Marketplace, and automate anything.

---

## Quick Links

- [Getting Started](#getting-started) — Install and run WXATA locally
- [Command System](#commands) — All built-in commands
- [Plugin Development](/docs?page=plugins) — Build your own plugins
- [Deployment Guide](/docs?page=deployment) — Deploy to Oracle Cloud
- [Marketplace](/extensions) — Browse community plugins

---

## Architecture

\`\`\`
Frontend (Vercel / React)
  └── WebSocket ──► Backend (Bun + Baileys)
                        └── WhatsApp Protocol
                        └── SQLite (message cache)
                        └── botinfo.json (scripts + config)
                        └── Firestore (marketplace, auth)
\`\`\`

The frontend dashboard connects to the backend over a persistent WebSocket. All bot configuration, logs, and QR codes flow through this connection in real time.

---

## Getting Started

### Local Development

\`\`\`bash
# 1. Clone
git clone https://github.com/TADSTech/WXATA.git
cd WXATA

# 2. Seed config
cp botinfo.example.json botinfo.json

# 3. Install deps
bun run install:all

# 4. Run everything
bun run all
# Frontend → http://localhost:5173
# Backend  → ws://localhost:5000
\`\`\`

### Connecting Your WhatsApp

1. Open the dashboard at \`http://localhost:5173\`
2. Log in or register
3. Click **Connect via QR** or **Connect via Phone**
4. Scan the QR code or enter the pairing code on your phone

---

## Command System

Commands are prefix-based (default: \`!\`). Each command has a primary trigger and optional aliases.

| Trigger | Aliases | Type | Description |
|---------|---------|------|-------------|
| \`mn\` | menu, m | core | Show system menu |
| \`hp\` | help, h | core | Help for a command |
| \`pg\` | ping, p | core | Check bot latency |
| \`dc\` | docs | core | Documentation link |
| \`pm\` | perm | admin | Manage permissions |
| \`ex\` | extract | tools | Extract view-once media |
| \`sv\` | save | tools | Save quoted media |
| \`st\` | sticker | tools | Make a sticker |
| \`qc\` | quote | tools | Quote sticker |
| \`dl\` | delete | tools | Delete a message |
| \`ss\` | screenshot | tools | Screenshot a URL |
| \`ta\` | tagall | group | Tag all members |
| \`tk\` | tkick | admin | Kick + re-add in 5m |
| \`wn\` | warn | admin | Warn user (3x = kick) |
| \`ad\` | antidel | tools | Anti-delete toggle |
| \`vs\` | vars | admin | View/set system vars |

### Using Commands

\`\`\`
!mn              → show menu
!mn detailed     → show menu with descriptions
!hp st           → help for sticker command
!ta              → tag everyone
!ta admins       → tag admins only
!ta Meeting now  → tag everyone with custom message
!vs              → show system variables
!vs set WARN_MESSAGE You have been warned ({count}/3)
\`\`\`

---

## Permission System

WXATA uses a 3-tier permission model:

1. **Root (Sudo)** — configured in \`botinfo.json → root.target\`. Full access to all commands.
2. **Allowed Numbers** — specific phone numbers that can use the bot anywhere.
3. **Allowed Chats** — specific group or DM JIDs where the bot responds to everyone.

### Managing Permissions

\`\`\`
!pm chat          → allow everyone in current chat
!pm all           → allow everyone everywhere (⚠️ risky)
!pm +2341234567   → allow a specific number
!pm revoke chat   → revoke current chat
!pm revoke all    → revoke global access
\`\`\`

---

## System Variables

Use \`!vs\` to view and set configurable variables:

| Variable | Default | Description |
|----------|---------|-------------|
| \`WARN_MESSAGE\` | \`⚠️ You have been warned! ({count}/3)\` | Warning message template |
| \`TAGALL_MESSAGE\` | \`✨ *ATTENTION EVERYONE* ✨\` | Default tagall header |
| \`TAGADMINS_MESSAGE\` | \`👑 *ATTENTION ADMINS* 👑\` | Tagall admins header |
| \`DB_RETENTION_DAYS\` | \`3\` | Message cache retention |

\`\`\`
!vs set WARN_MESSAGE ⚠️ Warning {count}/3 for @{user}
!vs reset WARN_MESSAGE
\`\`\`
`;

const DOC_PLUGINS = `# Plugin Development

> Build custom WhatsApp bot commands with JavaScript. No restart required.

---

## What is a Plugin?

A plugin is a JavaScript snippet that runs when a user sends a specific command. Plugins are stored in \`botinfo.json\` and can be installed from the Marketplace or built in the Dashboard.

---

## Plugin Schema

\`\`\`json
{
  "name": "Display name shown in !menu",
  "desc": "Short description for !mn detailed",
  "trigger": "command word (no prefix)",
  "aliases": ["alt1", "alt2"],
  "type": "core | tools | admin | group | fun | misc",
  "target": "chat | self",
  "response": "Static text (leave empty if using code)",
  "defaultArgument": "default arg if none provided",
  "code": "JavaScript code string"
}
\`\`\`

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| \`trigger\` | ✅ | Command word. User types \`!trigger\` |
| \`response\` | ✅ | Static text. Empty string \`""\` if using code |
| \`target\` | ✅ | \`"chat"\` or \`"self"\` |
| \`name\` | recommended | Display name in menus |
| \`desc\` | recommended | Shown in \`!mn detailed\` |
| \`aliases\` | optional | Extra triggers |
| \`type\` | optional | Category for menu grouping |
| \`code\` | optional | JS code — overrides response |
| \`defaultArgument\` | optional | Used when no arg provided |

---

## Execution Context

These variables are **automatically injected** into your plugin code. Do not declare them.

### \`sock\` — WhatsApp Socket

\`\`\`js
// Send text
await sock.sendMessage(remoteJid, { text: 'Hello!' });

// Send image from URL
await sock.sendMessage(remoteJid, { image: { url: 'https://...' }, caption: 'Caption' });

// Get group info
const meta = await sock.groupMetadata(remoteJid);
// meta.participants → [{ id: '234...@s.whatsapp.net', admin: 'admin' | null }]

// Tag members
await sock.sendMessage(remoteJid, {
  text: '@234... hello',
  mentions: ['234...@s.whatsapp.net']
});

// React to message
await sock.sendMessage(remoteJid, { react: { text: '👍', key: msg.key } });

// Kick from group
await sock.groupParticipantsUpdate(remoteJid, ['234...@s.whatsapp.net'], 'remove');
\`\`\`

### \`msg\` — Message Object

\`\`\`js
msg.key.remoteJid      // Chat JID
msg.key.fromMe         // true if sent by bot
msg.key.participant    // Sender JID in groups
msg.pushName           // Sender display name

// Quoted message
const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
\`\`\`

### \`remoteJid\` — Chat ID

\`\`\`js
remoteJid.endsWith('@g.us')           // true = group
remoteJid.endsWith('@s.whatsapp.net') // true = DM
\`\`\`

### \`argumentName\` — Command Argument

\`\`\`js
// User types: !weather Lagos
argumentName  // → "Lagos"

// User types: !ta Hello everyone
argumentName  // → "Hello everyone"

// Safe usage
const arg = argumentName?.trim() || '';
\`\`\`

### \`sendTrackedMessage(sock, jid, text)\`

Sends text and logs to dashboard. Use this instead of \`sock.sendMessage\` for text.

\`\`\`js
await sendTrackedMessage(sock, remoteJid, 'Hello!');
\`\`\`

### \`botInfo\` — Bot Config

\`\`\`js
botInfo.prefix              // "!"
botInfo.scripts             // all installed scripts
botInfo.permissions.numbers // allowed numbers
\`\`\`

### \`require\` — Node.js Require

\`\`\`js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
\`\`\`

### \`__rootdir\` — Data Directory

\`\`\`js
const configPath = path.resolve(__rootdir, 'myplugin.json');
\`\`\`

---

## Templates

### Echo
\`\`\`js
if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !echo <text>');
await sendTrackedMessage(sock, remoteJid, argumentName);
\`\`\`

### HTTP API Call
\`\`\`js
const axios = require('axios');
if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !weather <city>');
await sendTrackedMessage(sock, remoteJid, '🔍 Fetching...');
try {
  const res = await axios.get(\`https://wttr.in/\${encodeURIComponent(argumentName)}?format=3\`);
  await sendTrackedMessage(sock, remoteJid, \`🌤️ \${res.data}\`);
} catch (e) {
  await sendTrackedMessage(sock, remoteJid, '❌ Failed to fetch weather.');
}
\`\`\`

### Admin Check
\`\`\`js
if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, '❌ Groups only.');
const meta = await sock.groupMetadata(remoteJid);
const senderJid = msg.key.participant || msg.key.remoteJid;
const isAdmin = meta.participants.find(p => p.id === senderJid)?.admin;
if (!isAdmin && !msg.key.fromMe) return sendTrackedMessage(sock, remoteJid, '❌ Admins only.');
await sendTrackedMessage(sock, remoteJid, '✅ Done.');
\`\`\`

### Persistent Config
\`\`\`js
const fs = require('fs');
const path = require('path');
const configFile = path.resolve(__rootdir, 'myplugin.json');
let config = { value: 'default' };
if (fs.existsSync(configFile)) {
  try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch(e) {}
}
const arg = argumentName?.trim().toLowerCase() || '';
if (arg.startsWith('set ')) {
  config.value = arg.slice(4).trim();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  return sendTrackedMessage(sock, remoteJid, \`✅ Set to: \${config.value}\`);
}
await sendTrackedMessage(sock, remoteJid, \`Value: \${config.value}\`);
\`\`\`

---

## Best Practices

1. **Handle missing args** — always check \`if (!argumentName)\` and return usage
2. **Wrap API calls** — use try/catch for all network requests
3. **Use sendTrackedMessage for text** — prevents echo loops, logs to dashboard
4. **Use sock.sendMessage for media** — images, videos, stickers, reactions
5. **Config files in __rootdir** — \`path.resolve(__rootdir, 'myplugin.json')\`
6. **Check group context** — \`remoteJid.endsWith('@g.us')\` before group ops

---

## Publishing to Marketplace

1. Build and test in the Dashboard
2. Click **Publish to Marketplace** on the script card
3. Fill in metadata and submit
4. Admin reviews → approved → visible to all users

---

## For AI Agents

If you are an AI generating a WXATA plugin:

1. Output a valid JSON object matching the Plugin Schema
2. The \`code\` field is the body of an async function — no wrapper needed
3. All context variables are pre-injected — do not declare them
4. Use \`await\` for all async operations
5. Always wrap network calls in try/catch
6. Available packages: \`axios\`, \`@whiskeysockets/baileys\`, \`wa-sticker-formatter\`, \`fs\`, \`path\`, \`os\`

**Example prompt:** *"Create a WXATA plugin that fetches a random joke. Trigger: joke. Type: fun."*

**Expected output:**
\`\`\`json
{
  "name": "Random Joke",
  "desc": "Fetch a random joke",
  "trigger": "joke",
  "aliases": ["jk"],
  "type": "fun",
  "target": "chat",
  "response": "",
  "code": "const axios = require('axios');\ntry {\n  const res = await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=single');\n  await sendTrackedMessage(sock, remoteJid, \`😂 \${res.data.joke}\`);\n} catch (e) {\n  await sendTrackedMessage(sock, remoteJid, '❌ Failed.');\n}"
}
\`\`\`
`;

const DOC_DEPLOYMENT = `# Deployment Guide

## Architecture

\`\`\`
Frontend (Vercel)                    Backend (Oracle Cloud VPS)
https://wxata.tadstech.dev  ──WSS──► wss://wxata-api.tadstech.dev
                                      Caddy TLS ✅  Docker + PM2 ✅
\`\`\`

---

## Oracle Cloud Free Tier Setup

Oracle Always Free gives you a real Ubuntu VM (1 OCPU / 6 GB RAM — free forever).

### 1. Create the VM

1. Log in → **Compute → Instances → Create Instance**
2. Image: **Ubuntu 22.04**
3. Shape: \`VM.Standard.A1.Flex\` — 1 OCPU / 6 GB RAM
4. Networking: keep default VCN, enable **Assign public IPv4**
5. Upload your SSH key
6. Note the **Public IP** once running

### 2. Open Firewall Ports

Oracle has two firewall layers — both must be configured.

**Oracle Security List (cloud console):**

| Source CIDR | Protocol | Port | Purpose |
|-------------|----------|------|---------|
| 0.0.0.0/0 | TCP | 22 | SSH |
| 0.0.0.0/0 | TCP | 80 | Caddy ACME challenge |
| 0.0.0.0/0 | TCP | 443 | HTTPS / WSS |
| 0.0.0.0/0 | TCP | 5000 | Backend (optional) |

**OS firewall (iptables):**

\`\`\`bash
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null; \\
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null; \\
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 5000 -j ACCEPT 2>/dev/null; \\
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 5000 -j ACCEPT && \\
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT && \\
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT && \\
sudo netfilter-persistent save
\`\`\`

> Rules must be inserted **before** the default REJECT rule at line 5.

### 3. Install Docker

\`\`\`bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER && newgrp docker
sudo apt install -y docker-compose-plugin
\`\`\`

### 4. Clone and Start

\`\`\`bash
cd ~ && git clone https://github.com/TADSTech/WXATA.git WXATA && cd WXATA
cp backend/.env.example backend/.env
docker compose up -d --build
docker compose logs -f wxata
\`\`\`

### 5. Set Up TLS with Caddy

Browsers block \`ws://\` from HTTPS pages. You need \`wss://\` via a domain + TLS.

**Option A — Own domain:**

\`\`\`bash
# Install Caddy
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/installer.sh' | sudo bash
sudo apt install -y caddy

# Configure
sudo nano /etc/caddy/Caddyfile
# Add:
# wxata-api.yourdomain.com {
#     reverse_proxy localhost:5000
# }

sudo systemctl reload caddy
\`\`\`

**Option B — Free subdomain (DuckDNS):**

1. Go to [duckdns.org](https://www.duckdns.org) → create subdomain → point to your Oracle IP
2. Use \`wxata-yourname.duckdns.org\` as your domain in the Caddyfile

### 6. Update Vercel

In Vercel project settings → Environment Variables:
\`\`\`
VITE_BACKEND_URL=wss://wxata-api.yourdomain.com
\`\`\`

---

## Dashboard Actions & PM2

| Button | Exit Code | PM2 Behaviour |
|--------|-----------|---------------|
| Restart | 0 | PM2 restarts automatically |
| Terminate | 2 | PM2 stops, does NOT restart |
| Logout | 0 | Clears session, PM2 restarts |

---

## Useful Commands

\`\`\`bash
# Docker
docker compose up -d --build   # rebuild and restart
docker compose logs -f wxata   # tail logs
docker compose ps              # status

# PM2 (inside container)
docker compose exec wxata pm2 status
docker compose exec wxata pm2 logs wxata --lines 100

# Update
cd ~/WXATA && git pull && docker compose up -d --build
\`\`\`

---

## Persistent Data

| Data | Docker Volume | Path |
|------|---------------|------|
| WhatsApp session | wxata_auth | /data/auth_info |
| SQLite DB | wxata_db | /data/db |
| Config files | wxata_data | /data |
| PM2 logs | wxata_logs | /app/logs |

\`\`\`bash
# Backup session
docker run --rm -v wxata_auth:/data -v $(pwd):/backup ubuntu \\
  tar czf /backup/auth_backup.tar.gz /data

# Restore
docker run --rm -v wxata_auth:/data -v $(pwd):/backup ubuntu \\
  tar xzf /backup/auth_backup.tar.gz -C /
\`\`\`

---

## Troubleshooting

**Mixed Content / ws:// blocked**
→ Set up Caddy + domain, use \`wss://\` in VITE_BACKEND_URL

**Caddy NXDOMAIN**
→ DNS A record not set or not propagated yet. Check: \`nslookup your.domain.com\`

**Caddy validation error**
→ Port 80 blocked. Check Oracle Security List AND iptables order.

**iptables rules ignored**
→ Rules added after the REJECT rule. Re-run the iptables command above.

**Bot disconnects after a few minutes**
→ Status broadcasts flooding the buffer. Fixed in latest version — update and rebuild.
`;

export { DOC_OVERVIEW, DOC_PLUGINS, DOC_DEPLOYMENT };

// ── Markdown renderer with custom styling ─────────────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code.slice(0, 20));
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-black text-accent-light tracking-tight mb-6 mt-2 pb-3 border-b border-border-strong">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold text-text-main mt-10 mb-4 flex items-center gap-2">
            <span className="text-accent-primary">▸</span> {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-accent-light mt-6 mb-3 uppercase tracking-widest">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-text-muted leading-relaxed mb-4">{children}</p>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-accent-light hover:text-accent-primary underline underline-offset-2 transition-colors" target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="text-text-main font-bold">{children}</strong>
        ),
        code: ({ inline, children }: any) => {
          const code = String(children).replace(/\n$/, '');
          if (inline) {
            return <code className="bg-bg-panel border border-border-strong text-accent-light px-1.5 py-0.5 rounded text-xs font-mono">{code}</code>;
          }
          return (
            <div className="relative group my-4">
              <pre className="bg-bg-base border border-border-strong rounded-lg p-4 overflow-x-auto text-xs font-mono text-green-400 leading-relaxed">
                <code>{code}</code>
              </pre>
              <button
                onClick={() => copyCode(code)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-panel-hover border border-border-strong rounded p-1.5 text-text-muted hover:text-text-main"
              >
                {copied === code.slice(0, 20) ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border-strong">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left py-2 pr-4 text-text-main font-bold text-xs uppercase tracking-wider">{children}</th>
        ),
        td: ({ children }) => (
          <td className="py-2 pr-4 text-text-muted border-b border-border-subtle/30 text-xs">{children}</td>
        ),
        ul: ({ children }) => (
          <ul className="space-y-1.5 mb-4 ml-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="space-y-1.5 mb-4 ml-4 list-decimal list-inside">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm text-text-muted flex gap-2 items-start">
            <span className="text-accent-primary mt-0.5 shrink-0">→</span>
            <span>{children}</span>
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-accent-primary pl-4 my-4 text-text-muted italic text-sm">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border-strong my-8" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────
interface NavItem {
  id: string;
  label: string;
  emoji: string;
  href?: string;
  external?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Getting Started',
    items: [
      { id: 'overview', label: 'Overview', emoji: '🏠' },
      { id: 'deployment', label: 'Deployment', emoji: '🚀' },
    ],
  },
  {
    section: 'Development',
    items: [
      { id: 'plugins', label: 'Plugin Development', emoji: '🔌' },
      { id: 'marketplace', label: 'Marketplace', emoji: '📦', href: '/extensions' },
    ],
  },
  {
    section: 'Resources',
    items: [
      { id: 'telegram', label: 'Telegram Community', emoji: '💬', href: 'https://t.me/+dR5zABepmkNhYjQ0', external: true },
      { id: 'github', label: 'GitHub', emoji: '⚙️', href: 'https://github.com/TADSTech/WXATA', external: true },
    ],
  },
];

const PAGES: Record<string, string> = {
  overview: DOC_OVERVIEW,
  plugins: DOC_PLUGINS,
  deployment: DOC_DEPLOYMENT,
};

// ── Main component ────────────────────────────────────────────────────────────
const Docs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const page = searchParams.get('page') || 'overview';
  const content = PAGES[page] || PAGES.overview;

  const setPage = (id: string) => {
    setSearchParams({ page: id });
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  const Sidebar = () => (
    <nav className="w-64 shrink-0 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-5 h-5 text-accent-primary" />
        <span className="font-bold text-accent-light tracking-tight">WXATA Docs</span>
      </div>
      {NAV.map(({ section, items }) => (
        <div key={section}>
          <p className="text-[10px] uppercase tracking-widest text-text-muted mb-2 px-2">{section}</p>
          <div className="space-y-0.5">
            {items.map(({ id, label, emoji, href, external }) => {
              if (href) {
                return (
                  <a
                    key={id}
                    href={href}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    onClick={!external ? (e) => { e.preventDefault(); navigate(href); } : undefined}
                    className="flex items-center gap-2 px-3 py-2 rounded text-sm text-text-muted hover:text-text-main hover:bg-bg-panel-hover transition-colors"
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                    {external && <ExternalLink className="w-3 h-3 ml-auto opacity-50" />}
                  </a>
                );
              }
              return (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors text-left ${
                    page === id
                      ? 'bg-accent-subtle text-accent-light border border-accent-primary/20'
                      : 'text-text-muted hover:text-text-main hover:bg-bg-panel-hover'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                  {page === id && <ChevronRight className="w-3 h-3 ml-auto text-accent-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-mono">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-bg-panel/90 backdrop-blur border-b border-border-strong">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-text-muted hover:text-text-main transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-text-muted hidden sm:block">
              Docs
              {page !== 'overview' && (
                <>
                  <span className="mx-1 opacity-30">/</span>
                  <span className="text-text-main capitalize">{page}</span>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/TADSTech/WXATA" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-text-main transition-colors hidden sm:flex items-center gap-1">
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
            <button onClick={() => navigate('/extensions')} className="text-xs bg-accent-primary hover:bg-accent-hover text-white px-3 py-1.5 rounded font-bold transition-colors">
              Marketplace
            </button>
            {/* Mobile sidebar toggle */}
            <button onClick={() => setSidebarOpen(p => !p)} className="lg:hidden text-text-muted hover:text-text-main">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Desktop sidebar */}
        <div className="hidden lg:block sticky top-20 self-start">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <div className="absolute inset-0 bg-black/60" />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                className="absolute left-0 top-0 bottom-0 w-72 bg-bg-panel border-r border-border-strong p-6"
                onClick={e => e.stopPropagation()}
              >
                <Sidebar />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 min-w-0 max-w-3xl">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <MarkdownContent content={content} />
          </motion.div>

          {/* Page navigation */}
          <div className="mt-12 pt-6 border-t border-border-strong flex justify-between items-center">
            <div className="text-xs text-text-muted">
              Last updated: April 2026 · <a href="https://github.com/TADSTech/WXATA" target="_blank" rel="noopener noreferrer" className="text-accent-light hover:underline">Edit on GitHub</a>
            </div>
            <div className="flex gap-3">
              {page !== 'overview' && (
                <button onClick={() => setPage('overview')} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-main transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Overview
                </button>
              )}
              {page === 'overview' && (
                <button onClick={() => setPage('plugins')} className="flex items-center gap-1 text-xs text-accent-light hover:text-accent-primary transition-colors">
                  Plugin Dev <ChevronRight className="w-3 h-3" />
                </button>
              )}
              {page === 'plugins' && (
                <button onClick={() => setPage('deployment')} className="flex items-center gap-1 text-xs text-accent-light hover:text-accent-primary transition-colors">
                  Deployment <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;
