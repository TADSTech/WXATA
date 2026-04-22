# WXATA Deployment Guide

## Architecture

```
Frontend (Vercel)          Backend (Render)
https://wxata.vercel.app ──WebSocket──► wss://your-app.onrender.com:4000
                                        HTTP health ► :3000/health
                                        Persistent disk ► /data/
```

---

## Your Personal Deployment (Quick Start)

### 1. Fork / Clone

```bash
git clone https://github.com/your-username/wxata.git
cd wxata
```

### 2. Seed your config

```bash
cp botinfo.example.json botinfo.json
# Edit botinfo.json — set your prefix, welcome message, etc.
```

### 3. Deploy Backend on Render

1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   | Field | Value |
   |---|---|
   | Root Directory | `backend` |
   | Runtime | `Node` |
   | Build Command | `npm install -g bun && bun install` |
   | Start Command | `bun run index.ts` |
   | Health Check Path | `/health` |
4. Add a **Disk** (under Advanced):
   | Field | Value |
   |---|---|
   | Name | `wxata-data` |
   | Mount Path | `/data` |
   | Size | 1 GB |
5. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `PORT` | `3000` |
   | `WS_PORT` | `4000` |
   | `RENDER_EXTERNAL_URL` | `https://your-app.onrender.com` (fill after first deploy) |
   | `DB_RETENTION_DAYS` | `7` |
6. Click **Create Web Service**

> The persistent disk at `/data` stores your WhatsApp session (`auth_info/`), `botinfo.json`, SQLite DB, and all config files. They survive restarts and redeployments.

> The backend self-pings `/health` every 10 minutes via `RENDER_EXTERNAL_URL` to prevent Render's free tier from sleeping.

### 4. Update Frontend WebSocket URL

In `frontend/src/pages/Dashboard.tsx`, the WS URL is already environment-aware:
```ts
const wsUrl = window.location.hostname === 'localhost'
  ? 'ws://localhost:4000'
  : 'wss://wxata.onrender.com';  // ← update this to your Render URL
```

Change `wxata.onrender.com` to your actual Render service URL, then redeploy the frontend.

### 5. Deploy Frontend on Vercel

Already live at `https://wxata.vercel.app`. To deploy your own:

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
2. Settings:
   | Field | Value |
   |---|---|
   | Framework | `Vite` |
   | Root Directory | `frontend` |
   | Build Command | `bun run build` |
   | Output Directory | `dist` |
3. Deploy

---

## For Other Developers (Self-Hosting)

Each developer runs their own backend instance. They do **not** share your Render instance.

### What they need

1. Their own Render account (free tier works)
2. Fork of this repo
3. Their own `botinfo.json` (copy from `botinfo.example.json`)

### Steps

```bash
# 1. Fork the repo on GitHub

# 2. Clone their fork
git clone https://github.com/their-username/wxata.git
cd wxata

# 3. Seed config
cp botinfo.example.json botinfo.json

# 4. Deploy backend on their own Render account (same steps as above)

# 5. Update the WS URL in Dashboard.tsx to point to their Render URL

# 6. Deploy frontend on their own Vercel account (or use the shared one)
```

### What's shared vs. per-instance

| Resource | Shared | Per-instance |
|---|---|---|
| Frontend (Vercel) | ✅ Can share | Each can deploy their own |
| Firebase Auth/Firestore | ✅ Shared | — |
| Extension Marketplace | ✅ Shared | — |
| Backend (Render) | ❌ Each needs their own | ✅ |
| WhatsApp session | ❌ | ✅ |
| `botinfo.json` | ❌ | ✅ |
| SQLite DB | ❌ | ✅ |

---

## Local Development

```bash
# Install all deps
bun run install:all

# Run both frontend and backend
bun run all

# Backend only
bun run backend

# Frontend only
bun run frontend
```

Local data files live in the workspace root (`botinfo.json`, `warns.json`, etc.) and `backend/db/` for SQLite. These are gitignored.

---

## File Structure (gitignored per-instance files)

```
wxata/
├── botinfo.json          ← your bot config (gitignored, seed from botinfo.example.json)
├── botinfo.example.json  ← committed template
├── warns.json            ← warn counts (auto-created)
├── vars.json             ← custom variables (auto-created)
├── backend/
│   ├── auth_info/        ← WhatsApp session (gitignored, NEVER commit)
│   ├── antidel.json      ← anti-delete config (auto-created)
│   ├── antibc.json       ← anti-broadcast config (auto-created)
│   └── db/               ← SQLite database (gitignored)
```

On Render, all of the above live under `/data/` on the persistent disk instead.

---

## Troubleshooting

**Bot disconnects after a while on Render free tier**
- Make sure `RENDER_EXTERNAL_URL` is set correctly — this enables the self-ping keep-alive
- Render free tier has a 750 hour/month limit — upgrade to Starter ($7/mo) for 24/7 uptime

**QR code required on every restart**
- You don't have a persistent disk configured — add the `/data` disk in Render settings
- Without it, `auth_info/` is wiped on every deploy/restart

**WebSocket not connecting from dashboard**
- Check the WS URL in `Dashboard.tsx` matches your Render service URL
- Render free tier only exposes port 443 (HTTPS/WSS) externally — use `wss://` not `ws://`
- Make sure port 4000 is the WS port and Render's external port 443 proxies to it

**Commands not working after deploy**
- Check `botinfo.json` exists on the persistent disk — it's auto-created from `botinfo.example.json` on first run
- Check the dashboard logs for permission errors
