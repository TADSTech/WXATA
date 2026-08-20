import { useState, useEffect } from 'react';
import { Search, Download, ExternalLink, Tag, User } from 'lucide-react';

const API_BASE = (() => {
  const url = localStorage.getItem('wxata_backend_url');
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'wss:') u.protocol = 'https:';
      else if (u.protocol === 'ws:') u.protocol = 'http:';
      return u.origin;
    } catch {}
  }
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      if (u.protocol === 'wss:') u.protocol = 'https:';
      else if (u.protocol === 'ws:') u.protocol = 'http:';
      return u.origin;
    } catch {}
  }
  return window.location.origin;
})();

interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  trigger: string;
  aliases: string[];
  type: string;
  target: string;
  code: string;
  default_argument: string;
  author_username: string;
  downloads: number;
  version: string;
  tags: string[];
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
  disabled?: boolean;
}

interface Props {
  onInstall: (key: string, script: BotScript) => void;
  installedTriggers: string[];
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  core: 'text-info-text border-info-subtle',
  tools: 'text-success-text border-success-subtle',
  fun: 'text-warning-text border-warning-subtle',
  admin: 'text-danger-text border-danger-subtle',
  group: 'text-purple-400 border-purple-400/30',
  misc: 'text-text-muted border-border-subtle',
};

export default function MarketplaceBrowser({ onInstall, installedTriggers, onClose }: Props) {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetchPlugins();
  }, []);

  const fetchPlugins = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/plugins?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPlugins(data.plugins || []);
    } catch {
      setError('Could not load marketplace. Is the server online?');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (plugin: MarketplacePlugin) => {
    setInstalling(plugin.id);
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/plugins/${plugin.id}/download`);
      if (!res.ok) throw new Error('Download failed');
      const wxataFile = await res.json();

      const key = (wxataFile.trigger || plugin.trigger || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!key) return;

      const script: BotScript = {
        name: wxataFile.name || plugin.name || key,
        desc: wxataFile.desc || plugin.description || '',
        trigger: wxataFile.trigger || plugin.trigger || key,
        aliases: wxataFile.aliases || plugin.aliases || [],
        type: wxataFile.type || plugin.type || 'misc',
        response: wxataFile.response || '',
        target: wxataFile.target || plugin.target || 'chat',
        code: wxataFile.code || plugin.code || '',
        defaultArgument: wxataFile.defaultArgument || plugin.default_argument || '',
        disabled: false,
      };

      onInstall(key, script);
    } catch {
      setError('Failed to download plugin');
    } finally {
      setInstalling(null);
    }
  };

  const filtered = plugins.filter(p => {
    if (typeFilter && p.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.trigger.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const types = [...new Set(plugins.map(p => p.type))].sort();

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-bg-panel border border-border-strong rounded w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-border-strong flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold uppercase tracking-widest">Marketplace</h2>
          <button onClick={onClose} className="text-text-muted hover:text-accent-light text-lg">&times;</button>
        </div>

        {/* Search & Filters */}
        <div className="p-3 border-b border-border-strong/50 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search plugins..."
              className="w-full bg-bg-panel border border-border-strong pl-7 pr-3 py-1.5 text-accent-light text-xs outline-none focus:border-accent-primary placeholder:text-text-muted/50"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-bg-panel border border-border-strong px-2 py-1 text-xs text-accent-light outline-none"
          >
            <option value="">All Types</option>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Plugin List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {loading && (
            <div className="text-center text-text-muted py-12 text-xs uppercase tracking-widest">Loading plugins...</div>
          )}
          {error && (
            <div className="text-center text-danger-text py-12 text-xs">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center text-text-muted py-12 text-xs">No plugins found</div>
          )}
          {!loading && !error && filtered.map(plugin => {
            const alreadyInstalled = installedTriggers.includes(plugin.trigger);
            const isInstallingThis = installing === plugin.id;
            const colorClass = TYPE_COLORS[plugin.type] || TYPE_COLORS.misc;

            return (
              <div
                key={plugin.id}
                className="border border-border-strong/30 rounded p-3 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-accent-light font-bold text-sm">{plugin.name}</span>
                      <span className={`text-[10px] border px-1.5 py-0.5 rounded uppercase font-bold ${colorClass}`}>
                        {plugin.type}
                      </span>
                      {plugin.version && (
                        <span className="text-[10px] text-text-muted">v{plugin.version}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mb-2 line-clamp-2">{plugin.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-accent-primary">!{plugin.trigger}</span>
                        {plugin.aliases?.length > 0 && (
                          <span className="text-text-muted/50">({plugin.aliases.join(', ')})</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-2.5 h-2.5" /> {plugin.author_username}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="w-2.5 h-2.5" /> {plugin.downloads}
                      </span>
                      {plugin.tags?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" /> {plugin.tags.slice(0, 3).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {alreadyInstalled ? (
                      <span className="text-[10px] text-success-text border border-success-subtle px-2 py-1 rounded uppercase font-bold">
                        Installed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInstall(plugin)}
                        disabled={isInstallingThis}
                        className="flex items-center gap-1 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-base px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors"
                      >
                        {isInstallingThis ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <>
                            <Download className="w-3 h-3" /> Install
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border-strong/50 flex justify-between items-center text-[10px] text-text-muted shrink-0">
          <span>{filtered.length} plugin{filtered.length !== 1 ? 's' : ''}</span>
          <a
            href="/marketplace"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-accent-primary hover:text-accent-light transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" /> Open Full Marketplace
          </a>
        </div>
      </div>
    </div>
  );
}
