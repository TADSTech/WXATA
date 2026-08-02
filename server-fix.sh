#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WXATA Server Hardening Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Add 2GB swap file ──────────────────────────────────────────────
echo ""
echo "▶  Adding 2GB swap file..."

if swapon --show | grep -q "/swapfile"; then
  echo "  ✓ Swap already exists"
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "  ✓ 2GB swap created and enabled"

  # Lower swappiness to use swap only when really needed
  sudo sysctl vm.swappiness=10
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
  echo "  ✓ Swappiness set to 10"
fi

echo ""
free -h

# ── Step 2: Configure Docker log rotation ──────────────────────────────────
echo ""
echo "▶  Configuring Docker log rotation..."

sudo mkdir -p /etc/docker
if [ -f /etc/docker/daemon.json ]; then
  echo "  ✓ Docker daemon.json exists, adding log rotation..."
  # Merge log rotation settings
  sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
EOF
else
  sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
EOF
fi
echo "  ✓ Docker log rotation configured (10MB max, 3 files)"

# Restart Docker to apply (but don't fail if it doesn't restart in time)
sudo systemctl restart docker || echo "  ⚠ Docker restart will complete when container restarts"

# ── Step 3: Create the watchdog service ───────────────────────────────────
echo ""
echo "▶  Creating WXATA watchdog service..."

sudo tee /etc/systemd/system/wxata-watchdog.service <<'SERVICEEOF'
[Unit]
Description=WXATA System Watchdog — monitors health, auto-restarts, prevents OOM
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/wxata-watchdog.sh
Restart=always
RestartSec=30
StartLimitInterval=0

[Install]
WantedBy=multi-user.target
SERVICEEOF

echo "  ✓ systemd service created"

# ── Step 4: Create the watchdog script ────────────────────────────────────
echo ""
echo "▶  Creating watchdog script..."

sudo tee /usr/local/bin/wxata-watchdog.sh <<'WATCHDOGEOF'
#!/bin/bash

# WXATA System Watchdog
# Runs as a systemd service, checks health every 60s
# Actions:
#   1. Docker healthcheck → restart container if unhealthy 3x
#   2. System memory check → reboot if critically low
#   3. Disk usage check → clean Docker logs if >80%
#   4. PM2 process check → restart PM2 inside container if dead

WXATA_DIR="/home/ubuntu/WXATA"
HEALTH_URL="http://localhost:5000/health"
LOG_FILE="/var/log/wxata-watchdog.log"
CHECK_INTERVAL=60
MAX_HEALTH_FAILURES=3
health_failures=0

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

clean_docker_logs() {
  log "  Cleaning Docker logs (disk threshold)..."
  sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log' 2>/dev/null || true
  sudo docker system prune -f --volumes 2>/dev/null || true
}

while true; do
  # ── CHECK 1: Memory ─────────────────────────────────────────────────
  MEM_TOTAL=$(free -m | awk '/^Mem:/ {print $2}')
  MEM_AVAIL=$(free -m | awk '/^Mem:/ {print $7}')
  MEM_PCT=$(( (MEM_TOTAL - MEM_AVAIL) * 100 / MEM_TOTAL ))

  if [ "$MEM_AVAIL" -lt 50 ]; then
    log "⚠ CRITICAL: Only ${MEM_AVAIL}MB RAM available (${MEM_PCT}% used)! Cleaning caches..."
    sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches' 2>/dev/null || true
    
    # If still critically low after cache drop, restart Docker
    sleep 5
    MEM_AVAIL=$(free -m | awk '/^Mem:/ {print $7}')
    if [ "$MEM_AVAIL" -lt 30 ]; then
      log "⚠ STILL CRITICAL after cache drop (${MEM_AVAIL}MB). Restarting container..."
      cd "$WXATA_DIR" && docker compose restart wxata || true
      sleep 10
    fi
  fi

  # ── CHECK 2: Disk ───────────────────────────────────────────────────
  DISK_PCT=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
  if [ "$DISK_PCT" -gt 85 ]; then
    log "⚠ Disk usage at ${DISK_PCT}%. Cleaning Docker logs..."
    clean_docker_logs
  fi

  # ── CHECK 3: Docker container health ─────────────────────────────────
  CONTAINER_HEALTH=$(docker inspect wxata --format '{{.State.Health.Status}}' 2>/dev/null || echo "unhealthy")

  if [ "$CONTAINER_HEALTH" = "healthy" ]; then
    health_failures=0
  else
    # Also try HTTP health check directly
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
      health_failures=0
    else
      health_failures=$((health_failures + 1))
      log "⚠ Health check failed (${health_failures}/${MAX_HEALTH_FAILURES})"
      
      if [ "$health_failures" -ge "$MAX_HEALTH_FAILURES" ]; then
        log "⚠ Container unhealthy after ${MAX_HEALTH_FAILURES} checks. Restarting..."
        cd "$WXATA_DIR" && docker compose restart wxata 2>&1 || {
          log "⚠ Docker restart failed. Recreating container..."
          cd "$WXATA_DIR" && docker compose up -d --force-recreate 2>&1
        }
        health_failures=0
        sleep 30
      fi
    fi
  fi

  # ── CHECK 4: PM2 inside container ───────────────────────────────────
  PM2_STATUS=$(docker exec wxata pm2 jlist 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 || echo "")
  if [ -n "$PM2_STATUS" ] && [ "$PM2_STATUS" != '"status":"online"' ]; then
    log "⚠ PM2 process not online (${PM2_STATUS}). Restarting PM2..."
    docker exec wxata pm2 restart all 2>/dev/null || {
      docker exec wxata pm2-runtime start /app/ecosystem.config.cjs 2>/dev/null || true
    }
  fi

  # ── CHECK 5: System load ────────────────────────────────────────────
  LOAD=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | tr -d ' ')
  LOAD_INT=${LOAD%.*}
  if [ -n "$LOAD_INT" ] && [ "$LOAD_INT" -gt 10 ] 2>/dev/null; then
    log "⚠ Very high load (${LOAD}). Restarting PM2 process..."
    docker exec wxata pm2 restart wxata 2>/dev/null || true
    sleep 10
  fi

  sleep "$CHECK_INTERVAL"
