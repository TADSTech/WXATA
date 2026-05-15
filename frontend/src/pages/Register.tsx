import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabase";
import { SocialBanner } from "../components/SocialBanner";

const WHATSAPP_LINK = "https://wa.me/2347041029093";

export default function Register() {
  const [accountType, setAccountType] = useState<"bot" | "developer">("bot");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userCode, setUserCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (accountType === "developer") {
        const redirectTo = `${window.location.origin}/developer/auth/callback`;
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: { redirectTo },
        });

        if (oauthError) {
          throw new Error(oauthError.message || "GitHub sign-in failed");
        }

        return;
      } else {
        // Bot registration: Supabase auth + user record
        // 1. Verify user_code exists and is valid
        const { data: codeData, error: codeError } = await supabase
          .from("user_codes")
          .select("id, used, suspended")
          .eq("code", userCode)
          .single();

        if (codeError || !codeData) {
          throw new Error(
            `Invalid User Code. Purchase access instantly here: https://selar.co/wxata`,
          );
        }

        if (codeData.suspended) {
          throw new Error(
            `This code has been suspended. Contact support: ${WHATSAPP_LINK}`,
          );
        }

        if (codeData.used) {
          throw new Error(
            `This code has already been used. Buy a new one: https://selar.co/wxata`,
          );
        }

        // 2. Check if username is taken
        const { data: existingUser, error: usernameError } = await supabase
          .from("users")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (usernameError) {
          throw new Error(
            "Error checking username availability. Please try again.",
          );
        }

        if (existingUser) {
          throw new Error("Username is already taken.");
        }

        // 3. Create auth user — pass profile data as metadata so it's stored
        // even if email confirmation is pending
        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name, username },
            },
          });

        if (signUpError || !authData.user) {
          throw new Error(
            signUpError?.message ??
              "Failed to create account. Please try again.",
          );
        }

        const uid = authData.user.id;

        // 4. Insert user record
        // Note: if email confirmation is enabled, signUp returns a user but no
        // active session — auth.uid() is null. We use the service-role-bypass
        // approach: insert with the uid from the signUp response directly.
        // The RLS policy allows anon inserts so this works regardless of session state.
        const { error: insertError } = await supabase.from("users").insert({
          uid,
          name,
          username,
          email,
          user_code: userCode,
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          // Clean up: delete the auth user so they can retry
          console.error("Profile insert failed:", insertError);
          throw new Error(
            `Failed to save user profile: ${insertError.message}`,
          );
        }

        // 5. Mark code as used — do this before redirecting
        const { error: updateError } = await supabase
          .from("user_codes")
          .update({
            used: true,
            used_by: email,
            used_at: new Date().toISOString(),
          })
          .eq("id", codeData.id);

        if (updateError) {
          // Log but don't block — user is created, code marking is best-effort
          console.error(
            "Failed to mark user_code as used:",
            updateError.message,
          );
        }

        navigate(
          `/verify?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}`,
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // If Developer account was created successfully and API key is displayed
  if (accountType === "developer" && apiKey) {
    return (
      <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
        <div className="bg-bg-base border border-border-strong p-8 rounded-xl w-full max-w-md">
          <h2 className="text-3xl font-bold text-accent-primary mb-6 text-center">
            API Key Created
          </h2>
          <div className="bg-green-900/30 border border-green-600 text-green-200 p-4 rounded-lg mb-6">
            <p className="text-sm font-medium mb-2">
              Your API key has been created successfully!
            </p>
            <p className="text-xs text-green-300 mb-3">
              Store it securely. You won't be able to see it again.
            </p>
            <div className="bg-bg-base border border-green-600 rounded p-3 break-all font-mono text-xs">
              {apiKey}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(apiKey);
                setError("Copied to clipboard!");
                setTimeout(() => setError(""), 2000);
              }}
              className="mt-3 w-full py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded transition-colors text-xs"
            >
              Copy to Clipboard
            </button>
          </div>
          <p className="text-center text-sm text-text-muted mb-4">
            You can now use this API key to access the bot API.
          </p>
          <button
            onClick={() => (window.location.href = "/docs")}
            className="w-full py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl text-sm uppercase tracking-widest transition-all mb-2"
          >
            View API Documentation
          </button>
          <button
            onClick={() => {
              setApiKey("");
              setEmail("");
              setName("");
            }}
            className="w-full py-3 bg-bg-panel-hover hover:bg-border-subtle text-text-main font-bold rounded-xl text-sm uppercase tracking-widest transition-all"
          >
            Create Another Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
      <div className="bg-bg-base border border-border-strong p-8 rounded-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-accent-primary mb-6 text-center">
          Register
        </h2>

        {/* Account Type Toggle */}
        <div className="flex gap-2 mb-6 border-b border-border-subtle">
          <button
            onClick={() => setAccountType("bot")}
            className={`px-4 py-3 font-bold uppercase tracking-widest text-sm transition-colors ${
              accountType === "bot"
                ? "text-accent-primary border-b-2 border-accent-primary -mb-px"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Bot Account
          </button>
          <button
            onClick={() => setAccountType("developer")}
            className={`px-4 py-3 font-bold uppercase tracking-widest text-sm transition-colors ${
              accountType === "developer"
                ? "text-accent-primary border-b-2 border-accent-primary -mb-px"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Developer Account
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 break-words">
            {error}
          </div>
        )}
        <SocialBanner variant="register" />
        <form onSubmit={handleRegister} className="space-y-4 mt-4">
          {accountType === "bot" ? (
            /* Bot Account Form */
            <>
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-sm font-medium mb-1 text-text-muted"
                >
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="reg-username"
                  className="block text-sm font-medium mb-1 text-text-muted"
                >
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-medium mb-1 text-text-muted"
                >
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-sm font-medium mb-1 text-text-muted"
                >
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
                />
              </div>
                  <div className="flex justify-between items-center mb-1">
                    <label
                      htmlFor="reg-code"
                      className="block text-sm font-medium text-text-muted"
                    >
                      Registration Code
                    </label>
                    <a 
                      href="https://selar.co/wxata" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-accent-light hover:text-accent-primary font-semibold transition-colors"
                    >
                      Buy Code Instantly →
                    </a>
                  </div>
                <input
                  id="reg-code"
                  type="text"
                  required
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                  className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
                />
              </div>
            </>
          ) : (
            /* Developer Account Form */
            <>
              <div className="bg-accent-subtle border border-accent-primary/30 rounded-lg p-4 text-sm text-text-main">
                Developer accounts now use GitHub OAuth.
                Continue and authorize GitHub to generate your API key instantly.
              </div>
            </>
          )}
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 uppercase text-sm font-semibold"
          >
            {loading
              ? accountType === "bot"
                ? "Creating Account..."
                : "Redirecting to GitHub..."
              : accountType === "bot"
                ? "Register"
                : "Continue with GitHub"}
          </button>
          {accountType === "developer" && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted text-center">
                Email verification onboarding has been replaced with GitHub sign-in.
              </p>
            </div>
          )}
        </form>

        {/* Navigation Links */}
        <p className="text-center text-xs text-text-muted mt-4">
          {accountType === "bot" ? (
            <>
              Already have an account?{" "}
              <Link to="/login" className="text-accent-primary hover:underline">
                Log in
              </Link>
            </>
          ) : null}
        </p>
        <p className="text-center text-xs text-text-muted mt-2">
          {accountType === "bot"
            ? "Want to use the API instead? "
            : "Want a bot dashboard instead? "}
          <button
            onClick={() =>
              setAccountType(accountType === "bot" ? "developer" : "bot")
            }
            className="text-accent-light hover:text-accent-primary transition-colors font-semibold"
          >
            Switch to {accountType === "bot" ? "Developer" : "Bot"} Account
          </button>
        </p>
      </div>
    </div>
  );
}
