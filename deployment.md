# WXATA Deployment Guide

## Architecture

```
Frontend (Vercel)                    Backend (Oracle Cloud VPS)
https://wxata.tadstech.dev  ──WSS──► wss://wxata-api.tadstech.dev
                             ──HTTP─► https://wxata-api.tadstech.dev/health
                                      Caddy TLS ✅  Docker + PM2 ✅  Persistent volumes ✅
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

Oracle has **two independent firewall layers**. Both must allow a port or traffic is blocked.

#### A — Oracle Security List (cloud console)

1. Go to **Compute → Instances → your instance → Primary VNIC → Subnet → Security List**
   > Make sure you're editing the Security List attached to **this specific subnet**, not just any list in the VCN.
2. Add these **Ingress Rules**:

| Source CIDR | Protocol | Dest Port | Purpose |
|---|---|---|---|
| `0.0.0.0/0` | TCP | `22` | SSH (usually pre-added) |
| `0.0.0.0/0` | TCP | `80` | Caddy ACME cert challenge |
| `0.0.0.0/0` | TCP | `443` | HTTPS / WSS |
| `0.0.0.0/0` | TCP | `5000` | Backend direct access (optional after Caddy) |

#### B — OS firewall (iptables inside the VM)

Oracle Ubuntu images use iptables with a default `REJECT all` rule. New rules must be inserted **before** that rule or they're ignored.

Run this single command to add all ports correctly:

```bash
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null; \
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null; \
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 5000 -j ACCEPT 2>/dev/null; \
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 5000 -j ACCEPT && \
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT && \
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT && \
sudo netfilter-persistent save
```

> **Why position 5?** The default chain has a `REJECT all` rule at line 5. Inserting at 5 pushes it down and ensures your ACCEPT rules are evaluated first.

Verify the order is correct (ACCEPT rules must appear before REJECT):
```bash
sudo iptables -L INPUT --line-numbers -n
```

---

### 3. SSH into the VM

```bash
ssh -i ~/.ssh/your_key ubuntu@YOUR_ORACLE_IP
```

**Tip — copy/paste in SSH terminal:**
- Windows Terminal / PowerShell: `Ctrl+Shift+V` to paste
- Older cmd window: right-click = paste
- Recommended: use **VS Code Remote SSH** extension for a full editor experience

---

### 4. Install Docker & Docker Compose

```bash
sudo apt update && sudo apt upgrade -y && \
curl -fsSL https://get.docker.com | sudo bash && \
sudo usermod -aG docker $USER && \
sudo apt install -y docker-compose-plugin && \
docker --version && docker compose version
```

Log out and back in (or run `newgrp docker`) so the group change takes effect.

---

### 5. Clone the repo

```bash
cd ~ && git clone https://github.com/tadstech/wxata-public.git WXATA && cd WXATA
```

---

### 6. Configure environment

```bash
cp backend/.env.example backend/.env
```

The defaults are fine. `PORT=5000` is the only required value.

---

### 7. Build and start with Docker Compose

```bash
docker compose up -d --build
docker compose logs -f wxata
```

The container runs PM2 in no-daemon mode (`pm2-runtime`). PM2 manages the Bun process inside.

---

### 8. Verify the backend is running

```bash
docker compose ps
curl http://localhost:5000/health
curl http://localhost:5000/pm2
```

---

### 9. Set up TLS with Caddy (required for wss://)

Browsers **block** plain `ws://` connections from HTTPS pages (Mixed Content policy).
You need `wss://` — which requires TLS — which requires a domain name.

#### Option A — You have a domain (recommended)

**Step 1: Add a DNS A record**

In your DNS provider, point a subdomain at your Oracle IP:
```
Type:  A
Name:  wxata-api          (gives you wxata-api.yourdomain.com)
Value: YOUR_ORACLE_IP
TTL:   300
```

> If using **Cloudflare**: set the record to **DNS only** (grey cloud). The orange proxy cloud breaks WebSocket on the free plan.

