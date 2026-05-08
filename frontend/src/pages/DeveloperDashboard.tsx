import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Zap,
  QrCode,
  Wifi,
  Phone,
  Activity,
  Clock3,
} from "lucide-react";
import { useWXATASocket } from "../hooks/useWXATASocket";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UsageData {
  email: string;
  name: string;
  messages_sent: number;
  messages_limit: number;
  paid_credits: number;
  active: boolean;
  total_quota: number;
}

interface TopupInit {
  tx_ref: string;
  amount: number;
  credits: number;
  flw_public_key: string;
}

interface KeyCreateResponse {
  key: string | null;
  limit: number;
  created: boolean;
  pending?: boolean;
  verified?: boolean;
  email?: string;
  messages_sent?: number;
}

interface FlutterwaveOptions {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  customer: { email: string; name: string };
  callback: (response: {
    status: string;
    transaction_id?: string;
    tx_ref: string;
  }) => void;
  onclose: () => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (opts: FlutterwaveOptions) => void;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getBaseUrl(): string {
  const raw = import.meta.env.VITE_BACKEND_URL as string | undefined;
  return (
    raw?.replace(/^wss?:\/\//, "https://").replace(/\/ws$/, "") ??
    "http://localhost:5000"
  );
}

function maskKey(key: string): string {
  if (key.length <= 16) return key;
  return key.slice(0, 16) + "•".repeat(Math.min(key.length - 16, 20));
}

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

function getWebSocketUrl(): string {
  const raw = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const resolved = raw ?? "ws://localhost:5000";
  return resolved
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .replace(/\/ws$/, "")
    .replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Code snippet templates
// ---------------------------------------------------------------------------
function buildSnippets(apiKey: string): Record<string, string> {
  const displayKey = apiKey || "<YOUR_API_KEY>";
  return {
    curl: `curl -X POST https://your-bot-url/api/send \\
  -H "X-API-Key: ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "2348012345678", "message": "Hello from WXATA!"}'`,
    javascript: `const response = await fetch('https://your-bot-url/api/send', {
  method: 'POST',
  headers: {
    'X-API-Key': '${displayKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '2348012345678',
    message: 'Hello from WXATA!',
  }),
});

const data = await response.json();
console.log(data); // { sent: true, remaining: 99 }`,
    python: `import requests

response = requests.post(
    'https://your-bot-url/api/send',
    headers={'X-API-Key': '${displayKey}'},
    json={'to': '2348012345678', 'message': 'Hello from WXATA!'}
)
print(response.json())  # {'sent': True, 'remaining': 99}`,
  };
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  colorClass,
  bgClass,
}: {
  label: string;
  value: number | string;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={`border rounded-xl p-4 text-center ${bgClass}`}>
      <div className={`text-3xl font-black ${colorClass}`}>{value}</div>
      <div className="text-xs text-text-muted uppercase tracking-widest mt-1">
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DeveloperDashboard() {
  const navigate = useNavigate();
  const backendWsUrl = getWebSocketUrl();
  const { status: wsStatus, attempt: wsAttempt, send, lastMessage } =
    useWXATASocket(backendWsUrl);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [submittedKey, setSubmittedKey] = useState("");
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [botStatus, setBotStatus] = useState({
    connection: "DISCONNECTED",
    uptime: "00h 00m 00s",
    memory: "0MB / 512MB",
  });
  const [qrData, setQrData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<"NONE" | "QR" | "PHONE">(
    "NONE",
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const [keyCopied, setKeyCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"curl" | "javascript" | "python">(
    "curl",
  );
  const [codeCopied, setCodeCopied] = useState(false);

  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState("");
  const [topupSuccess, setTopupSuccess] = useState(false);

  // Inject Flutterwave script once
  useEffect(() => {
    if (document.getElementById("flw-inline-js")) return;
    const script = document.createElement("script");
    script.id = "flw-inline-js";
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== "object") return;

    const message = lastMessage as Record<string, unknown>;
    const event = message.event as string;
    const data = message.data as Record<string, unknown> | string | undefined;

    if (event === "status" && data && typeof data === "object") {
      setBotStatus({
        connection: (data.connection as string) ?? "DISCONNECTED",
        uptime: (data.uptime as string) ?? "00h 00m 00s",
        memory: (data.memory as string) ?? "0MB / 512MB",
      });

      if (data.connection === "CONNECTED") {
        setAuthMethod("NONE");
        setQrData(null);
        setPairingCode(null);
        setIsConnecting(false);
      }
    } else if (event === "qr" && typeof data === "string") {
      setQrData(data);
      setIsConnecting(false);
    } else if (event === "pairing-code" && typeof data === "string") {
      setPairingCode(data);
      setIsConnecting(false);
    }
  }, [lastMessage]);

  const startConnection = (method: "QR" | "PHONE") => {
    setIsConnecting(true);
    setAuthMethod(method);
    send({
      command: "START_CONNECTION",
      data: {
        method,
        phoneNumber: method === "PHONE" ? phoneNumber.trim() : undefined,
      },
    });
  };

  const loadUsage = async (key: string) => {
    const input = key.trim();
    if (!input) return;
    setLoadingUsage(true);
    setUsageError("");
    try {
      const usageResponse = await fetch(`${getBaseUrl()}/api/keys/usage`, {
        headers: { "X-API-Key": input },
      });

      if (usageResponse.status === 401 && looksLikeEmail(input)) {
        const createResponse = await fetch(`${getBaseUrl()}/api/keys/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: input }),
        });

        if (!createResponse.ok) {
          const body = (await createResponse.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          throw new Error(
            body.error ?? body.message ?? `Request failed: ${createResponse.status}`,
          );
        }

        const createdKey = (await createResponse.json()) as KeyCreateResponse;
        if (!createdKey.key) {
          throw new Error(
            createdKey.pending
              ? `Verification email sent to ${input}. Confirm it before checking usage.`
              : "Failed to resolve API key from email",
          );
        }

        localStorage.setItem("developerApiKey", createdKey.key);

        const retryResponse = await fetch(`${getBaseUrl()}/api/keys/usage`, {
          headers: { "X-API-Key": createdKey.key },
        });

        if (!retryResponse.ok) {
          const body = (await retryResponse.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          throw new Error(body.error ?? body.message ?? `Request failed: ${retryResponse.status}`);
        }

        const retryData = (await retryResponse.json()) as UsageData;
        setUsage(retryData);
        setSubmittedKey(createdKey.key);
        return;
      }

      if (usageResponse.status === 401) {
        throw new Error(looksLikeEmail(input) ? "No API key found for that email" : "Invalid API key");
      }
      if (!usageResponse.ok) throw new Error(`Request failed: ${usageResponse.status}`);
      const data = (await usageResponse.json()) as UsageData;
      setUsage(data);
      setSubmittedKey(input);
    } catch (err: unknown) {
      setUsageError(
        err instanceof Error ? err.message : "Failed to load usage",
      );
      setUsage(null);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleCheckUsage = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsage(apiKeyInput);
  };

  // Auto-load API key from localStorage (if coming from login page)
  useEffect(() => {
    const savedKey = localStorage.getItem("developerApiKey");
    if (savedKey) {
      setApiKeyInput(savedKey);
      loadUsage(savedKey);
    }
  }, []);

  // ── Computed values ──────────────────────────────────────────────────────
  const remaining = usage ? usage.total_quota - usage.messages_sent : 0;
  const usagePct =
    usage && usage.total_quota > 0
      ? Math.min(
          100,
          Math.round((usage.messages_sent / usage.total_quota) * 100),
        )
      : 0;
  const barColor =
    usagePct >= 90
      ? "bg-danger-base"
      : usagePct >= 70
        ? "bg-warning-base"
        : "bg-accent-primary";

  const snippets = buildSnippets(submittedKey);

  const copyKey = () => {
    if (!submittedKey) return;
    navigator.clipboard.writeText(submittedKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const copyCode = () => {
    const snippets = buildSnippets(submittedKey);
    navigator.clipboard.writeText(snippets[activeTab] ?? "");
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleTopUp = async () => {
    if (!submittedKey || !usage) return;
    setTopupLoading(true);
    setTopupError("");
    setTopupSuccess(false);
    try {
      const res = await fetch(`${getBaseUrl()}/api/keys/topup/init`, {
        method: "POST",
        headers: { "X-API-Key": submittedKey },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      const { tx_ref, amount, credits, flw_public_key } =
        (await res.json()) as TopupInit;

      if (!flw_public_key || !window.FlutterwaveCheckout) {
        throw new Error(
          "Payment system is not configured. Please contact support.",
        );
      }

      window.FlutterwaveCheckout({
        public_key: flw_public_key,
        tx_ref,
        amount,
        currency: "NGN",
        customer: {
          email: usage.email,
          name: usage.name || "Developer",
        },
        callback: (response) => {
          if (
            response.status === "successful" ||
            response.status === "completed"
          ) {
            setTopupSuccess(true);
            setTimeout(() => loadUsage(submittedKey), 2000);
          }
        },
        onclose: () => {
          setTopupLoading(false);
        },
      });

      // Note: flutterwave opens a modal — loading will be reset by onclose
      void credits; // credits is shown in the topup/init response for info
    } catch (err: unknown) {
      setTopupError(err instanceof Error ? err.message : "Top-up failed");
      setTopupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 px-8 py-5 flex justify-between items-center border-b border-border-subtle/50 backdrop-blur-md bg-bg-base/80">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="w-8 h-8 bg-accent-primary rounded flex items-center justify-center font-black text-bg-base">
            W
          </div>
          <span className="font-black text-xl tracking-tighter text-text-main">
            WX<span className="text-accent-primary">ATA</span>
            <span className="text-text-muted font-normal text-sm ml-2">
              Send API
            </span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/developer")}
            className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest hidden sm:block"
          >
            Get API Key
          </button>
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest"
          >
            Sign In
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-accent-light font-mono text-xs tracking-widest mb-2">
            // DEVELOPER DASHBOARD
          </div>
          <h1 className="text-3xl font-black text-text-main tracking-tight">
            API Usage & Credits
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Enter your API key to view usage stats and manage credits.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-bg-panel border border-border-strong rounded-2xl p-6 space-y-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs text-text-muted uppercase tracking-widest mb-1">
                WhatsApp Connection
              </div>
              <h2 className="text-lg font-bold text-text-main">
                Connect your WhatsApp to start sending
              </h2>
              <p className="text-sm text-text-muted mt-1">
                Use QR or phone pairing. Connection state is kept only in this session.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Activity className="w-4 h-4 text-accent-light" />
              <span className="uppercase tracking-widest text-text-muted">
                WS: {wsStatus}
                {wsStatus === "reconnecting" ? ` (${wsAttempt})` : ""}
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 bg-bg-base border border-border-subtle rounded-xl">
                {qrData ? (
                  <div className="p-2 bg-white rounded">
                    <QRCodeSVG value={qrData} size={150} />
                  </div>
                ) : (
                  <div className="w-[150px] h-[150px] flex items-center justify-center border border-dashed border-border-subtle">
                    {isConnecting && authMethod === "QR" ? (
                      <RefreshCw className="w-8 h-8 animate-spin text-accent-light" />
                    ) : (
                      <QrCode className="w-12 h-12 text-accent-primary" />
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => startConnection("QR")}
                disabled={isConnecting || wsStatus !== "connected"}
                className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-base px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
              >
                <Wifi className="w-4 h-4" /> Connect QR
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              {pairingCode ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs uppercase text-text-muted">
                    Pairing Code
                  </span>
                  <div className="text-4xl font-mono font-black tracking-widest text-accent-light bg-bg-panel px-6 py-3 border border-border-strong rounded">
                    {pairingCode}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 w-full max-w-xs">
                  {showPhoneInput && (
                    <input
                      type="text"
                      placeholder="Phone (e.g. 2348012345678)"
                      className="w-full bg-bg-base border border-border-strong p-2 text-accent-light text-center font-mono focus:border-border-strong outline-none placeholder:text-accent-primary/50"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  )}
                  <button
                    onClick={() => {
                      if (!showPhoneInput) {
                        setShowPhoneInput(true);
                        return;
                      }
                      if (!phoneNumber.trim()) return;
                      startConnection("PHONE");
                    }}
                    disabled={isConnecting || (showPhoneInput && !phoneNumber.trim()) || wsStatus !== "connected"}
                    className="w-full flex items-center justify-center gap-2 bg-bg-panel border border-border-strong hover:bg-accent-subtle disabled:border-border-strong disabled:text-text-muted text-accent-light px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
                  >
                    <Phone className="w-4 h-4" />
                    {showPhoneInput ? "Link via Phone" : "Connect Phone"}
                  </button>
                </div>
              )}

              {botStatus.connection === "CONNECTED" ? (
                <div className="w-full rounded-lg border border-success-base/30 bg-success-subtle p-3 text-success-text text-sm text-center">
                  WhatsApp is connected and ready.
                </div>
              ) : (
                <div className="w-full rounded-lg border border-warning-base/30 bg-warning-subtle p-3 text-warning-text text-sm text-center">
                  WhatsApp is not connected yet. Connect it before sending API messages.
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Clock3 className="w-3.5 h-3.5" />
                <span>
                  Uptime: {botStatus.uptime} • Memory: {botStatus.memory}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── API Key Entry ── */}
        {!usage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-bg-panel border border-border-strong rounded-2xl p-8 space-y-4"
          >
            <form onSubmit={handleCheckUsage} className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-2">
                  Your API Key
                </label>
                <input
                  type="text"
                  placeholder="wxata_live_..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-bg-base border border-border-strong rounded-xl px-4 py-3 font-mono text-sm text-accent-light focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>
              {usageError && (
                <div className="p-3 bg-danger-subtle border border-danger-base/40 rounded-lg text-danger-text text-sm">
                  {usageError}
                </div>
              )}
              <button
                type="submit"
                disabled={loadingUsage || !apiKeyInput.trim()}
                className="w-full py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingUsage ? "Loading..." : "Check Usage"}
              </button>
            </form>
            <p className="text-center text-xs text-text-muted">
              Don't have a key yet?{" "}
              <button
                onClick={() => navigate("/developer")}
                className="text-accent-light hover:text-accent-primary transition-colors inline-flex items-center gap-1"
              >
                Get one free <ArrowRight className="w-3 h-3" />
              </button>
            </p>
          </motion.div>
        )}

        {/* ── Usage Stats ── */}
        {usage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* API Key display */}
            <div className="bg-bg-panel border border-border-strong rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-widest mb-1">
                    API Key
                  </div>
                  <div className="font-mono text-accent-light text-sm">
                    {maskKey(submittedKey)}
                  </div>
                  {usage.email && (
                    <div className="text-xs text-text-muted mt-0.5">
                      {usage.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyKey}
                    className="p-2 bg-accent-subtle border border-border-strong rounded-lg hover:bg-accent-primary/20 transition-colors"
                    title="Copy key"
                  >
                    {keyCopied ? (
                      <Check className="w-4 h-4 text-success-text" />
                    ) : (
                      <Copy className="w-4 h-4 text-accent-light" />
                    )}
                  </button>
                  <button
                    onClick={() => loadUsage(submittedKey)}
                    className="p-2 bg-accent-subtle border border-border-strong rounded-lg hover:bg-accent-primary/20 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-accent-light ${loadingUsage ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setUsage(null);
                      setSubmittedKey("");
                      setApiKeyInput("");
                    }}
                    className="text-xs text-text-muted hover:text-danger-text transition-colors px-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {!usage.active && (
                <div className="p-3 bg-danger-subtle border border-danger-base/40 rounded-lg text-danger-text text-sm">
                  ⚠️ This API key has been suspended. Contact support to
                  reactivate.
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Messages Sent"
                value={usage.messages_sent}
                colorClass="text-info-text"
                bgClass="bg-info-subtle border-info-base/30"
              />
              <StatCard
                label="Free Quota"
                value={usage.messages_limit}
                colorClass="text-accent-light"
                bgClass="bg-accent-subtle border-border-strong"
              />
              <StatCard
                label="Paid Credits"
                value={usage.paid_credits}
                colorClass="text-success-text"
                bgClass="bg-success-subtle border-success-base/30"
              />
              <StatCard
                label="Remaining"
                value={remaining}
                colorClass={
                  remaining <= 10 ? "text-danger-text" : "text-text-main"
                }
                bgClass={
                  remaining <= 10
                    ? "bg-danger-subtle border-danger-base/30"
                    : "bg-bg-panel border-border-strong"
                }
              />
            </div>

            {/* Progress bar */}
            <div className="bg-bg-panel border border-border-strong rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Usage</span>
                <span>
                  {usage.messages_sent} / {usage.total_quota}
                </span>
              </div>
              <div className="h-2.5 bg-bg-base rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${barColor}`}
                />
              </div>
              <div className="text-xs text-text-muted text-right">
                {usagePct}% used
              </div>
            </div>

            {/* Top Up card */}
            <div className="bg-bg-panel border border-border-strong rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent-light" />
                    Top Up Credits
                  </h2>
                  <p className="text-text-muted text-sm mt-1">
                    Add 500 more messages for ₦2,000. Instant activation.
                  </p>
                </div>
              </div>
              {topupSuccess && (
                <div className="p-3 bg-success-subtle border border-success-base/40 rounded-lg text-success-text text-sm">
                  ✓ Payment successful! Your credits will be updated shortly.
                </div>
              )}
              {topupError && (
                <div className="p-3 bg-danger-subtle border border-danger-base/40 rounded-lg text-danger-text text-sm">
                  {topupError}
                </div>
              )}
              <button
                onClick={handleTopUp}
                disabled={topupLoading || !usage.active}
                className="w-full py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(139,92,246,0.2)]"
              >
                {topupLoading
                  ? "Opening payment..."
                  : "Top Up — ₦2,000 for 500 messages"}
              </button>
            </div>

            {/* Code snippets */}
            <div className="bg-bg-panel border border-border-strong rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-text-main">Quick Start</h2>
              {/* Tabs */}
              <div className="flex gap-1 bg-bg-base rounded-lg p-1 border border-border-subtle w-fit">
                {(["curl", "javascript", "python"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded text-xs font-mono uppercase tracking-widest transition-all ${
                      activeTab === tab
                        ? "bg-accent-primary text-bg-base font-bold"
                        : "text-text-muted hover:text-text-main"
                    }`}
                  >
                    {tab === "javascript" ? "JS" : tab}
                  </button>
                ))}
              </div>
              {/* Code block */}
              <div className="relative">
                <pre className="bg-black/40 border border-border-subtle rounded-lg p-4 font-mono text-xs text-text-muted overflow-x-auto leading-relaxed whitespace-pre">
                  {snippets[activeTab]}
                </pre>
                <button
                  onClick={copyCode}
                  className="absolute top-3 right-3 p-1.5 bg-bg-panel border border-border-strong rounded transition-colors hover:border-accent-primary"
                  title="Copy code"
                >
                  {codeCopied ? (
                    <Check className="w-3 h-3 text-success-text" />
                  ) : (
                    <Copy className="w-3 h-3 text-text-muted" />
                  )}
                </button>
              </div>
              <p className="text-xs text-text-muted">
                Replace{" "}
                <code className="text-accent-light text-[11px] bg-accent-subtle px-1 py-0.5 rounded">
                  your-bot-url
                </code>{" "}
                with your deployed WXATA backend URL.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
