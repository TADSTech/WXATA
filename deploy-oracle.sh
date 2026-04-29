#!/bin/bash
#
# WXATA Oracle VPS Deployment Script
# Usage:
#   ./deploy-oracle.sh              # normal update (keeps WhatsApp session)
#   ./deploy-oracle.sh --reset-wa   # wipe WhatsApp session (forces new QR scan)
#   ./deploy-oracle.sh --full-reset # wipe ALL data (fresh start)
#

set -e  # Exit on any error

RESET_WA=false
FULL_RESET=false

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
echo "  WXATA Deployment Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Stop the container ───────────────────────────────────────────────
echo ""
echo "▶  Stopping WXATA container..."
cd ~/WXATA
docker compose down

if [ "$FULL_RESET" = true ]; then
  echo "⚠  FULL RESET: Removing ALL volumes (WhatsApp session, database, config)..."
  docker volume rm wxata_auth wxata_db wxata_data wxata_logs 2>/dev/null || true
  echo "✓  All data wiped"
elif [ "$RESET_WA" = true ]; then
  echo "⚠  Resetting WhatsApp session (you'll need to scan QR again)..."
  docker volume rm wxata_auth 2>/dev/null || true
  echo "✓  WhatsApp session cleared"
else
  echo "✓  Container stopped (data volumes preserved)"
fi

# ── Step 2: Pull latest code ──────────────────────────────────────────────────
echo ""
echo "▶  Pulling latest code from GitHub..."
# Discard any local changes to lock files (they get regenerated on the server
# and should always match the repo)
git checkout -- bun.lock 2>/dev/null || true
git checkout -- backend/bun.lock 2>/dev/null || true
git checkout -- frontend/bun.lock 2>/dev/null || true
git pull
echo "✓  Code updated"

# ── Step 3: Rebuild and start ─────────────────────────────────────────────────
echo ""
echo "▶  Building and starting WXATA..."
docker compose up -d --build

# Wait for container to be healthy
echo ""
echo "▶  Waiting for container to be healthy..."
sleep 5

# ── Step 4: Verify ────────────────────────────────────────────────────────────
echo ""
echo "▶  Verifying deployment..."

# Check container status
if docker ps | grep -q wxata; then
  echo "✓  Container is running"
else
  echo "✗  Container failed to start"
  docker compose logs --tail 50 wxata
  exit 1
fi

# Check health endpoint
if curl -sf http://localhost:5000/health > /dev/null; then
  echo "✓  Health endpoint responding"
else
  echo "⚠  Health endpoint not responding yet (may still be starting)"
fi

# Show PM2 status inside container
echo ""
echo "▶  PM2 status:"
docker compose exec -T wxata pm2 jlist 2>/dev/null | grep -o '"status":"[^"]*"' || echo "   (PM2 not ready yet)"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deployment complete!"
echo ""
echo "  Dashboard: https://wxata.tadstech.dev"
echo "  Backend:   https://wxata-api.tadstech.dev/health"
echo ""
echo "  View logs:   docker compose logs -f wxata"
echo "  PM2 status:  docker compose exec wxata pm2 status"
echo "  PM2 logs:    docker compose exec wxata pm2 logs wxata --lines 50"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
