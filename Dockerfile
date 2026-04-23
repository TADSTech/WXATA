FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY backend/package.json ./backend/

# Install build tools required by node-gyp for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Install backend dependencies
RUN bun install
WORKDIR /app/backend
RUN bun install

# Copy backend source code
WORKDIR /app
COPY backend/ ./backend/
COPY botinfo.example.json ./

# Set default port
ARG PORT=5000
ENV PORT=${PORT}

# Expose the configured port for the dashboard
EXPOSE ${PORT}

# Run the backend
WORKDIR /app/backend
CMD ["bun", "run", "index.ts"]
