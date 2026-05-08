import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, Zap } from "lucide-react";
import { SocialBanner } from "../components/SocialBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlutterwaveOptions {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  customer: {
    email: string;
    name: string;
  };
  callback: (response: {
    status: string;
    transaction_id?: string;
    tx_ref: string;
  }) => void;
  onclose: () => void;
}

interface PricingCardProps {
  tier: "self-host" | "hosted" | "developer";
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  flwKey: string | undefined;
  flwAmount?: number;
  userEmail: string;
  userName: string;
  highlight?: boolean;
}

// ---------------------------------------------------------------------------
// Flutterwave inline JS type shim
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    FlutterwaveCheckout?: (opts: FlutterwaveOptions) => void;
  }
}

// ---------------------------------------------------------------------------
// PricingCard sub-component
// ---------------------------------------------------------------------------

function PricingCard({
  tier,
  name,
  price,
  priceNote,
  features,
  flwKey,
  flwAmount,
  userEmail,
  userName,
  highlight,
}: PricingCardProps) {
  const [paid, setPaid] = useState(false);

  const handleFlutterwave = () => {
    if (!window.FlutterwaveCheckout || !flwKey || !flwAmount) return;
    const txRef = `WXATA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.FlutterwaveCheckout({
      public_key: flwKey,
      tx_ref: txRef,
      amount: flwAmount,
      currency: "NGN",
      customer: {
        email: userEmail || "buyer@example.com",
        name: userName || "WXATA Customer",
      },
      callback: (response) => {
        console.log("Payment complete:", response.tx_ref, response.status);
        if (
          response.status === "successful" ||
          response.status === "completed"
        ) {
          setPaid(true);
        }
      },
      onclose: () => {
        console.log("Payment window closed");
      },
    });
  };

  return (
    <motion.div
      data-tier={tier}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-2xl p-8 flex flex-col gap-6 w-full max-w-sm ${
        highlight
          ? "bg-accent-subtle border-2 border-accent-primary shadow-[0_0_30px_rgba(139,92,246,0.2)]"
          : "bg-bg-panel border border-border-strong"
      }`}
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-black text-accent-light tracking-tight">
            {name}
          </h2>
          {highlight && <Zap className="w-5 h-5 text-accent-primary" />}
        </div>
        <div className="text-4xl font-black text-text-main">{price}</div>
        <div className="text-sm text-text-muted mt-1">{priceNote}</div>
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

      <div className="flex flex-col gap-3">
        {/* Flutterwave CTA — only when key is configured */}
        {flwKey && !paid && (
          <button
            onClick={handleFlutterwave}
            className="px-6 py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl transition-colors text-sm uppercase tracking-widest"
          >
            Pay with Flutterwave
          </button>
        )}

        {/* Fallback when Flutterwave not configured — direct WhatsApp */}
        {!flwKey && !paid && (
          <a
            href="https://wa.me/2347041029093"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl transition-colors text-sm uppercase tracking-widest"
          >
            Contact Sales
          </a>
        )}

        {/* Inline confirmation after successful payment */}
        {paid && (
          <div className="px-6 py-3 bg-green-900/40 border border-green-600/50 text-green-400 font-bold rounded-xl text-sm text-center">
            ✓ Payment successful! Check your email for credentials.
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Pricing page
// ---------------------------------------------------------------------------

export default function Pricing() {
  const navigate = useNavigate();
  const flwKey = import.meta.env.VITE_FLW_PUBLIC_KEY as string | undefined;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // Inject Flutterwave inline JS once when key is present
  useEffect(() => {
    if (!flwKey) return;
    if (document.getElementById("flw-inline-js")) return;
    const script = document.createElement("script");
    script.id = "flw-inline-js";
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    document.body.appendChild(script);
  }, [flwKey]);

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-sans">
      {/* Navbar */}
      <nav className="px-8 py-5 flex justify-between items-center border-b border-border-subtle/50">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="w-8 h-8 bg-accent-primary rounded flex items-center justify-center font-black text-bg-base">
            W
          </div>
          <span className="font-black text-xl tracking-tighter text-text-main">
            WX<span className="text-accent-primary">ATA</span>
          </span>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="text-sm font-bold text-text-muted hover:text-accent-light transition-colors uppercase tracking-widest"
        >
          Sign In
        </button>
      </nav>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center pt-16 pb-10 px-4"
      >
        <div className="text-accent-light font-mono text-xs tracking-widest mb-3">
          // PRICING
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-text-main tracking-tight mb-4">
          Simple, transparent pricing.
        </h1>
        <p className="text-text-muted text-lg max-w-xl mx-auto">
          Choose the plan that fits your needs. Whether you're self-hosting a
          bot, using our managed service, or building with our API — we've got
          you covered.
        </p>
      </motion.div>

      {/* Email + name inputs for Flutterwave (only shown when Flutterwave is enabled) */}
      {flwKey && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-3 mb-6 px-4"
        >
          <input
            type="text"
            placeholder="Your name for payment"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-sm bg-bg-panel border border-border-strong rounded-xl px-4 py-2 text-text-main text-sm focus:outline-none focus:border-accent-primary"
          />
          <input
            type="email"
            placeholder="Your email for payment receipt"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full max-w-sm bg-bg-panel border border-border-strong rounded-xl px-4 py-2 text-text-main text-sm focus:outline-none focus:border-accent-primary"
          />
        </motion.div>
      )}

      {/* Pricing cards */}
      <div className="flex flex-col gap-8 justify-center items-center px-8 pb-16 max-w-7xl mx-auto">
        {/* Bot Tiers */}
        <div className="w-full">
          <h2 className="text-2xl font-black text-accent-light mb-8 text-center">
            WhatsApp Bot Tiers
          </h2>
          <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch">
            <PricingCard
              tier="self-host"
              name="Self-Host Bot"
              price="₦25,000"
              priceNote="One-time payment"
              features={[
                "Full bot source code",
                "Docker-ready deployment",
                "Lifetime updates",
                "Dashboard web UI",
                "Extension marketplace",
                "WhatsApp bot commands",
              ]}
              flwKey={flwKey}
              flwAmount={25000}
              userEmail={email}
              userName={name}
            />

            <PricingCard
              tier="hosted"
              name="Hosted Bot"
              price="₦30,000"
              priceNote="First month, then ₦5,000/month"
              features={[
                "Everything in Self-Host",
                "Managed hosting on Render",
                "Automatic deployments",
                "Dashboard management",
                "WhatsApp bot commands",
                "Extension marketplace",
              ]}
              flwKey={flwKey}
              flwAmount={30000}
              userEmail={email}
              userName={name}
            />
          </div>
        </div>

        {/* Developer Tiers */}
        <div className="w-full">
          <h2 className="text-2xl font-black text-accent-light mb-8 text-center">
            Developer API Tiers
          </h2>
          <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch">
            <PricingCard
              tier="developer"
              name="Developer Free"
              price="₦0"
              priceNote="100 free messages"
              features={[
                "Programmatic REST API",
                "100 free messages to start",
                "Pay-per-topup options available",
                "Any programming language",
                "Full API documentation",
                "Community support",
              ]}
              flwKey={undefined}
              userEmail={email}
              userName={name}
            />

            <PricingCard
              tier="developer"
              name="Developer Pro"
              price="₦3,200"
              priceNote="Monthly subscription"
              features={[
                "10,000 messages per month",
                "Programmatic REST API",
                "Priority email support",
                "Webhook callbacks",
                "Usage analytics dashboard",
                "Any programming language",
              ]}
              flwKey={flwKey}
              flwAmount={3200}
              userEmail={email}
              userName={name}
              highlight={true}
            />
          </div>
        </div>
      </div>

      {/* Social banner at bottom */}
      <div className="max-w-md mx-auto px-8 pb-16">
        <SocialBanner variant="pricing" />
      </div>
    </div>
  );
}
