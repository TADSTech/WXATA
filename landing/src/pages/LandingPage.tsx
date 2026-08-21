import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";

/* ── Data ── */
const features = [
  { title: "Bun + Baileys", desc: "High-performance runtime with the best WhatsApp Web library. No Chrome needed.", wide: true },
  { title: "Custom Scripts", desc: "Add your own commands via botinfo.json. No code changes required — just config." },
  { title: "Anti-Delete", desc: "SQLite-backed message cache. Retrieve deleted messages on demand." },
  { title: "Live Dashboard", desc: "Real-time logs, QR pairing, connection status — all in a React dashboard." },
  { title: "Permissions", desc: "Granular command permissions. Control who can use what." },
  { title: "One-Command Deploy", desc: "Docker or PM2. Deploy to any VPS in seconds." },
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
  { title: "Random Joke", desc: "Fetch jokes from JokeAPI. Fun commands for groups." },
  { title: "Weather", desc: "Get real-time weather for any city worldwide." },
  { title: "QR Generator", desc: "Generate QR codes from any text or URL." },
  { title: "Password Gen", desc: "Generate secure random passwords on demand." },
  { title: "Unit Converter", desc: "Convert kg↔lb, km↔mi, °C↔°F and more." },
  { title: "Dictionary", desc: "Word definitions, phonetics, and examples." },
];

