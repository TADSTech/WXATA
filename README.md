# WXATA 🟢

A high-performance, premium WhatsApp automation and developer API platform built with **Baileys** and **Bun**. Connect, script, and scale WhatsApp interactions with ease through a beautiful web dashboard.

**Live Frontend:** [wxata.vercel.app](https://wxata.vercel.app)

---

## 🚀 Two Powerful Modes of Operation

WXATA is divided into two distinct, optimized account tracks tailored to different use cases:

### 1. 🤖 WhatsApp Bot Account
Ideal for users wanting a fully-featured interactive bot with command modules and user interfaces.
*   **Web Dashboard:** Manage bot connection (QR Code / Phone Pairing), view live execution logs, and configure bots in real time.
*   **Interactive Script Engine:** Live editing of commands. Add, edit, or install JavaScript plugins/scripts dynamically without restarting the bot.
*   **Extension Marketplace:** Publish and install community extensions directly through Firestore-backed Marketplace.
*   **Built-in Commands:** Extensive set of tools (+menu, +ping, +perm, anti-delete, anti-broadcast, YouTube music streaming, web screenshots, casino games).

### 2. 🔌 Developer API Account
A lightweight REST API service designed for programmatic integration. Send messages to WhatsApp contacts from any external script or application.
*   **Programmatic REST API:** Simple endpoints (`POST /api/send`, `GET /api/keys/usage`) with header authentication.
*   **Developer Dashboard:** Beautiful React-based usage analytics, color-coded quota progress bars, and copyable code snippets (cURL, JS, Python).
*   **Credits & Top-Ups:** Integrated with Flutterwave for instant, automated balance updates via webhooks.
*   **Dual Auth System:** Register and log in instantly via email or API keys without needing standard passwords or a Bot account.

---

## 🛠️ The Tech Stack

| Layer | Tech | Description |
|---|---|---|
| **Runtime** | [Bun](https://bun.sh/) | Blazing-fast JavaScript runtime and package manager |
| **WhatsApp Core** | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) | High-performance, lightweight WhatsApp Web API library |
| **Frontend Dashboard** | Vite + React + Tailwind + Framer Motion | Premium responsive web dashboard with smooth animations |
| **Authentication & Cloud DB** | Supabase (PostgreSQL + Auth + RLS) | Cloud database with secure Row Level Security policies |
| **Local Cache** | SQLite (`bun:sqlite`) | High-performance message cache optimized with WAL, synchronous NORMAL, and dynamic capacity-based pruning (capped to 200 messages by default) |
| **Payment Gateway** | Flutterwave | Secure webhook-backed payments for API topups & subscriptions |
| **Process Management**| PM2 / Docker | Process daemon for zero-downtime hosting on Linux VPS |

---

## ⚡ High-Performance SQLite Cache & Stability
To prevent the WhatsApp bot from stalling, disconnecting, or crashing during heavy message bursts:
* **Concurrent Journaling (WAL):** Enabled Write-Ahead Logging (`PRAGMA journal_mode = WAL`) so readers and writers never block each other.
* **Non-blocking Synchronous Mode:** Set `PRAGMA synchronous = NORMAL` and `temp_store = MEMORY` to drastically reduce CPU thread-blocking disk I/O barriers.
* **Bounded Capacity Pruning:** Set a strict limit of **200 messages** (via `DB_MAX_MESSAGES`) to prevent the SQLite database from inflating indefinitely. This is pruned in the background via non-blocking microtasks every 100 stored messages.
* **On-the-Fly Configuration:** Configure settings live via the `!vs` command directly from WhatsApp without rebooting the bot:
  * Check current variables: `!vs`
  * Change capacity limit: `!vs set DB_MAX_MESSAGES 500`
  * Change retention days: `!vs set DB_RETENTION_DAYS 5`

---

## 📦 Project Structure

```
wxata/
├── frontend/               # React Dashboard (Vite)
│   └── src/
│       ├── pages/          # Dashboard, Landing, Login, Register, Marketplace, Admin, DeveloperPortal
│       └── components/     # UI elements & progress loaders
├── backend/                # WhatsApp Bot Core & API Service
│   ├── index.ts            # Main bot initiator & message router
│   ├── connection.ts       # Baileys session & connection state manager
│   ├── DashboardServer.ts  # WebSocket server, HTTP REST endpoints & webhooks
│   └── db.ts               # SQLite message cache
├── botinfo.example.json    # Bot configuration template
├── vars.json               # Auto-created key-value storage for custom bot vars
├── warns.json              # Auto-created strike warning counter for group moderation
├── deployment.md           # Full deployment instructions
└── plugin_spec.md          # Guide for writing and publishing bot extensions
```

---

## ⚡ Quick Start (Local Development)

WXATA prioritizes using **Bun** for all node/JS operations.

```bash
# 1. Clone the repository
git clone https://github.com/your-username/wxata.git
cd wxata

# 2. Seed configurations
cp botinfo.example.json botinfo.json

# 3. Install dependencies across frontend and backend
bun run install:all

# 4. Start both servers concurrently
bun run all
# Frontend → http://localhost:5173
# Backend  → ws://localhost:4000 (REST API / Webhooks on port 5000/api)
```

---

## 🛡️ Built-in Bot Commands

Commands in the Bot engine are prefix-based (default: `!`). Below are key commands, which can be modified dynamically via the dashboard:

| Trigger | Alias | Target | Description |
|---|---|---|---|
| `mn` | `menu`, `m` | `chat` | Opens the premium, interactive system menu |
| `hp` | `help`, `h` | `chat` | Shows detailed usage help for a specific command |
| `pg` | `ping`, `p` | `chat` | Checks socket connection latency and status |
| `pm` | `perm` | `chat` | Manage permissions (`!pm [grant\|revoke] chat\|all\|+number`) |
| `vars` | - | `chat` | View and edit custom config variables on the fly |
| `extract`| - | `chat` | Reveals and downloads view-once media |
| `save` | - | `chat` | Saves quoted media directly to your saved messages DM |
| `tagall` | - | `chat` | Mention all group members (admins only) |
| `warn` | - | `chat` | Give a warning strike to a group user (3 strikes = kick) |
| `antidel`| - | `chat` | Toggle anti-delete (caches and re-sends deleted messages) |
| `antibc` | - | `chat` | Toggle anti-broadcast (auto-deletes/blocks broadcast spams) |
| `ss` | - | `chat` | Take a high-resolution screenshot of a web URL |
| `alexa` | - | `chat` | Download and stream audio from YouTube (`+alexa <song name>`) |
| `sysinfo`| - | `chat` | Output detailed server system resource usage |
| Games | `ship`, `fun`, `random`, `bt`, `wcg`, `wrg`, `wyr` | `chat` | Fun modules: Matchmaking, Hot Potato, Casino, Riddles, Word Chain/Scramble |

---

## 🔌 Programmatic REST API

The Developer API is fully documented in [DEVELOPER_SETUP.md](file:///c:/Users/TADS/WORK/TADSTech/WXATA/DEVELOPER_SETUP.md).

### Send a Message
```http
POST /api/send
X-API-Key: wxata_live_your_secret_key
Content-Type: application/json

{
  "to": "2348012345678",
  "message": "Hello from WXATA REST API!"
}
```

### Check Balance and Quota
```http
GET /api/keys/usage
X-API-Key: wxata_live_your_secret_key
```

---

## 💳 Pricing & Subscriptions

| Feature | Developer Free | TopUp Tier 1 | TopUp Tier 2 | Developer Pro |
|---------|----------|--------------|--------------|---------|
| **Messages** | 100 | +2,000 | +5,000 | 10,000/mo |
| **Price** | ₦0 | ₦1,000 | ₦2,000 | ₦3,200/mo |
| **Commitment**| None | One-time | One-time | Monthly |
| **Support** | Community | Community | Community | Priority |
| **Webhooks** | ❌ | ❌ | ❌ | ✅ |
| **Analytics** | Basic | Basic | Basic | Premium |

*TopUp purchases stack instantly and never expire. Payments are processed securely via the Flutterwave integration.*

---

## 📚 Detailed Documentation

Explore more detailed aspects of the codebase:
- **[DEVELOPER_SETUP.md](file:///c:/Users/TADS/WORK/TADSTech/WXATA/DEVELOPER_SETUP.md):** Step-by-step developer accounts onboarding & REST endpoints.
- **[DEVELOPER_API_COMPLETE.md](file:///c:/Users/TADS/WORK/TADSTech/WXATA/DEVELOPER_API_COMPLETE.md):** Deep technical implementation details of the API core.
- **[PLUGIN_SPEC.md](file:///c:/Users/TADS/WORK/TADSTech/WXATA/PLUGIN_SPEC.md):** authoritative reference for writing JavaScript plugins.
- **[README_FLUTTERWAVE_INTEGRATION.md](file:///c:/Users/TADS/WORK/TADSTech/WXATA/README_FLUTTERWAVE_INTEGRATION.md):** Complete walkthrough of the payment topup webhook processor.
- **[DOCUMENTATION.md](file:///c:/Users/TADS/WORK/TADSTech/WXATA/DOCUMENTATION.md):** General command syntax and user permission structures.
- **[deployment.md](file:///c:/Users/TADS/WORK/TADSTech/WXATA/deployment.md):** Guide for running WXATA on Oracle Cloud VPS using PM2.

---

*Built with passion by [TADS Tech](https://x.com/tads_tech)*

