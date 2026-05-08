# GitHub OAuth Setup (WXATA + Supabase)

This guide configures GitHub sign-in for developer onboarding.
After setup, developers sign in with GitHub and the app provisions/reuses their API key via `/api/keys/github/upsert`.

## 1) Create GitHub OAuth App

1. Open GitHub Developer Settings:
   - https://github.com/settings/developers
2. Click **OAuth Apps** -> **New OAuth App**.
3. Fill values:
   - **Application name**: `WXATA Developer Portal` (or your preferred name)
   - **Homepage URL**: your frontend URL (example: `https://wxata.app`)
   - **Authorization callback URL**:
     - Supabase callback URL format:
       - `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
4. Save app and copy:
   - **Client ID**
   - **Client Secret**

## 2) Enable GitHub Provider in Supabase

1. Open Supabase Dashboard -> your project.
2. Go to **Authentication** -> **Providers** -> **GitHub**.
3. Enable provider.
4. Paste GitHub **Client ID** and **Client Secret**.
5. Save.

## 3) Configure Supabase Redirect URLs

In Supabase Dashboard -> **Authentication** -> **URL Configuration**:

1. Set **Site URL** to your frontend base URL.
   - Example: `https://wxata.app`
2. Add **Redirect URLs**:
   - `http://localhost:5173/developer/auth/callback` (local dev)
   - `https://<YOUR_FRONTEND_DOMAIN>/developer/auth/callback` (production)

## 4) Ensure App Environment Variables

Frontend (`frontend/.env` or deployment env):

- `VITE_SUPABASE_URL=<your supabase project url>`
- `VITE_SUPABASE_ANON_KEY=<your supabase anon key>`
- `VITE_BACKEND_URL=<your backend base url>`

Backend env (server runtime):

- `SUPABASE_URL=<your supabase project url>`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key>`

## 5) Apply DB Migration

Make sure your DB includes GitHub auth columns added in migration:

- `github_user_id`
- `auth_provider`

Run your Supabase migration flow so `supabase/migrations/20240101_api_service.sql` is applied.

## 6) Runtime Flow (Expected)

1. Frontend calls `supabase.auth.signInWithOAuth({ provider: 'github' })`.
2. User authorizes GitHub.
3. Supabase redirects to `/developer/auth/callback`.
4. Callback page gets session and calls backend `POST /api/keys/github/upsert` with `Authorization: Bearer <access_token>`.
5. Backend verifies Supabase user identity and provider, then creates/updates API profile and returns API key.
6. Frontend stores `developerApiKey` and redirects to `/developer/dashboard`.

## 7) Quick Test Checklist

1. Open `/login` and click **Continue with GitHub** under Developer account.
2. Complete OAuth consent.
3. Verify redirect reaches `/developer/auth/callback`.
4. Confirm you land on `/developer/dashboard`.
5. Confirm usage/topup/send endpoints work with returned key.

## 8) Common Issues

- `redirect_uri mismatch`:
  - Check callback URL in GitHub OAuth app exactly matches Supabase callback.
- Supabase redirects but app shows callback error:
  - Ensure `/developer/auth/callback` is listed in Supabase Redirect URLs.
- Backend rejects token (`Unauthorized`):
  - Check backend `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Provider check fails (`GitHub account required`):
  - User must sign in with GitHub provider, not email/password.
