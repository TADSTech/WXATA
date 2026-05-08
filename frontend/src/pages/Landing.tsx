import { motion } from "framer-motion";
import { Chain, Mist } from "../components/Visuals";
import { useNavigate } from "react-router-dom";
import {
  Terminal,
  Shield,
  Zap,
  Package,
  ChevronRight,
  ChevronDown,
  Eye,
  Radio,
  Tag,
  Code2,
  MessageSquare,
  TrendingUp,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { SocialBanner } from "../components/SocialBanner";
import { useTheme, KNOWN_THEMES } from "../components/ThemeProvider";

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  title,
  desc,
  delay,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="border border-border-subtle bg-bg-panel/10 rounded-xl p-6 space-y-3 hover:border-border-strong hover:bg-bg-panel/20 transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-accent-subtle border border-border-subtle flex items-center justify-center">
        <Icon className="w-5 h-5 text-accent-light" />
      </div>
      <h3 className="font-bold text-text-main text-lg">{title}</h3>
      <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}

// ── Command pill ──────────────────────────────────────────────────────────────
function CommandPill({
  cmd,
  desc,
  delay,
}: {
  cmd: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-4 border border-accent-subtle rounded-lg p-3 bg-accent-subtle/5 hover:bg-accent-subtle/15 transition-colors"
    >
      <code className="text-accent-light font-mono font-bold text-sm bg-accent-subtle px-3 py-1 rounded border border-border-subtle shrink-0">
        {cmd}
      </code>
      <span className="text-text-muted text-sm">{desc}</span>
    </motion.div>
  );
}

