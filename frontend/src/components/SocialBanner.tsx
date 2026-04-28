// ─── Props ────────────────────────────────────────────────────────────────────

export interface SocialBannerProps {
  variant?: 'register' | 'landing' | 'pricing';
}

// ─── Text variants ────────────────────────────────────────────────────────────

const VARIANTS = {
  register: {
    heading: 'Need a Registration Code?',
    body: 'DM us on WhatsApp or X to purchase access and receive your code.',
  },
  landing: {
    heading: 'Access is invite-only.',
    body: 'DM to purchase.',
  },
  pricing: {
    heading: 'Questions?',
    body: 'Reach us directly on WhatsApp or X.',
  },
} as const;

// ─── SocialBanner ─────────────────────────────────────────────────────────────

export function SocialBanner({ variant = 'register' }: SocialBannerProps) {
  const { heading, body } = VARIANTS[variant];

  return (
    <div className="bg-bg-panel border border-border-subtle rounded-xl p-4 text-accent-light">
      <p className="font-semibold mb-1">{heading}</p>
      <p className="text-sm mb-3">{body}</p>
      <div className="flex gap-3">
        <a
          href="https://wa.me/2347041029093"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
        >
          WhatsApp
        </a>
        <a
          href="https://x.com/tads_tech"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium transition-colors"
        >
          X
        </a>
      </div>
    </div>
  );
}

export default SocialBanner;
