import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabase";

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

function looksLikePhone(value: string): boolean {
  return /^[+\d][\d\s-]{7,}$/.test(value.trim());
}

async function signInDeveloperWithGithub() {
  const redirectTo = `${window.location.origin}/developer/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  });

  if (error) throw error;
}

export default function Login() {
  const [accountType, setAccountType] = useState<"bot" | "developer" | "beta">("bot");
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleBotLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const input = identifier.trim();
      let emailToUse = input;

      // If the input doesn't look like an email, treat it as a username
      // and look up the associated email first
      if (!input.includes("@")) {
        const { data: userRow, error: lookupError } = await supabase
          .from("users")
          .select("email")
          .eq("username", input)
          .maybeSingle();

        if (lookupError) {
          throw new Error(`Username lookup failed: ${lookupError.message}`);
        }
        if (!userRow) {
          throw new Error(
            `No account found with username "${input}". Check the spelling or use your email instead.`,
          );
        }
        emailToUse = userRow.email;
      }

      const { data: session, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: emailToUse,
          password,
        });

      if (signInError) throw signInError;

      // Look up username to route to the correct dashboard
      const { data: userRow } = await supabase
        .from("users")
        .select("username")
        .eq("uid", session.user.id)
        .maybeSingle();

      if (userRow?.username) {
        navigate(`/dashboard/${userRow.username}`);
      } else {
        navigate("/dashboard/user");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeveloperLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const input = apiKeyInput.trim();
      if (!input) {
        throw new Error("Use GitHub sign-in or enter an existing API key");
      }

      const response = await fetch("/api/keys/usage", {
        method: "GET",
        headers: {
          "X-API-Key": input,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 403) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Developer account is not verified yet.");
      }

      if (response.status === 401 && looksLikePhone(input)) {
        throw new Error("Recovery phone login is no longer supported. Use GitHub sign-in.");
      }

      if (response.status === 401 && looksLikeEmail(input)) {
        throw new Error("Email login was replaced with GitHub sign-in. Use the GitHub button.");
      }

      if (response.status === 401) {
        throw new Error("Invalid API key");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to verify API key");
      }

      // Store API key in localStorage for developer dashboard
      localStorage.setItem("developerApiKey", input);
      navigate(`/developer/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (accountType === "bot" || accountType === "beta") {
      handleBotLogin(e);
    } else {
      handleDeveloperLogin(e);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
      <div className="bg-bg-base border border-border-strong p-8 rounded-xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-accent-primary rounded-lg font-black text-bg-base text-lg mb-3">
            W
          </div>
          <h2 className="text-3xl font-bold text-accent-primary">Sign In</h2>
        </div>

        {/* Account Type Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border-subtle overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setAccountType("bot")}
            className={`px-4 py-3 font-bold uppercase tracking-widest text-sm transition-colors whitespace-nowrap ${
              accountType === "bot"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Bot Account
          </button>
          <button
            onClick={() => setAccountType("developer")}
            className={`px-4 py-3 font-bold uppercase tracking-widest text-sm transition-colors whitespace-nowrap ${
              accountType === "developer"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Developer
          </button>
          <button
            onClick={() => setAccountType("beta")}
            className={`px-4 py-3 font-bold uppercase tracking-widest text-sm transition-colors whitespace-nowrap flex items-center gap-1 ${
              accountType === "beta"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse"></span>
            TV Beta
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {accountType === "bot" || accountType === "beta" ? (
            // Bot or Beta Account Login Form
            <>
              {accountType === "beta" && (
                <div className="bg-accent-subtle/20 border border-accent-subtle p-3 rounded mb-4 text-xs text-accent-light">
                  <span className="font-bold uppercase tracking-widest block mb-1">Restricted Access</span>
                  TV Dashboard is currently in closed beta. Only authorized admin accounts can login here.
                </div>
              )}
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-medium mb-1 text-text-muted"
                >
                  {accountType === "beta" ? "Admin Email" : "Email"}
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder={accountType === "beta" ? "admin@tadstech.com" : "yourname or you@email.com"}
                  className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary placeholder:text-text-muted/40"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium mb-1 text-text-muted"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            // Developer Account Login Form
            <div className="space-y-4">
              <button
                type="button"
                onClick={async () => {
                  setError("");
                  setLoading(true);
                  try {
                    await signInDeveloperWithGithub();
                  } catch (err: any) {
                    setError(err.message ?? "GitHub sign-in failed");
                    setLoading(false);
                  }
                }}
                className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-widest transition-all disabled:opacity-50"
                disabled={loading}
              >
                Continue with GitHub
              </button>
              <input
                type="text"
                placeholder="Existing API Key (optional)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full bg-bg-base border border-border-strong rounded-xl px-4 py-3 text-text-main text-sm focus:outline-none focus:border-accent-primary"
              />
              <p className="text-xs text-text-muted text-center">
                New developer accounts must use GitHub sign-in. API key input is only for existing keys.
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {loading
              ? (accountType === "bot" || accountType === "beta")
                ? "Signing in..."
                : "Checking..."
              : (accountType === "bot" || accountType === "beta")
                ? "Sign In"
                : "Check Usage"}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted mt-4">
          {(accountType === "bot" || accountType === "beta") ? (
            <>
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-accent-light hover:text-accent-primary"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Don't have an API key?{" "}
              <Link
                to="/developer"
                className="text-accent-light hover:text-accent-primary"
              >
                Get one free
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