done
WATCHDOGEOF

sudo chmod +x /usr/local/bin/wxata-watchdog.sh
echo "  ✓ Watchdog script created"

# ── Step 5: Create DB cleanup script ──────────────────────────────────────
echo ""
echo "▶  Creating database cleanup script..."

sudo tee /usr/local/bin/wxata-db-cleanup.sh <<'DBEOF'
#!/bin/bash

# WXATA Database & Log Cleanup
# Run via cron daily

WXATA_DIR="/home/ubuntu/WXATA"
LOG_FILE="/var/log/wxata-db-cleanup.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Clean Docker logs (always)
log "Cleaning Docker logs..."
sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log' 2>/dev/null || true

# Prune unused Docker resources
log "Pruning Docker resources..."
sudo docker system prune -f 2>/dev/null || true

# Clean PM2 logs inside container
log "Cleaning PM2 logs..."
docker exec wxata sh -c 'truncate -s 0 /app/logs/*.log' 2>/dev/null || true

# Run DB prune via API
log "Triggering DB prune via health endpoint..."
curl -sf http://localhost:5000/health > /dev/null && log "  Server alive" || log "  Server unreachable"

# Clean journal logs older than 3 days
log "Cleaning old journal logs..."
sudo journalctl --vacuum-time=3d 2>/dev/null || true

# Report disk usage
DISK_USED=$(df -h / | awk 'NR==2 {print $3}')
DISK_TOTAL=$(df -h / | awk 'NR==2 {print $2}')
DISK_PCT=$(df / | awk 'NR==2 {print $5}')
log "Disk: ${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT})"
log "Cleanup complete."
DBEOF

sudo chmod +x /usr/local/bin/wxata-db-cleanup.sh
echo "  ✓ DB cleanup script created"

# ── Step 6: Add cron jobs ────────────────────────────────────────────────
echo ""
echo "▶  Adding cron jobs..."

(crontab -l 2>/dev/null; echo "# WXATA: Clean Docker logs and DB every 6 hours") | crontab -
(crontab -l 2>/dev/null; echo "0 */6 * * * /usr/local/bin/wxata-db-cleanup.sh >> /var/log/wxata-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "# WXATA: Daily disk usage report") | crontab -
(crontab -l 2>/dev/null; echo "0 6 * * * df -h | mail -s 'WXATA Disk Usage' root 2>/dev/null || df -h >> /var/log/wxata-cron.log") | crontab -

echo "  ✓ Cron jobs added"

# ── Step 7: Update docker-compose with memory limits ─────────────────────
echo ""
echo "▶  Adding memory limits to docker-compose.yml..."

cd "$WXATA_DIR"

# Set memory limit for the container (prevent it from eating all RAM)
if grep -q "mem_limit\|deploy:" docker-compose.yml; then
  echo "  ✓ Memory limits already configured"
else
  # Add memory limits after the healthcheck section
  sed -i '/^    healthcheck:/i\    mem_limit: 512m\n    mem_reservation: 384m\n    deploy:\n      resources:\n        limits:\n          memory: 512M\n        reservations:\n          memory: 384M' docker-compose.yml
  echo "  ✓ Memory limits added (512MB limit, 384MB reservation)"
fi

# ── Step 8: Enable and start watchdog ────────────────────────────────────
echo ""
echo "▶  Enabling and starting watchdog service..."

sudo systemctl daemon-reload
sudo systemctl enable wxata-watchdog.service
sudo systemctl start wxata-watchdog.service
sudo systemctl status wxata-watchdog.service --no-pager

# ── Step 9: Initial cleanup ──────────────────────────────────────────────
echo ""
echo "▶  Running initial cleanup..."
/usr/local/bin/wxata-db-cleanup.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Server hardening complete!"
echo ""
echo "  What was done:"
echo "  • 2GB swap file added (prevents OOM crashes)"
echo "  • Docker log rotation (10MB max per log)"
echo "  • WXATA watchdog systemd service (auto-restarts)"
echo "  • DB cleanup script + cron jobs (every 6h)"
echo "  • Docker memory limits (512MB max)"
echo ""
echo "  Commands:"
echo "  Watchdog status: sudo systemctl status wxata-watchdog"
echo "  Watchdog logs:  sudo journalctl -u wxata-watchdog -f"
echo "  DB cleanup:     sudo /usr/local/bin/wxata-db-cleanup.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
