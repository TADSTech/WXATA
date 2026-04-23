# WXATA Deployment Guide

## Architecture

```
Frontend (Vercel)           Backend (VPS)
https://wxata.vercel.app ──WebSocket──► ws://YOUR_VPS_IP:5000
                                        HTTP health ► :3000/health
                                        Filesystem  ► persistent ✅
```

---

## Backend — VPS Setup (freevps.edu.pl or any Linux VPS)

### 1. SSH into your VPS

```bash
ssh root@YOUR_VPS_IP
```

### 2. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc   # or restart the shell
bun --version      # confirm it works
```

### 3. Install Git

```bash
apt update && apt install -y git
```

### 4. Clone your repo

```bash
cd /root
git clone https://github.com/TADSTech/WXATA.git wxata
cd wxata
```

### 5. Seed your config

```bash
cp botinfo.example.json botinfo.json
# Edit if needed — prefix, welcome message, etc.
nano botinfo.json
```

### 6. Install backend dependencies

```bash
cd backend
bun install
cd ..
```

### 7. Run the bot with PM2 (keeps it alive after SSH disconnect)

```bash
# Install PM2
bun add -g pm2

# Start the bot
pm2 start backend/index.ts --name wxata --interpreter bun

# Save so it restarts on VPS reboot
pm2 save
pm2 startup   # run the command it outputs
```

### 8. Check it's running

```bash
pm2 logs wxata        # live logs
pm2 status            # process list
```

### 9. Update the WebSocket URL in the frontend

In `frontend/.env`:
```env
VITE_BACKEND_URL=ws://YOUR_VPS_IP:5000
```

Commit and push, Vercel will auto-redeploy.

---

## Useful PM2 Commands

```bash
pm2 restart wxata     # restart bot
pm2 stop wxata        # stop bot
pm2 logs wxata        # tail logs
pm2 logs wxata --lines 100   # last 100 lines
pm2 monit             # live CPU/memory dashboard
```

---

## Updating the Bot

```bash
cd /root/wxata
git pull
cd backend && bun install   # only if package.json changed
pm2 restart wxata
```

---

## File Locations on VPS

```
/root/wxata/
├── botinfo.json          ← your bot config (persistent ✅)
├── warns.json            ← auto-created on first run
├── vars.json             ← auto-created on first run
└── backend/
    ├── auth_info/        ← WhatsApp session (persistent ✅)
    ├── antidel.json      ← auto-created on first run
    ├── antibc.json       ← auto-created on first run
    └── db/               ← SQLite database (persistent ✅)
```

Everything persists on a real VPS — no disk wipes, no sleep.

---

## Backend — Docker PaaS Deployment (Alternative)

If you prefer to deploy the backend to a Platform as a Service (PaaS) like Render, Railway, or Fly.io, you can use the provided `Dockerfile`. Most PaaS providers support deploying directly from a `Dockerfile` without needing `docker-compose`.

### 1. Connecting your Repo
Most platforms allow you to connect your GitHub repository directly. They will automatically detect the `Dockerfile` in the root of the repository and build the image.

### 2. Configuration Settings
When configuring the deployment on your PaaS provider, use the following settings:
- **Build Command**: Not required (handled by the Dockerfile)
- **Start Command**: Not required (handled by the Dockerfile's `CMD`)
- **Port**: `5000` (Make sure the platform exposes this port for the WebSocket connection)
- **Environment Variables**: Add any environment variables you need (e.g., `DB_RETENTION_DAYS=3`)

### 3. Data Persistence Note
Since this deployment method relies on the container's ephemeral filesystem (without mounted volumes), **any data stored locally inside the container will be lost if the container spins down, restarts, or redeploys.**
- **Plugins**: Your marketplace plugins are safely stored in Firestore and will not be affected.
- **WhatsApp Session (`auth_info`)**: If the container restarts, you will need to re-scan the QR code to re-authenticate the bot.
- **SQLite DB**: The local SQLite database containing chat history for commands will be wiped on restart.

If your PaaS provider supports persistent disks (like Render's `/data` disk), the application is already configured to prioritize it automatically to prevent data loss.

### 4. Deploying Manually (Local/VPS)
If you just want to run the Docker image manually on your own server without `docker-compose`:
```bash
docker build -t wxata-backend .
docker run -d -p 5000:5000 --name wxata-backend wxata-backend
```

---

## Frontend — Vercel (already live)

Already deployed at `https://wxata.vercel.app`.

To redeploy after changing the WS URL:
```bash
# Add your environment variable VITE_BACKEND_URL to your Vercel project settings
```

Vercel picks it up automatically.

---

## For Other Developers (Self-Hosting)

Each dev runs their own VPS instance. They do **not** share yours.

```bash
# 1. Fork the repo on GitHub
# 2. Get their own VPS (freevps.edu.pl or similar)
# 3. SSH in and follow steps 2–8 above
# 4. Set VITE_BACKEND_URL in your Vercel project settings to your own VPS IP
# 5. Deploy their own frontend fork on Vercel
```

What's shared vs per-instance:

| Resource | Shared | Per-instance |
|---|---|---|
| Frontend (Vercel) | ✅ Can share | Each can deploy their own |
| Firebase Auth/Firestore | ✅ Shared | — |
| Extension Marketplace | ✅ Shared | — |
| VPS / Backend process | ❌ | ✅ Each needs their own |
| WhatsApp session | ❌ | ✅ |
| `botinfo.json` | ❌ | ✅ |
| SQLite DB | ❌ | ✅ |

---

## Local Development

```bash
bun run install:all   # install all deps
bun run all           # frontend + backend together
```

---

## Troubleshooting

**Dashboard can't connect to backend**
- Make sure port 5000 is open on your VPS firewall: `ufw allow 5000`
- Check the `VITE_BACKEND_URL` environment variable matches your VPS IP
- Check PM2 is running: `pm2 status`

**Bot disconnects / crashes**
- Check logs: `pm2 logs wxata`
- PM2 auto-restarts on crash — check restart count in `pm2 status`

**QR code needed after VPS reboot**
- Session is in `backend/auth_info/` — it persists across reboots on a real VPS
- Only need to re-scan if you manually deleted auth_info or the VPS was wiped

**Commands not working**
- Check `botinfo.json` exists: `cat /root/wxata/botinfo.json`
- Check permissions in botinfo.json — run `+perm grant all` from your number
