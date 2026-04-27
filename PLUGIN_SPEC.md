# WXATA Plugin Specification v1.0

> This document is the authoritative reference for building WXATA plugins.
> It is designed to be consumed by both humans and AI agents (LLMs, Copilots, etc.).

---

## What is a Plugin?

A WXATA plugin is a JavaScript snippet that runs inside the bot when a user sends a specific command in WhatsApp. Plugins are stored as entries in `botinfo.json` under the `scripts` key and can be installed from the Marketplace or built directly in the Dashboard.

---

## Plugin Schema

```json
{
  "name": "string — display name shown in !menu",
  "desc": "string — short description shown in !mn detailed",
  "trigger": "string — primary command word (no prefix). e.g. 'weather'",
  "aliases": ["array", "of", "alternative", "triggers"],
  "type": "core | tools | admin | group | fun | misc",
  "target": "chat | self",
  "response": "string — static text response (used if no code field)",
  "defaultArgument": "string — default arg if user provides none",
  "code": "string — JavaScript code (see Execution Context below)",
  "arguments": {
    "argname": {
      "target": "chat | self | +countrycodeNumber",
      "response": "override response for this specific argument"
    }
  }
}
```

### Field Reference

| Field | Required | Description |
|---|---|---|
| `trigger` | ✅ | The command word. User types `!trigger` to run it. |
| `response` | ✅ | Static text response. Can be empty string `""` if `code` is used. |
| `target` | ✅ | `"chat"` sends to current chat. `"self"` sends to your own DM. |
| `name` | recommended | Display name in menus. Defaults to trigger if omitted. |
| `desc` | recommended | Description shown in `!mn detailed` and `!hp`. |
| `aliases` | optional | Extra triggers. e.g. `["weather", "w"]` |
| `type` | optional | Category for menu grouping. Default: `"misc"` |
| `code` | optional | JavaScript code. If present, overrides `response`. |
| `defaultArgument` | optional | Used when user runs command with no argument. |
| `arguments` | optional | Named argument overrides for target/response. |

---

## Execution Context

When your plugin's `code` runs, these variables are injected automatically:

### `sock` — Baileys WhatsApp Socket
The full Baileys socket. Use it to send messages, get group info, etc.

```js
// Send a text message
await sock.sendMessage(remoteJid, { text: 'Hello!' });

// Send an image from URL
await sock.sendMessage(remoteJid, { image: { url: 'https://...' }, caption: 'Caption' });

// Send a video
await sock.sendMessage(remoteJid, { video: { url: 'https://...' }, caption: 'Caption' });

// Get group metadata
const meta = await sock.groupMetadata(remoteJid);
// meta.participants → [{ id: '234...@s.whatsapp.net', admin: 'admin' | null }]
// meta.subject → group name

// Tag members with mentions
await sock.sendMessage(remoteJid, {
  text: '@234... hello',
  mentions: ['234...@s.whatsapp.net']
});

// React to a message
await sock.sendMessage(remoteJid, {
  react: { text: '👍', key: msg.key }
});

// Delete a message
await sock.sendMessage(remoteJid, {
  delete: { remoteJid, fromMe: true, id: 'MESSAGE_ID' }
});

// Kick a user from group
await sock.groupParticipantsUpdate(remoteJid, ['234...@s.whatsapp.net'], 'remove');

// Add a user to group
await sock.groupParticipantsUpdate(remoteJid, ['234...@s.whatsapp.net'], 'add');

// Get profile picture URL
const ppUrl = await sock.profilePictureUrl('234...@s.whatsapp.net', 'image');
```

### `msg` — Message Object
The full incoming message from Baileys.

```js
msg.key.remoteJid      // Chat JID (group or DM)
msg.key.fromMe         // true if sent by the bot
msg.key.participant    // Sender JID in groups
msg.key.id             // Message ID
msg.pushName           // Sender's display name
msg.message            // Message content object

// Get quoted message
const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

// Get mentioned JIDs
const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
```

### `remoteJid` — Chat ID
The JID of the chat where the command was triggered. Already resolved from `@lid` to real number.