/* ── Reveal hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.classList.add("is-in");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-in");
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ── Page ── */
export default function LandingPage() {
  const [navOpen, setNavOpen] = useState(false);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <div className="min-h-screen" style={{ background: "var(--color-paper)", color: "var(--color-ink-2)" }}>
      {/* Skip to content */}
      <a href="#main" className="skip-link">Skip to content</a>

      {/* ── Nav — N13 bordered + ⌘K ── */}
      <nav className={`nav ${navOpen ? "is-open" : ""}`} aria-label="Primary">
        <div className="nav__inner">
          <Link to="/" className="nav__wordmark" onClick={closeNav}>WXATA</Link>

          <button
            className="nav__toggle"
            onClick={toggleNav}
            aria-expanded={navOpen}
            aria-controls="nav-links"
            aria-label={navOpen ? "Close menu" : "Open menu"}
          >
            {navOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>
            )}
          </button>

          <ul id="nav-links" className="nav__links">
            <li><Link to="/" aria-current="page" onClick={closeNav}>Home</Link></li>
            <li><Link to="/docs" onClick={closeNav}>Docs</Link></li>
            <li><Link to="/marketplace" onClick={closeNav}>Marketplace</Link></li>
          </ul>

          <button className="nav__search" aria-label="Search commands">
            Search… <kbd>⌘K</kbd>
          </button>

          <a
            href="https://github.com/TADSTech/wxata"
            target="_blank"
            rel="noreferrer"
            className="btn-primary nav__cta"
            style={{ padding: "7px 16px", fontSize: "var(--text-xs)" }}
          >
            GitHub ↗
          </a>
        </div>
      </nav>

      <main id="main">
        {/* ── Hero — title left, code demo right ── */}
        <section className="hero">
          <div className="container">
            <div className="hero__grid">
              {/* Left — copy */}
              <div className="hero__copy">
                <div className="mono-label hero__eyebrow">WhatsApp Automation</div>
                <h1 className="hero__title">
                  The bot platform you configure, not code.
                </h1>
                <p className="hero__desc">
                  Built on Baileys + Bun. Connect your WhatsApp, write custom scripts via config, install community plugins, and automate anything — no framework lock-in.
                </p>
                <div className="hero__actions">
                  <Link to="/docs" className="btn-primary">Read the docs</Link>
                  <a href="https://github.com/TADSTech/wxata" target="_blank" rel="noreferrer" className="btn-outline">
                    Star on GitHub ↗
                  </a>
                </div>
              </div>

              {/* Right — code demo */}
              <RevealSection>
                <div className="code-card">
                  <div className="code-card__bar">
                    <span className="code-card__filename">botinfo.json</span>
                  </div>
                  <div className="code-card__body custom-scrollbar">
                    <span className="tok-punct">{"{"}</span>{"\n"}
                    <span className="tok-key">  "prefix"</span><span className="tok-punct">: </span><span className="tok-str">"+"</span><span className="tok-punct">,</span>{"\n"}
                    <span className="tok-key">  "scripts"</span><span className="tok-punct">: {"{"}</span>{"\n"}
                    <span className="tok-key">    "weather"</span><span className="tok-punct">: {"{"}</span>{"\n"}
                    <span className="tok-key">      "name"</span><span className="tok-punct">: </span><span className="tok-str">"Weather"</span><span className="tok-punct">,</span>{"\n"}
                    <span className="tok-key">      "trigger"</span><span className="tok-punct">: </span><span className="tok-str">"weather"</span><span className="tok-punct">,</span>{"\n"}
                    <span className="tok-key">      "type"</span><span className="tok-punct">: </span><span className="tok-str">"tools"</span><span className="tok-punct">,</span>{"\n"}
                    <span className="tok-key">      "target"</span><span className="tok-punct">: </span><span className="tok-str">"chat"</span>{"\n"}
                    <span className="tok-punct">    {"}"}</span>{"\n"}
                    <span className="tok-punct">  {"}"}</span>{"\n"}
                    <span className="tok-punct">{"}"}</span>
                  </div>
                </div>
                <div style={{ marginTop: "var(--space-md)", display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="status-chip">200 OK</span>
                  <span className="mono-label" style={{ color: "var(--color-muted)" }}>
                    bot loaded · 6 scripts · prefix +
                  </span>
                </div>
              </RevealSection>
            </div>
          </div>
        </section>

        {/* ── Features — Bento Grid ── */}
        <section className="section">
          <div className="container">
            <RevealSection className="section-header">
              <div className="mono-label" style={{ marginBottom: "var(--space-sm)" }}>Features</div>
              <h2 style={{ fontSize: "var(--text-3xl)" }}>
                Everything you need. Nothing you don't.
              </h2>
            </RevealSection>

            <div className="bento-grid">
              {features.map((f, i) => (
                <RevealSection
                  key={f.title}
                  className={`bento-cell ${f.wide ? "bento-cell--wide" : ""}`}
                  style={{ "--reveal-i": i } as React.CSSProperties}
                >
                  <h3 style={{ fontSize: "var(--text-md)" }}>{f.title}</h3>
                  <p style={{ color: "var(--color-muted)", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>{f.desc}</p>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ── Commands ── */}
        <section className="section section--narrow">
          <div className="container--narrow">
            <RevealSection>
              <div className="mono-label" style={{ marginBottom: "var(--space-sm)" }}>Built-in</div>
              <h2 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-lg)" }}>
                Ten commands out of the box.
              </h2>
              <p style={{ color: "var(--color-muted)", fontSize: "var(--text-sm)", maxWidth: "55ch", marginBottom: "var(--space-xl)" }}>
                The prefix is configurable. Every command is a config entry — add, remove, or override via botinfo.json.
              </p>
            </RevealSection>

            <RevealSection>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
                {commands.map((c) => (
                  <div key={c.cmd} className="cmd-chip">
                    <code>{c.cmd}</code>
                    <span>{c.desc}</span>
                  </div>
                ))}
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ── Architecture — dark graphite band ── */}
        <section className="section">
          <div className="container--narrow">
            <RevealSection className="dark-band">
              <div className="mono-label" style={{ marginBottom: "var(--space-sm)" }}>Architecture</div>
              <h2 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-xl)" }}>
                Two processes. One WebSocket. Zero Chrome.
              </h2>
              <div className="arch-grid">
                <div>
                  <h3 style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-md)" }}>Frontend</h3>
                  <div className="arch-list">
                    <div>Vite + React + Tailwind</div>
                    <div>WebSocket client</div>
                    <div>Real-time log stream</div>
                    <div>QR + phone pairing UI</div>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-md)" }}>Backend</h3>
                  <div className="arch-list">
                    <div>Bun + Baileys</div>
                    <div>SQLite (message cache)</div>
                    <div>botinfo.json (config)</div>
                    <div>Firebase <span style={{ color: "var(--color-muted)" }}>(optional)</span></div>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ── Marketplace ── */}
        <section className="section">
          <div className="container">
            <RevealSection>
              <div className="mono-label" style={{ marginBottom: "var(--space-sm)" }}>Marketplace</div>
              <h2 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-lg)" }}>
                Community plugins. One-click install.
              </h2>
              <p style={{ color: "var(--color-muted)", fontSize: "var(--text-sm)", maxWidth: "55ch", marginBottom: "var(--space-xl)" }}>
                Browse, download, import. Standard JSON format — publish your own or install from the marketplace.
              </p>
            </RevealSection>

            <div className="marketplace-grid">
              {plugins.map((p, i) => (
                <RevealSection
                  key={p.title}
                  className="bento-cell"
                  style={{ "--reveal-i": i } as React.CSSProperties}
                >
                  <h3 style={{ fontSize: "var(--text-sm)" }}>{p.title}</h3>
                  <p style={{ color: "var(--color-muted)", fontSize: "var(--text-xs)", lineHeight: 1.6 }}>{p.desc}</p>
                </RevealSection>
              ))}
            </div>

            <RevealSection style={{ marginTop: "var(--space-xl)" }}>
              <Link to="/marketplace" className="btn-outline">
                Browse marketplace →
              </Link>
            </RevealSection>
          </div>
        </section>

        {/* ── Quick Start ── */}
        <section className="section">
          <div className="container--narrow">
            <RevealSection>
              <div className="mono-label" style={{ marginBottom: "var(--space-sm)" }}>Quick Start</div>
              <h2 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-xl)" }}>
                Three commands to a running bot.
              </h2>
            </RevealSection>

            <RevealSection>
              <div className="code-card">
                <div className="code-card__bar">
                  <span className="code-card__filename">terminal</span>
                </div>
                <div className="code-card__body custom-scrollbar">
                  <span className="tok-comment"># Clone and install</span>{"\n"}
                  <span className="tok-key">git clone</span> https://github.com/TADSTech/wxata.git{"\n"}
                  <span className="tok-key">cd</span> wxata{"\n"}
                  .\setup.ps1{"\n"}{"\n"}
                  <span className="tok-comment"># Start frontend + backend</span>{"\n"}
                  <span className="tok-key">bun run</span> all
                </div>
              </div>
            </RevealSection>

            <RevealSection>
              <div className="steps-grid">
                {[
                  { step: "01", title: "Clone", desc: "Clone the repo and run setup." },
                  { step: "02", title: "Configure", desc: "Edit .env and botinfo.json." },
                  { step: "03", title: "Run", desc: "Start and scan the QR code." },
                ].map((s) => (
                  <div key={s.step}>
                    <div className="mono-label" style={{ marginBottom: "var(--space-xs)" }}>{s.step}</div>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "2px" }}>{s.title}</div>
                    <div style={{ color: "var(--color-muted)", fontSize: "var(--text-xs)" }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="section cta">
          <RevealSection>
            <h2 className="cta__title">
              Ship your first bot today.
            </h2>
            <p className="cta__desc">
              Free. Open source. No account required.
            </p>
            <div className="cta__actions">
              <Link to="/docs" className="btn-primary">Read the docs</Link>
              <a href="https://github.com/TADSTech/wxata" target="_blank" rel="noreferrer" className="btn-outline">
                Star on GitHub ↗
              </a>
            </div>
          </RevealSection>
        </section>
      </main>

      {/* ── Footer — Ft2 Inline single line ── */}
      <footer className="footer">
        <p>
          Built by{" "}
          <a href="https://x.com/tads_tech">TADS Tech</a>
          {" "}· GPL-3.0
        </p>
      </footer>
    </div>
  );
}
