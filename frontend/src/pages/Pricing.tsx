import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, MessageCircle } from 'lucide-react';
import { SocialBanner } from '../components/SocialBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingCardProps {
  tier: 'self-host' | 'hosted';
  name: string;
  price: string;
  priceNote: string;
  features: string[];
  paystackKey: string | undefined;
  paystackAmount?: number;
  paystackPlan?: string;
  userEmail: string;
}

// ---------------------------------------------------------------------------
// Paystack inline JS type shim
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: {
        key: string;
        email: string;
        amount?: number;
        plan?: string;
        currency: string;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
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
  paystackKey,
  paystackAmount,
  paystackPlan,
  userEmail,
}: PricingCardProps) {
  const handlePaystack = () => {
    if (!window.PaystackPop || !paystackKey) return;
    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: userEmail || 'buyer@example.com',
      ...(paystackAmount ? { amount: paystackAmount } : {}),
      ...(paystackPlan ? { plan: paystackPlan } : {}),
      currency: 'NGN',
      callback: (response) => {
        console.log('Payment complete:', response.reference);
      },
      onClose: () => {
        console.log('Payment window closed');
      },
    });
    handler.openIframe();
  };

  return (
    <motion.div
      data-tier={tier}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-bg-panel border border-border-strong rounded-2xl p-8 flex flex-col gap-6 w-full max-w-sm"
    >
      <div>
        <h2 className="text-xl font-black text-accent-light tracking-tight mb-1">{name}</h2>
        <div className="text-4xl font-black text-text-main">{price}</div>
        <div className="text-sm text-text-muted mt-1">{priceNote}</div>
      </div>

      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
            <Check className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        {/* Primary CTA — always present */}
        <a
          href="https://wa.me/2347041029093"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors text-sm uppercase tracking-widest"
        >
          <MessageCircle className="w-4 h-4" />
          Buy Now — WhatsApp
        </a>

        {/* Paystack CTA — only when key is configured */}
        {paystackKey && (
          <button
            onClick={handlePaystack}
            className="px-6 py-3 bg-accent-primary hover:bg-accent-hover text-bg-base font-bold rounded-xl transition-colors text-sm uppercase tracking-widest"
          >
            Pay with Paystack
          </button>
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
  const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  const paystackPlanHostedInitial = import.meta.env.VITE_PAYSTACK_PLAN_HOSTED_INITIAL as string | undefined;
  const [email, setEmail] = useState('');

  // Inject Paystack inline JS once when key is present
  useEffect(() => {
    if (!paystackKey) return;
    if (document.getElementById('paystack-inline-js')) return;
    const script = document.createElement('script');
    script.id = 'paystack-inline-js';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
  }, [paystackKey]);

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-sans">
      {/* Navbar */}
      <nav className="px-8 py-5 flex justify-between items-center border-b border-border-subtle/50">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 bg-accent-primary rounded flex items-center justify-center font-black text-bg-base">
            W
          </div>
          <span className="font-black text-xl tracking-tighter text-text-main">
            WX<span className="text-accent-primary">ATA</span>
          </span>
        </div>
        <button
          onClick={() => navigate('/login')}
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
        <div className="text-accent-light font-mono text-xs tracking-widest mb-3">// PRICING</div>
        <h1 className="text-5xl md:text-6xl font-black text-text-main tracking-tight mb-4">
          Simple, transparent pricing.
        </h1>
        <p className="text-text-muted text-lg max-w-xl mx-auto">
          Choose the plan that fits your setup. Pay once or subscribe monthly — both include full access to WXATA.
        </p>
      </motion.div>

      {/* Email input for Paystack (only shown when Paystack is enabled) */}
      {paystackKey && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mb-6 px-4"
        >
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
      <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch px-8 pb-16 max-w-4xl mx-auto">
        <PricingCard
          tier="self-host"
          name="Self-Host"
          price="₦25,000"
          priceNote="One-time payment"
          features={[
            'Full bot source code',
            'Docker-ready deployment',
            'Lifetime updates',
            'Dashboard web UI',
            'Plugin marketplace access',
            'Community support',
          ]}
          paystackKey={paystackKey}
          paystackAmount={2500000}
          userEmail={email}
        />

        <PricingCard
          tier="hosted"
          name="Hosted"
          price="₦30,000"
          priceNote="First month, then ₦5,000/month"
          features={[
            'Everything in Self-Host',
            'Managed hosting on Render',
            'Automatic deployments',
            'Monthly support',
            'Uptime monitoring',
            'Priority response',
          ]}
          paystackKey={paystackKey}
          paystackPlan={paystackPlanHostedInitial}
          userEmail={email}
        />
      </div>

      {/* Social banner at bottom */}
      <div className="max-w-md mx-auto px-8 pb-16">
        <SocialBanner variant="pricing" />
      </div>
    </div>
  );
}
