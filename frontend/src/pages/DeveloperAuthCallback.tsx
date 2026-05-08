import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "../supabase";

type State = "loading" | "success" | "error";

function getBaseUrl(): string {
  const raw = import.meta.env.VITE_BACKEND_URL as string | undefined;
  return (
    raw?.replace(/^wss?:\/\//, "https://").replace(/\/ws$/, "") ??
    "http://localhost:5000"
  );
}

export default function DeveloperAuthCallback() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("Completing GitHub sign-in...");

  useEffect(() => {
    const run = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error("GitHub session not found. Please try signing in again.");
        }

        const response = await fetch(`${getBaseUrl()}/api/keys/github/upsert`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Request failed: ${response.status}`);
        }

        const data = (await response.json()) as { key?: string };
        if (!data.key) {
          throw new Error("No API key was returned for this GitHub account.");
        }

        localStorage.setItem("developerApiKey", data.key);
        setState("success");
        setMessage("GitHub account linked. Redirecting to your developer dashboard...");
        setTimeout(() => navigate("/developer/dashboard"), 1200);
      } catch (err) {
        setState("error");
        setMessage(err instanceof Error ? err.message : "GitHub sign-in failed.");
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-panel border border-border-strong rounded-2xl p-8 w-full max-w-md text-center space-y-5"
      >
        {state === "loading" && <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent-light" />}
        {state === "success" && <CheckCircle2 className="w-10 h-10 mx-auto text-success-text" />}
        {state === "error" && <XCircle className="w-10 h-10 mx-auto text-danger-text" />}

        <h1 className="text-xl font-black text-text-main">Developer GitHub Auth</h1>
        <p className="text-sm text-text-muted">{message}</p>

        {state === "error" && (
          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 rounded-xl bg-accent-primary hover:bg-accent-hover text-bg-base font-bold text-sm uppercase tracking-widest transition-colors"
          >
            Back to Sign In
          </button>
        )}
      </motion.div>
    </div>
  );
}
