import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  signInBotWithPassword,
  signInDeveloperWithGithub,
  signInBotWithGoogle,
  findUserByUsername,
  findUserByEmail,
  findUserByUid,
  updateUser,
} from "../firebase";

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

function looksLikePhone(value: string): boolean {
  return /^[+\d][\d\s-]{7,}$/.test(value.trim());
}

export default function Login() {
  const [accountType, setAccountType] = useState<"bot" | "developer">("bot");
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
        const userRow = await findUserByUsername(input);
        if (!userRow) {
          throw new Error(
            `No account found with username "${input}". Check the spelling or use your email instead.`,
          );
        }
        emailToUse = userRow.email as string;
      }

      const userCredential = await signInBotWithPassword(emailToUse, password);

      // Look up username to route to the correct dashboard
      const userRow = await findUserByUid(userCredential.user.uid);

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

  // Google sign-in for bot accounts. If the Google email matches an existing
  // bot account (created via email/password), link it so the user can sign in
  // without typing a password. We keep the Firestore `users` doc under its
  // original uid and record the Google uid in a `google_uid` field.
  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInBotWithGoogle();
      const googleUser = userCredential.user;
      const googleUid = googleUser.uid;
      const googleEmail = (googleUser.email ?? "").toLowerCase();

      // 1. Already linked — the users doc has this uid in `google_uid`
      const byGoogleUid = await findUserByEmail(googleEmail);

      // 2. Existing email/password account — attach the Google uid to it
      if (byGoogleUid && byGoogleUid.google_uid !== googleUid) {
        await updateUser(byGoogleUid.id, {
          google_uid: googleUid,
          linked_at: new Date().toISOString(),
        });
      }

      // 3. No bot account yet — create a starter record keyed by the Google uid
      if (!byGoogleUid) {
        const existingUidUser = await findUserByUid(googleUid);
        if (!existingUidUser) {
          await updateUser(googleUid, {
            name: googleUser.displayName ?? googleUser.email?.split("@")[0] ?? "",
            username: "",
            email: googleEmail,
            auth_provider: "google",
            created_at: new Date().toISOString(),
          });
        }
      }

      const userRow =
        byGoogleUid ??
        (await findUserByUid(googleUid));

      if (userRow?.username) {
        navigate(`/dashboard/${userRow.username}`);
      } else {
        navigate("/dashboard/user");
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (accountType === "bot") {
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

        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {accountType === "bot" ? (
            // Bot Account Login Form
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-bg-panel-hover hover:bg-border-subtle text-text-main font-bold py-3 px-4 rounded-xl text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-border-subtle"></div>
                <span className="text-xs text-text-muted uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border-subtle"></div>
              </div>
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-medium mb-1 text-text-muted"
                >
                  Email
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="yourname or you@email.com"
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
              ? (accountType === "bot")
                ? "Signing in..."
                : "Checking..."
              : (accountType === "bot")
                ? "Sign In"
                : "Check Usage"}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted mt-4">
          {(accountType === "bot") ? (
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
