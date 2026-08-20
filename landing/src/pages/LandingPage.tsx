import { Link } from "react-router-dom";

const features = [
  { icon: "⚡", title: "Bun + Baileys", desc: "High-performance runtime with the best WhatsApp Web library. No Chrome needed." },
  { icon: "🧩", title: "Custom Scripts", desc: "Add your own commands via botinfo.json. No code changes required — just config." },
  { icon: "🛡️", title: "Anti-Delete", desc: "SQLite-backed message cache. Retrieve deleted messages on demand." },
  { icon: "📊", title: "Live Dashboard", desc: "Real-time logs, QR pairing, connection status — all in a React dashboard." },
  { icon: "🔑", title: "Permissions", desc: "Granular command permissions. Control who can use what." },
  { icon: "🚀", title: "One-Command Deploy", desc: "Docker or PM2. Deploy to any VPS in seconds." },
  { icon: "🏪", title: "Plugin Marketplace", desc: "Install community-built plugins with one click. Browse, download, and import." },
  { icon: "🔌", title: "JSON Plugin Files", desc: "Standard script format. Download from marketplace, import to dashboard, done." },
];

const commands = [
  { cmd: "+menu", desc: "Show menu" },
  { cmd: "+ping", desc: "Health check" },
  { cmd: "+help", desc: "List commands" },
  { cmd: "+tagall", desc: "Mention all" },
  { cmd: "+warn", desc: "Warn member" },
  { cmd: "+antidel", desc: "Deleted msgs" },
  { cmd: "+sticker", desc: "Image → sticker" },
  { cmd: "+ss <url>", desc: "Screenshot" },
  { cmd: "+vars", desc: "Bot variables" },
  { cmd: "+perm", desc: "Permissions" },
];

const plugins = [
  { icon: "😂", title: "Random Joke", desc: "Fetch jokes from JokeAPI. Fun commands for groups." },
  { icon: "🌤️", title: "Weather", desc: "Get real-time weather for any city worldwide." },
  { icon: "📱", title: "QR Generator", desc: "Generate QR codes from any text or URL." },
  { icon: "🔐", title: "Password Gen", desc: "Generate secure random passwords on demand." },
  { icon: "📐", title: "Unit Converter", desc: "Convert kg↔lb, km↔mi, °C↔°F and more." },
  { icon: "📖", title: "Dictionary", desc: "Word definitions, phonetics, and examples." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-main">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-bg-panel/80 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-accent-primary">WXATA</Link>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/" className="text-accent-primary font-medium">Home</Link>
            <Link to="/docs" className="text-text-muted hover:text-text-main transition-colors">Docs</Link>
            <Link to="/marketplace" className="text-text-muted hover:text-text-main transition-colors">Marketplace</Link>
            <a href="https://github.com/TADSTech/wxata" target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-main transition-colors">GitHub</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-accent-primary/10 via-transparent to-transparent pointer-events-none" />
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4">WXATA</h1>
        <p className="text-xl text-text-muted mb-2">FOSS WhatsApp Automation & Tactical Assistant</p>
        <p className="text-text-muted/70 max-w-xl mx-auto mb-8">Built on Baileys + Bun. Connect your WhatsApp, write custom scripts, and automate anything.</p>
        <div className="flex gap-4 justify-center">
          <Link to="/docs" className="bg-accent-primary hover:bg-accent-hover text-bg-base px-6 py-3 rounded-lg font-bold transition-colors">Get Started</Link>
          <a href="https://github.com/TADSTech/wxata" target="_blank" rel="noreferrer" className="border border-border-strong hover:border-accent-primary text-text-main px-6 py-3 rounded-lg transition-colors">View on GitHub</a>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(f => (
              <div key={f.title} className="bg-bg-panel border border-border-subtle rounded-lg p-5 hover:border-accent-primary/30 transition-colors">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-text-muted text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commands */}
      <section className="py-20 px-4 bg-bg-panel/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Built-in Commands</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            {commands.map(c => (
              <div key={c.cmd} className="bg-bg-base border border-border-subtle rounded-full px-4 py-2 flex items-center gap-2 text-sm">
                <code className="text-accent-primary font-mono font-bold">{c.cmd}</code>
                <span className="text-text-muted">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Quick Start</h2>
          <div className="space-y-6 mb-8">
            {[
              { n: "1", title: "Clone & Install", desc: "Clone the repo and run the setup script." },
              { n: "2", title: "Configure", desc: "Edit .env and botinfo.json with your settings." },
              { n: "3", title: "Run", desc: "Start the bot and scan the QR code from the dashboard." },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-accent-primary text-bg-base flex items-center justify-center font-bold text-sm shrink-0">{s.n}</div>
                <div>
                  <h4 className="font-bold text-sm">{s.title}</h4>
                  <p className="text-text-muted text-xs">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-bg-panel border border-border-subtle rounded-lg p-4 font-mono text-xs text-text-muted overflow-x-auto">
            <pre>{`git clone https://github.com/TADSTech/wxata.git
cd wxata
.\\setup.ps1          # Windows
bun run all          # Start frontend + backend`}</pre>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-20 px-4 bg-bg-panel/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Architecture</h2>
          <div className="bg-bg-base border border-border-subtle rounded-lg p-4 font-mono text-xs text-text-muted overflow-x-auto">
            <pre>{`Frontend (Vite + React)
  │  WebSocket
  ▼
Backend (Bun + Baileys)
  ├── WhatsApp Protocol
  ├── SQLite (message cache)
  ├── botinfo.json (config)
  └── Firebase (optional)`}</pre>
          </div>
        </div>
      </section>

      {/* Marketplace Preview */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Plugin Marketplace</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map(p => (
              <div key={p.title} className="bg-bg-panel border border-border-subtle rounded-lg p-5 hover:border-accent-primary/30 transition-colors">
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="font-bold text-sm mb-1">{p.title}</h3>
                <p className="text-text-muted text-xs">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/marketplace" className="bg-accent-primary hover:bg-accent-hover text-bg-base px-6 py-3 rounded-lg font-bold transition-colors inline-block">Browse Marketplace →</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to automate?</h2>
        <p className="text-text-muted mb-8">Get started in minutes. Free and open source.</p>
        <div className="flex gap-4 justify-center">
          <Link to="/docs" className="bg-accent-primary hover:bg-accent-hover text-bg-base px-6 py-3 rounded-lg font-bold transition-colors">Read the Docs</Link>
          <a href="https://github.com/TADSTech/wxata" target="_blank" rel="noreferrer" className="border border-border-strong hover:border-accent-primary text-text-main px-6 py-3 rounded-lg transition-colors">Star on GitHub</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-text-muted text-xs border-t border-border-subtle">
        Built by <a href="https://x.com/tads_tech" className="text-accent-primary hover:underline">TADS Tech</a> · MIT License
      </footer>
    </div>
  );
}
