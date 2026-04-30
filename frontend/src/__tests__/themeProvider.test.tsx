/**
 * Tests for ThemeProvider component
 * Tasks 14.3, 14.5
 * Requirements: 1.18, 1.19, 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';
import { ThemeProvider, useTheme, KNOWN_THEMES } from '../components/ThemeProvider';

// ---------------------------------------------------------------------------
// Helper — consumer component that exposes theme state and setTheme
// ---------------------------------------------------------------------------
function ThemeConsumer({
  onMount,
}: {
  onMount?: (ctx: { theme: string; setTheme: (t: string) => void }) => void;
}) {
  const { theme, setTheme } = useTheme();
  React.useEffect(() => {
    onMount?.({ theme, setTheme: setTheme as (t: string) => void });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div data-testid="theme-value">{theme}</div>;
}

// ---------------------------------------------------------------------------
// Task 14.3 — Property 5: Theme persistence round-trip
// Validates: Requirements 1.18, 1.19, 9.1, 9.2
// ---------------------------------------------------------------------------
describe('Property 5: Theme persistence round-trip', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let removeItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
  });

  afterEach(() => {
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
    localStorage.clear();
  });

  it('setTheme writes to localStorage and re-initialising ThemeProvider restores the same theme', () => {
    /**
     * **Validates: Requirements 1.18, 1.19, 9.1, 9.2**
     *
     * For any valid theme name in KNOWN_THEMES:
     * 1. Render ThemeProvider and call setTheme(name)
     * 2. Verify localStorage.setItem was called with the correct key/value
     * 3. Unmount and re-render ThemeProvider
     * 4. Verify the restored theme matches the one that was set
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...KNOWN_THEMES),
        (themeName) => {
          setItemSpy.mockClear();
          getItemSpy.mockClear();

          // Step 1: Render and call setTheme
          let capturedSetTheme: ((t: string) => void) | undefined;
          const { unmount } = render(
            <ThemeProvider>
              <ThemeConsumer
                onMount={({ setTheme }) => {
                  capturedSetTheme = setTheme;
                }}
              />
            </ThemeProvider>
          );

          act(() => {
            capturedSetTheme!(themeName);
          });

          // Step 2: Verify localStorage.setItem was called with correct key/value
          const setItemCalls = setItemSpy.mock.calls;
          const themeSetCall = setItemCalls.find(
            ([key, value]) => key === 'wxata-theme' && value === themeName
          );
          if (!themeSetCall) {
            unmount();
            return false;
          }

          unmount();

          // Step 3: Re-render ThemeProvider — it should read from localStorage
          // localStorage now has the theme set by the previous render
          let restoredTheme = '';
          const { unmount: unmount2 } = render(
            <ThemeProvider>
              <ThemeConsumer
                onMount={({ theme }) => {
                  restoredTheme = theme;
                }}
              />
            </ThemeProvider>
          );

          unmount2();

          // Step 4: Verify restored theme matches what was set
          return restoredTheme === themeName;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 14.3 — Property 6: Unknown theme falls back to default
// Validates: Requirements 9.4
// ---------------------------------------------------------------------------
describe('Property 6: Unknown theme falls back to default', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let removeItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
  });

  afterEach(() => {
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
    localStorage.clear();
  });

  it('initialises with midnight and clears invalid theme from localStorage', () => {
    /**
     * **Validates: Requirements 9.4**
     *
     * For any string not in KNOWN_THEMES:
     * 1. Mock localStorage.getItem to return the invalid theme string
     * 2. Render ThemeProvider
     * 3. Verify the active theme is 'midnight'
     * 4. Verify localStorage.removeItem was called (invalid value cleared)
     */
    const knownThemeSet = new Set<string>(KNOWN_THEMES);

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !knownThemeSet.has(s)),
        (invalidTheme) => {
          removeItemSpy.mockClear();

          // Step 1: Seed localStorage with the invalid theme
          localStorage.setItem('wxata-theme', invalidTheme);

          // Step 2: Render ThemeProvider
          let activeTheme = '';
          const { unmount } = render(
            <ThemeProvider>
              <ThemeConsumer
                onMount={({ theme }) => {
                  activeTheme = theme;
                }}
              />
            </ThemeProvider>
          );

          unmount();
          localStorage.clear();

          // Step 3: Theme must be 'midnight'
          if (activeTheme !== 'midnight') return false;

          // Step 4: removeItem must have been called to clear the invalid value
          const removedWxataTheme = removeItemSpy.mock.calls.some(
            ([key]) => key === 'wxata-theme'
          );
          return removedWxataTheme;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 14.5 — Unit tests for ThemeProvider
// Requirements: 9.1, 9.2, 9.3
// ---------------------------------------------------------------------------
describe('ThemeProvider unit tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to midnight when localStorage is empty', () => {
    // Requirements: 9.1
    let initialTheme = '';
    const { unmount } = render(
      <ThemeProvider>
        <ThemeConsumer onMount={({ theme }) => { initialTheme = theme; }} />
      </ThemeProvider>
    );
    unmount();
    expect(initialTheme).toBe('midnight');
  });

  it('writes to localStorage when setTheme is called', () => {
    // Requirements: 9.2
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    let capturedSetTheme: ((t: string) => void) | undefined;

    const { unmount } = render(
      <ThemeProvider>
        <ThemeConsumer onMount={({ setTheme }) => { capturedSetTheme = setTheme; }} />
      </ThemeProvider>
    );

    act(() => {
      capturedSetTheme!('nord');
    });

    expect(setItemSpy).toHaveBeenCalledWith('wxata-theme', 'nord');
    unmount();
  });

  it('falls back to midnight gracefully when localStorage throws on access', () => {
    // Requirements: 9.3
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    let activeTheme = '';
    expect(() => {
      const { unmount } = render(
        <ThemeProvider>
          <ThemeConsumer onMount={({ theme }) => { activeTheme = theme; }} />
        </ThemeProvider>
      );
      unmount();
    }).not.toThrow();

    expect(activeTheme).toBe('midnight');
  });
});
