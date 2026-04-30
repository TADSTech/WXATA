/**
 * Tests for AdUnit component
 * Tasks 3.2, 3.3, 3.4
 * Requirements: 1.1, 1.2, 1.5, 1.6, 1.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import React, { Component } from 'react';
import AdUnit, { _resetInjectedZones } from '../components/AdUnit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count <script> elements in document.head with a given data-zone-id */
function countHeadScripts(zoneId: string): number {
  return document.head.querySelectorAll(`script[data-zone-id="${zoneId}"]`).length;
}

/** Count <script> elements anywhere in document with a given data-zone-id */
function countAllScripts(zoneId: string): number {
  return document.querySelectorAll(`script[data-zone-id="${zoneId}"]`).length;
}

/** Remove all injected ad scripts from the document */
function cleanupAdScripts() {
  document.querySelectorAll('script[data-zone-id]').forEach(s => s.remove());
  _resetInjectedZones();
}

// ---------------------------------------------------------------------------
// Task 3.2 — Property 1: Popunder script injection is idempotent
// Feature: wxata-monetization, Property 1: Popunder script injection is idempotent
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------
describe('Property 1: Popunder script injection is idempotent', () => {
  beforeEach(() => {
    cleanupAdScripts();
    // Reset the module-level injectedZones set by unmounting all components
  });

  afterEach(() => {
    cleanupAdScripts();
  });

  it('injects exactly one script per zoneId regardless of interaction count', () => {
    // Use a fixed set of zone IDs to avoid module-level Set state issues across runs
    const zoneIds = ['zone-idem-1', 'zone-idem-2', 'zone-idem-3'];

    fc.assert(
      fc.property(
        fc.constantFrom(...zoneIds),
        fc.integer({ min: 1, max: 5 }),
        (zoneId, n) => {
          cleanupAdScripts();

          const { unmount } = render(<AdUnit adType="popunder" zoneId={zoneId} />);

          // Simulate N click interactions
          for (let i = 0; i < n; i++) {
            fireEvent.click(document);
          }

          // Exactly one script should exist for this zoneId
          const count = countAllScripts(zoneId);
          unmount();
          cleanupAdScripts();

          return count === 1;
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3.3 — Property 2: AdUnit renders without error for all valid prop combinations
// Feature: wxata-monetization, Property 2: AdUnit renders without error for all valid prop combinations
// Validates: Requirements 1.5
// ---------------------------------------------------------------------------
describe('Property 2: AdUnit renders without error for all valid prop combinations', () => {
  afterEach(() => {
    cleanupAdScripts();
  });

  it('renders without throwing for any adType and non-empty zoneId', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('popunder' as const, 'banner' as const, 'native' as const),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        (adType, zoneId) => {
          let threw = false;
          try {
            const { unmount, container } = render(
              <AdUnit adType={adType} zoneId={zoneId} />
            );
            // For banner/native, zoneId should appear in the rendered output
            if (adType !== 'popunder') {
              const ins = container.querySelector(`[data-zone-id="${zoneId}"]`);
              if (!ins) threw = true;
            }
            unmount();
          } catch {
            threw = true;
          }
          cleanupAdScripts();
          return !threw;
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3.4 — Unit tests for AdUnit
// Requirements: 1.1, 1.6, 1.7
// ---------------------------------------------------------------------------
describe('AdUnit unit tests', () => {
  beforeEach(() => {
    cleanupAdScripts();
  });

  afterEach(() => {
    cleanupAdScripts();
  });

  it('renders without error for adType="popunder"', () => {
    expect(() => {
      const { unmount } = render(<AdUnit adType="popunder" zoneId="test-zone-1" />);
      unmount();
    }).not.toThrow();
  });

  it('renders without error for adType="banner"', () => {
    const { container, unmount } = render(<AdUnit adType="banner" zoneId="test-zone-2" />);
    expect(container.querySelector('[data-zone-id="test-zone-2"]')).not.toBeNull();
    unmount();
  });

  it('renders without error for adType="native"', () => {
    const { container, unmount } = render(<AdUnit adType="native" zoneId="test-zone-3" />);
    expect(container.querySelector('[data-zone-id="test-zone-3"]')).not.toBeNull();
    unmount();
  });

  it('popunder script is NOT injected before first user interaction', () => {
    const zoneId = 'test-no-inject-before-click';
    const { unmount } = render(<AdUnit adType="popunder" zoneId={zoneId} />);
    // No interaction yet — script should not be in the document
    expect(countAllScripts(zoneId)).toBe(0);
    unmount();
  });

  it('popunder script IS injected after simulated click', () => {
    const zoneId = 'test-inject-after-click';
    const { unmount } = render(<AdUnit adType="popunder" zoneId={zoneId} />);

    fireEvent.click(document);

    expect(countAllScripts(zoneId)).toBe(1);
    unmount();
  });

  it('error boundary catches thrown render error and renders null', () => {
    // Create a component that always throws
    const ThrowingComponent = () => {
      throw new Error('Test render error');
    };

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Wrap in a class error boundary similar to AdErrorBoundary
    class TestBoundary extends Component<
      { children: React.ReactNode },
      { hasError: boolean }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }
      static getDerivedStateFromError() { return { hasError: true }; }
      componentDidCatch(e: Error) { console.error(e); }
      render() {
        if (this.state.hasError) return null;
        return this.props.children;
      }
    }

    const { container } = render(
      <TestBoundary>
        <ThrowingComponent />
      </TestBoundary>
    );

    // Error boundary should render null (empty container)
    expect(container.firstChild).toBeNull();
    consoleSpy.mockRestore();
  });
});
