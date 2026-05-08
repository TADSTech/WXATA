import { validateLicense } from "./licenseValidator";
import { WXATAConnection } from "./connection";
// @ts-ignore
import * as qrcode from "qrcode-terminal";
import { dashboard } from "./DashboardServer";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import {
  storeMessage,
  getMessage,
  pruneOldMessages,
  getRetentionDays,
  setRetentionDays,
  getMessageCount,
} from "./db";

interface BotScript {
  name: string;
  desc: string;
  trigger: string;
  aliases?: string[];
  type?: string;
  response: string;
  target: string;
  code?: string;
  defaultArgument?: string;
  arguments?: Record<string, BotScriptArgument>;
}

interface BotScriptArgument {
  target?: string;
  response?: string;
}

interface BotInfo {
  prefix: string;
  scripts: Record<string, BotScript>;
  root: BotRoot;
  welcome: BotWelcome;
  permissions: BotPermissions;
}

interface BotRoot {
  target: string;
}

interface BotWelcome {
  enabled: boolean;
  text: string;
}

interface BotPermissions {
  allowAll: boolean;
  chats: string[];
  numbers: string[];
}

// Use Render's persistent disk at /data if available, otherwise workspace root
const DATA_DIR = require("fs").existsSync("/data")
  ? "/data"
  : path.resolve(__dirname, "..");
