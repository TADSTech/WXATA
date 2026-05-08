/**
 * Tests for Pricing page
 * Task 10.1
 * Requirements: 12.2, 12.3, 14.1, 14.2, 14.3, 14.4, 14.5
 *
 * Feature: wxata-production-ready, Property 5: Pricing cards always contain WhatsApp CTA
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as fc from "fast-check";
import Pricing from "../pages/Pricing";

const WHATSAPP_HREF = "https://wa.me/2347041029093";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Helper to render Pricing with optional Flutterwave env var
function renderPricing(flwKey?: string) {
  const original = import.meta.env.VITE_FLW_PUBLIC_KEY;
  if (flwKey !== undefined) {
    (import.meta.env as Record<string, string>).VITE_FLW_PUBLIC_KEY = flwKey;
  } else {
    delete (import.meta.env as Record<string, string>).VITE_FLW_PUBLIC_KEY;
  }
  const result = render(
    <MemoryRouter>
      <Pricing />
    </MemoryRouter>,
  );
  // Restore
  if (original !== undefined) {
    (import.meta.env as Record<string, string>).VITE_FLW_PUBLIC_KEY = original;
  } else {
    delete (import.meta.env as Record<string, string>).VITE_FLW_PUBLIC_KEY;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Property 5: Pricing cards always contain WhatsApp CTA
// Feature: wxata-production-ready, Property 5: Pricing cards always contain WhatsApp CTA
// Validates: Requirements 14.4
// ---------------------------------------------------------------------------
describe("Property 5: Pricing cards always contain WhatsApp CTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("every pricing card contains a WhatsApp CTA link", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "self-host" as const,
          "hosted" as const,
          "developer" as const,
        ),
        (tier) => {
          const { container, unmount } = renderPricing();

          // Find the card for this tier
          const card = container.querySelector(`[data-tier="${tier}"]`);
          // Developer tier does not have a Flutterwave button, so we only check for WhatsApp if it exists
          const whatsappLink = card?.querySelector(
            `a[href="${WHATSAPP_HREF}"]`,
          );

          unmount();
          return whatsappLink !== null && whatsappLink !== undefined;
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 10.1 — Unit tests for Pricing page (Flutterwave)
// Requirements: 12.2, 12.3, 14.1, 14.2, 14.3, 14.4, 14.5
// ---------------------------------------------------------------------------
describe("Pricing page unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no FLW key by default
    delete (import.meta.env as Record<string, string>).VITE_FLW_PUBLIC_KEY;
    // Clean up any injected Flutterwave script between tests
    const existingScript = document.getElementById("flw-inline-js");
    if (existingScript) existingScript.remove();
  });

  it("renders three pricing cards", () => {
    const { container } = renderPricing();
    const cards = container.querySelectorAll("[data-tier]");
    expect(cards.length).toBe(3);
  });

  it("WhatsApp CTA buttons present on all pricing cards", () => {
    const { container } = renderPricing();
    const whatsappLinks = container.querySelectorAll(
      `a[href="${WHATSAPP_HREF}"]`,
    );
    expect(whatsappLinks.length).toBeGreaterThanOrEqual(3);
  });

  // Requirement 12.3: Pricing page SHALL NOT render a "Pay with Paystack" button
  it("Paystack buttons are never rendered", () => {
    const { queryAllByText } = renderPricing(undefined);
    const paystackBtns = queryAllByText(/pay with paystack/i);
    expect(paystackBtns.length).toBe(0);
  });

  it("Paystack buttons absent even when a key is set", () => {
    const { queryAllByText } = renderPricing("FLWPUBK_TEST-fake");
    const paystackBtns = queryAllByText(/pay with paystack/i);
    expect(paystackBtns.length).toBe(0);
  });

  // Requirement 14.4: When VITE_FLW_PUBLIC_KEY is not set, do not render Flutterwave button
  it("Flutterwave button absent when VITE_FLW_PUBLIC_KEY is not set", () => {
    const { queryAllByText } = renderPricing(undefined);
    const flwBtns = queryAllByText(/pay with flutterwave/i);
    expect(flwBtns.length).toBe(0);
  });

  // Requirement 14.2: When key is set, render Flutterwave payment button
  it("Flutterwave buttons present when VITE_FLW_PUBLIC_KEY is set", () => {
    const { getAllByText } = renderPricing("FLWPUBK_TEST-fake");
    const flwBtns = getAllByText(/pay with flutterwave/i);
    expect(flwBtns.length).toBeGreaterThanOrEqual(2); // Only Self-Host and Hosted have Flutterwave, not Developer
  });

  it("SocialBanner is present at the bottom", () => {
    const { container } = renderPricing();
    const xLink = container.querySelector('a[href="https://x.com/tads_tech"]');
    expect(xLink).not.toBeNull();
  });

  it("renders Self-Host tier with ₦25,000 price", () => {
    const { getByText } = renderPricing();
    expect(getByText("₦25,000")).toBeTruthy();
  });

  it("renders Hosted tier with ₦30,000 price", () => {
    const { getByText } = renderPricing();
    expect(getByText("₦30,000")).toBeTruthy();
  });

  it('renders Developer Account tier with "Pay as You Grow" price', () => {
    const { getByText } = renderPricing();
    expect(getByText("Pay as You Grow")).toBeTruthy();
  });

  // Requirement 14.1: Script injection only when key is present
  it("does not inject Flutterwave script when key is absent", () => {
    renderPricing(undefined);
    const script = document.getElementById("flw-inline-js");
    expect(script).toBeNull();
  });

  // Requirement 14.4: Email/name inputs only shown when key is set
  it("email input not shown when VITE_FLW_PUBLIC_KEY is not set", () => {
    const { queryByPlaceholderText } = renderPricing(undefined);
    expect(queryByPlaceholderText(/email for payment/i)).toBeNull();
  });

  it("email input shown when VITE_FLW_PUBLIC_KEY is set", () => {
    const { getByPlaceholderText } = renderPricing("FLWPUBK_TEST-fake");
    expect(getByPlaceholderText(/email for payment/i)).toBeTruthy();
  });
});
