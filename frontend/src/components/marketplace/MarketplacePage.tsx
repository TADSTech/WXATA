import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, Download, Tag, User, Package } from "lucide-react";
import { fetchPlugins, type MarketplacePlugin } from "./api";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "tools", label: "Tools" },
  { value: "fun", label: "Fun" },
  { value: "core", label: "Core" },
  { value: "admin", label: "Admin" },
  { value: "group", label: "Group" },
  { value: "misc", label: "Misc" },
];

const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "A-Z" },
];

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const [authorFilter, setAuthorFilter] = useState("");

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category !== "all") params.type = category;
      if (sort) params.sort = sort;
      if (authorFilter) params.author = authorFilter;
      const result = await fetchPlugins(params);
      setPlugins(result.plugins);
      setTotal(result.total);
    } catch (e) {
      console.error("Failed to load plugins:", e);
    } finally {
      setLoading(false);
    }
  }, [search, category, sort, authorFilter]);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPlugins();
  };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="bg-bg-panel border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-accent-primary" />
            <h1 className="text-3xl font-bold text-text-main">Marketplace</h1>
          </div>
          <p className="text-text-muted mb-6">Discover and install community-built plugins for your WhatsApp bot</p>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search plugins..."
                className="w-full pl-10 pr-4 py-2.5 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>
            <button type="submit" className="px-4 py-2.5 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-hover transition-colors">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Filters */}
          <div className="w-full md:w-56 flex-shrink-0">
            <div className="bg-bg-panel border border-border-subtle rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-main mb-3 uppercase tracking-wider">Category</h3>
              <div className="space-y-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      category === cat.value
                        ? "bg-accent-subtle text-accent-primary font-medium"
                        : "text-text-muted hover:bg-bg-panel-hover hover:text-text-main"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-text-main mb-3 uppercase tracking-wider">Sort By</h3>
                <div className="space-y-1">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSort(opt.value)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        sort === opt.value
                          ? "bg-accent-subtle text-accent-primary font-medium"
                          : "text-text-muted hover:bg-bg-panel-hover hover:text-text-main"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-text-main mb-3 uppercase tracking-wider">Author</h3>
                <input
                  type="text"
                  value={authorFilter}
                  onChange={e => setAuthorFilter(e.target.value)}
                  placeholder="Filter by author..."
                  className="w-full px-3 py-1.5 bg-bg-base border border-border-subtle rounded-lg text-sm text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Plugin Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-text-muted">{total} plugin{total !== 1 ? "s" : ""} found</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-bg-panel border border-border-subtle rounded-xl p-5 animate-pulse">
                    <div className="h-5 bg-bg-base rounded w-1/3 mb-3" />
                    <div className="h-4 bg-bg-base rounded w-2/3 mb-2" />
                    <div className="h-3 bg-bg-base rounded w-full mb-4" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-bg-base rounded-full w-16" />
                      <div className="h-6 bg-bg-base rounded-full w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : plugins.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-muted text-lg">No plugins found</p>
                <p className="text-text-muted text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plugins.map(plugin => (
                  <PluginCard key={plugin.id} plugin={plugin} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PluginCard({ plugin }: { plugin: MarketplacePlugin }) {
  const typeColors: Record<string, string> = {
    tools: "bg-info-subtle text-info-text",
    fun: "bg-warning-subtle text-warning-text",
    core: "bg-success-subtle text-success-text",
    admin: "bg-danger-subtle text-danger-text",
    group: "bg-accent-subtle text-accent-primary",
    misc: "bg-bg-panel-hover text-text-muted",
  };

  return (
    <Link
      to={`/marketplace/${plugin.id}`}
      className="block bg-bg-panel border border-border-subtle rounded-xl p-5 hover:border-accent-primary/50 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-text-main group-hover:text-accent-primary transition-colors">
          {plugin.name}
        </h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[plugin.type] || typeColors.misc}`}>
          {plugin.type}
        </span>
      </div>

      <p className="text-sm text-text-muted mb-3 line-clamp-2">{plugin.description}</p>

      <div className="flex items-center gap-2 mb-3">
        <code className="text-xs bg-bg-base px-2 py-0.5 rounded text-accent-primary font-mono">
          !{plugin.trigger}
        </code>
        {plugin.aliases?.slice(0, 2).map((alias: string) => (
          <code key={alias} className="text-xs bg-bg-base px-2 py-0.5 rounded text-text-muted font-mono">
            !{alias}
          </code>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {plugin.author_username}
        </div>
        <div className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {plugin.downloads}
        </div>
      </div>

      {plugin.tags && plugin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {plugin.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-base rounded-full text-xs text-text-muted">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