const BOT_INFO_PATH = path.resolve(DATA_DIR, "botinfo.json");
const OUTBOUND_MESSAGE_TTL_MS = 15_000;
const DEFAULT_BOT_INFO: BotInfo = {
  prefix: "!",
  scripts: {
    menu: {
      name: "System Menu",
      desc: "Show professional system menu with stats",
      trigger: "mn",
      aliases: ["menu", "m"],
      type: "core",
      response: "",
      target: "chat",
      code: `const os = require('os');
const uptime = Math.floor(process.uptime());
const h = Math.floor(uptime / 3600);
const m = Math.floor((uptime % 3600) / 60);
const s = Math.floor(uptime % 60);
const uptimeStr = \`\${h}h \${m}m \${s}s\`;
const ram = (os.totalmem() - os.freemem()) / 1024 / 1024 / 1024;
const totalRam = os.totalmem() / 1024 / 1024 / 1024;

const isDetailed = argumentName === 'detailed' || argumentName === 'd';
const date = new Date();
const time = date.toLocaleTimeString();

let menuText = \`╭━─━─━─≪✠≫─━─━─━╮
     *WXATA SYSTEM v1.0*
╰━─━─━─≪✠≫─━─━─━╯
╭━─━─━─≪✠≫─━─━─━╮
│ 📅 *Date:* \${date.toLocaleDateString()}
│ ⏰ *Time:* \${time}
│ ❄️ *Day:* \${date.toLocaleString('en', { weekday: 'long' })}
│ 🚀 *Version:* 1.2.0
│ 🪻 *RAM:* \${ram.toFixed(2)}GB / \${totalRam.toFixed(0)}GB
│ ⏳ *Uptime:* \${uptimeStr}
╰━─━─━─≪✠≫─━─━─━╯\\n\\n\`;

const categories = {};
Object.entries(botInfo.scripts).forEach(([key, script]) => {
    const type = script.type || 'misc';
    if (!categories[type]) categories[type] = [];
    categories[type].push(script);
});

for (const [cat, cmds] of Object.entries(categories)) {
    menuText += \`╭━─━─━─≪❥≫\\n│ *\${cat.toUpperCase()} ❞*\\n╰━─━─━─≪❥≫\\n\`;
    cmds.forEach(cmd => {
        if (isDetailed) {
            menuText += \`│ ✗ \${botInfo.prefix}\${cmd.trigger} (\${cmd.name})\\n│    \${cmd.desc}\\n\`;
        } else {
            menuText += \`│ ✗ \${botInfo.prefix}\${cmd.trigger}\\n\`;
        }
    });
    menuText += '\\n';
}

if (!isDetailed) menuText += \`_Tip: Use \${botInfo.prefix}mn detailed for descriptions._\`;

await sock.sendMessage(remoteJid, {
    text: menuText,
    contextInfo: {
        externalAdReply: {
            title: 'WXATA • PREMIUM ENGINE',
            body: isDetailed ? 'Detailed Command Overview' : 'Advanced WhatsApp Automation',
            mediaType: 1,
            thumbnailUrl: 'https://files.catbox.moe/7pqr0j.jpeg',
            sourceUrl: 'https://wxata.tadstech.dev'
        }
    }
});`,
    },
    help: {
      name: "Help System",
      desc: "Describe a specific command and its usage",
      trigger: "hp",
      aliases: ["help", "h"],
      type: "core",
      response: "",
      target: "chat",
      code: `if (!argumentName) return sendTrackedMessage(sock, remoteJid, \`📖 *WXATA HELP*\\n\\nUsage: \${botInfo.prefix}hp <command>\\nExample: \${botInfo.prefix}hp st\\n\\nType \${botInfo.prefix}mn to see all aliases.\`);

const cmdKey = argumentName.toLowerCase().trim();
const script = Object.values(botInfo.scripts).find(s => s.trigger === cmdKey || s.name?.toLowerCase() === cmdKey || (s.aliases && s.aliases.includes(cmdKey)));

if (!script) return sendTrackedMessage(sock, remoteJid, \`❌ Command "\${cmdKey}" not found.\`);

let helpText = \`*───『 HELP: \${script.name?.toUpperCase() || cmdKey.toUpperCase()} 』───*\\n\\n\`;
helpText += \`🔹 *Alias:* \${botInfo.prefix}\${script.trigger}\\n\`;
helpText += \`🔹 *Full Name:* \${script.name}\\n\`;
helpText += \`🔹 *Description:* \${script.desc || 'No description available.'}\\n\`;
if (script.aliases && script.aliases.length > 0) helpText += \`🔹 *Other Aliases:* \${script.aliases.join(', ')}\\n\`;
helpText += \`🔹 *Target:* \${script.target || 'chat'}\\n\`;

await sock.sendMessage(remoteJid, {
  text: helpText,
  contextInfo: {
    externalAdReply: {
      title: \`HELP: \${script.name}\`,
      body: 'WXATA Documentation System',
      mediaType: 1,
      thumbnailUrl: 'https://files.catbox.moe/7pqr0j.jpeg',
      sourceUrl: 'https://wxata.tadstech.dev/docs'
    }
  }
});`,
    },
    perm: {
      name: "Permission Manager",
      desc: "Grant bot permissions: chat | all | +number",
      trigger: "pm",
      aliases: ["perm", "pms"],
      type: "core",
      response: "Permission updated.",
      target: "chat",
    },
    dc: {
      name: "Documentation",
      desc: "Get a link to the WXATA documentation",
      trigger: "dc",
      aliases: ["docs", "doc"],
      type: "core",
      response: "",
      target: "chat",
      code: `await sendTrackedMessage(sock, remoteJid, '📚 *WXATA Documentation*\\n\\nhttps://wxata.tadstech.dev/docs');`,
    },
    owner: {
      name: "Bot Owner",
      desc: "Send the bot owner contact card",
      trigger: "owner",
      aliases: ["ow"],
      type: "core",
      response: "",
      target: "chat",
      code: `const ownerNumber = botInfo.root.target.replace(/\\D/g, '');
if (!ownerNumber) return sendTrackedMessage(sock, remoteJid, '❌ Owner number not configured.');
try {
  await sock.sendMessage(remoteJid, {
    contacts: {
      displayName: 'Bot Owner',
      contacts: [{
        vcard: \`BEGIN:VCARD\\nVERSION:3.0\\nFN:Bot Owner\\nTEL;type=CELL;type=VOICE;waid=\${ownerNumber}:+\${ownerNumber}\\nEND:VCARD\`
      }]
    }
  });
} catch (err) {
  dashboard.log('ERROR', \`!owner vCard send failed: \${err?.message ?? err}\`);
  await sendTrackedMessage(sock, remoteJid, '❌ Failed to send owner contact.');
}`,
    },
    antibc: {
      name: "Anti-Broadcast",
      desc: "Toggle anti-broadcast filter. Usage: !antibc on | off | message <text>",
      trigger: "antibc",
      aliases: ["abc"],
      type: "core",
      response: "",
      target: "chat",
      code: `const isSudo = botInfo.permissions.numbers?.includes(remoteJid.split('@')[0]) || msg.key?.fromMe;
if (!isSudo) return sendTrackedMessage(sock, remoteJid, '❌ Permission Denied.');

const fs = require('fs');
const rPath = require('path');
const cfgPath = rPath.resolve(__rootdir, 'antibc.json');
let cfg = { enabled: false, message: 'remove me from broadcast' };
try {
  if (fs.existsSync(cfgPath)) {
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (typeof parsed.enabled === 'boolean') cfg.enabled = parsed.enabled;
    if (typeof parsed.message === 'string') cfg.message = parsed.message;
  }
} catch(e) {}

const arg = argumentName ? argumentName.trim().toLowerCase() : '';

if (arg === 'on') {
  cfg.enabled = true;
  try { fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); } catch(e) { return sendTrackedMessage(sock, remoteJid, '❌ Failed to save config.'); }
  return sendTrackedMessage(sock, remoteJid, '✅ Anti-Broadcast *ON*');
} else if (arg === 'off') {
  cfg.enabled = false;
  try { fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); } catch(e) { return sendTrackedMessage(sock, remoteJid, '❌ Failed to save config.'); }
  return sendTrackedMessage(sock, remoteJid, '❌ Anti-Broadcast *OFF*');
} else if (arg.startsWith('message ')) {
  const newMsg = argumentName.trim().slice(8).trim();
  if (!newMsg) return sendTrackedMessage(sock, remoteJid, '❌ Please provide a message text.');
  cfg.message = newMsg;
  try { fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); } catch(e) { return sendTrackedMessage(sock, remoteJid, '❌ Failed to save config.'); }
  return sendTrackedMessage(sock, remoteJid, \`✅ Anti-Broadcast message updated: "\${newMsg}"\`);
} else {
  return sendTrackedMessage(sock, remoteJid, \`*Anti-Broadcast Status*\\nEnabled: \${cfg.enabled ? 'ON ✅' : 'OFF ❌'}\\nMessage: "\${cfg.message}"\\n\\nUsage: !antibc on | off | message <text>\`);
}`,
    },
    summoner: {
      name: "System Ping",
      desc: "Check bot network speed and status",
      trigger: "pg",
      aliases: ["ping", "p"],
      type: "core",
      response: "",
      target: "chat",
      code: `const start = Date.now();
await sendTrackedMessage(sock, remoteJid, "Pong! 🟢 Calculating speed...");
const end = Date.now();
await sendTrackedMessage(sock, remoteJid, \`🚀 Speed: \${end - start}ms\\n🤖 WXATA is ONLINE\`);`,
    },
    extractor: {
      name: "Media Extractor",
      desc: "Extract view once media",
      trigger: "ex",
      aliases: ["extract", "e"],
      type: "tools",
      response: "",
      target: "chat",
      code: `const bail = require('@whiskeysockets/baileys');
const extractFrom = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
if (!extractFrom) return sendTrackedMessage(sock, remoteJid, "Please reply to a View Once message.");

let viewOnce = extractFrom.viewOnceMessage?.message || extractFrom.viewOnceMessageV2?.message || extractFrom.viewOnceMessageV2Extension?.message || extractFrom;
const mediaMsg = viewOnce.imageMessage || viewOnce.videoMessage || viewOnce.audioMessage;
const mediaType = viewOnce.imageMessage ? 'image' : (viewOnce.videoMessage ? 'video' : 'audio');

if (mediaMsg) {
  const stream = await bail.downloadContentFromMessage(mediaMsg, mediaType);
  let buffer = Buffer.from([]);
  for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

  let target = remoteJid;
  if (argumentName === 'self' || argumentName === 'me') target = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  else if (argumentName && argumentName.match(/^\\d+$/)) target = argumentName + '@s.whatsapp.net';

  const payload = {};
  payload[mediaType] = buffer;
  if (mediaMsg.caption) payload.caption = mediaMsg.caption;

  await sock.sendMessage(target, payload);
  if (target !== remoteJid) await sendTrackedMessage(sock, remoteJid, "Extracted and sent successfully.");
} else {
  return sendTrackedMessage(sock, remoteJid, "Could not find valid media in the quoted message.");
}`,
    },
    saver: {
      name: "Status Saver",
      desc: "Save status media to your chat",
      trigger: "sv",
      aliases: ["save", "s"],
      type: "tools",
      response: "",
      target: "chat",
      code: `const bail = require('@whiskeysockets/baileys');
const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
const extractFrom = contextInfo?.quotedMessage;
if (!extractFrom) return sendTrackedMessage(sock, remoteJid, "Please reply to a message to save it to your chat.");

const mediaMsg = extractFrom.imageMessage || extractFrom.videoMessage || extractFrom.audioMessage;
const mediaType = extractFrom.imageMessage ? 'image' : (extractFrom.videoMessage ? 'video' : 'audio');

if (mediaMsg) {
  const stream = await bail.downloadContentFromMessage(mediaMsg, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

  const target = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const payload = {};
  payload[mediaType] = buffer;
  if (mediaMsg.caption) payload.caption = mediaMsg.caption;

  await sock.sendMessage(target, payload);
  await sendTrackedMessage(sock, remoteJid, "Media saved to your own chat successfully!");
} else {
  return sendTrackedMessage(sock, remoteJid, "No media found in the quoted message.");
}`,
    },
    tagall: {
      name: "Tag All Members",
      desc: "Tag everyone in the group. Args: admins = tag admins only | <message> = custom header",
      trigger: "ta",
      aliases: ["tagall", "tag"],
      type: "group",
      response: "",
      target: "chat",
      code: `if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, "This command can only be used in groups.");

const groupMetadata = await sock.groupMetadata(remoteJid);
const arg = argumentName ? argumentName.trim().toLowerCase() : '';
const tagAdminsOnly = arg === 'admins' || arg === 'admin';

const pool = tagAdminsOnly
  ? groupMetadata.participants.filter(p => p.admin)
  : groupMetadata.participants;

if (pool.length === 0) return sendTrackedMessage(sock, remoteJid, "No admins found in this group.");

const fs = require('fs');
const path = require('path');
const varsFile = path.resolve(__rootdir, 'vars.json');
let configVars = {};
if (fs.existsSync(varsFile)) { try { configVars = JSON.parse(fs.readFileSync(varsFile, 'utf8')); } catch(e) {} }

const header = tagAdminsOnly
  ? \`\${configVars.TAGADMINS_MESSAGE || '👑 *ATTENTION ADMINS* 👑'}\\n\\n\`
  : (argumentName ? \`📢 *\${argumentName.trim()}*\\n\\n\` : \`\${configVars.TAGALL_MESSAGE || '✨ *ATTENTION EVERYONE* ✨'}\\n\\n\`);

let text = header;
const mentions = [];
for (const mem of pool) {
  text += \`@\${mem.id.split('@')[0]} \`;
  mentions.push(mem.id);
}
await sock.sendMessage(remoteJid, { text, mentions });`,
    },
    sticker: {
      name: "Sticker Maker",
      desc: "Convert image/video to sticker",
      trigger: "st",
      aliases: ["sticker", "stick"],
      type: "tools",
      response: "",
      target: "chat",
      code: `const bail = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
const extractFrom = contextInfo?.quotedMessage || msg.message;
if (!extractFrom) return sendTrackedMessage(sock, remoteJid, "Please reply to an image/video or send one with the command.");

const mediaMsg = extractFrom.imageMessage || extractFrom.videoMessage;
const mediaType = extractFrom.imageMessage ? 'image' : 'video';

if (mediaMsg) {
  const stream = await bail.downloadContentFromMessage(mediaMsg, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

  const sticker = new Sticker(buffer, {
    pack: 'WXATA Pack',
    author: 'WXATA Bot',
    type: StickerTypes.FULL,
    quality: 100
  });
  await sock.sendMessage(remoteJid, await sticker.toMessage());
} else {
  return sendTrackedMessage(sock, remoteJid, "No image or video found.");
}`,
    },
    qc: {
      name: "Quote Sticker Maker",
      desc: "Generate quote sticker from text",
      trigger: "qc",
      aliases: ["quote", "q"],
      type: "tools",
      response: "",
      target: "chat",
      code: `const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

if (!argumentName) return sendTrackedMessage(sock, remoteJid, "Usage: !qc <text> [; <name>]");
const [text, name] = argumentName.split(';');

let pp = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
try {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const target = contextInfo?.participant || msg.key.participant || remoteJid;
    pp = await sock.profilePictureUrl(target, 'image');
} catch (e) {}

const obj = {
    type: 'quote',
    format: 'png',
    backgroundColor: '#FFFFFF',
    width: 512,
    height: 512,
    scale: 2,
    messages: [{
        avatar: true,
        from: {
            name: name?.trim() || msg.pushName || "User",
            photo: { url: pp },
        },
        text: text.trim(),
        replyMessage: {},
    }],
};

try {
    const response = await axios.post('https://bot.lyo.su/quote/generate', obj);
    const imgBuffer = Buffer.from(response.data.result.image, 'base64');
    const sticker = new Sticker(imgBuffer, {
        pack: 'WXATA Pack',
        author: 'WXATA Bot',
        type: StickerTypes.FULL,
        quality: 100
    });
    await sock.sendMessage(remoteJid, await sticker.toMessage());
} catch (e) {
    await sendTrackedMessage(sock, remoteJid, "❌ Failed to generate quote sticker.");
}`,
    },
    delete: {
      name: "Message Deleter",
      desc: "Delete a message",
      trigger: "dl",
      aliases: ["delete", "del"],
      type: "tools",
      response: "",
      target: "chat",
      code: `const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
if (!contextInfo?.quotedMessage) return sendTrackedMessage(sock, remoteJid, "Please reply to the message you want to delete.");

await sock.sendMessage(remoteJid, {
  delete: {
    remoteJid,
    fromMe: contextInfo.participant === sock.user.id.split(':')[0] + '@s.whatsapp.net',
    id: contextInfo.stanzaId,
    participant: contextInfo.participant
  }
});`,
    },
    tkick: {
      name: "Time Kick",
      desc: "Kick user and re-add in 5m. Reply to or mention the target.",
      trigger: "tk",
      aliases: ["tkick"],
      type: "admin",
      response: "",
      target: "chat",
      code: `if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, "❌ This command is for groups only.");

const groupMetadata = await sock.groupMetadata(remoteJid);

const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
const targetUser = contextInfo?.participant || (contextInfo?.mentionedJid && contextInfo.mentionedJid[0]);
if (!targetUser) return sendTrackedMessage(sock, remoteJid, "⚠️ Please reply to a user's message or tag them to T-Kick.");

const targetIsAdmin = groupMetadata.participants.find(p => p.id === targetUser)?.admin;
if (targetIsAdmin) return sendTrackedMessage(sock, remoteJid, "❌ I cannot kick a Group Admin.");

await sock.sendMessage(remoteJid, {
  text: \`⏳ @\${targetUser.split('@')[0]} will be kicked and re-added in 5 minutes.\`,
  mentions: [targetUser]
});

try {
  await sock.groupParticipantsUpdate(remoteJid, [targetUser], 'remove');
  setTimeout(async () => {
    try {
      // Try direct re-add first
      await sock.groupParticipantsUpdate(remoteJid, [targetUser], 'add');
      await sock.sendMessage(remoteJid, {
        text: \`✅ @\${targetUser.split('@')[0]} has been re-added automatically.\`,
        mentions: [targetUser]
      });
    } catch (e) {
      // Direct add failed (privacy settings) — send invite link to the person via DM
      try {
        const inviteCode = await sock.groupInviteCode(remoteJid);
        const inviteLink = \`https://chat.whatsapp.com/\${inviteCode}\`;
        // DM the kicked user with the invite link
        try {
          await sock.sendMessage(targetUser, {
            text: \`You have been invited to join the group once again\\n\${inviteLink}\`
          });
          await sock.sendMessage(remoteJid, {
            text: \`✅ @\${targetUser.split('@')[0]} has been sent a re-invite link via DM.\`,
            mentions: [targetUser]
          });
        } catch (_) {
          // DM failed — post link in group as last resort
          await sock.sendMessage(remoteJid, {
            text: \`⚠️ Could not DM @\${targetUser.split('@')[0]}. Here is the re-invite link:\\n\${inviteLink}\`,
            mentions: [targetUser]
          });
        }
      } catch (inviteErr) {
        await sock.sendMessage(remoteJid, { text: \`❌ Failed to re-add @\${targetUser.split('@')[0]} and could not generate invite link. Please add them manually.\`, mentions: [targetUser] });
      }
    }
  }, 5 * 60 * 1000);
} catch (e) {
  await sendTrackedMessage(sock, remoteJid, "❌ Failed to execute T-Kick. Ensure I have proper permissions.");
}`,
    },
    ss: {
      name: "Web Screenshot",
      desc: "Take web page screenshot. Usage: !ss <url>",
      trigger: "ss",
      aliases: ["screenshot", "snap"],
      type: "tools",
      response: "",
      target: "chat",
      code: `if (!argumentName) return sendTrackedMessage(sock, remoteJid, "Please provide a URL (e.g. !ss google.com)");
let url = argumentName.trim();
if (!url.startsWith('http')) url = 'https://' + url;
await sendTrackedMessage(sock, remoteJid, '📸 *Capturing screenshot...*');
try {
  const ssUrl = \`https://pageshot.site/v1/screenshot?url=\${encodeURIComponent(url)}&width=1280&height=900&format=jpg\`;
  await sock.sendMessage(remoteJid, { image: { url: ssUrl }, caption: \`📸 *\${url}*\` });
} catch(e) {
  await sendTrackedMessage(sock, remoteJid, '❌ Failed to capture screenshot. Check the URL and try again.');
}`,
    },
    warn: {
      name: "User Warner",
      desc: "Warn 3x then kick",
      trigger: "wn",
      aliases: ["warn", "w"],
      type: "admin",
      response: "",
      target: "chat",
      code: `if (!remoteJid.endsWith('@g.us')) return sendTrackedMessage(sock, remoteJid, "This command can only be used in groups.");
const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
const targetUser = contextInfo?.participant || (contextInfo?.mentionedJid && contextInfo.mentionedJid[0]);
if (!targetUser) return sendTrackedMessage(sock, remoteJid, "⚠️ Please reply to a user's message or tag them to warn.");

const fs = require('fs');
const path = require('path');
const warnsFile = path.resolve(__rootdir, 'warns.json');
const varsFile = path.resolve(__rootdir, 'vars.json');
let warns = {};
if (fs.existsSync(warnsFile)) { warns = JSON.parse(fs.readFileSync(warnsFile, 'utf8')); }
if (!warns[remoteJid]) warns[remoteJid] = {};

warns[remoteJid][targetUser] = (warns[remoteJid][targetUser] || 0) + 1;
fs.writeFileSync(warnsFile, JSON.stringify(warns, null, 2));

let configVars = {};
if (fs.existsSync(varsFile)) { try { configVars = JSON.parse(fs.readFileSync(varsFile, 'utf8')); } catch(e) {} }
const warnTemplate = configVars.WARN_MESSAGE || '⚠️ You have been warned! ({count}/3)';

const warnCount = warns[remoteJid][targetUser];
if (warnCount >= 3) {
  await sock.sendMessage(remoteJid, { text: \`🚨 @\${targetUser.split('@')[0]} has reached 3 warnings and is being removed!\`, mentions: [targetUser] });
  try { await sock.groupParticipantsUpdate(remoteJid, [targetUser], 'remove'); } catch (e) {
    await sock.sendMessage(remoteJid, { text: "❌ I don't have Admin permissions to remove them!" });
  }
  warns[remoteJid][targetUser] = 0;
  fs.writeFileSync(warnsFile, JSON.stringify(warns, null, 2));
} else {
  const warnMsg = warnTemplate.replace('{count}', warnCount).replace('{max}', '3').replace('{user}', \`@\${targetUser.split('@')[0]}\`);
  await sock.sendMessage(remoteJid, { text: \`@\${targetUser.split('@')[0]} \${warnMsg}\`, mentions: [targetUser] });
}`,
    },
    antidel: {
      name: "Anti-Delete System",
      desc: "Forward deleted msgs",
      trigger: "ad",
      aliases: ["antidel", "anti"],
      type: "tools",
      response: "",
      target: "chat",
      code: `const arg = argumentName ? argumentName.toLowerCase() : '';
const fs = require('fs');
const rPath = require('path');
const cfgPath = rPath.resolve(__rootdir, 'antidel.json');
const selfJid = sock.user?.id.split(':')[0] + '@s.whatsapp.net';
const defaultTarget = (botInfo.permissions.numbers[0] ? botInfo.permissions.numbers[0] + '@s.whatsapp.net' : null) || selfJid;\n\nlet cfg = { enabled: true, target: defaultTarget };\ntry {\n  if (fs.existsSync(cfgPath)) {\n    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));\n    cfg.enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : cfg.enabled;\n    if (typeof parsed.target === 'string' && parsed.target.includes('@')) cfg.target = parsed.target;\n  }\n} catch(e) {}\n\nif (arg === 'on') {\n  cfg.enabled = true;\n  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));\n  return sendTrackedMessage(sock, remoteJid, \`✅ Anti-Delete *ON* — forwarding to \${cfg.target}\`);\n} else if (arg === 'off') {\n  cfg.enabled = false;\n  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));\n  return sendTrackedMessage(sock, remoteJid, '❌ Anti-Delete *OFF*');\n}\nawait sendTrackedMessage(sock, remoteJid, \`*Anti-Delete Status*\\nEnabled: \${cfg.enabled ? 'ON ✅' : 'OFF ❌'}\\nTarget: \${cfg.target}\\n\\nUsage: !ad on | off\`);`,
    },
    vars: {
      name: "System Variables",
      desc: "View/set bot config vars. Usage: !vs | !vs set <key> <value> | !vs reset <key>",
      trigger: "vs",
      aliases: ["vars", "v"],
      type: "admin",
      response: "",
      target: "chat",
      code: `const fs = require('fs');
const path = require('path');
const os = require('os');
const varsFile = path.resolve(__rootdir, 'vars.json');

const isSudo = botInfo.permissions.numbers?.includes(remoteJid.split('@')[0]) || msg.key?.fromMe;
if (!isSudo) return sendTrackedMessage(sock, remoteJid, '❌ Permission Denied. Sudo only.');

// Load current vars
let configVars = {
  WARN_MESSAGE: '⚠️ You have been warned! ({count}/3)',
  TAGALL_MESSAGE: '✨ *ATTENTION EVERYONE* ✨',
  TAGADMINS_MESSAGE: '👑 *ATTENTION ADMINS* 👑',
  WELCOME_ENABLED: 'true',
  DB_RETENTION_DAYS: '3',
};
if (fs.existsSync(varsFile)) {
  try { Object.assign(configVars, JSON.parse(fs.readFileSync(varsFile, 'utf8'))); } catch(e) {}
}

const arg = argumentName ? argumentName.trim() : '';

// !vs set KEY value
if (arg.toLowerCase().startsWith('set ')) {
  const parts = arg.slice(4).trim().split(' ');
  const key = parts[0].toUpperCase();
  const value = parts.slice(1).join(' ');
  if (!key || !value) return sendTrackedMessage(sock, remoteJid, '❌ Usage: !vs set <KEY> <value>');

  // Special case: PREFIX updates botinfo.json directly
  if (key === 'PREFIX') {
    const trimmedPrefix = value.trim();
    if (!trimmedPrefix) return sendTrackedMessage(sock, remoteJid, '❌ Prefix cannot be empty.');
    const botInfoPath = path.resolve(__rootdir, 'botinfo.json');
    try {
      const raw = fs.readFileSync(botInfoPath, 'utf8');
      const parsed = JSON.parse(raw);
      parsed.prefix = trimmedPrefix;
      fs.writeFileSync(botInfoPath, JSON.stringify(parsed, null, 2));
      return sendTrackedMessage(sock, remoteJid, \`✅ *PREFIX* updated to: \${trimmedPrefix}\\n_Restart or send any command to apply._\`);
    } catch(e) {
      return sendTrackedMessage(sock, remoteJid, \`❌ Failed to update prefix: \${e?.message ?? e}\`);
    }
  }

  configVars[key] = value;
  fs.writeFileSync(varsFile, JSON.stringify(configVars, null, 2));
  return sendTrackedMessage(sock, remoteJid, \`✅ *\${key}* set to: \${value}\`);
}

// !vs reset KEY
if (arg.toLowerCase().startsWith('reset ')) {
  const key = arg.slice(6).trim().toUpperCase();

  // Special case: reset PREFIX back to '!'
  if (key === 'PREFIX') {
    const botInfoPath = path.resolve(__rootdir, 'botinfo.json');
    try {
      const raw = fs.readFileSync(botInfoPath, 'utf8');
      const parsed = JSON.parse(raw);
      parsed.prefix = '!';
      fs.writeFileSync(botInfoPath, JSON.stringify(parsed, null, 2));
      return sendTrackedMessage(sock, remoteJid, '🔄 *PREFIX* reset to default: !');
    } catch(e) {
      return sendTrackedMessage(sock, remoteJid, \`❌ Failed to reset prefix: \${e?.message ?? e}\`);
    }
  }

  delete configVars[key];
  fs.writeFileSync(varsFile, JSON.stringify(configVars, null, 2));
  return sendTrackedMessage(sock, remoteJid, \`🔄 *\${key}* reset to default.\`);
}

// Show all vars
const uptime = Math.floor(process.uptime());
const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;
let text = '⚙️ *WXATA SYSTEM VARS*\\n\\n';
text += \`🔹 *PREFIX:* \${botInfo.prefix}\\n\`;
text += \`🔹 *ALLOW_ALL:* \${botInfo.permissions.allowAll}\\n\`;
text += \`🔹 *UPTIME:* \${h}h \${m}m \${s}s\\n\`;
text += \`🔹 *RAM:* \${((os.totalmem()-os.freemem())/1024/1024/1024).toFixed(2)}GB / \${(os.totalmem()/1024/1024/1024).toFixed(0)}GB\\n\\n\`;
text += '*Configurable Vars:*\\n';
for (const [k, v] of Object.entries(configVars)) {
  text += \`🔸 *\${k}:* \${v}\\n\`;
}
text += '\\n_Usage: !vs set WARN\\_MESSAGE new text_';
return sendTrackedMessage(sock, remoteJid, text);`,
    },
  },
  root: {
    target: "self",
  },
  welcome: {
    enabled: true,
    text: "*───『 WXATA • PREMIUM 』───*\\n\\nHello! Thank you for connecting with the WXATA engine.\\nThe system is currently *ONLINE* and ready to assist.\\n\\n🚀 *Get Started:*\\nType *{prefix}{menu}* to view the professional command console.\\n\\n🔗 *Resources:*\\n• Website: https://wxata.tadstech.dev\\n• Docs: https://wxata.tadstech.dev/docs\\n• X: @tads_tech\\n• Telegram: https://t.me/+dR5zABepmkNhYjQ0\\n\\n_Powered by TADSTech_",
  },
  permissions: {
    allowAll: false,
    chats: [],
    numbers: [],
  },
};

