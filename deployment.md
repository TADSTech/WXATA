# WXATA Deployment Guide

## Architecture

```
Frontend (Vercel)                  Backend (Oracle Cloud VPS)
https://wxata.vercel.app  ──WSS──► wss://YOUR_ORACLE_IP:5000
                           ──HTTP─► http://YOUR_ORACLE_IP:5000/health
                                    Persistent volumes ✅  PM2 managed ✅
```

---

## Oracle Cloud Free Tier — Full Setup

Oracle's Always Free tier gives you a real Ubuntu VM (up to 4 OCPU / 24 GB RAM on Ampere A1).
Everything below runs on the free tier.

---

### 1. Create the VM

1. Log in → **Compute → Instances → Create Instance**
2. **Image**: Ubuntu 22.04 (Canonical)
3. **Shape**: `VM.Standard.A1.Flex` — set **1 OCPU / 6 GB RAM** (free)
4. **Networking**: keep the default VCN, make sure **Assign a public IPv4** is checked
5. **SSH keys**: upload your public key (or download the generated one)
6. Click **Create** — note the **Public IP** once it's running

---

### 2. Open firewall ports

Oracle has two layers of firewall. You need to open port **5000** in both.

#### A — Oracle Security List (cloud console)

1. Go to **Networking → Virtual Cloud Networks → your VCN → Security Lists → Default**
2. **Add Ingress Rule**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination Port: `5000`
3. Save

#### B — OS firewall (iptables / ufw inside the VM)

```bash
# Oracle Ubuntu images use iptables by default, not ufw
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5000 -j ACCEPT
sudo netfilter-persistent save
```

If you prefer ufw:
```bash
sudo ufw allow 5000/tcp
sudo ufw reload
```

---

### 3. SSH into the VM

```bash
ssh -i ~/.ssh/your_key ubuntu@YOUR_ORACLE_IP
```

---

### 4. Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo bash

# Add your user to the docker group (no sudo needed after re-login)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

### 5. Clone the repo

```bash
cd ~
git clone https://github.com/TADSTech/WXATA.git wxata
cd wxata
```

---

### 6. Configure environment

```bash
# Create the backend .env from the example
cp backend/.env.example backend/.env

# Edit if you want a different port (default 5000 is fine)
nano backend/.env
```

The only required variable is `PORT=5000`. Everything else has safe defaults.

---

### 7. Build and start with Docker Compose

```bash
# Build the image and start in the background
docker compose up -d --build

# Watch logs
docker compose logs -f wxata
```

The container starts PM2 in no-daemon mode (`pm2-runtime`).
PM2 manages the Bun process inside the container.

---

### 8. Verify it's running

```bash
# Container status
docker compose ps

# Health check
curl http://localhost:5000/health

# PM2 info
curl http://localhost:5000/pm2

# Live PM2 logs from inside the container
docker compose exec wxata pm2 logs wxata
```

---

### 9. Set up TLS with Caddy (required for wss://)

Your frontend is on HTTPS (`wxata.tadstech.dev`). Browsers **block** plain `ws://` connections from HTTPS pages (Mixed Content policy). You need `wss://` — Caddy handles this automatically with a free Let's Encrypt cert.

#### A — Point a (sub)domain at your Oracle IP

In your DNS provider, add an **A record**:
```
wxata-api.tadstech.dev  →  129.151.247.139
```
Or reuse the same domain with a path — whatever you prefer. Wait for DNS to propagate (~1–5 min with low TTL).

#### B — Open port 80 and 443 in Oracle Security List + iptables

Port 80 is needed for the ACME HTTP challenge (cert issuance). Port 443 is the TLS endpoint.

In Oracle Console → Security List → Add Ingress Rules:
- TCP port `80`  (source `0.0.0.0/0`)
- TCP port `443` (source `0.0.0.0/0`)

In the VM:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 7 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

#### C — Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

#### D — Configure Caddy

