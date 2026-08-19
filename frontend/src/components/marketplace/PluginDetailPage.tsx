import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, User, Tag, Clock, Copy, Check, ExternalLink } from "lucide-react";
import { fetchPlugin, downloadPlugin, type MarketplacePlugin } from "./api";

export default function PluginDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [plugin, setPlugin] = useState<MarketplacePlugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPlugin(id)
      .then(data => setPlugin(data.plugin))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!plugin) return;
    setDownloading(true);
    try {
      const blob = await downloadPlugin(plugin.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const slug = plugin.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.href = url;
      a.download = `${slug}.wxata.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  const copyCode = () => {
    if (!plugin?.code) return;
    navigator.clipboard.writeText(plugin.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="animate-pulse text-text-muted">Loading plugin...</div>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted text-lg">Plugin not found</p>
        <Link to="/marketplace" className="text-accent-primary hover:underline">Back to Marketplace</Link>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    tools: "bg-info-subtle text-info-text",
    fun: "bg-warning-subtle text-warning-text",
    core: "bg-success-subtle text-success-text",
    admin: "bg-danger-subtle text-danger-text",
    group: "bg-accent-subtle text-accent-primary",
    misc: "bg-bg-panel-hover text-text-muted",
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-text-muted hover:text-accent-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        {/* Header */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-text-main mb-1">{plugin.name}</h1>
              <p className="text-text-muted">by {plugin.author_username}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeColors[plugin.type] || typeColors.misc}`}>
              {plugin.type}
            </span>
          </div>

          <p className="text-text-main mb-4">{plugin.description}</p>

          <div className="flex flex-wrap gap-4 text-sm text-text-muted mb-4">
            <div className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              {plugin.downloads} downloads
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              v{plugin.version}
            </div>
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {plugin.author_username}
            </div>
          </div>

          {plugin.tags && plugin.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {plugin.tags.map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-bg-base rounded-full text-xs text-text-muted">
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Trigger */}
          <div className="bg-bg-base rounded-lg p-4 mb-4">
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">Command</p>
            <code className="text-lg font-mono text-accent-primary">!{plugin.trigger}</code>
            {plugin.aliases && plugin.aliases.length > 0 && (
              <p className="text-xs text-text-muted mt-1">
                Aliases: {plugin.aliases.map((a: string) => `!${a}`).join(", ")}
              </p>
            )}
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-accent-primary text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            {downloading ? "Downloading..." : "Download Plugin (.json)"}
          </button>
        </div>

        {/* How to Install */}
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-main mb-4">How to Install</h2>
          <ol className="space-y-3 text-sm text-text-muted">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-accent-primary text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <span>Click "Download Plugin" above to save the <code className="bg-bg-base px-1.5 py-0.5 rounded text-accent-primary">.json</code> file</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-accent-primary text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <span>Open your WXATA Dashboard and go to the <strong className="text-text-main">Scripts</strong> tab</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-accent-primary text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <span>Click <strong className="text-text-main">"Import"</strong> and select the downloaded <code className="bg-bg-base px-1.5 py-0.5 rounded text-accent-primary">.json</code> file</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-accent-primary text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <span>The plugin is now active! Use <code className="bg-bg-base px-1.5 py-0.5 rounded text-accent-primary">!{plugin.trigger}</code> in WhatsApp</span>
            </li>
          </ol>
        </div>

        {/* Code Preview */}
        {plugin.code && (
          <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border-subtle">
              <button
                onClick={() => setShowCode(!showCode)}
                className="text-sm font-medium text-text-main hover:text-accent-primary transition-colors"
              >
                {showCode ? "Hide Code" : "Show Code"}
              </button>
              {showCode && (
                <button onClick={copyCode} className="flex items-center gap-1 text-xs text-text-muted hover:text-accent-primary transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
            {showCode && (
              <pre className="p-6 overflow-x-auto text-sm font-mono text-text-main bg-bg-base">
                <code>{plugin.code}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