function sanitizeBotScript(
  input: Partial<BotScript> | undefined,
  fallbackName: string,
): BotScript {
  const name =
    typeof input?.name === "string" && input.name.trim()
      ? input.name.trim()
      : fallbackName;
  const desc =
    typeof input?.desc === "string" && input.desc.trim()
      ? input.desc.trim()
      : `${name} core script`;
  const defaultArgument =
    typeof input?.defaultArgument === "string" && input.defaultArgument.trim()
      ? input.defaultArgument.trim()
      : "self";
  const defaultSummonerArguments = {
    here: {
      target: "chat",
    },
    self: {
      target: "self",
    },
  };
  const argumentsInput =
    input?.arguments && typeof input.arguments === "object"
      ? input.arguments
      : input?.trigger === "summon"
        ? defaultSummonerArguments
        : undefined;

  const argumentsMap = Object.entries(argumentsInput ?? {}).reduce<
    Record<string, BotScriptArgument>
  >((accumulator, [name, argument]) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return accumulator;
    }

    accumulator[normalizedName] = {
      target:
        typeof argument?.target === "string" && argument.target.trim()
          ? argument.target.trim()
          : undefined,
      response:
        typeof argument?.response === "string" && argument.response.trim()
          ? argument.response.trim()
          : undefined,
    };
    return accumulator;
  }, {});

  return {
    name,
    desc,
    trigger:
      typeof input?.trigger === "string" && input.trigger.trim()
        ? input.trigger.trim()
        : fallbackName,
    aliases: Array.isArray(input?.aliases)
      ? input!.aliases
          .filter((a): a is string => typeof a === "string" && !!a.trim())
          .map((a) => a.trim())
      : typeof input?.aliases === "string" && (input.aliases as string).trim()
        ? (input.aliases as string)
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : [],
    response:
      typeof input?.response === "string"
        ? input.response
        : "WXATA summoned successfully.",
    target:
      typeof input?.target === "string" && input.target.trim()
        ? input.target.trim()
        : "self",
    code:
      typeof input?.code === "string" && input.code.trim()
        ? input.code.trim()
        : undefined,
    defaultArgument,
    arguments: Object.keys(argumentsMap).length ? argumentsMap : undefined,
  };
}

