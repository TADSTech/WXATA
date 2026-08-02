# Firebase Setup Guide

WXATA has migrated from Supabase to Firebase. This guide covers what you need
to set up in the Firebase Console and what env vars the app expects.

---

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and create a project
   (or reuse an existing one). No billing plan is required for the features
   WXATA uses (Auth + Firestore in the free Spark tier).
2. **Enable Email/Password auth**:
   - Console → Build → Authentication → Sign-in method
   - Enable **Email/Password**.
3. **Enable GitHub auth** (for the Developer Portal OAuth flow):
   - Console → Build → Authentication → Sign-in method
   - Enable **GitHub** and enter your GitHub OAuth app credentials
     (create one at https://github.com/settings/developers).
   - Authorized redirect URI must be:
     `https://<your-project>.firebaseapp.com/__/auth/handler`
4. **Create the Firestore database**:
   - Console → Build → Firestore Database → Create database
   - Choose **Production mode** (we provide rules below).
   - Region: pick the closest to your users.

---

## 2. Frontend config (Web app)

Console → Project settings → **Your apps** → Add app → Web.

Copy the config values into `frontend/.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=<project>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_BACKEND_URL=http://localhost:5000
VITE_ADMIN_PASS=...
VITE_FLW_PUBLIC_KEY=...
```

---

## 3. Backend config (Admin SDK)

Console → Project settings → **Service accounts** → Generate new private key.

This downloads a JSON file like:

```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMII...==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@<project>.iam.gserviceaccount.com",
  ...
}
```

Put these values into `backend/.env` (the `\n` in the private key are literal
backslash-n escapes, exactly as they appear in the JSON):

```
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@<project>.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...==\n-----END PRIVATE KEY-----\n"
```

> Note: on some platforms the multi-line value must be double-quoted. The
> `\\n` escapes are handled by `backend/firebase.ts` (and the migration script).

---

## 4. Firestore Security Rules

Direct Firestore reads/writes from the browser are **denied**. All data access
goes through the backend (firebase-admin), which bypasses security rules.

Console → Firestore Database → **Rules** → replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Migrate existing Supabase data

Before switching the running app to Firebase, export your current data once:

```bash
cd backend
# source Supabase env + destination Firebase env must both be set
bun run scripts/migrate-supabase-to-firestore.ts
```

This copies every row from these tables into Firestore:

| Supabase table | Firestore collection | Doc id |
|----------------|----------------------|--------|
| `api_keys` | `api_keys` | the API key value (`key`) |
| `users` | `users` | the Supabase auth `id` |
| `user_codes` | `user_codes` | auto-generated |
| `marketplace_extensions` | `marketplace_extensions` | auto-generated |
| `service_config` | `service_config` | the `key` value |
| `api_usage_log` | `api_usage_log` | auto-generated |

> Note: `users` doc ids are the old Supabase auth ids. Firebase Auth users are
> separate — new sign-ins create their own docs keyed by Firebase uid. If you
> need the old `username` fields to resolve for existing users, re-link them
> after sign-in (e.g. set the `username` field on the new Firebase-uid doc).

---

## 6. Authorized domains (if hosting the frontend elsewhere)

Console → Authentication → Settings → **Authorized domains**.

Add your frontend domain (e.g. `your-app.vercel.app`) so OAuth redirects work.

---

## 7. Environment recap

| Env var | Where | Source |
|---------|-------|--------|
| `VITE_FIREBASE_*` | `frontend/.env` | Firebase Console web app config |
| `FIREBASE_PROJECT_ID` | `backend/.env` | Service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | `backend/.env` | Service-account JSON |
| `FIREBASE_PRIVATE_KEY` | `backend/.env` | Service-account JSON |

The old `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` vars are no longer used by
the app (only by the one-time migration script above).