**Step 2: Install Caddy**

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/installer.sh' | sudo bash && \
sudo apt install -y caddy && caddy version
```

**Step 3: Configure Caddy**

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the entire file with (swap in your actual domain):
```
wxata-api.yourdomain.com {
    reverse_proxy localhost:5000
}
```

```bash
sudo systemctl reload caddy
sudo journalctl -u caddy -f   # watch for "certificate obtained successfully"
```

Caddy auto-provisions and renews the Let's Encrypt cert. No manual cert management needed.

**Step 4: Update Vercel**

In your Vercel project → Settings → Environment Variables:
```
VITE_BACKEND_URL=wss://wxata-api.yourdomain.com
```

Trigger a redeploy. Mixed Content error is gone.

---

#### Option B — No domain (free subdomain via DuckDNS)

[DuckDNS](https://www.duckdns.org) gives you a free `*.duckdns.org` subdomain that you can point at any IP.

1. Go to [duckdns.org](https://www.duckdns.org) → sign in with Google/GitHub
2. Create a subdomain, e.g. `wxata-yourname` → set the IP to your Oracle IP
3. You now have `wxata-yourname.duckdns.org` → `YOUR_ORACLE_IP`
4. Follow **Option A** steps 2–4 using `wxata-yourname.duckdns.org` as your domain

This is completely free and works identically to a paid domain for this use case.

---

#### Option C — No domain, no TLS (local/dev only)

If your frontend is also running locally (not on Vercel HTTPS), plain `ws://` works fine:
```
VITE_BACKEND_URL=ws://YOUR_ORACLE_IP:5000
```

This does **not** work from an HTTPS frontend. Browsers will block it.

---

### 10. Verify everything end-to-end

```bash
# Backend healthy?
curl https://wxata-api.yourdomain.com/health

# WebSocket port reachable? (run from your local machine)
# Windows: Test-NetConnection -ComputerName YOUR_ORACLE_IP -Port 443
# Linux/Mac: nc -zv YOUR_ORACLE_IP 443
```

Then open your dashboard in the browser — no Mixed Content errors, WebSocket connects.

---

## How Dashboard Actions Work with PM2

| Dashboard Button | Exit code | PM2 behaviour |
|---|---|---|
| **Restart** | `0` | PM2 sees normal exit → restarts automatically |
| **Terminate** | `2` | PM2 sees it in `stop_exit_codes` → stops, does **not** restart |
| **Logout** | `0` | Clears WA session, then restarts — bot shows QR/pairing on reconnect |

---

## Useful Commands

### Docker Compose

```bash
docker compose up -d --build  # rebuild image and restart (use after git pull)
docker compose down           # stop and remove containers
docker compose restart wxata  # quick restart without rebuild
docker compose logs -f wxata  # tail logs
docker compose ps             # status
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
cd ~/WXATA
git pull
docker compose up -d --build
```

Data lives in Docker named volumes and is **not affected** by rebuilds.

---

## Persistent Data — What's Stored Where

| Data | Docker Volume | Mount point |
|---|---|---|
| WhatsApp session | `wxata_auth` | `/data/auth_info` |
| SQLite database | `wxata_db` | `/data/db` |
| botinfo / warns / vars | `wxata_data` | `/data` |
| PM2 logs | `wxata_logs` | `/app/logs` |

**Backup session:**
```bash
docker run --rm -v wxata_auth:/data -v $(pwd):/backup ubuntu \
  tar czf /backup/auth_backup.tar.gz /data
```

**Restore session:**
```bash
docker run --rm -v wxata_auth:/data -v $(pwd):/backup ubuntu \
  tar xzf /backup/auth_backup.tar.gz -C /
```

---

## Bare VPS (without Docker)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc

# Install Node + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs && sudo npm install -g pm2

# Install deps
cd ~/WXATA && bun install && cd backend && bun install && cd ..

# Start
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

---

## Troubleshooting

**`ws://` blocked / Mixed Content error in browser**
- Your frontend is on HTTPS — you must use `wss://`
- Set up Caddy (Option A or B above) and update `VITE_BACKEND_URL` in Vercel

**Caddy can't get cert — `NXDOMAIN`**
- DNS A record doesn't exist or hasn't propagated yet
- Check: `nslookup wxata-api.yourdomain.com` from any machine — should return your Oracle IP
- Wait a few minutes and reload: `sudo systemctl reload caddy`

**Caddy can't get cert — `Error getting validation data`**
- Port 80 is blocked — Let's Encrypt can't reach your VM for the ACME challenge
- Check Oracle Security List has port 80 open
- Check iptables: `sudo iptables -L INPUT --line-numbers -n` — ACCEPT rules for 80/443 must appear **before** the REJECT rule
- Fix: re-run the iptables command from step 2B

**Port open in Oracle Security List but still blocked**
- The Security List must be attached to the **subnet your instance is on**
- Navigate: Instance → Primary VNIC → Subnet → Security List (don't just edit any list in the VCN)

**Dashboard can't connect to backend**
- Test port from your machine: `Test-NetConnection -ComputerName YOUR_IP -Port 443`
- Check Caddy is running: `sudo systemctl status caddy`
- Check backend is running: `docker compose ps`

**Bot crashes on startup**
- `docker compose logs wxata` — look for the error
- `botinfo.json` is auto-created from defaults on first run — not an issue

**QR code needed after container restart**
- Session is in the `wxata_auth` Docker volume — persists across restarts and rebuilds
- Only need to re-scan after **Logout** from dashboard or manual volume deletion