function sanitizeBotWelcome(
  input: Partial<BotWelcome> | undefined,
): BotWelcome {
  return {
    enabled: typeof input?.enabled === "boolean" ? input.enabled : true,
    text:
      typeof input?.text === "string" && input.text.trim()
        ? input.text
        : DEFAULT_BOT_INFO.welcome.text,
  };
}

function sanitizeBotRoot(input: Partial<BotRoot> | undefined): BotRoot {
  return {
    target:
      typeof input?.target === "string" && input.target.trim()
        ? input.target.trim()
        : "self",
  };
}

function sanitizePermissions(
  input: Partial<BotPermissions> | undefined,
): BotPermissions {
  const chats = Array.isArray(input?.chats)
    ? input!.chats
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && !!entry.trim(),
        )
        .map((entry) => entry.trim())
    : [];

  const numbers = Array.isArray(input?.numbers)
    ? input!.numbers
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && !!entry.trim(),
        )
        .map((entry) => entry.replace(/\D/g, ""))
        .filter((entry) => !!entry)
    : [];

  return {
    allowAll: typeof input?.allowAll === "boolean" ? input.allowAll : false,
    chats: Array.from(new Set(chats)),
    numbers: Array.from(new Set(numbers)),
  };
}

function migrateLegacyBotInfo(
  input: Record<string, unknown>,
): Partial<BotInfo> {
  const defaultSummoner: BotScript = {
    name: "summoner",
    desc: "Send summon response to root or current chat",
    trigger: "summon",
    response: "WXATA summoned successfully.",
    target: "self",
  };

  if (
    typeof input.summoner === "string" ||
    typeof input.summonResponse === "string" ||
    typeof input.sudoNumber === "string"
  ) {
    return {
      prefix:
        typeof input.prefix === "string"
          ? input.prefix
          : DEFAULT_BOT_INFO.prefix,
      scripts: {
        summoner: {
          name: "summoner",
          desc: "Send summon response to root or current chat",
          trigger:
            typeof input.summoner === "string"
              ? input.summoner
              : defaultSummoner.trigger,
          response:
            typeof input.summonResponse === "string"
              ? input.summonResponse
              : defaultSummoner.response,
          target:
            typeof input.sudoNumber === "string"
              ? input.sudoNumber
              : defaultSummoner.target,
        },
      },
      root: {
        target:
          typeof input.sudoNumber === "string" ? input.sudoNumber : "self",
      },
    };
  }

  return {};
}

function sanitizeBotInfo(
  input: Partial<BotInfo> & Record<string, unknown>,
): BotInfo {
  const prefix =
    typeof input.prefix === "string" && input.prefix.trim()
      ? input.prefix.trim()
      : DEFAULT_BOT_INFO.prefix;
  const migrated = migrateLegacyBotInfo(input);
  const scriptsInput =
    (input.scripts && typeof input.scripts === "object"
      ? input.scripts
      : migrated.scripts) ?? DEFAULT_BOT_INFO.scripts;
  const rootInput =
    input.root && typeof input.root === "object" ? input.root : migrated.root;
  const welcomeInput =
    input.welcome && typeof input.welcome === "object"
      ? input.welcome
      : undefined;
  const permissionsInput =
    input.permissions && typeof input.permissions === "object"
      ? input.permissions
      : undefined;

  const scripts = Object.entries(
    scriptsInput as Record<string, Partial<BotScript>>,
  ).reduce<Record<string, BotScript>>((accumulator, [name, script]) => {
    const normalizedName = name.trim();
    if (normalizedName) {
      // For system scripts defined in DEFAULT_BOT_INFO, always backfill missing code/aliases
      // from the default. This ensures a stale botinfo.json on disk (e.g. Docker volume)
      // always gets the latest script logic without requiring a manual file edit.
      const defaultScript = DEFAULT_BOT_INFO.scripts[normalizedName];
      const merged: Partial<BotScript> = defaultScript
        ? {
            ...script,
            // Always use the latest code from DEFAULT_BOT_INFO for system scripts.
            // This ensures stale or broken code on the volume is always overwritten.
            code: defaultScript.code,
            aliases:
              script.aliases && script.aliases.length > 0
                ? script.aliases
                : defaultScript.aliases,
            type: script.type ?? defaultScript.type,
          }
        : script;
      accumulator[normalizedName] = sanitizeBotScript(merged, normalizedName);
    }
    return accumulator;
  }, {});

  if (!Object.keys(scripts).length) {
    scripts.summoner = sanitizeBotScript(
      DEFAULT_BOT_INFO.scripts.summoner,
      "summoner",
    );
  }

  // Ensure all default system scripts are present — add any that are missing entirely
  for (const [key, defaultScript] of Object.entries(DEFAULT_BOT_INFO.scripts)) {
    if (!scripts[key]) {
      scripts[key] = sanitizeBotScript(defaultScript, key);
    }
  }

  return {
    prefix,
    scripts,
    root: sanitizeBotRoot(rootInput as Partial<BotRoot> | undefined),
    welcome: sanitizeBotWelcome(
      welcomeInput as Partial<BotWelcome> | undefined,
    ),
    permissions: sanitizePermissions(
      permissionsInput as Partial<BotPermissions> | undefined,
    ),
  };
}

function buildMenuResponse(botInfo: BotInfo): string {
  const lines: string[] = [];
  lines.push("== WXATA SCRIPT MENU ==");
  lines.push("");
  lines.push("Highlights:");
  lines.push(`- Prefix: ${botInfo.prefix}`);
  lines.push("- Routing args (all scripts): self | +countrycodeNumber");
  lines.push(
    `- Permissions: all=${botInfo.permissions.allowAll} chats=${botInfo.permissions.chats.length} numbers=${botInfo.permissions.numbers.length}`,
  );
  lines.push("");

  for (const [key, script] of Object.entries(botInfo.scripts)) {
    const baseCommand = `${botInfo.prefix}${script.trigger}`;
    const argumentNames = Object.keys(script.arguments ?? {});
    const argsSuffix = argumentNames.length
      ? ` [${argumentNames.join(" | ")}]`
      : "";
    const aliasesSuffix = script.aliases?.length
      ? ` (aliases: ${script.aliases.join(", ")})`
      : "";
    const defaultArgSuffix = script.defaultArgument
      ? ` (default: ${script.defaultArgument})`
      : "";
    lines.push(`> ${script.name || key}${aliasesSuffix}`);
    lines.push(`  command : ${baseCommand}${argsSuffix}${defaultArgSuffix}`);
    lines.push(`  desc    : ${script.desc}`);
    if (key === "perm") {
      lines.push(
        `  grant   : ${botInfo.prefix}${script.trigger} chat | all | +countrycodeNumber`,
      );
      lines.push(
        `  revoke  : ${botInfo.prefix}${script.trigger} revoke chat | all | +countrycodeNumber`,
      );
    }
    lines.push("");
  }

  lines.push("Use: <prefix><trigger> [arg]");
  return lines.join("\n");
}

