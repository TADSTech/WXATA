# WXATA — FOSS WhatsApp Bot Platform

A self-hosted WhatsApp automation bot built on [Baileys](https://github.com/WhiskeySockets/Baileys) and [Bun](https://bun.sh). Connect your WhatsApp account, use built-in commands, write custom scripts via config, install community plugins, and manage everything from a live web dashboard.

**Live site:** [wxata-live-ruby.vercel.app](https://wxata-live-ruby.vercel.app/)
**License:** GPL-3.0

---

## Features

- **Custom Scripts** — Add commands via `botinfo.json`. No code changes, just config.
- **Live Dashboard** — Real-time WebSocket dashboard for logs, QR codes, and bot control.
- **Anti-Delete** — Recover deleted messages with local SQLite cache.
- **Built-in Commands** — Ten commands out of the box: `+menu`, `+ping`, `+help`, `+tagall`, `+warn`, `+antidel`, `+sticker`, `+ss`, `+vars`, `+perm`.
- **Permissions** — Granular command permissions. Control who can use what.
- **Extension Marketplace** — Community-contributed plugins. Browse, download, import.
- **One-Command Deploy** — Docker or PM2. Deploy to any VPS in seconds.

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime

### 1. Clone & Setup

```bash
git clone https://github.com/TADSTech/wxata.git
cd wxata
```

**PowerShell (Windows):**
```powershell
.\setup.ps1
```

**Bash (Linux/Mac):**
```bash
chmod +x setup.sh
./setup.sh
```

**Manual setup:**
```bash
cp .env.example .env
cp botinfo.example.json botinfo.json
bun run install:all
```

### 2. Configure

Edit `.env` with your settings. At minimum, set:
- `PORT` (default: 5000)
- `VITE_BACKEND_URL` (default: `http://localhost:5000/ws`)

Edit `botinfo.json` to customize commands and behavior.

### 3. Run

```bash
bun run all
```

- Dashboard: http://localhost:5173
- Backend WebSocket: ws://localhost:5000

### 4. Connect WhatsApp

1. Open the dashboard at http://localhost:5173
2. Click **Connect via QR** or **Connect via Phone**
3. Scan the QR code or enter the pairing code on your phone

---

## Project Structure

```
wxata/
├── backend/                 # Bun + Baileys core
│   ├── index.ts             # Bot entrypoint, commands, message handling
│   ├── connection.ts        # Baileys socket management
│   ├── DashboardServer.ts   # HTTP + WebSocket server
│   ├── db.ts                # SQLite message cache (anti-delete)
│   └── commands/            # Modular command system
├── frontend/                # Vite + React dashboard
│   └── src/
│       ├── pages/           # Dashboard, TV mode, X Grabber
│       └── components/      # UI components
├── landing/                 # Vite + React landing page + docs
├── primary/                 # Primary account config
├── secondary/               # Secondary account config
├── .env.example             # Environment template
├── botinfo.example.json     # Bot config template
├── setup.ps1                # Windows setup script
├── setup.sh                 # Linux/Mac setup script
└── Dockerfile               # Docker deployment
```

---

## Commands

| Command | Description |
|---------|-------------|
| `+menu` | Show the bot menu |
| `+ping` | Check if bot is alive |
| `+help` | List available commands |
| `+tagall` | Mention all group members |
| `+warn` | Warn a member (3 = kick) |
| `+antidel` | Show deleted messages |
| `+sticker` | Convert image to sticker |
| `+ss <url>` | Screenshot a website |
| `+vars` | View/set bot variables |
| `+perm` | Manage permissions |

Prefix is configurable in `botinfo.json` (default: `+`)

---

## Custom Scripts

Add custom commands to `botinfo.json`:

```json
{
  "scripts": {
    "hello": {
      "name": "Hello",
      "desc": "Say hello",
      "trigger": "hello",
      "aliases": ["hi"],
      "type": "fun",
      "response": "Hello!",
      "target": "chat",
      "code": ""
    }
  }
}
```

---

## Deployment

### Docker

```bash
docker compose up -d
```

### PM2 (Production)

```bash
bun run pm2:start
bun run pm2:logs
bun run pm2:status
```

### Oracle Cloud / VPS

See `deploy-oracle.sh` for automated Oracle Cloud deployment.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend server port |
| `DB_RETENTION_DAYS` | `3` | Message cache retention |
| `VITE_BACKEND_URL` | `http://localhost:5000/ws` | WebSocket URL for frontend |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run type-check` to verify
5. Submit a pull request

---

## License

GPL-3.0 — see [LICENSE](LICENSE) for full text.

---

## Credits

Built by [TADS Tech](https://x.com/tads_tech)
