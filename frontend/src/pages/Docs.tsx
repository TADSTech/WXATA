import { Terminal, Shield, Activity, BookOpen, ChevronRight, Zap, Code, Lock, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Docs = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: "Architecture",
      icon: <Terminal className="w-5 h-5 text-accent-primary" />,
      content: "WXATA is built on a high-performance engine using Baileys for WhatsApp protocol and Bun for the runtime. It features a real-time WebSocket bridge between the Node.js backend and the React dashboard."
    },
    {
      title: "Command System",
      icon: <Zap className="w-5 h-5 text-accent-primary" />,
      content: "Commands are triggered via a customizable prefix (default '!'). Each script can have multiple aliases and categorizations. Detailed usage can be found via the '!hp' command."
    },
    {
      title: "Permission Layers",
      icon: <Lock className="w-5 h-5 text-accent-primary" />,
      content: "WXATA features a 3-tier security model: Root (full system control), Allowed Chats (group-level access), and Allowed Numbers (individual-level access)."
    },
    {
      title: "Custom Scripting",
      icon: <Code className="w-5 h-5 text-accent-primary" />,
      content: "Developers can inject custom JavaScript directly through the dashboard. Scripts have full access to the socket instance and message metadata for advanced automation."
    }
  ];

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-mono p-6 lg:p-12 selection:bg-accent-primary selection:text-bg-base">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border-subtle pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-accent-primary" />
              <h1 className="text-3xl font-black tracking-tighter">WXATA_DOCS</h1>
            </div>
            <p className="text-text-muted text-sm uppercase tracking-widest">Official Technical Documentation v1.2.0</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-2 border border-border-strong hover:bg-accent-subtle transition-all text-xs font-bold uppercase tracking-widest rounded"
          >
            Return to Terminal
          </button>
        </header>

        {/* Hero Section */}
        <section className="bg-bg-panel border border-border-strong rounded-xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Globe className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <h2 className="text-xl font-bold text-accent-light">The Premium Automation Engine</h2>
            <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
              WXATA is not just a bot; it's a full-featured tactical assistant designed for users who demand power, speed, and clean aesthetics. Built with modern web technologies, it provides a seamless bridge between your desktop and mobile devices.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent-primary bg-accent-subtle px-3 py-1.5 rounded-full border border-accent-primary/20">
                <Shield className="w-3 h-3" /> Secure Auth
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-success-text bg-success-subtle px-3 py-1.5 rounded-full border border-success-subtle/20">
                <Activity className="w-3 h-3" /> Real-time Logs
              </div>
            </div>
          </div>
        </section>

        {/* Documentation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-6 bg-bg-panel border border-border-subtle rounded-xl hover:border-accent-primary/30 transition-colors space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-bg-base border border-border-strong rounded-lg">
                  {section.icon}
                </div>
                <h3 className="font-bold text-accent-light uppercase tracking-tight">{section.title}</h3>
              </div>
              <p className="text-xs text-text-muted leading-loose">
                {section.content}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Usage Section */}
        <section className="space-y-6">
          <h3 className="text-sm uppercase tracking-widest text-text-muted flex items-center gap-2">
            <ChevronRight className="w-4 h-4" /> Quick Commands
          </h3>
          <div className="bg-bg-panel border border-border-strong rounded-lg overflow-hidden font-mono text-xs">
            <div className="bg-bg-base px-4 py-2 border-b border-border-strong flex justify-between">
              <span className="text-accent-primary">TERMINAL_EXAMPLES</span>
              <span className="opacity-30">bash</span>
            </div>
            <div className="p-6 space-y-4 text-text-muted">
              <div className="space-y-2">
                <p className="text-accent-light"># Initialize the engine</p>
                <div className="bg-bg-base p-3 rounded border border-border-subtle">
                  $ <span className="text-text-main">bun run all</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-accent-light"># Typical bot interaction</p>
                <div className="bg-bg-base p-3 rounded border border-border-subtle text-text-main">
                  <div>!mn <span className="text-text-muted"># Open menu</span></div>
                  <div>!hp st <span className="text-text-muted"># Help for sticker maker</span></div>
                  <div>!pm chat <span className="text-text-muted"># Grant permission to current chat</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section className="space-y-6">
          <h3 className="text-sm uppercase tracking-widest text-text-muted flex items-center gap-2">
            <ChevronRight className="w-4 h-4" /> Community & Support
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <a href="https://t.me/+dR5zABepmkNhYjQ0" target="_blank" rel="noopener noreferrer" className="p-4 bg-bg-panel border border-border-subtle rounded-lg flex items-center justify-between hover:border-accent-primary/50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="text-accent-light font-bold">Telegram</div>
                <div className="text-[9px] text-text-muted uppercase tracking-[0.2em]">Community Chat</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary transition-colors" />
            </a>
            <a href="https://x.com/tads_tech" target="_blank" rel="noopener noreferrer" className="p-4 bg-bg-panel border border-border-subtle rounded-lg flex items-center justify-between hover:border-accent-primary/50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="text-accent-light font-bold">X (Twitter)</div>
                <div className="text-[9px] text-text-muted uppercase tracking-[0.2em]">@tads_tech</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary transition-colors" />
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-subtle pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-text-muted uppercase tracking-[0.2em]">
          <span>© 2026 TADSTECH • WXATA PROJECT</span>
          <div className="flex gap-6">
            <span className="text-accent-primary">Privacy First</span>
            <span>Premium Engine</span>
            <span>Cloud Ready</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Docs;