Edit the Caddyfile (one is included in the repo):
```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the entire contents with:
```
wxata-api.tadstech.dev {
    reverse_proxy localhost:5000
}
```

Then reload:
```bash
sudo systemctl reload caddy
sudo systemctl status caddy   # confirm it's running
```

Caddy will automatically obtain and renew the TLS cert.

#### E — Update Vercel environment variable

In your Vercel project settings, change:
```
VITE_BACKEND_URL=wss://wxata-api.tadstech.dev
```

Trigger a redeploy. The dashboard will now connect over `wss://` and the Mixed Content error is gone.

---

### 10. Verify everything

```bash
# Backend running?
docker compose ps
curl http://localhost:5000/health

# TLS working?
curl https://wxata-api.tadstech.dev/health

# WebSocket reachable?
# Open browser devtools on wxata.tadstech.dev/dashboard — no Mixed Content errors
```

---

## How Dashboard Actions Work with PM2

| Dashboard Button | What happens in code | Exit code | PM2 behaviour |
|---|---|---|---|
| **Restart** | Destroys WA connection, `process.exit(0)` | `0` | PM2 restarts the process automatically |
| **Terminate** | Destroys WA connection, `process.exit(2)` | `2` | PM2 stops — does **not** restart (`stop_exit_codes: [2]`) |
| **Logout** | Clears session files, then same as Restart | `0` | PM2 restarts; bot will show QR/pairing on next connect |

---

## Useful Commands

### Docker Compose

```bash
docker compose up -d          # start (detached)
docker compose down           # stop and remove containers
docker compose restart wxata  # restart container
docker compose logs -f wxata  # tail logs
docker compose pull           # pull latest image (after git pull + rebuild)
docker compose up -d --build  # rebuild and restart
```

### PM2 (inside the container)

```bash
docker compose exec wxata pm2 status
docker compose exec wxata pm2 logs wxata
docker compose exec wxata pm2 logs wxata --lines 100
docker compose exec wxata pm2 monit
```

---

## Updating the Bot

```bash
cd ~/wxata
git pull
docker compose up -d --build   # rebuilds image with new code, restarts container
```

Your data (WhatsApp session, SQLite DB, botinfo.json) lives in Docker named volumes
and is **not affected** by rebuilds.

---

## Persistent Data — What's Stored Where

| Data | Docker Volume | Host path (inside VM) |
|---|---|---|
| WhatsApp session | `wxata_auth` → `/data/auth_info` | managed by Docker |
| SQLite database | `wxata_db` → `/data/db` | managed by Docker |
| botinfo / warns / vars | `wxata_data` → `/data` | managed by Docker |
| PM2 logs | `wxata_logs` → `/app/logs` | managed by Docker |

To back up your session:
```bash
docker run --rm -v wxata_auth:/data -v $(pwd):/backup ubuntu \
  tar czf /backup/auth_backup.tar.gz /data
```

To restore:
```bash
docker run --rm -v wxata_auth:/data -v $(pwd):/backup ubuntu \
  tar xzf /backup/auth_backup.tar.gz -C /
```

---

## Bare VPS (without Docker)

If you prefer to run directly on the VM without Docker:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install Node + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Install deps
cd ~/wxata
bun install
cd backend && bun install && cd ..

# Start
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # run the command it prints
```

---

## Troubleshooting

**Dashboard can't connect**
- Check port 5000 is open: `curl http://YOUR_ORACLE_IP:5000/health` from your local machine
- Oracle Security List AND iptables both need the port open (see step 2)
- Check container is running: `docker compose ps`

**Bot crashes on startup**
- Check logs: `docker compose logs wxata`
- Usually a missing `botinfo.json` — the app creates it automatically from defaults on first run

**QR code needed after restart**
- Session is in the `wxata_auth` Docker volume — it persists across restarts and rebuilds
- Only need to re-scan if you ran **Logout** from the dashboard or manually deleted the volume

**PM2 not restarting after dashboard Restart**
- Confirm you're running via `docker compose` (uses `pm2-runtime`)
- Check: `curl http://localhost:5000/pm2` — `managed: true` means PM2 is active

**Container keeps restarting**
- `docker compose logs wxata` — look for the error
- If it's a port conflict: `sudo lsof -i :5000`