```js
remoteJid                          // e.g. '234...@s.whatsapp.net' or '123...@g.us'
remoteJid.endsWith('@g.us')        // true if group chat
remoteJid.endsWith('@s.whatsapp.net') // true if DM
```

### `argumentName` — Command Argument
Everything the user typed after the trigger word.

```js
// User types: !weather Lagos
argumentName  // → "Lagos"

// User types: !weather
argumentName  // → undefined

// User types: !ta Hello everyone, meeting now
argumentName  // → "Hello everyone, meeting now"

// Safe usage:
const arg = argumentName?.trim() || '';
const parts = argumentName?.split(' ') || [];
```

### `sendTrackedMessage(sock, jid, text)` — Safe Send Helper
Sends a text message and logs it to the dashboard. Prevents echo loops.

```js
await sendTrackedMessage(sock, remoteJid, 'Hello!');
await sendTrackedMessage(sock, remoteJid, `Result: ${value}`);
```

### `botInfo` — Bot Configuration
The current bot config object.

```js
botInfo.prefix              // Command prefix (e.g. "!")
botInfo.scripts             // All installed scripts
botInfo.permissions.allowAll
botInfo.permissions.numbers // Allowed phone numbers
botInfo.permissions.chats   // Allowed chat JIDs
botInfo.root.target         // Root/sudo target
```

### `dashboard` — Logger
Log messages to the dashboard UI.

```js
dashboard.log('INFO', 'Plugin started');
dashboard.log('SUCCESS', 'Done!');
dashboard.log('ERROR', 'Something failed');
dashboard.log('WARN', 'Watch out');
dashboard.log('DEBUG', 'Value: ' + someVar);
```

### `require` — Node.js Require
Import Node.js built-ins and installed npm packages.

```js
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');           // HTTP requests
const bail = require('@whiskeysockets/baileys');  // Baileys utilities
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
```

### `__rootdir` — Data Directory Path
Path to the persistent data directory. Use this for reading/writing JSON config files.

```js
const path = require('path');
const fs = require('fs');

// Read a config file
const configPath = path.resolve(__rootdir, 'myplugin.json');
let config = {};
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Write a config file
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

// Read vars.json (system variables)
const varsPath = path.resolve(__rootdir, 'vars.json');
```

---

## Plugin Templates

### Template 1 — Simple Text Response
```js
// No code needed — just set response field:
// response: "Hello! This is my plugin."
// Leave code empty.
```

### Template 2 — Echo with Argument
```js
if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !echo <text>');
await sendTrackedMessage(sock, remoteJid, argumentName);
```

### Template 3 — HTTP API Call
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

### Template 4 — Group Only with Admin Check
```js
if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, '❌ Groups only.');
const meta = await sock.groupMetadata(remoteJid);
const senderJid = msg.key.participant || msg.key.remoteJid;
const isAdmin = meta.participants.find(p => p.id === senderJid)?.admin;
if (!isAdmin && !msg.key.fromMe) return sendTrackedMessage(sock, remoteJid, '❌ Admins only.');

// Your admin-only logic here
await sendTrackedMessage(sock, remoteJid, '✅ Admin action executed.');
```

### Template 5 — Persistent Config (Read/Write JSON)
```js
const fs = require('fs');
const path = require('path');
const configFile = path.resolve(__rootdir, 'myplugin.json');

let config = { enabled: true, value: 'default' };
if (fs.existsSync(configFile)) {
  try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch(e) {}
}

const arg = argumentName?.trim().toLowerCase() || '';
if (arg.startsWith('set ')) {
  config.value = arg.slice(4).trim();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  return sendTrackedMessage(sock, remoteJid, `✅ Value set to: ${config.value}`);
}

await sendTrackedMessage(sock, remoteJid, `Current value: ${config.value}`);
```

### Template 6 — Reply to Quoted Message
```js
const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
if (!contextInfo?.quotedMessage) return sendTrackedMessage(sock, remoteJid, '⚠️ Reply to a message to use this.');

const quotedText = contextInfo.quotedMessage?.conversation
  || contextInfo.quotedMessage?.extendedTextMessage?.text
  || '(media)';
const quotedSender = contextInfo.participant;

await sendTrackedMessage(sock, remoteJid, `You quoted @${quotedSender?.split('@')[0]}: "${quotedText}"`);
```

