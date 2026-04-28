/**
 * Tests for licenseValidator.ts
 * Tasks 8.3, 8.4
 * Requirements: 5.6, 5.7, 5.8
 *
 * Feature: wxata-monetization, Property 6: License key generation and validation are inverses
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import * as fc from 'fast-check';
import { generateLicenseKey, validateLicenseKey, validateLicense } from '../licenseValidator';

const TEST_SECRET = 'test-hmac-secret-32-bytes-long!!';

// ---------------------------------------------------------------------------
// Task 8.3 — Property 6: License key generation and validation are inverses
// Feature: wxata-monetization, Property 6: License key generation and validation are inverses (round-trip)
// Validates: Requirements 5.8
// ---------------------------------------------------------------------------
describe('Property 6: License key generation and validation are inverses', () => {
  it('generateLicenseKey + validateLicenseKey round-trip is always true', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes(':')),
        (username) => {
          const key = generateLicenseKey(username, TEST_SECRET);
          return validateLicenseKey(key, TEST_SECRET) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tampered key always returns false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
        (username) => {
          const key = generateLicenseKey(username, TEST_SECRET);
          // Tamper: flip the last character of the HMAC portion
          const parts = key.split(':');
          const hmac = parts[1]!;
          const tampered = hmac.slice(0, -1) + (hmac.endsWith('a') ? 'b' : 'a');
          const tamperedKey = `${parts[0]}:${tampered}`;
          return validateLicenseKey(tamperedKey, TEST_SECRET) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('key generated with one secret is invalid for a different secret', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes(':')),
        (username) => {
          const key = generateLicenseKey(username, TEST_SECRET);
          return validateLicenseKey(key, 'different-secret') === false;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 8.4 — Unit tests for licenseValidator.ts
// Requirements: 5.6, 5.7
// ---------------------------------------------------------------------------
describe('licenseValidator unit tests', () => {
  let originalEnv: Record<string, string | undefined>;
  let exitSpy: ReturnType<typeof spyOn>;
  let timeoutSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Save env
    originalEnv = {
      LICENSE_KEY: process.env.LICENSE_KEY,
      LICENSE_HMAC_SECRET: process.env.LICENSE_HMAC_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    };
    // Ensure not in development mode
    process.env.NODE_ENV = 'production';

    // Spy on process.exit and setTimeout to prevent actual exit
    exitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
      return undefined as never;
    });
    timeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(
      ((fn: unknown, _delay?: number) => {
        if (typeof fn === 'function') (fn as () => void)();
        return 0;
      }) as unknown as typeof setTimeout
    );
  });

  afterEach(() => {
    // Restore env
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    exitSpy.mockRestore();
    timeoutSpy.mockRestore();
  });

  it('returns without error for a valid key', async () => {
    const key = generateLicenseKey('testuser', TEST_SECRET);
    process.env.LICENSE_KEY = key;
    process.env.LICENSE_HMAC_SECRET = TEST_SECRET;

    await validateLicense();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('calls process.exit for missing LICENSE_KEY', async () => {
    delete process.env.LICENSE_KEY;
    process.env.LICENSE_HMAC_SECRET = TEST_SECRET;

    await validateLicense();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit for malformed key (no colon separator)', async () => {
    process.env.LICENSE_KEY = 'nokeyformat';
    process.env.LICENSE_HMAC_SECRET = TEST_SECRET;

    await validateLicense();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit for HMAC mismatch', async () => {
    process.env.LICENSE_KEY = 'testuser:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    process.env.LICENSE_HMAC_SECRET = TEST_SECRET;

    await validateLicense();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit when LICENSE_HMAC_SECRET is missing', async () => {
    const key = generateLicenseKey('testuser', TEST_SECRET);
    process.env.LICENSE_KEY = key;
    delete process.env.LICENSE_HMAC_SECRET;

    await validateLicense();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('skips validation in development mode', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LICENSE_KEY;

    await validateLicense();

    expect(exitSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unit tests for generateLicenseKey and validateLicenseKey helpers
// ---------------------------------------------------------------------------
describe('generateLicenseKey helper', () => {
  it('returns "{username}:{64-char-hex}" format', () => {
    const key = generateLicenseKey('alice', TEST_SECRET);
    const parts = key.split(':');
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe('alice');
    expect(parts[1]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same username + secret always produces same key', () => {
    const key1 = generateLicenseKey('bob', TEST_SECRET);
    const key2 = generateLicenseKey('bob', TEST_SECRET);
    expect(key1).toBe(key2);
  });

  it('different usernames produce different keys', () => {
    const key1 = generateLicenseKey('alice', TEST_SECRET);
    const key2 = generateLicenseKey('bob', TEST_SECRET);
    expect(key1).not.toBe(key2);
  });
});

describe('validateLicenseKey helper', () => {
  it('returns false for empty string', () => {
    expect(validateLicenseKey('', TEST_SECRET)).toBe(false);
  });

  it('returns false for key with no colon', () => {
    expect(validateLicenseKey('nocolon', TEST_SECRET)).toBe(false);
  });

  it('returns false for key with wrong HMAC length', () => {
    expect(validateLicenseKey('user:abc123', TEST_SECRET)).toBe(false);
  });
});
