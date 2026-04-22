# WXATA 🟢

A high-performance WhatsApp automation platform built with **Baileys** and **Bun**. Run interactive scripts, manage permissions, and configure everything from a live web dashboard.

**Live frontend:** [wxata.vercel.app](https://wxata.vercel.app)

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | [Bun](https://bun.sh/) |
| WhatsApp | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) |
| Frontend | Vite + React + Tailwind + Framer Motion |
| Auth/DB | Firebase (Auth + Firestore) |
| Local DB | bun:sqlite (message cache for anti-delete) |
| Deploy | Render (backend) + Vercel (frontend) |

---

## Quick Start (Local)

```bash
# 1. Clone
git clone https://github.com/your-username/wxata.git
cd wxata

# 2. Seed config
cp botinfo.example.json botinfo.json

# 3. Install deps
bun run install:all

# 4. Run
bun run all
# Frontend → http://localhost:5173
# Backend  → ws://localhost:4000
```

---

## Deployment

See **[deployment.md](./deployment.md)** for full instructions covering:
- Deploying your own backend on Render with a persistent disk
- Keeping the bot alive on the free tier (built-in self-ping)
- Deploying the frontend on Vercel
- How other developers can self-host their own instance

---

## Built-in Commands

| Command | Description |
|---|---|
| `+menu` | List all scripts |
| `+ping` | Check bot latency |
| `+perm [grant\|revoke] chat\|all\|+number` | Manage permissions |
| `+vars` | View/set config variables |
| `+extract` | Reveal view-once media |
| `+save` | Save quoted media to your chat |
| `+tagall` | Mention all group members |
| `+warn` | Warn a user (3 strikes = kick) |
| `+antidel [on\|off\|target +number]` | Anti-delete toggle |
| `+antibc [on\|off\|message]` | Anti-broadcast toggle |
| `+ss <url>` | Screenshot a webpage |
| `+owner` | Send owner vCard |
| `+joke` | Random programming joke |

All commands are editable from the dashboard. Add custom JS scripts without restarting.

---

## Per-Instance Files (gitignored)

These are generated automatically on first run — never commit them:

```
botinfo.json        ← bot config  (seed: botinfo.example.json)
warns.json          ← warn counts (auto-created)
vars.json           ← custom vars (auto-created)
backend/auth_info/  ← WhatsApp session (NEVER share)
backend/antidel.json
backend/antibc.json
backend/db/
```

---

## Project Structure

```
wxata/
├── frontend/          # React dashboard (Vite)
│   └── src/
│       ├── pages/     # Dashboard, Landing, Login, Register, Marketplace, Admin
│       └── components/
├── backend/           # WhatsApp bot core
│   ├── index.ts       # Main bot + command engine
│   ├── connection.ts  # Baileys connection manager
│   ├── DashboardServer.ts  # WebSocket + HTTP health server
│   ├── db.ts          # SQLite message cache
│   └── commands/      # Typed command module system (future)
├── botinfo.example.json   # Config template
├── render.yaml            # Render one-click deploy config
└── deployment.md          # Full deployment guide
```

---

*Built by [TADS Tech](https://x.com/tads_tech)*
