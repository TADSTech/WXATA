import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, ArrowRight } from 'lucide-react';

const Connect = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState(() => localStorage.getItem('wxata_backend_url') || 'ws://localhost:5000');
  const [password, setPassword] = useState(() => localStorage.getItem('wxata_dashboard_password') || '');

  const handleConnect = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    localStorage.setItem('wxata_backend_url', trimmed);
    if (password.trim()) {
      localStorage.setItem('wxata_dashboard_password', password.trim());
    } else {
      localStorage.removeItem('wxata_dashboard_password');
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center font-mono">
      <div className="w-full max-w-md p-8">
        <div className="bg-bg-panel border border-border-subtle rounded p-8 space-y-6">
          <div className="flex items-center gap-3 justify-center">
            <Wifi className="w-8 h-8 text-accent-primary" />
            <h1 className="text-xl font-bold tracking-tight text-text-main">WXATA</h1>
          </div>

          <p className="text-xs text-text-muted text-center">
            Enter your backend WebSocket URL to connect.
          </p>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-text-muted">Backend URL</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="wss://wxata-api.tadstech.dev"
              className="w-full bg-bg-panel border border-border-strong p-3 text-accent-light font-mono text-sm outline-none focus:border-border-strong transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-text-muted">Password (optional)</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="Leave empty if no password set"
              className="w-full bg-bg-panel border border-border-strong p-3 text-accent-light font-mono text-sm outline-none focus:border-border-strong transition-colors"
            />
          </div>

          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-hover text-bg-base px-4 py-3 rounded font-bold text-sm uppercase tracking-widest transition-all"
          >
            Connect <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-[10px] text-text-muted text-center opacity-50">
            Examples: wss://wxata-api.tadstech.dev · ws://localhost:5000
          </p>
        </div>
      </div>
    </div>
  );
};

export default Connect;
