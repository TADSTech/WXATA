#!/bin/bash
#
# WXATA Oracle VPS Deployment Script (No Docker)
# Usage:
#   ./wxata_start.sh              # normal update (keeps WhatsApp session)
#   ./wxata_start.sh --reset-wa   # wipe WhatsApp session (forces new QR scan)
#   ./wxata_start.sh --full-reset # wipe ALL data (fresh start)
#

set -e  # Exit on any error

RESET_WA=false
FULL_RESET=false
PM2="/home/ubuntu/.bun/bin/pm2"
BUN="/home/ubuntu/.bun/bin/bun"

# Parse flags
for arg in "$@"; do
  case $arg in
    --reset-wa)
      RESET_WA=true
      ;;
    --full-reset)
      FULL_RESET=true
      ;;
  esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WXATA Deployment Script (No Docker)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Ensure we are running this from the WXATA directory
cd "$(dirname "$0")"

# ── Step 1: Stop Docker container if running ─────────────────────────────────
echo ""
echo "▶  Stopping any running WXATA containers..."
docker compose down 2>/dev/null || true
echo "✓  Docker containers stopped (if any)"

# ── Step 2: Stop PM2 process if running ──────────────────────────────────────
echo ""
echo "▶  Stopping PM2 process..."
$PM2 delete wxata 2>/dev/null || true
echo "✓  PM2 process stopped"

# ── Step 3: Handle data resets ───────────────────────────────────────────────
if [ "$FULL_RESET" = true ]; then
  echo "⚠  FULL RESET: Wiping ALL data..."
  rm -rf /data/auth_info /data/auth_info_primary /data/auth_info_secondary
  rm -rf /data/db /data/primary /data/secondary
  rm -f /data/messages.sqlite /data/messages.sqlite-shm /data/messages.sqlite-wal
  rm -f /data/botinfo.json /data/vars.json /data/warns.json
  rm -f /data/antibc.json /data/antidel.json
  mkdir -p /data/auth_info /data/auth_info_primary /data/auth_info_secondary
  mkdir -p /data/db /data/primary /data/secondary
  echo "✓  All data wiped"
elif [ "$RESET_WA" = true ]; then
  echo "⚠  Resetting WhatsApp session (you'll need to scan QR again)..."
  rm -rf /data/auth_info /data/auth_info_primary /data/auth_info_secondary
  mkdir -p /data/auth_info /data/auth_info_primary /data/auth_info_secondary
  echo "✓  WhatsApp session cleared"
else
  echo "✓  Data preserved"
fi

# ── Step 4: Pull latest code ──────────────────────────────────────────────────
echo ""
echo "▶  Pulling latest code from GitHub..."
git pull
echo "✓  Code updated"

# ── Step 5: Install dependencies ──────────────────────────────────────────────
echo ""
echo "▶  Installing dependencies..."
$BUN install 2>&1 | tail -3
cd backend && $BUN install 2>&1 | tail -3 && cd ..
echo "✓  Dependencies installed"

# ── Step 6: Ensure /data symlink exists ───────────────────────────────────────
if [ ! -L /data ] && [ ! -d /data ]; then
  echo ""
  echo "▶  Creating /data symlink..."
  sudo ln -sfn "$(pwd)/data" /data
  echo "✓  /data → $(pwd)/data"
fi

# ── Step 7: Start with PM2 ───────────────────────────────────────────────────
echo ""
echo "▶  Starting backend with PM2..."
$PM2 start ecosystem.config.cjs
$PM2 save
echo "✓  PM2 started"

# ── Step 8: Wait for health ───────────────────────────────────────────────────
echo ""
echo "▶  Waiting for backend to start..."
sleep 5

# ── Step 9: Verify ────────────────────────────────────────────────────────────
echo ""
echo "▶  Verifying deployment..."

# Check PM2 status
if $PM2 jlist 2>/dev/null | grep -q '"status":"online"'; then
  echo "✓  PM2 process is online"
else
  echo "✗  PM2 process failed to start"
  $PM2 logs wxata --lines 20 --nostream 2>/dev/null
  exit 1
fi

# Check health endpoint
if curl -sf --max-time 5 http://localhost:5000/health > /dev/null; then
  echo "✓  Health endpoint responding"
  curl -s --max-time 5 http://localhost:5000/health
else
  echo "⚠  Health endpoint not responding yet (may still be starting)"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deployment complete!"
echo ""
echo "  Dashboard: https://wxata-live-ruby.vercel.app/"
echo "  Backend:   https://wxata-api.tadstech.dev/health"
echo ""
echo "  View logs:   $PM2 logs wxata --lines 50"
echo "  PM2 status:  $PM2 status"
echo "  Restart:     $PM2 restart wxata"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
