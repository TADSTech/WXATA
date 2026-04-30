-- supabase/migrations/002_rls_user_codes_anon.sql
-- Allow anonymous (unauthenticated) users to SELECT from user_codes.
--
-- Why this policy is needed:
--   The registration page must validate that a user code exists and is unused
--   BEFORE the user has created a Supabase Auth account. At that point in the
--   flow the request is made with the anon key and there is no authenticated
--   session, so auth.uid() / auth.email() are NULL. Without this policy the
--   anon role would receive an empty result set and code validation would
--   always fail, blocking new registrations.
--
-- Security notes:
--   - This policy grants read-only access to the user_codes table for the
--     anon role. No sensitive personal data is stored in this table; it
--     contains only the code string, usage flags, and timestamps.
--   - The existing "user_codes_select_own" policy (added in migration 001)
--     is preserved unchanged so that authenticated users can still query
--     the code that was assigned to them.
--   - INSERT, UPDATE, and DELETE remain restricted to the service role,
--     which bypasses RLS by default. No explicit permissive policies are
--     added for those operations, so they continue to be denied for both
--     the anon and authenticated roles.

CREATE POLICY "user_codes_select_anon" ON user_codes
  FOR SELECT
  USING (true);
