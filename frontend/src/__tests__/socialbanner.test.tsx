/**
 * Tests for SocialBanner component
 * Tasks 3.6, 3.7
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, 3.5
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import SocialBanner from '../components/SocialBanner';

const WHATSAPP_HREF = 'https://wa.me/2347041029093';
const X_HREF = 'https://x.com/tads_tech';

// ---------------------------------------------------------------------------
// Task 3.6 — Property 3: SocialBanner always contains both contact links
// Feature: wxata-monetization, Property 3: SocialBanner always contains both contact links
// Validates: Requirements 2.2, 2.3, 3.1, 3.5
// ---------------------------------------------------------------------------
describe('Property 3: SocialBanner always contains both contact links', () => {
  it('always renders WhatsApp and X links with target="_blank" for any variant', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('register' as const, 'landing' as const, 'pricing' as const, undefined),
        (variant) => {
          const { container, unmount } = render(
            <SocialBanner variant={variant} />
          );

          const whatsappLink = container.querySelector(`a[href="${WHATSAPP_HREF}"]`);
          const xLink = container.querySelector(`a[href="${X_HREF}"]`);

          const hasWhatsApp = whatsappLink !== null;
          const hasX = xLink !== null;
          const whatsappBlank = whatsappLink?.getAttribute('target') === '_blank';
          const xBlank = xLink?.getAttribute('target') === '_blank';

          unmount();
          return hasWhatsApp && hasX && whatsappBlank && xBlank;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3.7 — Unit tests for SocialBanner
// Requirements: 2.2, 2.3, 2.4, 3.1
// ---------------------------------------------------------------------------
describe('SocialBanner unit tests', () => {
  it('contains WhatsApp link with correct href', () => {
    const { container } = render(<SocialBanner />);
    const link = container.querySelector(`a[href="${WHATSAPP_HREF}"]`);
    expect(link).not.toBeNull();
  });

  it('contains X link with correct href', () => {
    const { container } = render(<SocialBanner />);
    const link = container.querySelector(`a[href="${X_HREF}"]`);
    expect(link).not.toBeNull();
  });

  it('WhatsApp link has target="_blank" and rel="noopener noreferrer"', () => {
    const { container } = render(<SocialBanner />);
    const link = container.querySelector(`a[href="${WHATSAPP_HREF}"]`);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('X link has target="_blank" and rel="noopener noreferrer"', () => {
    const { container } = render(<SocialBanner />);
    const link = container.querySelector(`a[href="${X_HREF}"]`);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders "Need a Registration Code?" heading for register variant (default)', () => {
    const { getByText } = render(<SocialBanner variant="register" />);
    expect(getByText('Need a Registration Code?')).toBeTruthy();
  });

  it('renders "Access is invite-only." heading for landing variant', () => {
    const { getByText } = render(<SocialBanner variant="landing" />);
    expect(getByText('Access is invite-only.')).toBeTruthy();
  });

  it('renders "Questions?" heading for pricing variant', () => {
    const { getByText } = render(<SocialBanner variant="pricing" />);
    expect(getByText('Questions?')).toBeTruthy();
  });

  it('defaults to register variant when no variant prop is given', () => {
    const { getByText } = render(<SocialBanner />);
    expect(getByText('Need a Registration Code?')).toBeTruthy();
  });
});
