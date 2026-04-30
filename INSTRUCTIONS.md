# WXATA — Getting Live: Step-by-Step Instructions

This document covers everything you need to deploy the new monetization features and fix the bot stability issue on Oracle VPS.

---

## Part 1 — Why the Bot Was Dying (and the Fix)

### Root Cause

Three things were working against you:

1. **PM2 `max_restarts: 10` was too low.** If Baileys had a burst of reconnect attempts (e.g. WhatsApp server hiccup, network blip), PM2 would hit the limit and permanently stop restarting the process. The bot would appear "running" in PM2 but actually be dead.

2. **No global error handlers.** An unhandled promise rejection in any part of the code could leave the process in a zombie state — alive but not reconnecting.

3. **Self-ping only ran on Render.** On Oracle VPS, if the event loop went quiet for too long (no messages, no dashboard connections), the OS could kill the process as "idle".

### What Was Fixed

- `ecosystem.config.cjs`: `max_restarts` raised from 10 → 50, added `exp_backoff_restart_delay` so PM2 backs off instead of spin-looping
- `backend/index.ts`: Added `unhandledRejection`, `uncaughtException`, and `SIGTERM` handlers
- `backend/DashboardServer.ts`: Self-ping now runs on Oracle VPS too (pings `http://127.0.0.1:5000/health` every 10 minutes regardless of `RENDER_EXTERNAL_URL`)

### Apply the Fix on Your Oracle VPS

```bash
# SSH into your Oracle VPS
ssh -i ~/.ssh/your_key ubuntu@YOUR_ORACLE_IP

# Pull the latest code
cd ~/WXATA
git pull

# Rebuild and restart
docker compose up -d --build

# Verify it's running
docker compose ps
docker compose logs -f wxata
```

That's it. The bot will now survive indefinitely without you touching it.

---

## Part 2 — New Features Setup

### 2.1 Supabase Setup (Required — replaces Firebase)

The frontend now uses Supabase instead of Firebase. You need a Supabase project.

**Step 1: Create a Supabase project**

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Also note your **service role key** (Settings → API → service_role — keep this secret)

**Step 2: Run the database migration**

In your Supabase project → SQL Editor → paste and run the contents of:
```
supabase/migrations/001_initial_schema.sql
```

This creates the `users`, `user_codes`, and `marketplace_extensions` tables with all indexes and RLS policies.

**Step 3: Update frontend environment variables (Vercel)**

In your Vercel project → Settings → Environment Variables, add:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

Remove the old Firebase variables if they exist.

Trigger a redeploy.

**Step 4: Update backend environment variables (Oracle VPS)**

Edit `backend/.env` on your Oracle VPS:
```bash
nano ~/WXATA/backend/.env
```

Add:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
```

---

### 2.2 Pricing Page

The `/pricing` route is live automatically after the Vercel redeploy. No extra config needed.

To enable Flutterwave payment buttons (optional):

In your Vercel project → Settings → Environment Variables, add:
```
VITE_FLW_PUBLIC_KEY=FLWPUBK_your_public_key_here
```

Without this, only the WhatsApp CTA buttons show (which is fine for now).

---

### 2.3 Flutterwave Webhook (for automated payment processing)

**Step 1: Add backend env vars**

In `backend/.env` on Oracle VPS:
```env
FLW_SECRET_HASH=your-flutterwave-secret-hash-here
LICENSE_HMAC_SECRET=<generate a random 32-byte hex string>
ADMIN_SECRET=<your admin password>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="WXATA <your@gmail.com>"
```

To generate a random `LICENSE_HMAC_SECRET`:
```bash
openssl rand -hex 32
```

**How webhook verification works**

When Flutterwave sends a webhook, it includes a `verif-hash` header. The backend verifies the request by comparing this header value directly against `FLW_SECRET_HASH` using string equality:

```
if (req.headers['verif-hash'] !== process.env.FLW_SECRET_HASH) → 401 Unauthorized
```

Set `FLW_SECRET_HASH` to any secret string you choose — just make sure it matches exactly what you configure in the Flutterwave dashboard.

**Step 2: Register the webhook in Flutterwave**

1. Flutterwave Dashboard → Settings → Webhooks
2. Add webhook URL: `https://wxata-api.yourdomain.com/webhooks/flutterwave`
3. Set the secret hash to the same value as your `FLW_SECRET_HASH` env var

**Step 3: Rebuild and restart**

```bash
cd ~/WXATA && git pull && docker compose up -d --build
```

---

### 2.4 License Key Generation (Admin Panel)

After deploying with `ADMIN_SECRET` set:

1. Go to `https://wxata.tadstech.dev/admin`
2. Enter your admin passphrase
3. Scroll to the new **"Generate License Key"** card
4. Enter the buyer's username → click Generate
5. Copy the key and send it to the buyer

The key format is `username:hmac_hex`. The buyer sets it as `LICENSE_KEY` in their `.env`.

---

### 2.5 wxata-public Repo (for selling the self-host tier)

The `wxata-public/` directory is ready. To publish it:

```bash
cd wxata-public
git init
git add .
git commit -m "Initial public release"
git remote add origin https://github.com/tadstech/wxata-public.git
git push -u origin main
```

To build the obfuscated binary:
```bash
# From the workspace root
bun run build:public
```

This outputs `wxata-public/dist/index.js` — the obfuscated bot binary. Commit and push it to the public repo.

---

## Part 3 — Full Deployment Checklist

Run through this before testing:

- [ ] `git pull` on Oracle VPS
- [ ] `docker compose up -d --build` on Oracle VPS
- [ ] `docker compose logs -f wxata` — confirm no errors, bot starts
- [ ] Supabase migration SQL run
- [ ] Vercel env vars updated (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Vercel redeployed
- [ ] `/pricing` page loads at `https://wxata.tadstech.dev/pricing`
- [ ] Register page shows SocialBanner
- [ ] Admin panel shows "Generate License Key" section
- [ ] Bot stays connected after 30+ minutes of inactivity (the key test)

---

## Part 4 — Monitoring the Bot

### Check if PM2 is keeping the bot alive

```bash
docker compose exec wxata pm2 status
docker compose exec wxata pm2 logs wxata --lines 50
```

Look for `status: online` and `↺ restarts: N` — a few restarts is normal, but it should never reach `errored`.

### Check the self-ping is working

```bash
docker compose logs wxata | grep "Self-ping"
```

You should see: `🔁 Self-ping keep-alive active → http://127.0.0.1:5000/health`

### Check the health endpoint

```bash
curl https://wxata-api.yourdomain.com/health
```

Should return JSON with `"status":"ok"` and the current connection state.

---

## Part 5 — If the Bot Still Dies

If after all this the bot still dies during inactivity, the issue is likely a **Baileys session expiry** (WhatsApp logs out the session after ~14 days of no messages). This is normal WhatsApp behavior.

Signs: `Connection closed. Reason: 401` in the logs.

Fix: The bot automatically clears the session and reconnects — you just need to scan a new QR code from the dashboard.

To prevent this: send at least one message through the bot every 7–10 days, or set up a cron job that pings the bot with a command.

---

## Quick Reference

| What | Where |
|------|-------|
| Frontend | `https://wxata.tadstech.dev` |
| Pricing page | `https://wxata.tadstech.dev/pricing` |
| Admin panel | `https://wxata.tadstech.dev/admin` |
| Backend health | `https://wxata-api.yourdomain.com/health` |
| Flutterwave webhook URL | `https://wxata-api.yourdomain.com/webhooks/flutterwave` |
| Public repo | `https://github.com/tadstech/wxata-public` |
| WhatsApp support | `https://wa.me/2347041029093` |
