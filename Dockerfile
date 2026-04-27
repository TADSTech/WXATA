FROM oven/bun:latest

# ── System deps ───────────────────────────────────────────────────────────────
# The oven/bun base image is Debian trixie (slim). We need:
#   - npm  → to install PM2 globally (nodejs is already in trixie repos)
#   - curl → used by healthcheck and bun install
# bun:sqlite is built-in so no python/make/g++ needed.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl nodejs npm && \
    npm install -g pm2 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
COPY package.json bun.lock ./
COPY backend/package.json backend/bun.lock ./backend/

RUN bun install --frozen-lockfile
WORKDIR /app/backend
RUN bun install --frozen-lockfile
WORKDIR /app

# ── Copy source ───────────────────────────────────────────────────────────────
COPY backend/ ./backend/
COPY botinfo.example.json ./
COPY ecosystem.config.cjs ./

# ── Persistent data directories ───────────────────────────────────────────────
# These are declared as VOLUME so Docker (or docker-compose) can mount them.
# On Oracle VPS we bind-mount host paths here so data survives container restarts.
RUN mkdir -p /data/auth_info /data/db /app/logs

# ── Port ──────────────────────────────────────────────────────────────────────
ARG PORT=5000
ENV PORT=${PORT}
EXPOSE ${PORT}

# ── Entrypoint ────────────────────────────────────────────────────────────────
# PM2 runs in no-daemon mode so Docker can track the process.
# The ecosystem config handles restart/stop_exit_codes logic.
CMD ["pm2-runtime", "ecosystem.config.cjs"]
