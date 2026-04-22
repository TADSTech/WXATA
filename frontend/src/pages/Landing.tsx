import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Chain, Mist } from '../components/Visuals';
import { useNavigate } from 'react-router-dom';
import {
  Terminal, Shield, Zap, Package, ChevronRight, ChevronLeft,
  Eye, Radio, Tag, Code2, MessageSquare
} from 'lucide-react';

// ── Horizontal scroll container ───────────────────────────────────────────────
function useHorizontalScroll() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return ref;
}

// ── Slide indicator dots ──────────────────────────────────────────────────────
function Dots({ total, active }: { total: number; active: number }) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-50">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === active ? 24 : 8, opacity: i === active ? 1 : 0.3 }}
          transition={{ duration: 0.3 }}
          className="h-2 rounded-full bg-blue-400"
        />
      ))}
    </div>
  );
}

// ── Scroll hint arrow ─────────────────────────────────────────────────────────
function ScrollHint({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      whileHover={{ opacity: 1, scale: 1.1 }}
      className={`fixed top-1/2 -translate-y-1/2 z-50 p-2 border border-white/10 rounded-full bg-black/40 backdrop-blur-sm text-white ${direction === 'left' ? 'left-4' : 'right-4'}`}
    >
      {direction === 'left' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
    </motion.button>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, delay }: { icon: any; title: string; desc: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="border border-blue-500/20 bg-blue-950/10 rounded-xl p-6 space-y-3 hover:border-blue-500/50 hover:bg-blue-950/20 transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-blue-400" />
      </div>
      <h3 className="font-bold text-white text-lg">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}

// ── Command pill ──────────────────────────────────────────────────────────────
function CommandPill({ cmd, desc, delay }: { cmd: string; desc: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-center gap-4 border border-green-500/15 rounded-lg p-3 bg-green-950/5 hover:bg-green-950/15 transition-colors"
    >
      <code className="text-green-400 font-mono font-bold text-sm bg-green-900/20 px-3 py-1 rounded border border-green-500/20 shrink-0">
        {cmd}
      </code>
      <span className="text-gray-400 text-sm">{desc}</span>
    </motion.div>
  );
}

// ── Main Landing ──────────────────────────────────────────────────────────────
const SLIDE_COUNT = 5;

const Landing = () => {
  const navigate = useNavigate();
  const scrollRef = useHorizontalScroll();
  const [activeSlide, setActiveSlide] = useState(0);

  // Track active slide from scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActiveSlide(idx);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans">
      {/* CRT scanline overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.18)_50%),linear-gradient(90deg,rgba(255,0,0,0.04),rgba(0,255,0,0.01),rgba(0,0,255,0.04))] bg-[length:100%_2px,3px_100%] z-50" />

      {/* Nav dots */}
      <Dots total={SLIDE_COUNT} active={activeSlide} />

      {/* Prev / Next arrows */}
      {activeSlide > 0 && <ScrollHint direction="left" onClick={() => scrollTo(activeSlide - 1)} />}
      {activeSlide < SLIDE_COUNT - 1 && <ScrollHint direction="right" onClick={() => scrollTo(activeSlide + 1)} />}

      {/* Horizontal scroll track */}
      <div
        ref={scrollRef}
        className="flex w-full h-full overflow-x-auto overflow-y-hidden scroll-smooth"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >

        {/* ── SLIDE 1: Hero ── */}
        <section className="relative shrink-0 w-screen h-screen flex flex-col items-center justify-center overflow-hidden" style={{ scrollSnapAlign: 'start' }}>
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
              className="inline-block text-xs font-mono text-blue-400/60 border border-blue-500/20 px-4 py-1 rounded-full mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              BAILEYS_SYSTEM_ONLINE ●
            </motion.div>

            <motion.h1
              className="text-[clamp(4rem,12vw,9rem)] font-black tracking-tighter text-white leading-none"
              animate={{
                textShadow: [
                  '0 0 20px rgba(59,130,246,0.4)',
                  '0 0 50px rgba(59,130,246,0.8)',
                  '0 0 20px rgba(59,130,246,0.4)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              WX<span className="text-blue-400">ATA</span>
            </motion.h1>

            <motion.p
              className="text-xl md:text-2xl font-light tracking-[0.3em] uppercase text-gray-400 max-w-xl mx-auto"
              initial={{ opacity: 0, letterSpacing: '0.1em' }}
              animate={{ opacity: 1, letterSpacing: '0.3em' }}
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
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 border border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-black font-bold rounded transition-all tracking-widest text-sm uppercase"
              >
                Launch
              </button>
              <button
                onClick={() => scrollTo(1)}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-all tracking-widest text-sm uppercase flex items-center gap-2"
              >
                Explore <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            className="absolute bottom-12 right-12 text-gray-600 text-xs font-mono flex items-center gap-2"
            animate={{ x: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            scroll right <ChevronRight className="w-3 h-3" />
          </motion.div>
        </section>

        {/* ── SLIDE 2: Features ── */}
        <section className="shrink-0 w-screen h-screen flex flex-col justify-center overflow-y-auto px-8 md:px-20 py-16" style={{ scrollSnapAlign: 'start' }}>
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <div className="text-blue-400 font-mono text-xs tracking-widest mb-2">// CAPABILITIES</div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Built different.</h2>
            <p className="text-gray-400 mt-3 max-w-lg">A full-stack WhatsApp automation platform. Not a chatbot — an engine.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
            <FeatureCard icon={Zap} title="Bun Runtime" desc="Runs on Bun for near-native JS performance. Sub-millisecond command dispatch." delay={0} />
            <FeatureCard icon={Shield} title="Permission System" desc="Per-chat, per-number, and global access control. Root-only sudo commands." delay={0.1} />
            <FeatureCard icon={Code2} title="Live JS Execution" desc="Every script runs real JavaScript in a sandboxed async context. No restarts needed." delay={0.2} />
            <FeatureCard icon={Eye} title="Anti-Delete" desc="Intercepts deleted messages and forwards them to your private chat before they vanish." delay={0.3} />
            <FeatureCard icon={Package} title="Extension Marketplace" desc="Install community-built scripts directly from the dashboard. One click, no code." delay={0.4} />
            <FeatureCard icon={Terminal} title="Live Dashboard" desc="Real-time WebSocket logs, bot config editor, and connection management from a web UI." delay={0.5} />
          </div>
        </section>

        {/* ── SLIDE 3: Commands ── */}
        <section className="shrink-0 w-screen h-screen flex flex-col justify-center overflow-y-auto px-8 md:px-20 py-16" style={{ scrollSnapAlign: 'start' }}>
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <div className="text-green-400 font-mono text-xs tracking-widest mb-2">// BUILT-IN SCRIPTS</div>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Ready out of the box.</h2>
            <p className="text-gray-400 mt-3 max-w-lg">Every command is editable from the dashboard. Trigger words, responses, targets — all configurable.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-4xl">
            <CommandPill cmd="+ping"    desc="Check bot latency and online status" delay={0} />
            <CommandPill cmd="+menu"    desc="List all available scripts and usage" delay={0.05} />
            <CommandPill cmd="+extract" desc="Reveal and save view-once media" delay={0.1} />
            <CommandPill cmd="+save"    desc="Save any quoted media to your own chat" delay={0.15} />
            <CommandPill cmd="+tagall"  desc="Mention every member in a group" delay={0.2} />
            <CommandPill cmd="+warn"    desc="Warn a user — 3 strikes and they're out" delay={0.25} />
            <CommandPill cmd="+antidel" desc="Toggle deleted message recovery" delay={0.3} />
            <CommandPill cmd="+ss"      desc="Screenshot any URL at 1280px width" delay={0.35} />
            <CommandPill cmd="+vars"    desc="View and set bot config variables" delay={0.4} />
            <CommandPill cmd="+perm"    desc="Grant or revoke chat/number access" delay={0.45} />
          </div>
        </section>

        {/* ── SLIDE 4: Marketplace ── */}
        <section className="shrink-0 w-screen h-screen flex flex-col justify-center overflow-y-auto px-8 md:px-20 py-16" style={{ scrollSnapAlign: 'start' }}>
          <div className="max-w-5xl w-full">
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-10"
            >
              <div className="text-purple-400 font-mono text-xs tracking-widest mb-2">// EXTENSION MARKETPLACE</div>
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Extend anything.</h2>
              <p className="text-gray-400 mt-3 max-w-lg">Community-built scripts. Install with one click from your dashboard. Publish your own for others to use.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {[
                { icon: MessageSquare, title: 'Chat Automations', desc: 'Auto-replies, scheduled messages, keyword triggers.', color: 'blue' },
                { icon: Radio,         title: 'Group Tools',      desc: 'Moderation, polls, announcements, member management.', color: 'green' },
                { icon: Tag,           title: 'Media Scripts',    desc: 'Sticker makers, image editors, file converters.', color: 'purple' },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`border border-${color}-500/20 bg-${color}-950/10 rounded-xl p-6 space-y-3`}
                >
                  <Icon className={`w-8 h-8 text-${color}-400`} />
                  <h3 className="font-bold text-white">{title}</h3>
                  <p className="text-gray-400 text-sm">{desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-4"
            >
              <button
                onClick={() => navigate('/extensions')}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded transition-all text-sm uppercase tracking-widest flex items-center gap-2"
              >
                <Package className="w-4 h-4" /> Browse Marketplace
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-3 border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 font-bold rounded transition-all text-sm uppercase tracking-widest"
              >
                Publish a Script
              </button>
            </motion.div>
          </div>
        </section>

        {/* ── SLIDE 5: CTA ── */}
        <section className="relative shrink-0 w-screen h-screen flex flex-col items-center justify-center overflow-hidden px-8" style={{ scrollSnapAlign: 'start' }}>
          <Mist />

          <motion.div
            className="z-10 text-center space-y-8 max-w-2xl"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-blue-400 font-mono text-xs tracking-widest">// GET STARTED</div>

            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-none">
              Your bot.<br />
              <span className="text-blue-400">Your rules.</span>
            </h2>

            <p className="text-gray-400 text-lg max-w-md mx-auto">
              Deploy on any VPS. Connect via QR or pairing code. Configure everything from the dashboard — no code required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded transition-all text-sm uppercase tracking-widest"
              >
                Create Account
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-10 py-4 border border-white/20 text-white hover:bg-white/5 font-bold rounded transition-all text-sm uppercase tracking-widest"
              >
                Sign In
              </button>
            </div>

            <div className="pt-4 text-xs text-gray-600 font-mono space-y-1">
              <div>Built with Baileys · Powered by Bun · Open Platform</div>
              <div className="text-gray-700">© TADS Tech</div>
            </div>
          </motion.div>
        </section>

      </div>
    </div>
  );
};

export default Landing;
