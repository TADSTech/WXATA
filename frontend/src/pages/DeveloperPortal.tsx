import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Terminal,
  Zap,
  TrendingUp,
  Copy,
  Check,
  ArrowRight,
  Code2,
} from "lucide-react";
import { SocialBanner } from "../components/SocialBanner";
import { supabase } from "../supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ApiKeyResult {
  key: string | null;
  limit: number;
  created: boolean;
  pending?: boolean;
  verified?: boolean;
  email?: string;
  messages_sent?: number;
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------
function StepCard({
  icon: Icon,
  step,
  title,
  desc,
  delay,
}: {
  icon: React.ElementType;
  step: number;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="border border-border-subtle bg-bg-panel/20 rounded-xl p-6 space-y-4 hover:border-border-strong hover:bg-bg-panel/40 transition-all"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-text-muted border border-border-subtle rounded px-2 py-0.5">
          0{step}
        </span>
        <div className="w-8 h-8 rounded-lg bg-accent-subtle border border-border-subtle flex items-center justify-center">
          <Icon className="w-4 h-4 text-accent-light" />
        </div>
      </div>
      <h3 className="font-bold text-text-main text-lg">{title}</h3>
      <p className="text-text-muted text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Pricing card
// ---------------------------------------------------------------------------
function PricingCard({
  name,
  price,
  priceNote,
  features,
  highlight,
}: {
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`rounded-2xl p-8 flex flex-col gap-5 w-full max-w-xs border ${
        highlight
          ? "bg-accent-subtle border-accent-primary shadow-[0_0_30px_rgba(139,92,246,0.2)]"
          : "bg-bg-panel border-border-strong"
      }`}
    >
      <div>
        <h3 className="text-lg font-black text-accent-light tracking-tight mb-1">
          {name}
        </h3>
        <div className="text-4xl font-black text-text-main">{price}</div>
        <div className="text-xs text-text-muted mt-1">{priceNote}</div>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-text-muted"
          >
            <Check className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DeveloperPortal() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiKeyResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleGetKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const redirectTo = `${window.location.origin}/developer/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo },
      });

      if (oauthError) {
        throw new Error(oauthError.message || "GitHub sign-in failed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (!result?.key) return;
    navigator.clipboard.writeText(result.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            onClick={() => navigate("/developer/dashboard")}
            className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest hidden sm:block"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="w-full px-8 py-28 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl space-y-6"
        >
          <div className="inline-block text-xs font-mono text-accent-light/60 border border-border-subtle px-4 py-1 rounded-full">
            // WXATA SEND API
          </div>
          <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-black tracking-tighter text-text-main leading-tight">
            Send WhatsApp Messages
            <br />
            <span className="text-accent-primary">Programmatically</span>
          </h1>
          <p className="text-xl text-text-muted max-w-xl mx-auto leading-relaxed">
            100 free messages to get started. No credit card required. One API
            call, infinite possibilities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={scrollToForm}
              className="px-8 py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl transition-all tracking-wide text-sm uppercase shadow-[0_0_20px_rgba(139,92,246,0.3)]"
            >
              Get Free API Key
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/developer/dashboard")}
              className="px-8 py-3 border border-border-strong text-text-main hover:bg-bg-panel/30 font-bold rounded-xl transition-all tracking-wide text-sm uppercase flex items-center gap-2 justify-center"
            >
              View Dashboard <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="w-full px-8 md:px-20 py-20 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <div className="text-accent-light font-mono text-xs tracking-widest mb-3">
            // HOW IT WORKS
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-text-main tracking-tight">
            Three steps to production
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StepCard
            icon={Terminal}
            step={1}
            title="Sign In With GitHub"
            desc="Use GitHub OAuth to create or link your developer profile instantly. No email verification flow."
            delay={0}
          />
          <StepCard
            icon={Zap}
            step={2}
            title="Make API Calls"
            desc="POST to /api/send with your key, a phone number, and your message. That's it."
            delay={0.1}
          />
          <StepCard
            icon={TrendingUp}
            step={3}
            title="Scale as Needed"
            desc="100 free messages included. Top up with ₦2,000 for 500 more, any time."
            delay={0.2}
          />
        </div>
      </section>

      {/* ── Code example ── */}
      <section className="w-full px-8 md:px-20 py-20 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <div className="text-info-text font-mono text-xs tracking-widest mb-3">
            // QUICK EXAMPLE
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-text-main tracking-tight">
            One call. Real delivery.
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Request */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-bg-panel border border-border-strong rounded-xl p-6 font-mono text-sm space-y-1"
          >
            <div className="text-text-muted text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
              <Code2 className="w-3 h-3" /> Request
            </div>
            <div>
              <span className="text-accent-primary font-bold">POST</span>{" "}
              <span className="text-text-muted">https://your-bot-url</span>
              <span className="text-accent-light">/api/send</span>
            </div>
            <div className="text-text-muted">
              X-API-Key:{" "}
              <span className="text-green-400">wxata_live_••••••••</span>
            </div>
            <div className="text-text-muted">
              Content-Type:{" "}
              <span className="text-info-text">application/json</span>
            </div>
            <div className="mt-4 text-text-muted">{"{"}</div>
            <div className="pl-4">
              <span className="text-info-text">"to"</span>
              <span className="text-text-muted">: </span>
              <span className="text-green-400">"2348012345678"</span>
              <span className="text-text-muted">,</span>
            </div>
            <div className="pl-4">
              <span className="text-info-text">"message"</span>
              <span className="text-text-muted">: </span>
              <span className="text-green-400">"Hello from WXATA API!"</span>
            </div>
            <div className="text-text-muted">{"}"}</div>
          </motion.div>

          {/* Response */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-bg-panel border border-border-strong rounded-xl p-6 font-mono text-sm space-y-1"
          >
            <div className="text-text-muted text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
              <Check className="w-3 h-3 text-success-text" /> Response{" "}
              <span className="text-success-text text-[10px]">200 OK</span>
            </div>
            <div className="text-text-muted">{"{"}</div>
            <div className="pl-4">
              <span className="text-info-text">"sent"</span>
              <span className="text-text-muted">: </span>
              <span className="text-accent-primary">true</span>
              <span className="text-text-muted">,</span>
            </div>
            <div className="pl-4">
              <span className="text-info-text">"remaining"</span>
              <span className="text-text-muted">: </span>
              <span className="text-success-text">99</span>
            </div>
            <div className="text-text-muted">{"}"}</div>
            <div className="mt-6 p-3 bg-success-subtle border border-success-base/30 rounded-lg">
              <div className="text-success-text text-xs font-sans">
                ✓ Message delivered to WhatsApp
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="w-full px-8 py-20 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <div className="text-accent-light font-mono text-xs tracking-widest mb-3">
            // PRICING
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-text-main tracking-tight">
            Choose your plan
          </h2>
          <p className="text-text-muted text-sm mt-2 max-w-2xl mx-auto">
            Start free with 100 messages. Upgrade to Pro for 10,000/month, or
            pay-as-you-grow: ₦1,000 for 2,000 msgs or ₦2,000 for 5,000 msgs.
          </p>
        </motion.div>
        <div className="flex flex-col lg:flex-row gap-8 justify-center items-center flex-wrap">
          <PricingCard
            name="Developer Free"
            price="₦0"
            priceNote="100 free messages"
            features={[
              "100 free messages",
              "Instant API key",
              "Pay-per-topup option",
              "REST API access",
              "Full documentation",
            ]}
            highlight
          />
          <div className="w-full h-px bg-border-subtle my-4 lg:hidden"></div>
          <PricingCard
            name="Developer Pro"
            price="₦3,200"
            priceNote="Monthly subscription"
            features={[
              "10,000 messages/month",
              "Priority email support",
              "Webhook callbacks",
              "Usage analytics",
              "Automatic renewal",
            ]}
          />
          <PricingCard
            name="TopUp: ₦1K for 2K"
            price="₦1,000"
            priceNote="2,000 messages"
            features={[
              "2,000 messages",
              "Stack with Free tier",
              "Instant activation",
              "Flexible renewal",
              "Best for light users",
            ]}
          />
          <PricingCard
            name="TopUp: ₦2K for 5K"
            price="₦2,000"
            priceNote="5,000 messages"
            features={[
              "5,000 messages",
              "Stack with Free tier",
              "Instant activation",
              "Better per-message rate",
              "Best for regular users",
            ]}
          />
        </div>
      </section>

      {/* ── Get API Key Form ── */}
      <section
        ref={formRef}
        id="get-key"
        className="w-full px-8 py-24 max-w-lg mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-bg-panel border border-border-strong rounded-2xl p-8 space-y-6"
        >
          <div>
            <div className="text-accent-light font-mono text-xs tracking-widest mb-2">
              // START FREE
            </div>
            <h2 className="text-2xl font-black text-text-main tracking-tight">
              Continue With GitHub
            </h2>
            <p className="text-text-muted text-sm mt-1">
              Sign in once with GitHub and your developer profile plus API key are provisioned automatically.
            </p>
          </div>

          {!result ? (
            <form onSubmit={handleGetKey} className="space-y-4">
              <div className="bg-accent-subtle border border-accent-primary/30 rounded-xl p-4 text-sm text-text-main">
                We now use GitHub OAuth for developer onboarding.
                Click below to authorize and jump straight to your dashboard.
              </div>
              {error && (
                <div className="p-3 bg-danger-subtle border border-danger-base/40 rounded-lg text-danger-text text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl transition-all text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Redirecting..." : "Continue with GitHub"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div
                className={`p-3 rounded-lg text-sm border ${result.created ? "bg-success-subtle border-success-base/40 text-success-text" : "bg-info-subtle border-info-base/40 text-info-text"}`}
              >
                {result.pending
                  ? "GitHub authorization is required to activate this profile."
                  : result.created
                    ? "✓ New verified profile created successfully!"
                    : "ℹ️ Existing verified profile retrieved for this email."}
              </div>

              {result.key && (
                <div>
                  <div className="text-text-muted text-xs uppercase tracking-widest mb-2">
                    Your API Key
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-bg-base border border-border-strong rounded-lg px-3 py-2.5 font-mono text-xs text-accent-light break-all">
                      {result.key}
                    </div>
                    <button
                      onClick={copyKey}
                      className="p-2.5 bg-accent-subtle border border-border-strong rounded-lg hover:bg-accent-primary/20 transition-colors shrink-0"
                      title="Copy key"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-success-text" />
                      ) : (
                        <Copy className="w-4 h-4 text-accent-light" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-bg-base border border-border-subtle rounded-lg p-3">
                  <div className="text-2xl font-black text-text-main">
                    {result.limit}
                  </div>
                  <div className="text-xs text-text-muted">Free Messages</div>
                </div>
                <div className="bg-bg-base border border-border-subtle rounded-lg p-3">
                  <div className="text-2xl font-black text-success-text">
                    {result.limit - (result.messages_sent ?? 0)}
                  </div>
                  <div className="text-xs text-text-muted">Remaining</div>
                </div>
              </div>

              <div className="p-3 bg-warning-subtle border border-warning-base/30 rounded-lg text-warning-text text-xs">
                ⚠️ Save your API key once it is verified. If you lose access, use your recovery email or phone to retrieve the same profile.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/developer/dashboard")}
                  className="flex-1 py-2.5 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl text-sm uppercase tracking-wider transition-colors"
                >
                  View Dashboard
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                  }}
                  className="px-4 py-2.5 border border-border-strong text-text-muted hover:text-text-main hover:bg-bg-panel/30 font-bold rounded-xl text-sm transition-colors"
                >
                  New Key
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      {/* Social banner */}
      <div className="max-w-md mx-auto px-8 pb-16">
        <SocialBanner variant="landing" />
      </div>
    </div>
  );
}
