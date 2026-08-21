import { Link } from "react-router-dom";

const navSections = [
  { title: "", items: [
    { id: "getting-started", label: "Getting Started" },
    { id: "installation", label: "Installation" },
    { id: "configuration", label: "Configuration" },
    { id: "commands", label: "Commands" },
  ]},
  { title: "Plugin System", items: [
    { id: "plugin-overview", label: "Overview" },
    { id: "plugin-schema", label: "Plugin Schema" },
    { id: "execution-context", label: "Execution Context" },
    { id: "plugin-templates", label: "Templates" },
    { id: "building-plugins", label: "Building Plugins" },
  ]},
  { title: "Marketplace", items: [
    { id: "marketplace-browse", label: "Browsing Plugins" },
    { id: "marketplace-install", label: "Installing Plugins" },
    { id: "marketplace-publish", label: "Publishing Plugins" },
    { id: "marketplace-security", label: "Security Model" },
  ]},
  { title: "Reference", items: [
    { id: "custom-scripts", label: "Custom Scripts" },
    { id: "dashboard", label: "Dashboard" },
    { id: "deployment", label: "Deployment" },
    { id: "api", label: "Developer API" },
    { id: "architecture", label: "Architecture" },
  ]},
];

function Code({ children }: { children: string }) {
  return <pre className="bg-bg-base border border-border-subtle rounded-lg p-4 overflow-x-auto mb-4 text-xs"><code>{children}</code></pre>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div className="bg-bg-panel border-l-3 border-accent-primary p-4 rounded-r-lg mb-6 text-sm">{children}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full border-collapse text-sm">
        <thead><tr>{headers.map(h => <th key={h} className="bg-bg-panel border border-border-subtle px-4 py-2 text-left font-bold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border border-border-subtle px-4 py-2 text-text-muted">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-main">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-bg-panel/80 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-accent-primary">WXATA</Link>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/" className="text-text-muted hover:text-text-main transition-colors">Home</Link>
            <Link to="/docs" className="text-accent-primary font-medium">Docs</Link>
            <Link to="/marketplace" className="text-text-muted hover:text-text-main transition-colors">Marketplace</Link>
            <a href="https://github.com/TADSTech/wxata" target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-main transition-colors">GitHub</a>
          </div>
        </div>
      </nav>

      <div className="flex gap-8 max-w-6xl mx-auto px-4 pt-20 pb-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-20 self-start">
          <h3 className="text-xs uppercase tracking-widest text-text-muted mb-3">Documentation</h3>
          {navSections.map(section => (
            <div key={section.title || "root"} className="mb-4">
              {section.title && <div className="text-[10px] uppercase tracking-widest text-accent-primary font-bold mb-1">{section.title}</div>}
              {section.items.map(item => (
                <a key={item.id} href={`#${item.id}`} className="block py-1 text-text-muted text-sm hover:text-accent-primary transition-colors">{item.label}</a>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 prose-invert max-w-none">
          <Link to="/" className="text-text-muted text-sm hover:text-accent-primary mb-4 inline-block">← Back to Home</Link>
          <h1 className="text-3xl font-bold mb-4">WXATA Documentation</h1>
          <p className="text-text-muted mb-2">Welcome to the official documentation for <strong className="text-text-main">WXATA</strong> — the FOSS WhatsApp Automation & Tactical Assistant.</p>
          <p className="text-text-muted mb-8">WXATA is built on Baileys and Bun, designed for high-performance automation. Connect your WhatsApp account, write custom scripts, install community plugins, and automate anything.</p>

          {/* Getting Started */}
          <h2 id="getting-started" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Getting Started</h2>
          <h3 className="text-lg font-bold mt-6 mb-2">Prerequisites</h3>
          <ul className="list-disc pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li><a href="https://bun.sh" className="text-accent-primary hover:underline">Bun</a> runtime</li>
            <li>Node.js 18+ (for compatibility)</li>
            <li>Git</li>
          </ul>

          {/* Installation */}
          <h2 id="installation" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Installation</h2>
          <Code>{`# Clone the repository
git clone https://github.com/TADSTech/wxata.git
cd wxata

# Run the setup script
# Windows:
.\\setup.ps1

# Linux/Mac:
chmod +x setup.sh
./setup.sh

# Or manually:
cp .env.example .env
cp botinfo.example.json botinfo.json
bun run install:all`}</Code>

          {/* Configuration */}
          <h2 id="configuration" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Configuration</h2>
          <h3 className="text-lg font-bold mt-6 mb-2">.env</h3>
          <Table headers={["Variable", "Default", "Description"]} rows={[
            ["PORT", "5000", "Backend server port"],
            ["DB_RETENTION_DAYS", "3", "Message cache retention"],
            ["VITE_BACKEND_URL", "http://localhost:5000/ws", "WebSocket URL for frontend"],
          ]} />
          <h3 className="text-lg font-bold mt-6 mb-2">botinfo.json</h3>
          <p className="text-text-muted text-sm mb-4">The main bot configuration file. Controls commands, prefix, permissions, and behavior.</p>
          <Code>{`{
  "prefix": "+",
  "scripts": { ... },
  "root": { "target": "self" },
  "welcome": { "enabled": true, "text": "Welcome!" },
  "permissions": { "allowAll": true }
}`}</Code>

          {/* Commands */}
          <h2 id="commands" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Commands</h2>
          <p className="text-text-muted text-sm mb-4">WXATA ships with built-in commands. The prefix is configurable (default: <code className="bg-bg-panel px-1 rounded">+</code>).</p>
          <Table headers={["Command", "Description"]} rows={[
            ["+menu", "Show the bot menu"],
            ["+ping", "Check if bot is alive"],
            ["+help", "List available commands"],
            ["+tagall", "Mention all group members"],
            ["+warn", "Warn a member (3 = kick)"],
            ["+antidel", "Show deleted messages"],
            ["+sticker", "Convert image to sticker"],
            ["+ss <url>", "Screenshot a website"],
            ["+vars", "View/set bot variables"],
            ["+perm", "Manage permissions"],
          ]} />

          {/* Plugin System */}
          <h2 id="plugin-overview" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Plugin System</h2>
          <p className="text-text-muted text-sm mb-4">WXATA's plugin system lets you add custom commands without modifying source code. Plugins are JavaScript snippets stored in <code className="bg-bg-panel px-1 rounded">botinfo.json</code> under the <code className="bg-bg-panel px-1 rounded">scripts</code> key.</p>
          <Callout><p><strong className="text-text-main">Two ways to get plugins:</strong> Write them yourself in the Dashboard, or install from the <Link to="/marketplace" className="text-accent-primary hover:underline">Marketplace</Link>.</p></Callout>
          <h3 className="text-lg font-bold mt-6 mb-2">How Plugins Execute</h3>
          <p className="text-text-muted text-sm mb-2">When a user sends a message matching your trigger (e.g., <code className="bg-bg-panel px-1 rounded">+weather Lagos</code>), the bot:</p>
          <ol className="list-decimal pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li>Matches the message against <code className="bg-bg-panel px-1 rounded">{'{prefix}{trigger}'}</code> or any alias</li>
            <li>Extracts the argument text after the trigger</li>
            <li>Runs your plugin's <code className="bg-bg-panel px-1 rounded">code</code> as an async function with injected context variables</li>
            <li>Sends the response to the configured target (chat or self)</li>
          </ol>

          <h2 id="plugin-schema" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Plugin Schema</h2>
          <p className="text-text-muted text-sm mb-4">Each plugin is a JSON object matching this schema:</p>
          <Code>{`{
  "name": "string — display name shown in +menu",
  "desc": "string — short description",
  "trigger": "string — primary command word",
  "aliases": ["array", "of", "alternative", "triggers"],
  "type": "core | tools | admin | group | fun | misc",
  "target": "chat | self",
  "response": "string — static text response (used if no code)",
  "defaultArgument": "string — default if user provides none",
  "code": "string — JavaScript code",
  "arguments": {
    "argname": {
      "target": "chat | self | +phone",
      "response": "override response for this argument"
    }
  }
}`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2">Field Reference</h3>
          <Table headers={["Field", "Required", "Description"]} rows={[
            ["trigger", "Yes", "The command word. User types +trigger to run it."],
            ["response", "Yes", "Static text response. Can be empty if code is used."],
            ["target", "Yes", '"chat" sends to current chat. "self" sends to your DM.'],
            ["name", "Recommended", "Display name in menus. Defaults to trigger if omitted."],
            ["desc", "Recommended", "Description shown in +menu and +help."],
            ["aliases", "Optional", 'Extra triggers. e.g. ["weather", "w"]'],
            ["type", "Optional", 'Category for menu grouping. Default: "misc"'],
            ["code", "Optional", "JavaScript code. If present, overrides response."],
            ["defaultArgument", "Optional", "Used when user runs command with no argument."],
          ]} />

          <h2 id="execution-context" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Execution Context</h2>
          <p className="text-text-muted text-sm mb-4">When your plugin's <code className="bg-bg-panel px-1 rounded">code</code> runs, these variables are injected automatically:</p>
          <h3 className="text-lg font-bold mt-6 mb-2"><code className="bg-bg-panel px-1 rounded">sock</code> — Baileys WhatsApp Socket</h3>
          <Code>{`// Send a text message
await sock.sendMessage(remoteJid, { text: 'Hello!' });

// Send an image from URL
await sock.sendMessage(remoteJid, { image: { url: 'https://...' }, caption: 'Caption' });

// Get group metadata
const meta = await sock.groupMetadata(remoteJid);

// Tag members with mentions
await sock.sendMessage(remoteJid, { text: '@user hello', mentions: ['user@s.whatsapp.net'] });

// React to a message
await sock.sendMessage(remoteJid, { react: { text: '👍', key: msg.key } });`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2"><code className="bg-bg-panel px-1 rounded">msg</code> — Message Object</h3>
          <Code>{`msg.key.remoteJid      // Chat JID
msg.key.fromMe         // true if sent by bot
msg.key.participant    // Sender JID in groups
msg.pushName           // Sender's display name

// Get quoted message
const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2"><code className="bg-bg-panel px-1 rounded">remoteJid</code> — Chat ID</h3>
          <Code>{`remoteJid                          // e.g. '234...@s.whatsapp.net'
remoteJid.endsWith('@g.us')        // true if group chat
remoteJid.endsWith('@s.whatsapp.net') // true if DM`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2"><code className="bg-bg-panel px-1 rounded">argumentName</code> — Command Argument</h3>
          <Code>{`// User types: +weather Lagos
argumentName  // → "Lagos"

// User types: +weather
argumentName  // → undefined

// Safe usage:
const arg = argumentName?.trim() || '';`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2"><code className="bg-bg-panel px-1 rounded">sendTrackedMessage(sock, jid, text)</code></h3>
          <p className="text-text-muted text-sm mb-2">Sends a text message and logs it to the dashboard. Prevents echo loops.</p>
          <Code>{`await sendTrackedMessage(sock, remoteJid, 'Hello!');`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2"><code className="bg-bg-panel px-1 rounded">require</code> — Node.js Require</h3>
          <Code>{`const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2"><code className="bg-bg-panel px-1 rounded">__rootdir</code> — Data Directory Path</h3>
          <Code>{`const fs = require('fs');
const path = require('path');

// Read/write config files
const configPath = path.resolve(__rootdir, 'myplugin.json');
let config = {};
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));`}</Code>

          <h2 id="plugin-templates" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Plugin Templates</h2>
          <h3 className="text-lg font-bold mt-6 mb-2">Template 1 — Simple Text Response</h3>
          <Code>{`// No code needed — just set the response field:
// response: "Hello! This is my plugin."`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2">Template 2 — Echo with Argument</h3>
          <Code>{`if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: +echo <text>');
await sendTrackedMessage(sock, remoteJid, argumentName);`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2">Template 3 — HTTP API Call</h3>
          <Code>{`const axios = require('axios');
if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: +weather <city>');

await sendTrackedMessage(sock, remoteJid, '🔍 Fetching...');
try {
  const res = await axios.get(\`https://wttr.in/\${encodeURIComponent(argumentName)}?format=3\`);
  await sendTrackedMessage(sock, remoteJid, \`🌤️ \${res.data}\`);
} catch (e) {
  await sendTrackedMessage(sock, remoteJid, '❌ Failed to fetch weather.');
}`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2">Template 4 — Group Only with Admin Check</h3>
          <Code>{`if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, '❌ Groups only.');
const meta = await sock.groupMetadata(remoteJid);
const senderJid = msg.key.participant || msg.key.remoteJid;
const isAdmin = meta.participants.find(p => p.id === senderJid)?.admin;
if (!isAdmin && !msg.key.fromMe) return sendTrackedMessage(sock, remoteJid, '❌ Admins only.');

await sendTrackedMessage(sock, remoteJid, '✅ Admin action executed.');`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2">Template 5 — Persistent Config</h3>
          <Code>{`const fs = require('fs');
const path = require('path');
const configFile = path.resolve(__rootdir, 'myplugin.json');

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

await sendTrackedMessage(sock, remoteJid, \`Current value: \${config.value}\`);`}</Code>

          <h2 id="building-plugins" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Building Plugins</h2>
          <h3 className="text-lg font-bold mt-6 mb-2">Step-by-Step</h3>
          <ol className="list-decimal pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li><strong className="text-text-main">Choose a trigger word</strong> — Short, memorable, unique. e.g. <code className="bg-bg-panel px-1 rounded">weather</code>, <code className="bg-bg-panel px-1 rounded">joke</code>, <code className="bg-bg-panel px-1 rounded">qr</code></li>
            <li><strong className="text-text-main">Write the code</strong> — Use the execution context variables. Always handle missing arguments.</li>
            <li><strong className="text-text-main">Test in Dashboard</strong> — Go to Scripts → New Script, paste your code, save, and test.</li>
            <li><strong className="text-text-main">Package as .json</strong> — Create a JSON file with the plugin schema fields.</li>
            <li><strong className="text-text-main">Publish to Marketplace</strong> — Register, login, and publish your plugin.</li>
          </ol>
          <Callout>
            <p className="text-text-muted"><strong className="text-text-main">Best Practices:</strong></p>
            <ul className="list-disc pl-5 text-text-muted mt-2 space-y-1 text-sm">
              <li>Always handle missing arguments with <code className="bg-bg-panel px-1 rounded">if (!argumentName)</code></li>
              <li>Wrap API calls in <code className="bg-bg-panel px-1 rounded">try/catch</code></li>
              <li>Use <code className="bg-bg-panel px-1 rounded">sendTrackedMessage</code> for text, <code className="bg-bg-panel px-1 rounded">sock.sendMessage</code> for media</li>
              <li>Store persistent data in <code className="bg-bg-panel px-1 rounded">__rootdir</code> using JSON files</li>
              <li>Check group context with <code className="bg-bg-panel px-1 rounded">remoteJid.endsWith('@g.us')</code></li>
            </ul>
          </Callout>

          {/* Marketplace */}
          <h2 id="marketplace-browse" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Browsing Plugins</h2>
          <p className="text-text-muted text-sm mb-4">The <Link to="/marketplace" className="text-accent-primary hover:underline">WXATA Marketplace</Link> is a community-driven plugin repository. Browse plugins by category, search by name or trigger, and filter by author.</p>
          <ul className="list-disc pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li><strong className="text-text-main">Categories:</strong> Tools, Fun, Core, Admin, Group, Misc</li>
            <li><strong className="text-text-main">Sort by:</strong> Most Popular, Newest, A-Z</li>
            <li><strong className="text-text-main">Search:</strong> By plugin name, description, or trigger word</li>
            <li><strong className="text-text-main">Filter:</strong> By author username</li>
          </ul>
          <h2 id="marketplace-install" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Installing Plugins</h2>
          <h3 className="text-lg font-bold mt-6 mb-2">Download & Import</h3>
          <ol className="list-decimal pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li>Find a plugin on the <Link to="/marketplace" className="text-accent-primary hover:underline">Marketplace</Link></li>
            <li>Click <strong className="text-text-main">"Download Plugin"</strong> — saves a <code className="bg-bg-panel px-1 rounded">.json</code> file</li>
            <li>Open your WXATA Dashboard → Scripts tab</li>
            <li>Click <strong className="text-text-main">"Import"</strong> → select the <code className="bg-bg-panel px-1 rounded">.json</code> file</li>
            <li>The plugin is merged into your <code className="bg-bg-panel px-1 rounded">botinfo.json</code> and is live immediately</li>
          </ol>
          <h2 id="marketplace-publish" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Publishing Plugins</h2>
          <h3 className="text-lg font-bold mt-6 mb-2">Requirements</h3>
          <ul className="list-disc pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li>A marketplace account (register at <Link to="/marketplace/login" className="text-accent-primary hover:underline">/marketplace/login</Link>)</li>
            <li>A valid plugin matching the Plugin Schema</li>
            <li>Plugin must pass automated security checks</li>
          </ul>
          <h2 id="marketplace-security" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Security Model</h2>
          <p className="text-text-muted text-sm mb-4">All plugin code executes in a sandboxed async function with limited context. However, plugins have access to:</p>
          <ul className="list-disc pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li><strong className="text-text-main">Network:</strong> <code className="bg-bg-panel px-1 rounded">axios</code> and <code className="bg-bg-panel px-1 rounded">require</code> for HTTP requests</li>
            <li><strong className="text-text-main">File System:</strong> Only <code className="bg-bg-panel px-1 rounded">__rootdir</code> via <code className="bg-bg-panel px-1 rounded">fs</code></li>
            <li><strong className="text-text-main">WhatsApp:</strong> Full Baileys socket access</li>
          </ul>
          <Callout><p><strong className="text-text-main">⚠️ Trust Warning:</strong> Plugins from the marketplace execute real JavaScript on your server. Only install plugins from authors you trust.</p></Callout>

          {/* Reference */}
          <h2 id="custom-scripts" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Custom Scripts</h2>
          <p className="text-text-muted text-sm mb-4">Add your own commands by editing <code className="bg-bg-panel px-1 rounded">botinfo.json</code> or using the Dashboard's script editor:</p>
          <Code>{`{
  "scripts": {
    "hello": {
      "name": "Hello",
      "desc": "Say hello",
      "trigger": "hello",
      "aliases": ["hi"],
      "type": "fun",
      "response": "Hello there!",
      "target": "chat",
      "code": ""
    }
  }
}`}</Code>
          <h2 id="dashboard" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Dashboard</h2>
          <p className="text-text-muted text-sm mb-4">The dashboard runs alongside the backend on port 5000.</p>
          <h3 className="text-lg font-bold mt-6 mb-2">Features</h3>
          <ul className="list-disc pl-5 text-text-muted mb-4 space-y-1 text-sm">
            <li>Real-time log streaming via WebSocket</li>
            <li>QR code and phone pairing for WhatsApp connection</li>
            <li>Bot info and script management</li>
            <li>Plugin import from <code className="bg-bg-panel px-1 rounded">.json</code> files</li>
            <li>12 built-in themes (Midnight, Nord, Cyberpunk, etc.)</li>
            <li>Connection status monitoring</li>
            <li>PM2 process status</li>
          </ul>
          <h2 id="deployment" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Deployment</h2>
          <h3 className="text-lg font-bold mt-6 mb-2">Docker</h3>
          <Code>{`docker compose up -d`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2">PM2 (Production)</h3>
          <Code>{`bun run pm2:start    # Start
bun run pm2:restart  # Restart
bun run pm2:logs     # View logs
bun run pm2:status   # Status`}</Code>
          <h2 id="api" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Developer API</h2>
          <p className="text-text-muted text-sm mb-4">WXATA includes a REST API for sending WhatsApp messages programmatically.</p>
          <h3 className="text-lg font-bold mt-6 mb-2">Send a Message</h3>
          <Code>{`POST /api/send
Content-Type: application/json

{
  "to": "2348012345678",
  "message": "Hello from WXATA!"
}`}</Code>
          <h3 className="text-lg font-bold mt-6 mb-2">Marketplace API</h3>
          <Table headers={["Method", "Endpoint", "Description"]} rows={[
            ["GET", "/api/marketplace/plugins", "List approved plugins"],
            ["GET", "/api/marketplace/plugins/:id", "Get plugin details"],
            ["GET", "/api/marketplace/plugins/:id/download", "Download plugin .json"],
            ["POST", "/api/marketplace/auth/register", "Create account"],
            ["POST", "/api/marketplace/auth/login", "Login"],
            ["POST", "/api/marketplace/plugins", "Publish plugin (auth)"],
          ]} />
          <h2 id="architecture" className="text-xl font-bold mt-12 mb-4 pt-4 border-t border-border-subtle">Architecture</h2>
          <Code>{`Frontend (Vite + React)
  │  WebSocket
  ▼
Backend (Bun + Baileys)
  ├── WhatsApp Protocol
  ├── SQLite (message cache)
  ├── SQLite (marketplace)
  ├── botinfo.json (config)
  └── Firebase (optional)`}</Code>

          <p className="text-text-muted text-xs mt-12 pt-4 border-t border-border-subtle">
            Built by <a href="https://x.com/tads_tech" className="text-accent-primary hover:underline">TADS Tech</a> · GPL-3.0
          </p>
        </main>
      </div>
    </div>
  );
}
