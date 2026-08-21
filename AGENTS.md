# WXATA — AI Agent Instructions

## Codebase Overview

WXATA is a WhatsApp bot platform running on **Bun** + **Baileys** with a React dashboard.

```
wxata/
├── frontend/               # Vite + React + Tailwind dashboard
│   ├── src/pages/          # Dashboard, TvDashboard, TvTools, XGrabberPage
│   ├── src/components/     # UI components
│   └── src/hooks/          # useWXATASocket, useToast
├── backend/                # Bun + Baileys core
│   ├── index.ts            # Bot entrypoint, commands, message handling
│   ├── connection.ts       # Baileys socket management
│   ├── DashboardServer.ts  # HTTP + WebSocket server
│   ├── db.ts               # SQLite message cache
│   └── commands/            # Modular command system
├── landing/                # Static docs site (HTML)
├── .env.example            # Environment template
├── botinfo.example.json    # Bot config template
├── setup.ps1 / setup.sh    # Setup scripts
└── Dockerfile              # Docker deployment
```

## Databases

1. **SQLite** (`backend/db.ts`) — Local message cache for anti-delete. WAL mode, 200 message cap, self-pruning.
2. **Firebase** (optional) — User profiles, extensions, marketplace.

## Configuration

- `botinfo.json` — Bot commands, prefix, permissions, welcome messages
- `vars.json` — Dynamic runtime variables (loaded live, no restart needed)
- `.env` — Server config (PORT, Firebase, etc.)

## Development Commands

```bash
bun run install:all    # Install all dependencies
bun run all            # Start frontend (5173) + backend (5000)
bun run type-check     # Verify TypeScript
bun run pm2:start      # Production via PM2
```

## Agent Rules

1. **Always run type-checks** after modifying backend: `bun run backend:type-check`
2. **Dynamic config first** — Use `vars.json` getters, don't hardcode values
3. **Never commit secrets** — .env, auth_info/, ipman are all gitignored
4. **Keep Dockerfile working** — Test with `docker build .` after structural changes
