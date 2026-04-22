FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY backend/package.json ./backend/

# Install backend dependencies
RUN bun install
WORKDIR /app/backend
RUN bun install

# Copy backend source code
WORKDIR /app
COPY backend/ ./backend/
COPY botinfo.example.json ./

# Expose the WebSocket port for the dashboard
EXPOSE 4000

# Run the backend
WORKDIR /app/backend
CMD ["bun", "run", "index.ts"]