async function readBotInfo(): Promise<BotInfo> {
  try {
    const raw = await fs.readFile(BOT_INFO_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return sanitizeBotInfo(parsed);
  } catch {
    await fs.writeFile(
      BOT_INFO_PATH,
      JSON.stringify(DEFAULT_BOT_INFO, null, 2),
      "utf-8",
    );
    return DEFAULT_BOT_INFO;
  }
}

async function updateBotInfo(patch: Partial<BotInfo>): Promise<BotInfo> {
  const current = await readBotInfo();
  const merged = sanitizeBotInfo({ ...current, ...patch });
  await fs.writeFile(BOT_INFO_PATH, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

function resolveTargetJid(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
  target: string,
): string | null {
  const normalizedTarget = target.trim().toLowerCase();

  if (
    normalizedTarget === "self" ||
    normalizedTarget === "root" ||
    normalizedTarget === "me" ||
    normalizedTarget === "myself"
  ) {
    const selfJid = resolveSelfJid(sock);
    return selfJid;
  }

  if (
    normalizedTarget === "chat" ||
    normalizedTarget === "here" ||
    normalizedTarget === "current"
  ) {
    return null;
  }

  if (normalizedTarget !== "self") {
    const customNumber = target.replace(/\D/g, "");
    if (customNumber) {
      return `${customNumber}@s.whatsapp.net`;
    }
  }

  return resolveSelfJid(sock);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveSelfJid(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
): string | null {
  const directId = sock.user?.id;
  const normalizedDirectId = normalizeWhatsAppJid(directId);
  if (normalizedDirectId) {
    return normalizedDirectId;
  }

  const fallbackUser = (
    sock as typeof sock & {
      authState?: { creds?: { me?: { id?: string; jid?: string } } };
    }
  ).authState?.creds?.me;

  const fallbackId = fallbackUser?.jid ?? fallbackUser?.id;
  const normalizedFallbackId = normalizeWhatsAppJid(fallbackId);
  if (normalizedFallbackId) {
    return normalizedFallbackId;
  }

  return null;
}

function normalizeWhatsAppJid(value: string | undefined | null): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmedValue = value.trim();

  // LID JIDs (@lid) are WhatsApp's linked device IDs — pass through as-is,
  // they are resolved to real numbers separately via resolveLidToNumber
  if (trimmedValue.endsWith("@lid")) {
    return trimmedValue;
  }

  if (trimmedValue.includes("@s.whatsapp.net")) {
    const baseNumber = trimmedValue.split(":")[0]?.replace(/\D/g, "");
    return baseNumber ? `${baseNumber}@s.whatsapp.net` : trimmedValue;
  }

  if (trimmedValue.endsWith("@g.us")) {
    return trimmedValue;
  }

  const number = trimmedValue.replace(/\D/g, "");
  return number ? `${number}@s.whatsapp.net` : null;
}

/**
 * Resolve a @lid JID to a real @s.whatsapp.net JID using the auth_info lid-mapping files.
 * Files are named lid-mapping-{LID}_reverse.json and contain the phone number as a plain string.
 * Returns null if no mapping found.
 */
function resolveLidToNumber(lidJid: string): string | null {
  if (!lidJid.endsWith("@lid")) return null;
  try {
    const lidId = lidJid.replace("@lid", "");
    const fsSync = require("fs");
    // Primary: reverse mapping file named by LID → contains phone number
    const reversePath = path.resolve(
      __dirname,
      "auth_info",
      `lid-mapping-${lidId}_reverse.json`,
    );
    if (fsSync.existsSync(reversePath)) {
      const raw = fsSync
        .readFileSync(reversePath, "utf-8")
        .trim()
        .replace(/^"|"$/g, "");
      if (raw && /^\d+$/.test(raw)) return `${raw}@s.whatsapp.net`;
    }
    // Fallback: scan non-reverse files whose content matches this LID
    const dir = path.resolve(__dirname, "auth_info");
    const files = fsSync.readdirSync(dir) as string[];
    for (const file of files) {
      if (!file.startsWith("lid-mapping-") || file.endsWith("_reverse.json"))
        continue;
      const content = fsSync
        .readFileSync(path.join(dir, file), "utf-8")
        .trim()
        .replace(/^"|"$/g, "");
      if (content === lidId) {
        // filename is lid-mapping-{PHONENUMBER}.json
        const phone = file.replace("lid-mapping-", "").replace(".json", "");
        if (/^\d+$/.test(phone)) return `${phone}@s.whatsapp.net`;
      }
    }
  } catch {
    // mapping not found or unreadable
  }
  return null;
}

/**
 * Resolve a remoteJid that may be a @lid to a usable JID for sending messages.
 * Always returns a non-null value — falls back to the original JID if resolution fails,
 * since Baileys can often send to @lid JIDs directly.
 */
function resolveReplyJid(remoteJid: string | null | undefined): string | null {
  if (!remoteJid) return null;
  if (remoteJid.endsWith("@lid")) {
    // Try to resolve to real number, but fall back to @lid — Baileys handles it
    return resolveLidToNumber(remoteJid) ?? remoteJid;
  }
  return remoteJid;
}

function normalizePermissionChatId(
  jid: string | undefined | null,
): string | null {
  if (typeof jid !== "string" || !jid.trim()) {
    return null;
  }

  const trimmed = jid.trim();
  if (trimmed.endsWith("@g.us")) {
    return trimmed;
  }

  // LID JIDs are not valid chat permission targets — resolve to real number
  if (trimmed.endsWith("@lid")) {
    return resolveLidToNumber(trimmed);
  }

  return normalizeWhatsAppJid(trimmed);
}

function extractSenderNumber(msg: {
  key?: { participant?: string | null; remoteJid?: string | null };
}): string | null {
  // participant can be empty string — treat same as null
  const raw = (msg.key?.participant || msg.key?.remoteJid) ?? undefined;
  if (!raw) return null;

  // If it's a LID, try to resolve to real number first
  if (raw.endsWith("@lid")) {
    const resolved = resolveLidToNumber(raw);
    if (resolved) return resolved.split("@")[0]?.replace(/\D/g, "") || null;
    // Can't resolve LID — extract the numeric part as fallback
    return raw.replace("@lid", "").replace(/\D/g, "") || null;
  }

  const senderJid = normalizeWhatsAppJid(raw);
  if (!senderJid) return null;
  return senderJid.split("@")[0]?.replace(/\D/g, "") || null;
}

function isCommandPermitted(
  botInfo: BotInfo,
  msg: {
    key?: {
      remoteJid?: string | null;
      participant?: string | null;
      fromMe?: boolean | null;
    };
  },
  sock?: any,
): boolean {
  if (botInfo.permissions.allowAll) {
    return true;
  }

  const remoteJid = msg.key?.remoteJid ?? undefined;

  // Linked Device handling: if it's from us, check if the sender LID matches our LID
  if (msg.key?.fromMe && sock?.user?.lid && remoteJid === sock.user.lid) {
    return true;
  }

  const chatId = normalizePermissionChatId(remoteJid);
  const senderNumber = extractSenderNumber(msg);

  const chatAllowed = !!chatId && botInfo.permissions.chats.includes(chatId);
  const numberAllowed =
    !!senderNumber && botInfo.permissions.numbers.includes(senderNumber);

  // Extra: if remoteJid is a @lid (DM from linked device), resolve it and check numbers
  const lidNumber = remoteJid?.endsWith("@lid")
    ? (resolveLidToNumber(remoteJid)?.split("@")[0]?.replace(/\D/g, "") ?? null)
    : null;
  const lidAllowed =
    !!lidNumber && botInfo.permissions.numbers.includes(lidNumber);

  return chatAllowed || numberAllowed || lidAllowed;
}

function applyPermissionMutation(
  botInfo: BotInfo,
  mode: "grant" | "revoke",
  targetArg: string | undefined,
  remoteJid: string | undefined,
): BotPermissions | null {
  if (!targetArg) {
    return null;
  }

  const normalizedArg = targetArg.trim().toLowerCase();
  const next: BotPermissions = {
    allowAll: botInfo.permissions.allowAll,
    chats: [...botInfo.permissions.chats],
    numbers: [...botInfo.permissions.numbers],
  };

  if (normalizedArg === "all") {
    next.allowAll = mode === "grant";
    return sanitizePermissions(next);
  }

  if (normalizedArg === "chat") {
    const chatId = normalizePermissionChatId(remoteJid ?? undefined);
    if (!chatId) {
      return null;
    }
    if (mode === "grant") {
      next.chats.push(chatId);
    } else {
      next.chats = next.chats.filter((entry) => entry !== chatId);
    }
    return sanitizePermissions(next);
  }

  if (/^\+?\d{7,20}$/.test(normalizedArg)) {
    const normalizedNumber = normalizedArg.replace(/\D/g, "");
    if (mode === "grant") {
      next.numbers.push(normalizedNumber);
    } else {
      next.numbers = next.numbers.filter((entry) => entry !== normalizedNumber);
    }
    return sanitizePermissions(next);
  }

  return null;
}

function parsePermArgs(
  primaryArg: string | undefined,
  secondaryArg: string | undefined,
): {
  mode: "grant" | "revoke";
  targetArg: string | undefined;
} {
  const normalizedPrimary = primaryArg?.trim().toLowerCase();
  if (
    normalizedPrimary &&
    ["revoke", "remove", "rm", "del", "deny", "block"].includes(
      normalizedPrimary,
    )
  ) {
    return { mode: "revoke", targetArg: secondaryArg };
  }
  // Explicit grant keyword — shift target to secondaryArg
  if (
    normalizedPrimary &&
    ["grant", "add", "allow"].includes(normalizedPrimary)
  ) {
    return { mode: "grant", targetArg: secondaryArg };
  }
  return { mode: "grant", targetArg: primaryArg };
}

type OutboundMessageRecord = {
  jid: string;
  text: string;
  timestamp: number;
};

const outboundMessageCache: OutboundMessageRecord[] = [];

function rememberOutboundMessage(jid: string, text: string) {
  outboundMessageCache.push({
    jid,
    text: text.trim().toLowerCase(),
    timestamp: Date.now(),
  });
}

function wasRecentlySentByBot(
  jid: string | undefined,
  text: string | undefined,
): boolean {
  if (!jid || !text) {
    return false;
  }

  const normalizedText = text.trim().toLowerCase();
  const now = Date.now();

  while (
    outboundMessageCache.length > 0 &&
    now - outboundMessageCache[0]!.timestamp > OUTBOUND_MESSAGE_TTL_MS
  ) {
    outboundMessageCache.shift();
  }

  return outboundMessageCache.some(
    (entry) => entry.jid === jid && entry.text === normalizedText,
  );
}

async function sendTrackedMessage(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
  jid: string,
  text: string,
) {
  rememberOutboundMessage(jid, text);
  await sock.sendMessage(jid, { text });
}

function extractMessageText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  const content = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    audioMessage?: { caption?: string };
    documentMessage?: { caption?: string; fileName?: string };
    stickerMessage?: { isAnimated?: boolean };
    ephemeralMessage?: { message?: unknown };
    viewOnceMessage?: { message?: unknown };
    viewOnceMessageV2?: { message?: unknown };
    viewOnceMessageV2Extension?: { message?: unknown };
    documentWithCaptionMessage?: { message?: unknown };
    buttonsResponseMessage?: { selectedDisplayText?: string };
    listResponseMessage?: { title?: string };
    templateButtonReplyMessage?: { selectedDisplayText?: string };
    interactiveResponseMessage?: {
      nativeFlowResponseMessage?: { paramsJson?: string };
    };
  };

  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.audioMessage?.caption ??
    content.documentMessage?.caption ??
    content.documentMessage?.fileName ??
    content.buttonsResponseMessage?.selectedDisplayText ??
    content.listResponseMessage?.title ??
    content.templateButtonReplyMessage?.selectedDisplayText ??
    extractMessageText(content.ephemeralMessage?.message) ??
    extractMessageText(content.viewOnceMessage?.message) ??
    extractMessageText(content.viewOnceMessageV2?.message) ??
    extractMessageText(content.viewOnceMessageV2Extension?.message) ??
    extractMessageText(content.documentWithCaptionMessage?.message)
  );
}

