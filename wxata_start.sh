#!/bin/bash
#
# WXATA Oracle VPS Deployment Script
# Usage:
#   ./wxata_start.sh              # normal update (keeps WhatsApp session)
#   ./wxata_start.sh --reset-wa   # wipe WhatsApp session (forces new QR scan)
#   ./wxata_start.sh --full-reset # wipe ALL data (fresh start)
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
# Ensure we are running this from the WXATA directory
cd "$(dirname "$0")"

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
git pull
echo "✓  Code updated"

# ── Step 3: Rebuild and start ─────────────────────────────────────────────────
echo ""
echo "▶  Building and starting WXATA..."
docker compose up -d --build

# ── Step 3.5: Sync Configuration ──────────────────────────────────────────────
echo ""
echo "▶  Syncing botinfo.json to Docker volumes..."
# Copy the repo's botinfo.json into the container's primary and secondary data folders
docker exec wxata mkdir -p /data/primary /data/secondary
docker cp botinfo.json wxata:/data/primary/botinfo.json
docker cp botinfo.json wxata:/data/secondary/botinfo.json
echo "✓  botinfo.json synced to live configuration"

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
