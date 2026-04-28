-- supabase/migrations/001_initial_schema.sql
-- Initial schema for WXATA platform
-- Replaces Firebase Auth + Firestore with Supabase (PostgreSQL + Auth)

-- ============================================================
-- Users table (replaces Firestore 'users' collection)
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT UNIQUE NOT NULL,   -- Supabase Auth user ID
  name        TEXT NOT NULL,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  user_code   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- User codes table (replaces Firestore 'user_codes' collection)
-- ============================================================
CREATE TABLE user_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  used        BOOLEAN DEFAULT false,
  suspended   BOOLEAN DEFAULT false,
  used_by     TEXT,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Marketplace extensions (replaces Firestore 'extensions' collection)
-- ============================================================
CREATE TABLE marketplace_extensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  trigger          TEXT NOT NULL,
  aliases          TEXT[],
  type             TEXT,
  target           TEXT,
  response         TEXT,
  code             TEXT,
  default_argument TEXT,
  author           TEXT NOT NULL,
  author_uid       TEXT NOT NULL,
  status           TEXT DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT now(),
  downloads        INTEGER DEFAULT 0,
  tags             TEXT[],
  version          TEXT,
  untrusted        BOOLEAN DEFAULT false,
  disabled         BOOLEAN DEFAULT false
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_users_uid ON users(uid);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_user_codes_code ON user_codes(code);
CREATE INDEX idx_user_codes_used_by ON user_codes(used_by);
CREATE INDEX idx_marketplace_extensions_status ON marketplace_extensions(status);
CREATE INDEX idx_marketplace_extensions_author_uid ON marketplace_extensions(author_uid);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_extensions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- users RLS policies
-- Authenticated users can read and update only their own row.
-- Service role bypasses RLS by default (no policy needed).
-- ------------------------------------------------------------
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = uid);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = uid);

-- ------------------------------------------------------------
-- user_codes RLS policies
-- Authenticated users can read the code that was assigned to them.
-- INSERT/UPDATE is performed only via the service role (webhook handler).
-- ------------------------------------------------------------
CREATE POLICY "user_codes_select_own" ON user_codes
  FOR SELECT USING (used_by = auth.email());

-- ------------------------------------------------------------
-- marketplace_extensions RLS policies
-- SELECT: approved extensions are visible to all; authors can see their own.
-- INSERT: authors can submit their own extensions.
-- UPDATE: authors can edit their own extensions.
-- Service role has full access for admin operations.
-- ------------------------------------------------------------
CREATE POLICY "extensions_select_approved" ON marketplace_extensions
  FOR SELECT USING (status = 'approved' OR author_uid = auth.uid()::text);

CREATE POLICY "extensions_insert_own" ON marketplace_extensions
  FOR INSERT WITH CHECK (author_uid = auth.uid()::text);

CREATE POLICY "extensions_update_own" ON marketplace_extensions
  FOR UPDATE USING (author_uid = auth.uid()::text);
