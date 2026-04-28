/**
 * licenseValidator.ts
 * Validates the LICENSE_KEY environment variable on startup using HMAC-SHA256.
 * Requirements: 5.5, 5.6, 5.7, 5.8
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Exported helpers (used by tests and DashboardServer)
// ---------------------------------------------------------------------------

/**
 * Generate a license key for a given username and secret.
 * Format: "{username}:{hmac_hex}"
 */
export function generateLicenseKey(username: string, secret: string): string {
  const hmacHex = crypto
    .createHmac('sha256', secret)
    .update(username)
    .digest('hex');
  return `${username}:${hmacHex}`;
}

/**
 * Validate a license key against a secret.
 * Returns true if the key is valid, false otherwise.
 */
export function validateLicenseKey(key: string, secret: string): boolean {
  const colonIdx = key.indexOf(':');
  if (colonIdx === -1) return false;
  const username = key.slice(0, colonIdx);
  const providedHmac = key.slice(colonIdx + 1);
  if (!username || !providedHmac) return false;

  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(username)
    .digest('hex');

  try {
    const a = Buffer.from(providedHmac, 'hex');
    const b = Buffer.from(expectedHmac, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// validateLicense — called at startup
// ---------------------------------------------------------------------------

export async function validateLicense(): Promise<void> {
  const licenseKey = process.env.LICENSE_KEY;
  const hmacSecret = process.env.LICENSE_HMAC_SECRET;

  // Skip validation in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[WXATA] Development mode — skipping license validation.');
    return;
  }

  if (!licenseKey) {
    console.error('[WXATA] ERROR: LICENSE_KEY environment variable is not set.');
    setTimeout(() => process.exit(1), 3000);
    return;
  }

  if (!licenseKey.includes(':')) {
    console.error('[WXATA] ERROR: LICENSE_KEY format is invalid.');
    setTimeout(() => process.exit(1), 3000);
    return;
  }

  if (!hmacSecret) {
    console.error('[WXATA] ERROR: LICENSE_HMAC_SECRET is not configured.');
    setTimeout(() => process.exit(1), 3000);
    return;
  }

  const isValid = validateLicenseKey(licenseKey, hmacSecret);

  if (!isValid) {
    console.error('[WXATA] ERROR: LICENSE_KEY is invalid or has been tampered with.');
    setTimeout(() => process.exit(1), 3000);
    return;
  }

  const username = licenseKey.split(':')[0];
  console.log(`[WXATA] License validated successfully for user: ${username}`);
}
