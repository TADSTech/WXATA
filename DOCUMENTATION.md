# WXATA Documentation 📖

Welcome to the official documentation for **WXATA** (WhatsApp Automation & Tactical Assistant). This engine is built on **Baileys** and **Bun**, designed for high-performance automation and premium user experience.

---

## 🚀 Getting Started

### Installation
WXATA is designed to be run via `bun`.
1.  Clone the repository.
2.  Run `bun install`.
3.  Start the system with `bun run all`.

### Connecting
You can connect via **QR Code** or **Phone Pairing** through the dashboard at `https://wxata.tadstech.dev`.

---

## 🛠️ Command System

Commands in WXATA are prefix-based (default: `!`). Each command can have a primary trigger and multiple aliases.

### Command Structure
*   **Trigger**: The primary shorthand (e.g., `hp` for help).
*   **Aliases**: Secondary shorthands (e.g., `help`, `h`).
*   **Type**: Categorization (core, tools, admin, group, fun).
*   **Target**: Where the response goes (`chat` for current chat, `self` for your own chat).

### Core Commands
| Trigger | Alias | Description |
|---------|-------|-------------|
| `mn` | `menu`, `m` | Opens the professional system menu. |
| `hp` | `help`, `h` | Shows detailed help for a specific command. |
| `pg` | `ping`, `p` | Checks system latency and status. |
| `dc` | `docs` | Access this documentation. |

---

## 🛡️ Permission System

WXATA uses a multi-tier permission system to ensure security.

1.  **Root (Sudo)**:
    *   Configured in `botinfo.json` under `root.target`.
    *   Can execute any command.
    *   Can manage permissions for others.
2.  **Allowed Chats**:
    *   Group or DM JIDs that are explicitly allowed.
    *   Managed via the `!pm` command.
3.  **Allowed Numbers**:
    *   Specific phone numbers allowed to use the bot in any shared chat.

### Managing Permissions
*   `!pm chat`: Grant permission to the current chat.
*   `!pm revoke chat`: Revoke permission from the current chat.
*   `!pm <number>`: Grant permission to a specific number.

---

## ⚡ Variables & Customization

### Configurable Vars
| Variable | Description |
|----------|-------------|
| `PREFIX` | Changes the bot's trigger prefix. |
| `WELCOME` | Toggles the connect greeting. |
| `ALLOW_ALL` | If true, everyone can use the bot (Warning: High Risk). |

### Custom Scripts
You can add your own JS scripts through the dashboard. Scripts have access to:
*   `sock`: The Baileys socket instance.
*   `msg`: The current message object.
*   `botInfo`: The full bot configuration.
*   `remoteJid`: The current chat ID.
*   `argumentName`: Any text after the command trigger.
*   `sendTrackedMessage`: A helper to send messages and log them.

---

## 🎨 Branding & Aesthetics

WXATA is built with a "Premium-First" philosophy.
*   **Themes**: 10+ custom themes (Midnight, Nord, Cyberpunk, etc.).
*   **Rich Media**: Commands like `!mn` and `!hp` use `externalAdReply` for a professional thumbnail look.

---

## 📦 Maintenance

*   **Logs**: View real-time socket streams in the dashboard.
*   **Retention**: System caches are periodically cleared to maintain performance.
*   **Marketplace**: Install community-approved extensions directly from the "Marketplace" tab.

---

*Powered by TADSTech*
