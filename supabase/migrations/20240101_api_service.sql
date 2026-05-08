-- ============================================================
-- WXATA Send API — Supabase Migration
-- Run this in the Supabase SQL Editor to create the tables
-- needed for the programmatic WhatsApp API service.
-- ============================================================

-- ── API Keys ──────────────────────────────────────────────
-- Each developer gets one API key per email address.
CREATE TABLE IF NOT EXISTS api_keys (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key            TEXT        UNIQUE NOT NULL,
  owner_email    TEXT        NOT NULL,
  owner_name     TEXT        DEFAULT '',
  recovery_email TEXT,
  recovery_phone TEXT,
  github_user_id TEXT,
  auth_provider  TEXT        NOT NULL DEFAULT 'email',
  messages_sent  INTEGER     NOT NULL DEFAULT 0,
  messages_limit INTEGER     NOT NULL DEFAULT 100,
  paid_credits   INTEGER     NOT NULL DEFAULT 0,
  active         BOOLEAN     NOT NULL DEFAULT true,
  email_verified_at TIMESTAMPTZ,
  profile_completed_at TIMESTAMPTZ,
  verification_token_hash TEXT,
  verification_sent_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used      TIMESTAMPTZ
);

-- If api_keys already existed before this migration, add the new developer
-- profile columns in-place so the later indexes and backend queries work.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS recovery_email TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS recovery_phone TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS github_user_id TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS verification_token_hash TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;

UPDATE api_keys SET recovery_email = '' WHERE recovery_email IS NULL;
UPDATE api_keys SET recovery_phone = '' WHERE recovery_phone IS NULL;
UPDATE api_keys SET auth_provider = 'email' WHERE auth_provider IS NULL;

ALTER TABLE api_keys
  ALTER COLUMN recovery_email SET DEFAULT '',
  ALTER COLUMN recovery_phone SET DEFAULT '',
  ALTER COLUMN auth_provider SET DEFAULT 'email';

ALTER TABLE api_keys
  ALTER COLUMN recovery_email SET NOT NULL,
  ALTER COLUMN recovery_phone SET NOT NULL,
  ALTER COLUMN auth_provider SET NOT NULL;

-- Index for fast key lookups (every API request does this)
CREATE INDEX IF NOT EXISTS api_keys_key_idx     ON api_keys (key);
-- Index for email lookup (used by /api/keys/create to detect duplicates)
CREATE INDEX IF NOT EXISTS api_keys_email_idx   ON api_keys (owner_email);
CREATE INDEX IF NOT EXISTS api_keys_recovery_email_idx ON api_keys (recovery_email);
CREATE INDEX IF NOT EXISTS api_keys_recovery_phone_idx ON api_keys (recovery_phone);
CREATE INDEX IF NOT EXISTS api_keys_verification_token_idx ON api_keys (verification_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_github_user_id_uq
  ON api_keys (github_user_id)
  WHERE github_user_id IS NOT NULL;

-- ── API Usage Log ─────────────────────────────────────────
-- One row per message sent through the API.
CREATE TABLE IF NOT EXISTS api_usage_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id   UUID        REFERENCES api_keys(id) ON DELETE SET NULL,
  to_number    TEXT        NOT NULL,
  message_text TEXT,                      -- first 200 chars only
  status       TEXT        NOT NULL DEFAULT 'sent',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_log_key_idx  ON api_usage_log (api_key_id);
CREATE INDEX IF NOT EXISTS api_usage_log_time_idx ON api_usage_log (created_at DESC);

-- ── Service Config ────────────────────────────────────────
-- Key-value store for admin-configurable API service settings.
-- Editable from the Admin panel under "API Service Config".
CREATE TABLE IF NOT EXISTS service_config (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT        DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with defaults (safe to re-run — upsert pattern)
INSERT INTO service_config (key, value, description) VALUES
  ('api_free_limit',              '100',   'Number of free messages granted to each new API key'),
  ('api_topup_tier1_price_ngn',   '1000',  'Price for tier 1 top-up in NGN'),
  ('api_topup_tier1_messages',    '2000',  'Number of messages in tier 1 top-up'),
  ('api_topup_tier2_price_ngn',   '2000',  'Price for tier 2 top-up in NGN'),
  ('api_topup_tier2_messages',    '5000',  'Number of messages in tier 2 top-up'),
  ('api_pro_price_monthly_ngn',   '3200',  'Monthly subscription price for Developer Pro in NGN'),
  ('api_pro_monthly_messages',    '10000', 'Number of messages per month for Developer Pro')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Row Level Security
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON api_keys;
CREATE POLICY "Service role full access" ON api_keys
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON api_usage_log;
CREATE POLICY "Service role full access" ON api_usage_log
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON service_config;
CREATE POLICY "Service role full access" ON service_config
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anonymous users read config" ON service_config;
CREATE POLICY "Anonymous users read config" ON service_config
  AS PERMISSIVE FOR SELECT
  USING (true);

-- ============================================================
-- Notes
-- ============================================================
-- 1. The backend reads/writes these tables using the Supabase
--    service-role key (SUPABASE_SERVICE_ROLE_KEY env var).
--
-- 2. The frontend Admin panel reads service_config via the
--    anon key — ensure your RLS / anon-key grants allow this,
--    or switch to a server-side proxy call.
--
-- 3. api_usage_log can grow large over time. Consider adding
--    a periodic cleanup job or partitioning by month.
--
-- 4. Top-up tiers:
--    - Tier 1: ₦1,000 for 2,000 messages (₦0.50 per message)
--    - Tier 2: ₦2,000 for 5,000 messages (₦0.40 per message)
--    Users can choose which tier they prefer.
--
-- 5. Developer Pro subscription:
--    - ₦3,200/month for 10,000 messages
--    - Includes priority support, webhooks, and analytics
--============================================================