// ── Main Landing ──────────────────────────────────────────────────────────────
const Landing = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const cycleTheme = () => {
    const currentIndex = KNOWN_THEMES.indexOf(theme);
    const nextIndex = (currentIndex + 1) % KNOWN_THEMES.length;
    setTheme(KNOWN_THEMES[nextIndex]);
  };

  return (
    <div className="relative min-h-screen bg-bg-base text-text-main font-sans overflow-x-hidden transition-colors duration-300">
      {/* CRT scanline overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.18)_50%),linear-gradient(90deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01),rgba(255,255,255,0.02))] bg-[length:100%_2px,3px_100%] z-[60]" />

      {/* ── Sticky Navbar ── */}
      <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md bg-bg-base/20 border-b border-border-subtle/50">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <div className="w-8 h-8 bg-accent-primary rounded flex items-center justify-center font-black text-bg-base">
            W
          </div>
          <span className="font-black text-xl tracking-tighter text-text-main">
            WX<span className="text-accent-primary">ATA</span>
          </span>
        </div>

        <div className="flex items-center gap-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/docs")}
            className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest hidden md:block"
          >
            Documentation
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/pricing")}
            className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest hidden md:block"
          >
            Pricing
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={cycleTheme}
            className="p-2 rounded-lg border border-border-subtle text-text-muted hover:text-accent-light hover:border-accent-light transition-colors"
            title={`Current theme: ${theme}`}
          >
            <Palette className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/login")}
            className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest"
          >
            Sign In
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/pricing")}
            className="px-5 py-2 bg-accent-primary hover:bg-accent-hover text-bg-base text-xs font-black rounded transition-all uppercase tracking-widest shadow-[0_0_15px_rgba(139,92,246,0.3)]"
          >
            Get Started
          </motion.button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 1: Hero ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="hero"
        className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden"
      >
        <Mist />
        <Chain x="5%" delay={0} />
        <Chain x="15%" delay={0.5} />
        <Chain x="85%" delay={0.2} />
        <Chain x="95%" delay={0.7} />

        <motion.div
          className="z-10 text-center space-y-6 px-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <motion.div
            className="inline-block text-xs font-mono text-accent-light/60 border border-border-subtle px-4 py-1 rounded-full mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            BAILEYS_SYSTEM_ONLINE ●
          </motion.div>

          <motion.h1
            className="text-[clamp(4rem,12vw,9rem)] font-black tracking-tighter text-text-main leading-none drop-shadow-[0_0_30px_var(--theme-accent-subtle)]"
            animate={{
              textShadow: [
                "0 0 20px var(--theme-accent-subtle)",
                "0 0 60px var(--theme-accent-subtle)",
                "0 0 20px var(--theme-accent-subtle)",
              ],
              scale: [1, 1.02, 1],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            WX<span className="text-accent-primary">ATA</span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl font-light tracking-[0.3em] uppercase text-text-muted max-w-xl mx-auto"
            initial={{ opacity: 0, letterSpacing: "0.1em" }}
            animate={{ opacity: 1, letterSpacing: "0.3em" }}
            transition={{ duration: 1.5, delay: 0.6 }}
          >
            The Ultimate WhatsApp Engine
          </motion.p>

          <motion.div
            className="flex gap-4 justify-center pt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/login")}
              className="px-8 py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded transition-all tracking-widest text-sm uppercase shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            >
              Launch App
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => scrollToSection("features")}
              className="px-8 py-3 border border-border-strong text-text-main hover:bg-bg-panel/10 font-bold rounded transition-all tracking-widest text-sm uppercase flex items-center gap-2"
            >
              Features <ChevronRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Scroll-down hint */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-text-muted text-xs font-mono cursor-pointer select-none"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          onClick={() => scrollToSection("features")}
        >
          <span className="tracking-widest uppercase opacity-60">
            scroll down
          </span>
          <ChevronDown className="w-4 h-4 opacity-60" />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 2: Features ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="w-full py-28 px-8 md:px-20">
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="text-accent-light font-mono text-xs tracking-widest mb-2">
            // CAPABILITIES
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-text-main tracking-tight">
            Built different.
          </h2>
          <p className="text-text-muted mt-3 max-w-lg">
            A full-stack WhatsApp automation platform. Not a chatbot — an
            engine.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          <FeatureCard
            icon={Zap}
            title="Bun Runtime"
            desc="Runs on Bun for near-native JS performance. Sub-millisecond command dispatch."
            delay={0}
          />
          <FeatureCard
            icon={Shield}
            title="Permission System"
            desc="Per-chat, per-number, and global access control. Root-only sudo commands."
            delay={0.1}
          />
          <FeatureCard
            icon={Code2}
            title="Live JS Execution"
            desc="Every script runs real JavaScript in a sandboxed async context. No restarts needed."
            delay={0.2}
          />
          <FeatureCard
            icon={Eye}
            title="Anti-Delete"
            desc="Intercepts deleted messages and forwards them to your private chat before they vanish."
            delay={0.3}
          />
          <FeatureCard
            icon={Package}
            title="Extension Marketplace"
            desc="Install community-built scripts directly from the dashboard. One click, no code."
            delay={0.4}
          />
          <FeatureCard
            icon={Terminal}
            title="Live Dashboard"
            desc="Real-time WebSocket logs, bot config editor, and connection management from a web UI."
            delay={0.5}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 3: Commands ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="commands"
        className="w-full py-28 px-8 md:px-20 bg-bg-panel/[0.04]"
      >
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="text-accent-primary font-mono text-xs tracking-widest mb-2">
            // BUILT-IN SCRIPTS
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-text-main tracking-tight">
            Ready out of the box.
          </h2>
          <p className="text-text-muted mt-3 max-w-lg">
            Every command is editable from the dashboard. Trigger words,
            responses, targets — all configurable.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-4xl">
          <CommandPill
            cmd="+ping"
            desc="Check bot latency and online status"
            delay={0}
          />
          <CommandPill
            cmd="+menu"
            desc="List all available scripts and usage"
            delay={0.05}
          />
          <CommandPill
            cmd="+extract"
            desc="Reveal and save view-once media"
            delay={0.1}
          />
          <CommandPill
            cmd="+save"
            desc="Save any quoted media to your own chat"
            delay={0.15}
          />
          <CommandPill
            cmd="+tagall"
            desc="Mention every member in a group"
            delay={0.2}
          />
          <CommandPill
            cmd="+warn"
            desc="Warn a user — 3 strikes and they're out"
            delay={0.25}
          />
          <CommandPill
            cmd="+antidel"
            desc="Toggle deleted message recovery"
            delay={0.3}
          />
          <CommandPill
            cmd="+ss"
            desc="Screenshot any URL at 1280px width"
            delay={0.35}
          />
          <CommandPill
            cmd="+vars"
            desc="View and set bot config variables"
            delay={0.4}
          />
          <CommandPill
            cmd="+perm"
            desc="Grant or revoke chat/number access"
            delay={0.45}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 4: Marketplace ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="marketplace" className="w-full py-28 px-8 md:px-20">
        <div className="max-w-5xl w-full">
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <div className="text-info-text font-mono text-xs tracking-widest mb-2">
              // EXTENSION MARKETPLACE
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-text-main tracking-tight">
              Extend anything.
            </h2>
            <p className="text-text-muted mt-3 max-w-lg">
              Community-built scripts. Install with one click from your
              dashboard. Publish your own for others to use.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: MessageSquare,
                title: "Chat Automations",
                desc: "Auto-replies, scheduled messages, keyword triggers.",
              },
              {
                icon: Radio,
                title: "Group Tools",
                desc: "Moderation, polls, announcements, member management.",
              },
              {
                icon: Tag,
                title: "Media Scripts",
                desc: "Sticker makers, image editors, file converters.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border border-border-subtle bg-bg-panel/10 rounded-xl p-6 space-y-3 hover:border-border-strong hover:bg-bg-panel/20 transition-all"
              >
                <Icon className="w-8 h-8 text-accent-light" />
                <h3 className="font-bold text-text-main">{title}</h3>
                <p className="text-text-muted text-sm">{desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-4"
          >
            <button
              onClick={() => navigate("/extensions")}
              className="px-6 py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded transition-all text-sm uppercase tracking-widest flex items-center gap-2"
            >
              <Package className="w-4 h-4" /> Browse Marketplace
            </button>
            <button
              onClick={() => navigate("/register")}
              className="px-6 py-3 border border-border-strong text-text-main hover:bg-bg-panel/10 font-bold rounded transition-all text-sm uppercase tracking-widest"
            >
              Publish a Script
            </button>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 5: Developer API ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="w-full px-8 md:px-20 py-28 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl text-center space-y-6"
        >
          <div className="text-accent-light font-mono text-xs tracking-widest">
            // PROGRAMMATIC API
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-text-main tracking-tight">
            Send Messages via API
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Beyond the dashboard. Control WhatsApp messages programmatically
            with a simple REST API. 100 free messages to start.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="border border-border-subtle bg-bg-panel/20 rounded-lg p-4">
              <Zap className="w-5 h-5 text-accent-light mx-auto mb-2" />
              <h3 className="font-bold text-text-main mb-1">
                100 Free Messages
              </h3>
              <p className="text-xs text-text-muted">
                Get started instantly, no credit card.
              </p>
            </div>
            <div className="border border-border-subtle bg-bg-panel/20 rounded-lg p-4">
              <Code2 className="w-5 h-5 text-accent-light mx-auto mb-2" />
              <h3 className="font-bold text-text-main mb-1">REST API</h3>
              <p className="text-xs text-text-muted">
                Simple HTTP requests, any language.
              </p>
            </div>
            <div className="border border-border-subtle bg-bg-panel/20 rounded-lg p-4">
              <TrendingUp className="w-5 h-5 text-accent-light mx-auto mb-2" />
              <h3 className="font-bold text-text-main mb-1">Pay as You Grow</h3>
              <p className="text-xs text-text-muted">
                ₦2,000 for 500 more messages.
              </p>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/developer")}
            className="px-8 py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl transition-all text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.3)]"
          >
            Explore Developer API
          </motion.button>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── SECTION 6: CTA ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="cta"
        className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden px-8"
      >
        <Mist />

        <motion.div
          className="z-10 text-center space-y-8 max-w-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-accent-light font-mono text-xs tracking-widest">
            // GET STARTED
          </div>

          <h2 className="text-5xl md:text-7xl font-black text-text-main tracking-tight leading-none">
            Your bot.
            <br />
            <span className="text-accent-light">Your rules.</span>
          </h2>

          <p className="text-text-muted text-lg max-w-md mx-auto">
            Deploy on any VPS. Connect via QR or pairing code. Configure
            everything from the dashboard — no code required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/pricing")}
              className="px-10 py-4 bg-accent-primary hover:bg-accent-hover text-bg-base font-black rounded transition-all text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            >
              Create Account
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/login")}
              className="px-10 py-4 border border-border-strong text-text-main hover:bg-bg-panel/10 font-bold rounded transition-all text-sm uppercase tracking-widest"
            >
              Sign In
            </motion.button>
          </div>

          <div className="w-full max-w-md mx-auto">
            <SocialBanner variant="landing" />
          </div>

          <div className="pt-4 text-xs text-text-muted font-mono space-y-1">
            <div>Built with Baileys · Powered by Bun · Open Platform</div>
            <div className="text-text-muted opacity-30">© TADS Tech</div>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default Landing;
