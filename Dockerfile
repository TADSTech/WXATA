FROM oven/bun:latest

# ── System deps ───────────────────────────────────────────────────────────────
# python3/make/g++ are required by node-gyp (better-sqlite3)
# Node.js + npm are required to install PM2 globally
RUN apt-get update && \
    apt-get install -y python3 make g++ curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pm2 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
COPY package.json bun.lock ./
COPY backend/package.json ./backend/

RUN bun install
WORKDIR /app/backend
RUN bun install
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
