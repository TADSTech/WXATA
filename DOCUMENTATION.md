# WXATA Documentation

Welcome to the official documentation for **WXATA** (WhatsApp Automation & Tactical Assistant). This engine is built on **Baileys** and **Bun**, designed for high-performance automation and premium user experience.

---

## Getting Started

### Installation
WXATA is designed to be run via `bun`.
1. Clone the repository.
2. Run `bun install`.
3. Start the system with `bun run all`.

### Connecting
You can connect via **QR Code** or **Phone Pairing** through the dashboard at `https://wxata.tadstech.dev`.

---

## Command System

Commands in WXATA are prefix-based (default: `!`). Each command can have a primary trigger and multiple aliases.

### Command Structure
- **Trigger**: The primary shorthand (e.g., `hp` for help).
- **Aliases**: Secondary shorthands (e.g., `help`, `h`).
- **Type**: Categorization (core, tools, admin, group, fun).
- **Target**: Where the response goes (`chat` for current chat, `self` for your own chat).

### Core Commands
| Trigger | Alias | Description |
|---------|-------|-------------|
| `mn` | `menu`, `m` | Opens the professional system menu. |
| `hp` | `help`, `h` | Shows detailed help for a specific command. |
| `pg` | `ping`, `p` | Checks system latency and status. |
| `dc` | `docs` | Access this documentation. |

---

## Permission System

WXATA uses a multi-tier permission system to ensure security.

1. **Root (Sudo)**:
   - Configured in `botinfo.json` under `root.target`.
   - Can execute any command.
   - Can manage permissions for others.
2. **Allowed Chats**:
   - Group or DM JIDs that are explicitly allowed.
   - Managed via the `!pm` command.
3. **Allowed Numbers**:
   - Specific phone numbers allowed to use the bot in any shared chat.

### Managing Permissions
- `!pm chat`: Grant permission to the current chat.
- `!pm revoke chat`: Revoke permission from the current chat.
- `!pm <number>`: Grant permission to a specific number.

---

## Plugin System

WXATA's plugin system lets you add custom commands without modifying source code. Plugins are JavaScript snippets stored in `botinfo.json` under the `scripts` key.

### How Plugins Execute
When a user sends a message matching your trigger (e.g., `+weather Lagos`):
1. The bot matches the message against `{prefix}{trigger}` or any alias
2. Extracts the argument text after the trigger
3. Runs your plugin's `code` as an async function with injected context variables
4. Sends the response to the configured target (chat or self)

### Plugin Schema
```json
{
  "name": "Display Name",
  "desc": "Short description",
  "trigger": "cmd",
  "aliases": ["alias1"],
  "type": "core | tools | admin | group | fun | misc",
  "target": "chat | self",
  "response": "Static text response",
  "code": "JavaScript code string"
}
```

### Execution Context
Variables injected into your plugin code:
- `sock` — Baileys WhatsApp socket
- `msg` — Full incoming message object
- `remoteJid` — Chat ID
- `argumentName` — User's argument after trigger
- `sendTrackedMessage(sock, jid, text)` — Safe message sender
- `botInfo` — Current bot configuration
- `require()` — Node.js require (axios, fs, path, etc.)
- `__rootdir` — Persistent data directory path
- `dashboard.log(type, message)` — Log to dashboard

### Writing a Plugin
```js
const axios = require('axios');
if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !weather <city>');

await sendTrackedMessage(sock, remoteJid, '🔍 Fetching...');
try {
  const res = await axios.get(`https://wttr.in/${encodeURIComponent(argumentName)}?format=3`);
  await sendTrackedMessage(sock, remoteJid, `🌤️ ${res.data}`);
} catch (e) {
  await sendTrackedMessage(sock, remoteJid, '❌ Failed to fetch weather.');
}
```

---

## Marketplace

The WXATA Marketplace is a community-driven plugin repository. Browse, download, and install plugins with one click.

### Browsing Plugins
Visit `/marketplace` to browse plugins by category, search by name, and filter by author.

### Installing Plugins
1. Find a plugin on the Marketplace
2. Click **"Download Plugin"** — saves a `.json` file
3. Open your WXATA Dashboard → Scripts tab
4. Click **"Import"** → select the `.json` file
5. The plugin is merged into your `botinfo.json` and is live immediately

### Publishing Plugins
1. Register an account at `/marketplace/login`
2. Go to **Publish Plugin**
3. Fill in: name, trigger, description, code, category, tags
4. Submit — auto-approved if code passes security checks
5. Manage your plugins at `/marketplace/my-plugins`

### Security
Plugins are scanned for dangerous patterns:
- `process.exit()` calls
- `child_process` imports
- `eval()` and `new Function()`
- Infinite loops
- File writes outside `__rootdir`

---

## Variables & Customization

### Configurable Vars
| Variable | Description |
|----------|-------------|
| `PREFIX` | Changes the bot's trigger prefix. |
| `WELCOME` | Toggles the connect greeting. |
| `ALLOW_ALL` | If true, everyone can use the bot. |

### Custom Scripts
You can add your own JS scripts through the dashboard. Scripts have access to:
- `sock`: The Baileys socket instance.
- `msg`: The current message object.
- `botInfo`: The full bot configuration.
- `remoteJid`: The current chat ID.
- `argumentName`: Any text after the command trigger.
- `sendTrackedMessage`: A helper to send messages and log them.

---

## Branding & Aesthetics

WXATA is built with a "Premium-First" philosophy.
- **Themes**: 12+ custom themes (Midnight, Nord, Cyberpunk, etc.).
- **Rich Media**: Commands like `!mn` and `!hp` use `externalAdReply` for a professional thumbnail look.

---

## Deployment

### Docker
```bash
docker compose up -d
```

### PM2 (Production)
```bash
bun run pm2:start    # Start
bun run pm2:restart  # Restart
bun run pm2:logs     # View logs
bun run pm2:status   # Status
```

---

## Developer API

### Send a Message
```
POST /api/send
Content-Type: application/json

{
  "to": "2348012345678",
  "message": "Hello from WXATA!"
}
```

### Marketplace API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/marketplace/plugins` | List approved plugins |
| `GET` | `/api/marketplace/plugins/:id` | Get plugin details |
| `GET` | `/api/marketplace/plugins/:id/download` | Download plugin .json |
| `POST` | `/api/marketplace/auth/register` | Create account |
| `POST` | `/api/marketplace/auth/login` | Login |
| `POST` | `/api/marketplace/plugins` | Publish plugin (auth) |

---

## Maintenance

- **Logs**: View real-time socket streams in the dashboard.
- **Retention**: System caches are periodically cleared to maintain performance.
- **Marketplace**: Install community-approved extensions directly from the "Marketplace" tab.

---

*Powered by TADSTech*
