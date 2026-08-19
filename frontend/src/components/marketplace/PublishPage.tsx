import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Send, Code, Info, Tag } from "lucide-react";
import { publishPlugin, getMarketplaceUser } from "./api";

const PLUGIN_TYPES = ["tools", "fun", "core", "admin", "group", "misc"];

export default function PublishPage() {
  const navigate = useNavigate();
  const user = getMarketplaceUser();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [aliases, setAliases] = useState("");
  const [type, setType] = useState("tools");
  const [target, setTarget] = useState("chat");
  const [response, setResponse] = useState("");
  const [code, setCode] = useState("");
  const [defaultArgument, setDefaultArgument] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted text-lg">You must be logged in to publish</p>
        <Link to="/marketplace/login" className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-hover transition-colors">
          Login / Register
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !trigger.trim() || !description.trim()) {
      setError("Name, trigger, and description are required");
      return;
    }

    setLoading(true);
    try {
      await publishPlugin({
        name: name.trim(),
        description: description.trim(),
        trigger: trigger.trim().toLowerCase(),
        aliases: aliases.split(",").map(a => a.trim()).filter(Boolean),
        type,
        target,
        response: response.trim(),
        code: code.trim(),
        default_argument: defaultArgument.trim(),
        version,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        author_username: user.username,
      });
      navigate("/marketplace");
    } catch (e: any) {
      setError(e.message || "Failed to publish plugin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-text-muted hover:text-accent-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        <div className="bg-bg-panel border border-border-subtle rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Send className="w-6 h-6 text-accent-primary" />
            <h1 className="text-2xl font-bold text-text-main">Publish Plugin</h1>
          </div>

          {error && (
            <div className="bg-danger-subtle border border-danger-base/30 rounded-lg p-3 mb-4 text-sm text-danger-text">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Plugin Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="My Awesome Plugin"
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Trigger Word *</label>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">!</span>
                  <input
                    type="text"
                    value={trigger}
                    onChange={e => setTrigger(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                    placeholder="mycommand"
                    className="flex-1 px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary font-mono"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Description *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does your plugin do?"
                rows={2}
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Category</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main focus:outline-none focus:border-accent-primary"
                >
                  {PLUGIN_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Target</label>
                <select
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main focus:outline-none focus:border-accent-primary"
                >
                  <option value="chat">Chat</option>
                  <option value="self">Self (DM)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Aliases (comma-separated)</label>
                <input
                  type="text"
                  value={aliases}
                  onChange={e => setAliases(e.target.value)}
                  placeholder="alias1, alias2"
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="utility, tools, helpful"
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Default Argument</label>
              <input
                type="text"
                value={defaultArgument}
                onChange={e => setDefaultArgument(e.target.value)}
                placeholder="Default value when no argument is provided"
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Static Response (if no code)</label>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Static text response (leave empty if using code)"
                rows={2}
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none"
              />
            </div>

            {/* Code Editor */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Code className="w-4 h-4 text-accent-primary" />
                <label className="text-sm font-medium text-text-main">Plugin Code (JavaScript)</label>
              </div>
              <div className="bg-bg-base border border-border-subtle rounded-lg p-3 mb-2">
                <div className="flex items-start gap-2 text-xs text-text-muted">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    Available: <code className="text-accent-primary">sock</code>, <code className="text-accent-primary">msg</code>, <code className="text-accent-primary">remoteJid</code>, <code className="text-accent-primary">argumentName</code>, <code className="text-accent-primary">sendTrackedMessage()</code>, <code className="text-accent-primary">botInfo</code>, <code className="text-accent-primary">require()</code>
                  </span>
                </div>
              </div>
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={'await sendTrackedMessage(sock, remoteJid, "Hello!");'}
                rows={10}
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none font-mono text-sm"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {loading ? "Publishing..." : "Publish Plugin"}
              </button>
              <Link
                to="/marketplace"
                className="px-6 py-2.5 bg-bg-base border border-border-subtle rounded-lg text-text-muted hover:text-text-main transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