### Template 7 — Send Image from URL
```js
if (!argumentName) return sendTrackedMessage(sock, remoteJid, 'Usage: !img <url>');
let url = argumentName.trim();
if (!url.startsWith('http')) url = 'https://' + url;

try {
  await sock.sendMessage(remoteJid, { image: { url }, caption: `📸 ${url}` });
} catch (e) {
  await sendTrackedMessage(sock, remoteJid, '❌ Failed to send image.');
}
```

### Template 8 — Tag All Members
```js
if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, '❌ Groups only.');
const meta = await sock.groupMetadata(remoteJid);
const header = argumentName ? `📢 *${argumentName}*\n\n` : `✨ *ATTENTION* ✨\n\n`;
let text = header;
const mentions = [];
for (const p of meta.participants) {
  text += `@${p.id.split('@')[0]} `;
  mentions.push(p.id);
}
await sock.sendMessage(remoteJid, { text, mentions });
```

---

## Plugin Rules & Best Practices

1. **Always handle missing arguments** — check `if (!argumentName)` and return usage instructions
2. **Wrap API calls in try/catch** — network requests can fail; always send an error message
3. **Use `sendTrackedMessage` for text** — it logs to dashboard and prevents echo loops
4. **Use `sock.sendMessage` for media** — images, videos, stickers, reactions
5. **Don't block the event loop** — use `await` for all async operations
6. **Config files go in `__rootdir`** — use `path.resolve(__rootdir, 'myplugin.json')`
7. **Check group context** — use `remoteJid.endsWith('@g.us')` before group operations
8. **Respect permissions** — check `msg.key.fromMe` or `botInfo.permissions` for sensitive actions

---

## Marketplace Publishing

To publish a plugin to the WXATA Marketplace:

1. Build and test your plugin in the Dashboard
2. Click **"Publish to Marketplace"** on the script card
3. Fill in the metadata (name, description, category, tags)
4. Submit for review — status becomes `pending`
5. Admin reviews and approves → status becomes `approved`
6. Plugin appears in Marketplace for all users

### Marketplace Extension Schema (Firestore)

```typescript
interface MarketplaceExtension {
  name: string;
  description: string;
  trigger: string;
  aliases: string[];
  type: string;
  target: string;
  response: string;
  code?: string;
  defaultArgument?: string;
  author: string;          // username
  authorUid: string;       // Firebase UID
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;       // ISO timestamp
  downloads: number;
  tags?: string[];
  version?: string;
  untrusted?: boolean;     // Flagged for security review
  disabled?: boolean;      // Admin disabled
}
```

---

## For AI Agents

If you are an AI agent generating a WXATA plugin, follow these rules:

1. Output a valid JSON object matching the Plugin Schema above
2. The `code` field must be a single JavaScript string (no outer function wrapper — the code runs as the body of an async function)
3. All variables in the Execution Context are pre-injected — do not declare them
4. Use `await` for all async operations
5. Always include error handling with try/catch for network calls
6. Test your logic mentally: what happens if `argumentName` is undefined? If the user is not in a group?
7. The `require` function is available for Node.js built-ins and these packages: `axios`, `@whiskeysockets/baileys`, `wa-sticker-formatter`

### Example AI Prompt

> "Create a WXATA plugin that fetches a random joke from the JokeAPI and sends it to the chat. Trigger: `joke`. Aliases: `jk`. Type: `fun`."

### Expected AI Output

```json
{
  "name": "Random Joke",
  "desc": "Fetch a random joke from JokeAPI",
  "trigger": "joke",
  "aliases": ["jk"],
  "type": "fun",
  "target": "chat",
  "response": "",
  "code": "const axios = require('axios');\nawait sendTrackedMessage(sock, remoteJid, '😂 Fetching a joke...');\ntry {\n  const res = await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=single');\n  await sendTrackedMessage(sock, remoteJid, `😂 ${res.data.joke}`);\n} catch (e) {\n  await sendTrackedMessage(sock, remoteJid, '❌ Failed to fetch joke.');\n}"
}
```