function senderMatchesRoot(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
  msg: {
    key?: {
      fromMe?: boolean | null;
      remoteJid?: string | null;
      participant?: string | null;
    };
  },
  rootTarget: string,
): boolean {
  const normalizedRootTarget = rootTarget.trim().toLowerCase();
  const isSelfRoot = ["self", "root", "me", "myself"].includes(
    normalizedRootTarget,
  );

  // fromMe=true always means it's us.
  // On linked devices, remoteJid may be our @lid.
  if (msg.key?.fromMe) {
    if (isSelfRoot) return true;

    // Check if our own LID matches the sender if we're not using 'self'
    if (sock.user?.lid && msg.key.remoteJid === sock.user.lid) return true;
  }

  // participant can be empty string — use || not ??
  const rawSender = (msg.key?.participant || msg.key?.remoteJid) ?? undefined;

  // If sender is a @lid, resolve to real number for comparison
  const senderJid = rawSender?.endsWith("@lid")
    ? (resolveLidToNumber(rawSender) ?? normalizeWhatsAppJid(rawSender))
    : normalizeWhatsAppJid(rawSender);

  if (!senderJid) {
    return false;
  }

  const rootJid = resolveTargetJid(sock, rootTarget);
  if (!rootJid) {
    return false;
  }

  const senderNumber = senderJid.split("@")[0]?.replace(/\D/g, "");
  const rootNumber = rootJid.split("@")[0]?.replace(/\D/g, "");

  return !!senderNumber && !!rootNumber && senderNumber === rootNumber;
}

function resolveScriptTarget(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
  botInfo: BotInfo,
  script: BotScript,
  argumentName: string | undefined,
  remoteJid: string | undefined,
): string | null {
  const normalizedArgumentName = argumentName?.trim().toLowerCase();

  const globalTargetOverride = resolveGlobalTargetOverride(
    sock,
    botInfo,
    normalizedArgumentName,
  );
  if (globalTargetOverride !== undefined) {
    return globalTargetOverride;
  }

  const fallbackArgument =
    script.defaultArgument?.trim().toLowerCase() || "self";
  const selectedArgumentName = normalizedArgumentName || fallbackArgument;
  const argumentConfig = script.arguments?.[selectedArgumentName];

  const selectedTarget = argumentConfig?.target ?? script.target;

  if (
    selectedTarget.trim().toLowerCase() === "chat" ||
    selectedTarget.trim().toLowerCase() === "here" ||
    selectedTarget.trim().toLowerCase() === "current"
  ) {
    return remoteJid ?? null;
  }

  return resolveTargetJid(sock, selectedTarget);
}

function resolveGlobalTargetOverride(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
  botInfo: BotInfo,
  argumentName: string | undefined,
): string | null | undefined {
  if (!argumentName) {
    return undefined;
  }

  if (["self", "root", "me", "myself"].includes(argumentName)) {
    return resolveTargetJid(sock, botInfo.root.target);
  }

  if (/^\+?\d{7,20}$/.test(argumentName)) {
    const number = argumentName.replace(/\D/g, "");
    return number ? `${number}@s.whatsapp.net` : null;
  }

  return undefined;
}

function resolveScriptResponse(
  script: BotScript,
  argumentName: string | undefined,
): string {
  const normalizedArgumentName = argumentName?.trim().toLowerCase();
  const fallbackArgument =
    script.defaultArgument?.trim().toLowerCase() || "self";
  const selectedArgumentName = normalizedArgumentName || fallbackArgument;
  const argumentConfig = script.arguments?.[selectedArgumentName];

  return argumentConfig?.response?.trim() || script.response;
}

