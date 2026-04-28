/**
 * Tests for Pricing page
 * Tasks 6.3, 6.4
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 *
 * Feature: wxata-monetization, Property 5: Pricing cards always contain WhatsApp CTA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import Pricing from '../pages/Pricing';

const WHATSAPP_HREF = 'https://wa.me/2347041029093';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Helper to render Pricing with optional env vars
function renderPricing(paystackKey?: string) {
  // Temporarily set the env var
  const original = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  if (paystackKey !== undefined) {
    (import.meta.env as Record<string, string>).VITE_PAYSTACK_PUBLIC_KEY = paystackKey;
  } else {
    delete (import.meta.env as Record<string, string>).VITE_PAYSTACK_PUBLIC_KEY;
  }
  const result = render(
    <MemoryRouter>
      <Pricing />
    </MemoryRouter>
  );
  // Restore
  if (original !== undefined) {
    (import.meta.env as Record<string, string>).VITE_PAYSTACK_PUBLIC_KEY = original;
  } else {
    delete (import.meta.env as Record<string, string>).VITE_PAYSTACK_PUBLIC_KEY;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Property 5: Pricing cards always contain WhatsApp CTA
// Feature: wxata-monetization, Property 5: Pricing cards always contain WhatsApp CTA
// Validates: Requirements 4.3, 4.4
// ---------------------------------------------------------------------------
describe('Property 5: Pricing cards always contain WhatsApp CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('every pricing card contains a WhatsApp CTA link', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('self-host' as const, 'hosted' as const),
        (tier) => {
          const { container, unmount } = renderPricing();

          // Find the card for this tier
          const card = container.querySelector(`[data-tier="${tier}"]`);
          const whatsappLink = card?.querySelector(`a[href="${WHATSAPP_HREF}"]`);

          unmount();
          return whatsappLink !== null && whatsappLink !== undefined;
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 6.4 — Unit tests for Pricing page
// Requirements: 4.2, 4.4, 4.5, 4.6, 4.7
// ---------------------------------------------------------------------------
describe('Pricing page unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no Paystack key by default
    delete (import.meta.env as Record<string, string>).VITE_PAYSTACK_PUBLIC_KEY;
  });

  it('renders two pricing cards', () => {
    const { container } = renderPricing();
    const cards = container.querySelectorAll('[data-tier]');
    expect(cards.length).toBe(2);
  });

  it('WhatsApp CTA buttons present on both cards', () => {
    const { container } = renderPricing();
    const whatsappLinks = container.querySelectorAll(`a[href="${WHATSAPP_HREF}"]`);
    expect(whatsappLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('Paystack buttons absent when VITE_PAYSTACK_PUBLIC_KEY is not set', () => {
    const { queryAllByText } = renderPricing(undefined);
    const paystackBtns = queryAllByText(/pay with paystack/i);
    expect(paystackBtns.length).toBe(0);
  });

  it('Paystack buttons present when VITE_PAYSTACK_PUBLIC_KEY is set', () => {
    const { getAllByText } = renderPricing('pk_test_fake_key');
    const paystackBtns = getAllByText(/pay with paystack/i);
    expect(paystackBtns.length).toBeGreaterThanOrEqual(2);
  });

  it('SocialBanner is present at the bottom', () => {
    const { container } = renderPricing();
    // SocialBanner renders the X link — check for it
    const xLink = container.querySelector('a[href="https://x.com/tads_tech"]');
    expect(xLink).not.toBeNull();
  });

  it('renders Self-Host tier with ₦25,000 price', () => {
    const { getByText } = renderPricing();
    expect(getByText('₦25,000')).toBeTruthy();
  });

  it('renders Hosted tier with ₦30,000 price', () => {
    const { getByText } = renderPricing();
    expect(getByText('₦30,000')).toBeTruthy();
  });
});
