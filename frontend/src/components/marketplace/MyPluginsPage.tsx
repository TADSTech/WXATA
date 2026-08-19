import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, Plus, Trash2, ExternalLink, Clock, Download } from "lucide-react";
import { fetchMyPlugins, getMarketplaceUser, type MarketplacePlugin } from "./api";

export default function MyPluginsPage() {
  const user = getMarketplaceUser();
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchMyPlugins()
      .then(data => setPlugins(data.plugins))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted text-lg">You must be logged in</p>
        <Link to="/marketplace/login" className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-hover transition-colors">
          Login / Register
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    approved: "bg-success-subtle text-success-text",
    pending: "bg-warning-subtle text-warning-text",
    rejected: "bg-danger-subtle text-danger-text",
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-main">My Plugins</h1>
            <p className="text-text-muted text-sm">Manage your published plugins</p>
          </div>
          <div className="flex gap-3">
            <Link to="/marketplace/publish" className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors">
              <Plus className="w-4 h-4" />
              Publish New
            </Link>
            <Link to="/marketplace" className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-border-subtle rounded-lg text-sm text-text-muted hover:text-text-main transition-colors">
              <Package className="w-4 h-4" />
              Browse
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-panel border border-border-subtle rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-bg-base rounded w-1/4 mb-2" />
                <div className="h-4 bg-bg-base rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted text-lg mb-2">No plugins published yet</p>
            <Link to="/marketplace/publish" className="text-accent-primary hover:underline">
              Publish your first plugin →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {plugins.map(plugin => (
              <div key={plugin.id} className="bg-bg-panel border border-border-subtle rounded-xl p-5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <Link to={`/marketplace/${plugin.id}`} className="font-semibold text-text-main hover:text-accent-primary transition-colors truncate">
                      {plugin.name}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[plugin.status] || statusColors.pending}`}>
                      {plugin.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted truncate">{plugin.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> v{plugin.version}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" /> {plugin.downloads}
                    </span>
                    <code className="text-accent-primary">!{plugin.trigger}</code>
                  </div>
                </div>
                <Link to={`/marketplace/${plugin.id}`} className="ml-4 p-2 text-text-muted hover:text-accent-primary transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