function attachMessageHandler(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
  onMessage?: () => void,
) {
  sock.ev.on("messaging-history.set", async ({ messages }) => {
    if (messages && messages.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      const cutoff = now - 24 * 60 * 60; // only cache last 24h
      let count = 0;

      for (const msg of messages) {
        // Skip status broadcasts — no point caching them
        if (msg?.key?.remoteJid === "status@broadcast") continue;

        // Extract timestamp, handling both number and Long types
        const ts = msg.messageTimestamp
          ? typeof msg.messageTimestamp === "number"
            ? msg.messageTimestamp
            : (msg.messageTimestamp as any).low
          : 0;

        if (msg?.key?.id && ts >= cutoff) {
          storeMessage(msg, ts * 1000);
          count++;
        }
      }
      dashboard.log(
        "INFO",
        `Cached ${count} recent messages for anti-delete (skipped ${messages.length - count} old/status)`,
      );
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    for (const msg of m.messages) {
      // Error boundary: a single malformed message must never crash the entire batch
      try {
        // Skip status broadcasts entirely — they flood the buffer with undecryptable
        // group-cipher messages and cause "Buffer timeout reached" stalls.
        if (msg?.key?.remoteJid === "status@broadcast") continue;

        // Reset watchdog on every real message received
        onMessage?.();

        // Always cache every message for anti-delete, regardless of type
        if (msg?.key?.id) storeMessage(msg);

        if (!msg || (m.type !== "notify" && m.type !== "append")) {
          continue;
        }

        const remoteJid = msg.key?.remoteJid;
        const text = extractMessageText(msg.message);
        const selfJid = resolveSelfJid(sock);
        const isSelfChat =
          typeof remoteJid === "string" &&
          typeof selfJid === "string" &&
          remoteJid === selfJid;
        const isBotEcho =
          msg.key?.fromMe &&
          wasRecentlySentByBot(remoteJid ?? undefined, text ?? undefined);
        const botInfo = await readBotInfo();
        const isRootSender = senderMatchesRoot(sock, msg, botInfo.root.target);
        const isCommandPermittedByList = isCommandPermitted(botInfo, msg, sock);
        const hasPermission = isRootSender || isCommandPermittedByList;

        if (text && text.startsWith(botInfo.prefix)) {
          dashboard.log(
            "DEBUG",
            `COMMAND_CHECK text="${text.trim()}" isRoot=${isRootSender} isPermitted=${isCommandPermittedByList} fromMe=${msg.key?.fromMe}`,
          );
        }

        const participant = msg.key?.participant ?? "-";
        const textPreview = (text ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
        dashboard.log(
          "DEBUG",
          `INBOUND type=${m.type} fromMe=${String(msg.key?.fromMe)} jid=${remoteJid ?? "-"} participant=${participant} text=${textPreview || "<none>"}`,
        );

        // Drop outbound messages from other devices that aren't commands directed at us.
        // Only skip if we're confident this is a non-self chat AND we can confirm the sender
        // is not root. If selfJid is unresolvable, let the message through so commands work.
        if (selfJid && !isRootSender && msg.key?.fromMe && !isSelfChat) {
          continue;
        }

        if (isBotEcho) {
          continue;
        }

        if (
          remoteJid?.endsWith("@broadcast") &&
          botInfo.scripts.antibc &&
          !msg.key?.fromMe
        ) {
          try {
            const fs = require("fs");
            const configPath = path.resolve(DATA_DIR, "antibc.json");
            let cfgEnabled = false;
            let cfgMsg = "remove me from broadcast";
            if (fs.existsSync(configPath)) {
              try {
                const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
                if (typeof parsed.enabled === "boolean")
                  cfgEnabled = parsed.enabled;
                if (typeof parsed.message === "string") cfgMsg = parsed.message;
              } catch (e) {}
            }
            if (cfgEnabled && msg.key?.participant) {
              await sendTrackedMessage(sock, msg.key.participant, cfgMsg);
              dashboard.log(
                "SUCCESS",
                `Anti-broadcast replied to ${msg.key.participant}`,
              );
            }
          } catch (e) {}
        }

        if (text) {
          const normalizedText = text.trim().toLowerCase();

          for (const [scriptName, script] of Object.entries(botInfo.scripts)) {
            const prefixPattern = escapeRegex(botInfo.prefix.trim());

            // Generate list of all possible triggers (main trigger + aliases)
            const allTriggers = [script.trigger, ...(script.aliases || [])];
            let triggerMatch = null;
            let argumentName: string | undefined = undefined;
            let matchedTrigger = "";

            for (const trig of allTriggers) {
              const triggerPattern = escapeRegex(trig.trim());
              // Capture everything after the trigger as the argument (not just one word)
              const triggerRegex = new RegExp(
                `^${prefixPattern}\\s*${triggerPattern}(?:\\s+(.+))?$`,
                "i",
              );
              const m = normalizedText.match(triggerRegex);
              if (m) {
                triggerMatch = m;
                argumentName = m[1];
                matchedTrigger = triggerPattern;
                break;
              }
            }

            if (triggerMatch) {
              dashboard.log(
                "DEBUG",
                `Match found: script="${scriptName}" trigger="${matchedTrigger}" args="${argumentName || "none"}"`,
              );

              if (!hasPermission) {
                dashboard.log(
                  "WARN",
                  `Blocked unpermitted command "${scriptName}" from ${remoteJid}`,
                );
                break;
              }

              if (scriptName === "perm") {
                if (!isRootSender) {
                  const replyJid = resolveReplyJid(remoteJid);
                  if (replyJid)
                    await sendTrackedMessage(
                      sock,
                      replyJid,
                      "Permission denied. Root only.",
                    );
                  break;
                }

                const permArgRegex = new RegExp(
                  `^${prefixPattern}\\s*${matchedTrigger}(?:\\s+(\\S+))?(?:\\s+(\\S+))?$`,
                  "i",
                );
                const permArgMatch = normalizedText.match(permArgRegex);
                const primaryArg = permArgMatch?.[1];
                const secondaryArg = permArgMatch?.[2];
                const parsedPermArgs = parsePermArgs(primaryArg, secondaryArg);

                const nextPermissions = applyPermissionMutation(
                  botInfo,
                  parsedPermArgs.mode,
                  parsedPermArgs.targetArg,
                  remoteJid ?? undefined,
                );
                const replyJid = resolveReplyJid(remoteJid);
                if (!nextPermissions) {
                  if (replyJid) {
                    await sendTrackedMessage(
                      sock,
                      replyJid,
                      `Usage:\n${botInfo.prefix}${script.trigger} [grant|revoke] chat | all | +countrycodeNumber\n\nExamples:\n${botInfo.prefix}perm chat\n${botInfo.prefix}perm grant +2347041029093\n${botInfo.prefix}perm revoke chat`,
                    );
                  }
                  break;
                }

                const updated = await updateBotInfo({
                  permissions: nextPermissions,
                });
                const summary = `✅ Permissions ${parsedPermArgs.mode} complete.\nallowAll=${updated.permissions.allowAll}\nchats=${updated.permissions.chats.length}\nnumbers=${updated.permissions.numbers.length}`;
                if (replyJid) await sendTrackedMessage(sock, replyJid, summary);
                dashboard.log(
                  "SUCCESS",
                  `Permission ${parsedPermArgs.mode} applied by ${remoteJid}`,
                );
                break;
              }

              if (script.code && script.code.trim()) {
                try {
                  const AsyncFunction = Object.getPrototypeOf(
                    async function () {},
                  ).constructor;
                  const executor = new AsyncFunction(
                    "sock",
                    "msg",
                    "botInfo",
                    "remoteJid",
                    "argumentName",
                    "sendTrackedMessage",
                    "dashboard",
                    "require",
                    "__rootdir",
                    script.code,
                  );
                  // Pass resolved JID so scripts can reply even when remoteJid is a @lid
                  const execJid = resolveReplyJid(remoteJid) ?? remoteJid;
                  // __rootdir = data directory (persistent disk on Render, workspace root locally)
                  const __rootdir = DATA_DIR;
                  await executor(
                    sock,
                    msg,
                    botInfo,
                    execJid,
                    argumentName,
                    sendTrackedMessage,
                    dashboard,
                    require,
                    __rootdir,
                  );
                  dashboard.log(
                    "SUCCESS",
                    `${scriptName} JS executed by ${remoteJid}`,
                  );
                } catch (err: any) {
                  dashboard.log(
                    "ERROR",
                    `JS Extension Error (${scriptName}): ${err.message}`,
                  );
                  const errReplyJid = resolveReplyJid(remoteJid);
                  if (errReplyJid && hasPermission) {
                    await sendTrackedMessage(
                      sock,
                      errReplyJid,
                      `[Extension Error] ${scriptName}:\n${err.message}`,
                    );
                  }
                }
                break;
              }

              const targetJid = resolveScriptTarget(
                sock,
                botInfo,
                script,
                argumentName,
                resolveReplyJid(remoteJid) ?? remoteJid ?? undefined,
              );
              if (targetJid) {
                const responseText =
                  scriptName === "menu"
                    ? buildMenuResponse(botInfo)
                    : resolveScriptResponse(script, argumentName);
                await sendTrackedMessage(sock, targetJid, responseText);
                dashboard.log(
                  "SUCCESS",
                  `${scriptName} triggered by ${remoteJid}; response sent to ${targetJid}`,
                );
              } else {
                dashboard.log(
                  "ERROR",
                  `${scriptName} triggered but target could not be resolved`,
                );
              }
              if (triggerMatch) break;
            }
            if (triggerMatch) break;
          }
        }

        if (text?.toLowerCase() === "ping" && remoteJid) {
          await sendTrackedMessage(sock, remoteJid, "pong 🟢");
          dashboard.log("SUCCESS", `Auto-reply [pong] sent to ${remoteJid}`);
        }

        const logMsg = `From: ${remoteJid} | Text: ${text ?? "<media>"}`;
        console.log(`[MSG] ${logMsg}`);
        // Only log MSG events that have actual text — media-only messages are too noisy
        if (text) dashboard.log("MSG", logMsg);
      } catch (err: any) {
        // Error boundary: log and continue — one bad message must not crash the batch
        const msgId = (msg as any)?.key?.id ?? "unknown";
        dashboard.log(
          "ERROR",
          `messages.upsert: unhandled error on msg ${msgId}: ${err?.message ?? err}`,
        );
        console.error(`[WXATA] messages.upsert error (msg ${msgId}):`, err);
      }
    }
  });

  sock.ev.on("messages.update", async (messageUpdates) => {
    const fs = require("fs");
    const rPath = require("path");

    for (const update of messageUpdates) {
      // Error boundary: isolate each update so one bad entry can't abort the rest
      try {
        // A revoke/delete sets message to null. messageStubType may be 0, undefined, or absent.
        // The reliable signal is message === null on the update patch.
        const isRevoke = update.update?.message === null;
        if (!isRevoke) continue;

        const targetId = update.key?.id;
        if (!targetId) continue;

        const originalMsg = getMessage(targetId);
        if (!originalMsg) {
          dashboard.log(
            "DEBUG",
            `Anti-delete: message ${targetId} not in DB (too old or never cached)`,
          );
          continue;
        }

        const botInfo = await readBotInfo();
        if (!botInfo.scripts.antidel) continue;

        const cfgPath = rPath.resolve(DATA_DIR, "antidel.json");
        const selfJid = sock.user?.id.split(":")[0] + "@s.whatsapp.net";
        const defaultTarget =
          (botInfo.permissions.numbers[0]
            ? botInfo.permissions.numbers[0] + "@s.whatsapp.net"
            : null) || selfJid;

        let cfg = { enabled: true, target: defaultTarget };
        try {
          if (fs.existsSync(cfgPath)) {
            const parsed = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
            cfg.enabled =
              typeof parsed.enabled === "boolean"
                ? parsed.enabled
                : cfg.enabled;
            if (
              typeof parsed.target === "string" &&
              parsed.target.includes("@")
            )
              cfg.target = parsed.target;
          }
        } catch (e) {}

        if (!cfg.enabled) continue;

        const sender =
          originalMsg.key?.participant ||
          originalMsg.key?.remoteJid ||
          "unknown";
        const chatJid = originalMsg.key?.remoteJid || "unknown";
        dashboard.log(
          "INFO",
          `Anti-delete triggered: msg from ${sender} in ${chatJid}`,
        );

        try {
          // Try forwarding the full message object
          await sock.sendMessage(cfg.target, {
            forward: originalMsg,
            force: true,
          } as any);
          dashboard.log(
            "SUCCESS",
            `Anti-delete: forwarded message from ${sender}`,
          );
        } catch (forwardErr: any) {
          // Forward failed — extract whatever content we can and send as text
          dashboard.log(
            "WARN",
            `Anti-delete forward failed (${forwardErr.message}), falling back to text`,
          );
          try {
            const msgContent = originalMsg.message;
            const text =
              msgContent?.conversation ||
              msgContent?.extendedTextMessage?.text ||
              msgContent?.imageMessage?.caption ||
              msgContent?.videoMessage?.caption ||
              null;

            let fallback = `🗑️ *Deleted Message*\n👤 From: @${sender.split("@")[0]}\n💬 Chat: ${chatJid}\n`;
            if (text) {
              fallback += `\n📝 Content:\n${text}`;
            } else {
              const mediaType = msgContent?.imageMessage
                ? "🖼️ Image"
                : msgContent?.videoMessage
                  ? "🎥 Video"
                  : msgContent?.audioMessage
                    ? "🎵 Audio"
                    : msgContent?.stickerMessage
                      ? "🎭 Sticker"
                      : msgContent?.documentMessage
                        ? "📄 Document"
                        : "❓ Unknown media";
              fallback += `\n📎 Type: ${mediaType} (media not recoverable)`;
            }
            await sock.sendMessage(cfg.target, { text: fallback });
            dashboard.log(
              "SUCCESS",
              `Anti-delete: sent fallback text for ${sender}`,
            );
          } catch (textErr: any) {
            dashboard.log(
              "ERROR",
              `Anti-delete: complete failure — ${textErr.message}`,
            );
          }
        }
      } catch (err: any) {
        // Error boundary: log and continue processing remaining updates
        dashboard.log(
          "ERROR",
          `messages.update: unhandled error on update ${update?.key?.id ?? "unknown"}: ${err?.message ?? err}`,
        );
        console.error("[WXATA] messages.update error:", err);
      }
    }
  });
}

async function sendWelcomeMessage(
  sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>,
) {
  const botInfo = await readBotInfo();
  if (!botInfo.welcome.enabled) {
    return;
  }

  const targetJid = resolveTargetJid(sock, botInfo.root.target);
  if (!targetJid) {
    dashboard.log(
      "ERROR",
      "Welcome message enabled but target could not be resolved",
    );
    return;
  }

  // Interpolate variables in welcome message
  const interpolatedText = botInfo.welcome.text
    .replace(/\\n/g, "\n")
    .replace(/{prefix}/g, botInfo.prefix)
    .replace(/{bot}/g, botInfo.scripts.summoner?.trigger || "bot")
    .replace(/{menu}/g, botInfo.scripts.menu?.trigger || "menu");

  await sendTrackedMessage(sock, targetJid, interpolatedText);
  dashboard.log("SUCCESS", `Welcome message sent to ${targetJid}`);
}

async function ensureConfigFiles(): Promise<void> {
  // DATA_DIR is defined at module level — /data on Render, workspace root locally
  const dir = DATA_DIR;

  // Also seed botinfo.json from example if missing
  try {
    await fs.access(BOT_INFO_PATH);
  } catch {
    const examplePath = path.resolve(__dirname, "..", "botinfo.example.json");
    try {
      const example = await fs.readFile(examplePath, "utf-8");
      await fs.writeFile(BOT_INFO_PATH, example, "utf-8");
      dashboard.log("INFO", "Created botinfo.json from botinfo.example.json");
    } catch {
      await fs.writeFile(
        BOT_INFO_PATH,
        JSON.stringify(DEFAULT_BOT_INFO, null, 2),
        "utf-8",
      );
      dashboard.log("INFO", "Created default botinfo.json");
    }
  }

  const antidelPath = path.resolve(dir, "antidel.json");
  try {
    await fs.access(antidelPath);
  } catch {
    await fs.writeFile(
      antidelPath,
      JSON.stringify({ enabled: true, target: null }, null, 2),
      "utf-8",
    );
    dashboard.log("INFO", "Created default antidel.json");
  }

  const antibcPath = path.resolve(dir, "antibc.json");
  try {
    await fs.access(antibcPath);
  } catch {
    await fs.writeFile(
      antibcPath,
      JSON.stringify(
        { enabled: false, message: "remove me from broadcast" },
        null,
        2,
      ),
      "utf-8",
    );
    dashboard.log("INFO", "Created default antibc.json");
  }

  const warnsPath = path.resolve(dir, "warns.json");
  try {
    await fs.access(warnsPath);
  } catch {
    await fs.writeFile(warnsPath, JSON.stringify({}, null, 2), "utf-8");
    dashboard.log("INFO", "Created default warns.json");
  }

  const varsPath = path.resolve(dir, "vars.json");
  try {
    await fs.access(varsPath);
  } catch {
    await fs.writeFile(varsPath, JSON.stringify({}, null, 2), "utf-8");
    dashboard.log("INFO", "Created default vars.json");
  }
}

async function startBot() {
  await validateLicense();
  dashboard.log("INFO", "Initializing WXATA Backend System...");
  console.log("🚀 Initializing WXATA Backend...");
  await ensureConfigFiles();

  // Load persisted vars (e.g. DB_RETENTION_DAYS set via +vars)
  try {
    const varsPath = path.resolve(DATA_DIR, "vars.json");
    const savedVars = JSON.parse(await fs.readFile(varsPath, "utf-8"));
    if (savedVars.DB_RETENTION_DAYS) {
      setRetentionDays(+savedVars.DB_RETENTION_DAYS);
      dashboard.log(
        "INFO",
        `DB retention loaded: ${savedVars.DB_RETENTION_DAYS} days`,
      );
    }
  } catch {
    /* vars.json missing or empty — use default */
  }

  let connectionManager: WXATAConnection | null = null;
  let hasSentWelcome = false;
  let lastConnectionParams: { method: string; phoneNumber?: string } | null =
    null;

  // ── Watchdog — detect and recover from Baileys buffer stalls ─────────────
  // When Baileys gets stuck processing undecryptable group messages, the
  // message handler queue freezes. The bot appears connected but doesn't
  // respond to commands. We detect this by tracking the last time a message
  // was received and force-reconnecting if it's been too long.
  let lastMessageAt = Date.now();
  const WATCHDOG_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes of silence = stalled

  // Export a function so attachMessageHandler can reset the watchdog
  function resetWatchdog() {
    lastMessageAt = Date.now();
  }

  setInterval(async () => {
    // Only check if we're supposed to be connected
    if (!connectionManager || !lastConnectionParams) return;
    const sock = connectionManager.getSocket();
    if (!sock) return;

    const silentMs = Date.now() - lastMessageAt;
    if (silentMs > WATCHDOG_TIMEOUT_MS) {
      dashboard.log(
        "WARN",
        `Watchdog: No messages for ${Math.round(silentMs / 1000)}s — force reconnecting...`,
      );
      console.log(
        `🔁 Watchdog triggered after ${Math.round(silentMs / 1000)}s silence — reconnecting`,
      );
      lastMessageAt = Date.now(); // Reset before reconnect to avoid loop

      try {
        await connectionManager.destroy();
        connectionManager = new WXATAConnection({
          phoneNumber: lastConnectionParams.phoneNumber,
          usePairingCode: lastConnectionParams.method === "PHONE",
          onQR: (qr) => {
            dashboard.sendQR(qr);
            qrcode.generate(qr, { small: true });
          },
          onPairingCode: (code) => {
            dashboard.sendPairingCode(code);
          },
          onSocketCreated: (sock) => {
            dashboard.setSock(sock);
            attachMessageHandler(sock, resetWatchdog);
          },
          onOpen: () => {
            dashboard.log("SUCCESS", "Watchdog reconnect successful");
          },
          onLogout: () => {
            dashboard.log("WARN", "Session expired during watchdog reconnect");
          },
        });
        await connectionManager.createConnection();
      } catch (err) {
        dashboard.log("ERROR", `Watchdog reconnect failed: ${err}`);
      }
    }
  }, 60_000); // Check every minute

  dashboard.onCommand(async (payload) => {
    try {
      if (payload.command === "START_CONNECTION") {
        const { method, phoneNumber } = payload.data;
        lastConnectionParams = { method, phoneNumber };

        dashboard.log("INFO", `Starting connection via ${method}...`);

        if (connectionManager) {
          await connectionManager.destroy();
        }

        connectionManager = new WXATAConnection({
          phoneNumber,
          usePairingCode: method === "PHONE",
          onQR: (qr) => {
            dashboard.sendQR(qr);
            qrcode.generate(qr, { small: true });
          },
          onPairingCode: (code) => {
            dashboard.sendPairingCode(code);
          },
          onSocketCreated: (sock) => {
            dashboard.setSock(sock);
            attachMessageHandler(sock, resetWatchdog);
          },
          onOpen: () => {
            dashboard.log("SUCCESS", "Bot is now fully operational");

            if (!hasSentWelcome) {
              setTimeout(() => {
                const socketForWelcome = connectionManager?.getSocket();
                if (socketForWelcome) {
                  sendWelcomeMessage(socketForWelcome)
                    .then(() => {
                      hasSentWelcome = true;
                    })
                    .catch((err) => {
                      console.error("Failed to send welcome message", err);
                      dashboard.log("ERROR", "Failed to send welcome message");
                    });
                }
              }, 15000); // Increased timeout to ensure session keys fully propagate to WhatsApp servers before sending
            }
          },
        });

        await connectionManager.createConnection();
      }

      if (payload.command === "GET_BOT_INFO") {
        const botInfo = await readBotInfo();
        dashboard.broadcast({ event: "bot-info", data: botInfo });
      }

      if (payload.command === "UPDATE_BOT_INFO") {
        const updated = await updateBotInfo(payload.data ?? {});
        dashboard.broadcast({ event: "bot-info", data: updated });
        dashboard.log("SUCCESS", "Bot script configuration updated");
      }

      if (payload.command === "QUICK_ACTION") {
        const { action } = payload.data;
        dashboard.log("WARN", `Executing Quick Action: ${action}`);

        switch (action) {
          case "RESTART_BOT":
            dashboard.log("INFO", "Restarting bot process via PM2...");
            if (connectionManager) {
              await connectionManager.destroy();
              connectionManager = null;
            }
            dashboard.setConnectionStatus("DISCONNECTED");
            dashboard.log(
              "SUCCESS",
              "Graceful shutdown complete. PM2 will restart the process.",
            );
            // Exit code 0 → PM2 treats this as a normal exit and restarts automatically.
            // If PM2 is not in use the process simply stops (no infinite loop).
            setTimeout(() => process.exit(0), 500);
            break;
          case "TERMINATE":
            dashboard.log(
              "WARN",
              "Terminating bot process and clearing session...",
            );
            if (connectionManager) {
              await connectionManager.logout(); // This clears auth_info
              await connectionManager.destroy();
              connectionManager = null;
            } else {
              // Fallback if not fully initialized
              const fs = require("fs/promises");
              const AUTH_DIR = fsSync.existsSync("/data")
                ? "/data/auth_info"
                : path.resolve(__dirname, "auth_info");
              await fs
                .rm(AUTH_DIR, { recursive: true, force: true })
                .catch(() => {});
            }
            dashboard.setConnectionStatus("DISCONNECTED");
            dashboard.log(
              "SUCCESS",
              "Session cleared. PM2 will NOT restart (stop_exit_codes: [2]).",
            );
            // Exit code 2 → listed in PM2 stop_exit_codes, so PM2 stops without restarting.
            setTimeout(() => process.exit(2), 500);
            break;
          case "LOGOUT":
            dashboard.log("WARN", "Logging out and clearing session data...");
            if (connectionManager) {
              await connectionManager.logout();
              await connectionManager.destroy();
              connectionManager = null;
            } else {
              // Fallback if not fully initialized
              const fs = require("fs/promises");
              const AUTH_DIR = fsSync.existsSync("/data")
                ? "/data/auth_info"
                : path.resolve(__dirname, "auth_info");
              await fs
                .rm(AUTH_DIR, { recursive: true, force: true })
                .catch(() => {});
            }
            dashboard.setConnectionStatus("DISCONNECTED");
            dashboard.log(
              "SUCCESS",
              "Session cleared. System ready for new pairing.",
            );
            break;
          case "EXPORT_DATA":
            dashboard.log("INFO", "Exporting session logs...");
            break;
        }
      }
    } catch (err) {
      console.error("Dashboard command failed", err);
      dashboard.log("ERROR", "Failed to execute dashboard command");
      dashboard.setConnectionStatus("DISCONNECTED");
    }
  });

  dashboard.setConnectionStatus("DISCONNECTED");
  dashboard.log(
    "INFO",
    "Backend ready. Waiting for START_CONNECTION command from dashboard.",
  );
}

startBot().catch((err) => {
  console.error("CRITICAL: Failed to start WXATA system", err);
});

// ── Global error handlers — ensure PM2 always gets a clean exit code ─────────
// Without these, an unhandled rejection can leave the process in a zombie state
// where it appears running but is actually broken (no reconnects, no commands).
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "[WXATA] Unhandled Promise Rejection at:",
    promise,
    "reason:",
    reason,
  );
  // Do NOT exit — let the bot keep running. Baileys handles its own reconnects.
  // Only exit if the rejection is truly fatal (e.g. OOM).
});

process.on("uncaughtException", (err) => {
  console.error("[WXATA] Uncaught Exception:", err);
  // Exit with code 1 so PM2 restarts the process cleanly.
  // This is safer than continuing with an unknown corrupted state.
  setTimeout(() => process.exit(1), 500);
});

// Graceful shutdown on SIGTERM (Docker stop, PM2 graceful reload)
process.on("SIGTERM", () => {
  console.log("[WXATA] SIGTERM received — shutting down gracefully...");
  setTimeout(() => process.exit(0), 1000);
});
