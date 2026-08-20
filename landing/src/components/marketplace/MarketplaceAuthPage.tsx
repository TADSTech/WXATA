import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn, UserPlus, User } from "lucide-react";
import { loginUser, registerUser, setMarketplaceUser, getMarketplaceUser, clearMarketplaceUser } from "./api";

export default function MarketplaceAuthPage() {
  const navigate = useNavigate();
  const existingUser = getMarketplaceUser();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (existingUser) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-6">
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-8 text-center">
          <User className="w-12 h-12 text-accent-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-main mb-1">Logged in as {existingUser.username}</h2>
          <p className="text-text-muted text-sm mb-6">{existingUser.email}</p>
          <div className="flex flex-col gap-3">
            <Link to="/marketplace/publish" className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-hover transition-colors">
              Publish a Plugin
            </Link>
            <Link to="/marketplace/my-plugins" className="px-4 py-2 bg-bg-base border border-border-subtle rounded-lg text-text-muted hover:text-text-main transition-colors">
              My Plugins
            </Link>
            <button
              onClick={() => { clearMarketplaceUser(); navigate("/marketplace"); }}
              className="px-4 py-2 text-danger-text hover:bg-danger-subtle rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let result;
      if (mode === "register") {
        if (!email.trim()) { setError("Email is required"); setLoading(false); return; }
        result = await registerUser(username.trim(), email.trim(), password);
      } else {
        result = await loginUser(username.trim(), password);
      }
      setMarketplaceUser(result.user, result.token);
      navigate("/marketplace");
    } catch (e: any) {
      setError(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-bg-panel border border-border-subtle rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {mode === "login" ? <LogIn className="w-6 h-6 text-accent-primary" /> : <UserPlus className="w-6 h-6 text-accent-primary" />}
              <h1 className="text-2xl font-bold text-text-main">
                {mode === "login" ? "Login" : "Create Account"}
              </h1>
            </div>
            <p className="text-text-muted text-sm">
              {mode === "login" ? "Sign in to publish plugins" : "Join the WXATA marketplace"}
            </p>
          </div>

          {error && (
            <div className="bg-danger-subtle border border-danger-base/30 rounded-lg p-3 mb-4 text-sm text-danger-text">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="yourusername"
                className="w-full px-3 py-2.5 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                required
                minLength={3}
                maxLength={20}
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-bg-base border border-border-subtle rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-sm text-accent-primary hover:underline"
            >
              {mode === "login" ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/marketplace" className="text-sm text-text-muted hover:text-accent-primary transition-colors">
            Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
