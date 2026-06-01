# WXATA — AI Agents Manual 🤖

Welcome, Agent! This guide details WXATA's codebase architecture, execution flows, databases, and operational instructions. Use this document to quickly onboard and confidently run, edit, or debug the platform.

---

## 🗺️ Codebase Overview

WXATA is a high-performance WhatsApp bot & REST API platform running under the **Bun** runtime. It uses **Baileys** for connection protocol and **Supabase** + **SQLite** for data.

```
wxata/
├── frontend/               # Vite + React + Tailwind CSS dashboard (hosted on Vercel)
│   ├── src/
│   │   ├── pages/          # Landing, Dashboard, DeveloperPortal, Admin, Marketplace
│   │   └── components/     # UI loaders, buttons, widgets
│   └── package.json        # Frontend configuration
├── backend/                # Bun + Baileys core services
│   ├── index.ts            # Entrypoint: Baileys routing, event listening, bot commands
│   ├── connection.ts       # Baileys socket state, pairing code requests, reconnects
│   ├── DashboardServer.ts  # HTTP REST API + WebSocket dashboard sync + Webhooks
│   ├── db.ts               # Local cache (SQLite) for high-performance message storage
│   ├── db.test.ts          # Bun test suite for db validation
│   └── package.json        # Backend configuration
├── vars.json               # Auto-generated custom bot system variables
├── warns.json              # Persistent warning counts for group moderation
├── botinfo.json            # Bot instance config (prefix, accounts, allowed permissions)
└── ipman                   # SSH key details & db password (CRITICAL: DO NOT DELETE)
```

---

## 💾 Database Architecture & Tuning

WXATA uses a dual-database pattern designed for zero-lag performance:

### 1. Cloud Database: Supabase (PostgreSQL)
Used for user profiles, license keys, API keys, and marketplace extensions. Protected via strict Postgres RLS (Row Level Security) policies.
* **RLS Policies:** Select query access for anonymous endpoints is enabled via custom policies (e.g., `user_codes_select_anon`), while mutations are strictly limited to `service_role`.

### 2. Local Cache: SQLite (`bun:sqlite`)
Stores messages locally under `backend/db.ts` to power the **Anti-Delete** and **Anti-Broadcast** safety handlers.
* **Write-Ahead Logging (WAL):** Initialized with `PRAGMA journal_mode = WAL;`. This enables simultaneous readers and writers, preventing deadlocks or stalls under heavy group messaging.
* **Reduced Write Blockage:** Initialized with `PRAGMA synchronous = NORMAL;` and `temp_store = MEMORY;` to avoid thread-blocking physical disk flushes.
* **Bounded Message Cap:** Hard-capped at **200 messages** (`DB_MAX_MESSAGES = 200`) by default.
* **Self-Pruning Engine:** Evaluates database size in non-blocking microtasks (`queueMicrotask`) every 100 insertions. Cleans up oldest messages first based on `timestamp` (optimized via index `idx_timestamp`).

---

## ⚙️ Configuration & The System Variables

User variables are persisted in `vars.json` and parsed live on command calls. 

### Core Custom Variables:
| Key | Default | Description |
|-----|---------|-------------|
| `PREFIX` | `!` | Shorthand bot trigger prefix |
| `DB_RETENTION_DAYS` | `3` | Time-to-live for local cached messages |
| `DB_MAX_MESSAGES` | `200` | Absolute ceiling of local database messages |
| `WELCOME_ENABLED` | `true` | Welcomes group entries upon connect |
| `WARN_MESSAGE` | `⚠️ Warned! ({count}/3)`| Group infraction notice template |

#### Live Adjustments (No Restart Needed):
Settings in `vars.json` are dynamically loaded by `backend/db.ts` on each check. Change them directly in chat via the `!vs` admin command:
* View settings: `!vs`
* Adjust capacity: `!vs set DB_MAX_MESSAGES 500`
* Adjust retention: `!vs set DB_RETENTION_DAYS 5`

---

## 🛠️ Execution & Deployment Commands

### Installation & Dependency Setup
Run this at the workspace root to bootstrap dependencies across folders:
```bash
bun run install:all
```

### Starting Servers Concurrently
Start the React frontend (port `5173`) and Bun backend server (port `5000`) concurrently:
```bash
bun run all
```

### Daemon Management via PM2
When deploying on Oracle Cloud VPS, use the following commands:
* Start: `bun run pm2:start`
* Restart: `bun run pm2:restart`
* Logs: `bun run pm2:logs`
* Status: `bun run pm2:status`

---

## 🧪 Testing & Validation Suite

Use Bun's native, blisteringly fast test runner to verify database operations:

```bash
bun test backend/db.test.ts
```

This test suite evaluates:
1. Message caching & retrieval accuracy (`storeMessage` & `getMessage`).
2. Correct handling of non-existent query entries (returns `null`).
3. Message count tracking (`getMessageCount`).
4. Read validation for dynamic settings and custom environment configurations.
5. Error-free pruning under capacity overflows and expiration cutoffs.

*Note: All test entries are automatically rolled back or cleaned up from SQLite after the suite completes, ensuring production cache integrity.*

---

## 🛡️ Guidelines for Future Agents
1. **Never Touch `ipman`:** It contains host SSH locations and database passwords.
2. **Dynamic Configurations first:** When asked to edit parameters (like message limits, triggers, or intervals), ensure you implement them dynamically using `vars.json` getters rather than hardcoding.
3. **Always Run Type-Checks:** After modifying the backend, run `bun run backend:type-check` to verify no TypeScript compilation errors were introduced.
4. **Isolate Webhook Web-Errors:** When servicing the Flutterwave webhooks in `backend/DashboardServer.ts`, always return `200 OK` responses in catch-blocks to prevent infinite payment-processor retries.
