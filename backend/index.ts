import { WXATAConnection } from './connection';
// @ts-ignore
import * as qrcode from 'qrcode-terminal';
import { dashboard } from './DashboardServer';
import fs from 'fs/promises';
import path from 'path';
import { storeMessage, getMessage, pruneOldMessages, getRetentionDays, setRetentionDays, getMessageCount } from './db';

interface BotScript {
  name: string;
  desc: string;
  trigger: string;
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
const DATA_DIR = require('fs').existsSync('/data') ? '/data' : path.resolve(__dirname, '..');
const BOT_INFO_PATH = path.resolve(DATA_DIR, 'botinfo.json');
const OUTBOUND_MESSAGE_TTL_MS = 15_000;
const DEFAULT_BOT_INFO: BotInfo = {
  prefix: '!',
  scripts: {
    menu: {
      name: 'menu',
      desc: 'List all core scripts and their usage',
      trigger: 'menu',
      response: 'Available scripts listed below.',
      target: 'chat'
    },
    perm: {
      name: 'perm',
      desc: 'Grant bot permissions: chat | all | +number',
      trigger: 'perm',
      response: 'Permission updated.',
      target: 'chat'
    },
    summoner: {
      name: 'summoner',
      desc: 'Send summon response to root or current chat',
      trigger: 'summon',
      response: 'WXATA summoned successfully.',
      target: 'self',
      defaultArgument: 'self',
      arguments: {
        here: {
          target: 'chat'
        },
        self: {
          target: 'self'
        }
      }
    },
    extractor: {
      name: 'extractor',
      desc: 'Extract view once message and send to self, here, or number',
      trigger: 'extract',
      response: '',
      target: 'chat',
      code: `const bail = require('@whiskeysockets/baileys');
const extractFrom = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
if (!extractFrom) return sendTrackedMessage(sock, remoteJid, "Please reply to a View Once message.");

let viewOnce = extractFrom.viewOnceMessage?.message || extractFrom.viewOnceMessageV2?.message || extractFrom.viewOnceMessageV2Extension?.message;
if (!viewOnce) return sendTrackedMessage(sock, remoteJid, "The replied message is not a View Once message.");

const mediaMsg = viewOnce.imageMessage || viewOnce.videoMessage || viewOnce.audioMessage;
const mediaType = viewOnce.imageMessage ? 'image' : (viewOnce.videoMessage ? 'video' : 'audio');

if (mediaMsg) {
  const stream = await bail.downloadContentFromMessage(mediaMsg, mediaType);
  let buffer = Buffer.from([]);
  for await(const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
  }
  
  let target = remoteJid; // 'here' default
  if (argumentName === 'self' || argumentName === 'me') {
     target = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  } else if (argumentName && argumentName.match(/^\\d+$/)) {
     target = argumentName + '@s.whatsapp.net';
  }
  
  const payload = {};
  payload[mediaType] = buffer;
  if (mediaMsg.caption) payload.caption = mediaMsg.caption;

  await sock.sendMessage(target, payload);
  if (target !== remoteJid) await sendTrackedMessage(sock, remoteJid, \`Extracted and sent successfully.\`);
}`
    },
    saver: {
      name: 'saver',
      desc: 'Save any status media to your own chat',
      trigger: 'save',
      response: '',
      target: 'chat',
      code: `const bail = require('@whiskeysockets/baileys');
const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
const extractFrom = contextInfo?.quotedMessage;
if (!extractFrom) return sendTrackedMessage(sock, remoteJid, "Please reply to a message.");

const mediaMsg = extractFrom.imageMessage || extractFrom.videoMessage || extractFrom.audioMessage;
const mediaType = extractFrom.imageMessage ? 'image' : (extractFrom.videoMessage ? 'video' : 'audio');

if (mediaMsg) {
  const stream = await bail.downloadContentFromMessage(mediaMsg, mediaType);
  let buffer = Buffer.from([]);
  for await(const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
  }
  
  let target = sock.user.id.split(':')[0] + '@s.whatsapp.net';
  const payload = {};
  payload[mediaType] = buffer;
  if (mediaMsg.caption) payload.caption = mediaMsg.caption;

  await sock.sendMessage(target, payload);
  await sendTrackedMessage(sock, remoteJid, "Media saved to your own chat successfully!");
} else {
  return sendTrackedMessage(sock, remoteJid, "No media found in the quoted message.");
}`
    },
    tagall: {
      name: 'tagall',
      desc: 'Tag all members in a group',
      trigger: 'tagall',
      response: '',
      target: 'chat',
      code: `if (!remoteJid.endsWith('@g.us')) {
  return sendTrackedMessage(sock, remoteJid, "This command can only be used in groups.");
}
const groupMetadata = await sock.groupMetadata(remoteJid);
const participants = groupMetadata.participants;
let text = "✨ Calling all members ✨\\n\\n";
const mentions = [];
for (let mem of participants) {
  text += \`@\${mem.id.split('@')[0]} \`;
  mentions.push(mem.id);
}
await sock.sendMessage(remoteJid, { text, mentions });`
    },
    joke: {
      name: 'joke',
      desc: 'Tells a programming joke',
      trigger: 'joke',
      response: '',
      target: 'chat',
      code: `const jokes = [
  "There are 10 types of people in the world: those who understand binary, and those who don't.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "How many programmers does it take to change a light bulb? None. It's a hardware problem.",
  "A SQL query goes into a bar, walks up to two tables and asks... 'Can I join you?'",
  "To understand what recursion is, you must first understand recursion.",
  "If at first you don't succeed; call it version 1.0",
  "I would love to change the world, but they won't give me the source code."
];
const joke = jokes[Math.floor(Math.random() * jokes.length)];
await sendTrackedMessage(sock, remoteJid, joke);`
    }
  },
  root: {
    target: 'self'
  },
  welcome: {
    enabled: true,
    text: '╔════════════════════════════╗\n║   WELCOME TO WXATA         ║\n║   SYSTEM ONLINE            ║\n╚════════════════════════════╝'
  },
  permissions: {
    allowAll: false,
    chats: [],
    numbers: []
  }
};

function sanitizeBotScript(input: Partial<BotScript> | undefined, fallbackName: string): BotScript {
  const name = typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : fallbackName;
  const desc = typeof input?.desc === 'string' && input.desc.trim() ? input.desc.trim() : `${name} core script`;
  const defaultArgument = typeof input?.defaultArgument === 'string' && input.defaultArgument.trim() ? input.defaultArgument.trim() : 'self';
  const defaultSummonerArguments = {
    here: {
      target: 'chat'
    },
    self: {
      target: 'self'
    }
  };
  const argumentsInput =
    input?.arguments && typeof input.arguments === 'object'
      ? input.arguments
      : input?.trigger === 'summon'
        ? defaultSummonerArguments
        : undefined;

  const argumentsMap = Object.entries(argumentsInput ?? {}).reduce<Record<string, BotScriptArgument>>((accumulator, [name, argument]) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return accumulator;
    }

    accumulator[normalizedName] = {
      target: typeof argument?.target === 'string' && argument.target.trim() ? argument.target.trim() : undefined,
      response: typeof argument?.response === 'string' && argument.response.trim() ? argument.response.trim() : undefined
    };
    return accumulator;
  }, {});

  return {
    name,
    desc,
    trigger: typeof input?.trigger === 'string' && input.trigger.trim() ? input.trigger.trim() : fallbackName,
    response: typeof input?.response === 'string' ? input.response : 'WXATA summoned successfully.',
    target: typeof input?.target === 'string' && input.target.trim() ? input.target.trim() : 'self',
    code: typeof input?.code === 'string' && input.code.trim() ? input.code.trim() : undefined,
    defaultArgument,
    arguments: Object.keys(argumentsMap).length ? argumentsMap : undefined
  };
}

function sanitizeBotWelcome(input: Partial<BotWelcome> | undefined): BotWelcome {
  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : true,
    text: typeof input?.text === 'string' && input.text.trim() ? input.text : DEFAULT_BOT_INFO.welcome.text
  };
}

function sanitizeBotRoot(input: Partial<BotRoot> | undefined): BotRoot {
  return {
    target: typeof input?.target === 'string' && input.target.trim() ? input.target.trim() : 'self'
  };
}

function sanitizePermissions(input: Partial<BotPermissions> | undefined): BotPermissions {
  const chats = Array.isArray(input?.chats)
    ? input!.chats
        .filter((entry): entry is string => typeof entry === 'string' && !!entry.trim())
        .map((entry) => entry.trim())
    : [];

  const numbers = Array.isArray(input?.numbers)
    ? input!.numbers
        .filter((entry): entry is string => typeof entry === 'string' && !!entry.trim())
        .map((entry) => entry.replace(/\D/g, ''))
        .filter((entry) => !!entry)
    : [];

  return {
    allowAll: typeof input?.allowAll === 'boolean' ? input.allowAll : false,
    chats: Array.from(new Set(chats)),
    numbers: Array.from(new Set(numbers))
  };
}

function migrateLegacyBotInfo(input: Record<string, unknown>): Partial<BotInfo> {
  const defaultSummoner: BotScript = {
    name: 'summoner',
    desc: 'Send summon response to root or current chat',
    trigger: 'summon',
    response: 'WXATA summoned successfully.',
    target: 'self'
  };

  if (
    typeof input.summoner === 'string' ||
    typeof input.summonResponse === 'string' ||
    typeof input.sudoNumber === 'string'
  ) {
    return {
      prefix: typeof input.prefix === 'string' ? input.prefix : DEFAULT_BOT_INFO.prefix,
      scripts: {
        summoner: {
          name: 'summoner',
          desc: 'Send summon response to root or current chat',
          trigger: typeof input.summoner === 'string' ? input.summoner : defaultSummoner.trigger,
          response:
            typeof input.summonResponse === 'string'
              ? input.summonResponse
              : defaultSummoner.response,
          target: typeof input.sudoNumber === 'string' ? input.sudoNumber : defaultSummoner.target
        }
      },
      root: {
        target: typeof input.sudoNumber === 'string' ? input.sudoNumber : 'self'
      }
    };
  }

  return {};
}

function sanitizeBotInfo(input: Partial<BotInfo> & Record<string, unknown>): BotInfo {
  const prefix = typeof input.prefix === 'string' && input.prefix.trim() ? input.prefix.trim() : DEFAULT_BOT_INFO.prefix;
  const migrated = migrateLegacyBotInfo(input);
  const scriptsInput =
    (input.scripts && typeof input.scripts === 'object' ? input.scripts : migrated.scripts) ?? DEFAULT_BOT_INFO.scripts;
  const rootInput = input.root && typeof input.root === 'object' ? input.root : migrated.root;
  const welcomeInput = input.welcome && typeof input.welcome === 'object' ? input.welcome : undefined;
  const permissionsInput = input.permissions && typeof input.permissions === 'object' ? input.permissions : undefined;

  const scripts = Object.entries(scriptsInput as Record<string, Partial<BotScript>>).reduce<Record<string, BotScript>>(
    (accumulator, [name, script]) => {
      const normalizedName = name.trim();
      if (normalizedName) {
        accumulator[normalizedName] = sanitizeBotScript(script, normalizedName);
      }
      return accumulator;
    },
    {}
  );

  if (!Object.keys(scripts).length) {
    scripts.summoner = sanitizeBotScript(DEFAULT_BOT_INFO.scripts.summoner, 'summoner');
  }

  if (!scripts.menu) {
    scripts.menu = sanitizeBotScript(DEFAULT_BOT_INFO.scripts.menu, 'menu');
  }

  if (!scripts.perm) {
    scripts.perm = sanitizeBotScript(DEFAULT_BOT_INFO.scripts.perm, 'perm');
  }

  return {
    prefix,
    scripts,
    root: sanitizeBotRoot(rootInput as Partial<BotRoot> | undefined),
    welcome: sanitizeBotWelcome(welcomeInput as Partial<BotWelcome> | undefined),
    permissions: sanitizePermissions(permissionsInput as Partial<BotPermissions> | undefined)
  };
}

function buildMenuResponse(botInfo: BotInfo): string {
  const lines: string[] = [];
  lines.push('== WXATA SCRIPT MENU ==');
  lines.push('');
  lines.push('Highlights:');
  lines.push(`- Prefix: ${botInfo.prefix}`);
  lines.push('- Routing args (all scripts): self | +countrycodeNumber');
  lines.push(`- Permissions: all=${botInfo.permissions.allowAll} chats=${botInfo.permissions.chats.length} numbers=${botInfo.permissions.numbers.length}`);
  lines.push('');

  for (const [key, script] of Object.entries(botInfo.scripts)) {
    const baseCommand = `${botInfo.prefix}${script.trigger}`;
    const argumentNames = Object.keys(script.arguments ?? {});
    const argsSuffix = argumentNames.length ? ` [${argumentNames.join(' | ')}]` : '';
    const defaultArgSuffix = script.defaultArgument ? ` (default: ${script.defaultArgument})` : '';
    lines.push(`> ${script.name || key}`);
    lines.push(`  command : ${baseCommand}${argsSuffix}${defaultArgSuffix}`);
    lines.push(`  desc    : ${script.desc}`);
    if (key === 'perm') {
      lines.push(`  grant   : ${botInfo.prefix}${script.trigger} chat | all | +countrycodeNumber`);
      lines.push(`  revoke  : ${botInfo.prefix}${script.trigger} revoke chat | all | +countrycodeNumber`);
    }
    lines.push('');
  }

  lines.push('Use: <prefix><trigger> [arg]');
  return lines.join('\n');
}

async function readBotInfo(): Promise<BotInfo> {
  try {
    const raw = await fs.readFile(BOT_INFO_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return sanitizeBotInfo(parsed);
  } catch {
    await fs.writeFile(BOT_INFO_PATH, JSON.stringify(DEFAULT_BOT_INFO, null, 2), 'utf-8');
    return DEFAULT_BOT_INFO;
  }
}

async function updateBotInfo(patch: Partial<BotInfo>): Promise<BotInfo> {
  const current = await readBotInfo();
  const merged = sanitizeBotInfo({ ...current, ...patch });
  await fs.writeFile(BOT_INFO_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

function resolveTargetJid(
  sock: Awaited<ReturnType<WXATAConnection['createConnection']>>,
  target: string
): string | null {
  const normalizedTarget = target.trim().toLowerCase();

  if (normalizedTarget === 'self' || normalizedTarget === 'root' || normalizedTarget === 'me' || normalizedTarget === 'myself') {
    const selfJid = resolveSelfJid(sock);
    return selfJid;
  }

  if (normalizedTarget === 'chat' || normalizedTarget === 'here' || normalizedTarget === 'current') {
    return null;
  }

  if (normalizedTarget !== 'self') {
    const customNumber = target.replace(/\D/g, '');
    if (customNumber) {
      return `${customNumber}@s.whatsapp.net`;
    }
  }

  return resolveSelfJid(sock);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveSelfJid(sock: Awaited<ReturnType<WXATAConnection['createConnection']>>): string | null {
  const directId = sock.user?.id;
  const normalizedDirectId = normalizeWhatsAppJid(directId);
  if (normalizedDirectId) {
    return normalizedDirectId;
  }

  const fallbackUser = (sock as typeof sock & {
    authState?: { creds?: { me?: { id?: string; jid?: string } } };
  }).authState?.creds?.me;

  const fallbackId = fallbackUser?.jid ?? fallbackUser?.id;
  const normalizedFallbackId = normalizeWhatsAppJid(fallbackId);
  if (normalizedFallbackId) {
    return normalizedFallbackId;
  }

  return null;
}

function normalizeWhatsAppJid(value: string | undefined | null): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmedValue = value.trim();

  // LID JIDs (@lid) are WhatsApp's linked device IDs — pass through as-is,
  // they are resolved to real numbers separately via resolveLidToNumber
  if (trimmedValue.endsWith('@lid')) {
    return trimmedValue;
  }

  if (trimmedValue.includes('@s.whatsapp.net')) {
    const baseNumber = trimmedValue.split(':')[0]?.replace(/\D/g, '');
    return baseNumber ? `${baseNumber}@s.whatsapp.net` : trimmedValue;
  }

  if (trimmedValue.endsWith('@g.us')) {
    return trimmedValue;
  }

  const number = trimmedValue.replace(/\D/g, '');
  return number ? `${number}@s.whatsapp.net` : null;
}

/**
 * Resolve a @lid JID to a real @s.whatsapp.net JID using the auth_info lid-mapping files.
 * Files are named lid-mapping-{LID}_reverse.json and contain the phone number as a plain string.
 * Returns null if no mapping found.
 */
function resolveLidToNumber(lidJid: string): string | null {
  if (!lidJid.endsWith('@lid')) return null;
  try {
    const lidId = lidJid.replace('@lid', '');
    const fsSync = require('fs');
    // Primary: reverse mapping file named by LID → contains phone number
    const reversePath = path.resolve(__dirname, 'auth_info', `lid-mapping-${lidId}_reverse.json`);
    if (fsSync.existsSync(reversePath)) {
      const raw = fsSync.readFileSync(reversePath, 'utf-8').trim().replace(/^"|"$/g, '');
      if (raw && /^\d+$/.test(raw)) return `${raw}@s.whatsapp.net`;
    }
    // Fallback: scan non-reverse files whose content matches this LID
    const dir = path.resolve(__dirname, 'auth_info');
    const files = fsSync.readdirSync(dir) as string[];
    for (const file of files) {
      if (!file.startsWith('lid-mapping-') || file.endsWith('_reverse.json')) continue;
      const content = fsSync.readFileSync(path.join(dir, file), 'utf-8').trim().replace(/^"|"$/g, '');
      if (content === lidId) {
        // filename is lid-mapping-{PHONENUMBER}.json
        const phone = file.replace('lid-mapping-', '').replace('.json', '');
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
  if (remoteJid.endsWith('@lid')) {
    // Try to resolve to real number, but fall back to @lid — Baileys handles it
    return resolveLidToNumber(remoteJid) ?? remoteJid;
  }
  return remoteJid;
}

function normalizePermissionChatId(jid: string | undefined | null): string | null {
  if (typeof jid !== 'string' || !jid.trim()) {
    return null;
  }

  const trimmed = jid.trim();
  if (trimmed.endsWith('@g.us')) {
    return trimmed;
  }

  // LID JIDs are not valid chat permission targets — resolve to real number
  if (trimmed.endsWith('@lid')) {
    return resolveLidToNumber(trimmed);
  }

  return normalizeWhatsAppJid(trimmed);
}

function extractSenderNumber(msg: { key?: { participant?: string | null; remoteJid?: string | null } }): string | null {
  // participant can be empty string — treat same as null
  const raw = (msg.key?.participant || msg.key?.remoteJid) ?? undefined;
  if (!raw) return null;

  // If it's a LID, try to resolve to real number first
  if (raw.endsWith('@lid')) {
    const resolved = resolveLidToNumber(raw);
    if (resolved) return resolved.split('@')[0]?.replace(/\D/g, '') || null;
    // Can't resolve LID — extract the numeric part as fallback
    return raw.replace('@lid', '').replace(/\D/g, '') || null;
  }

  const senderJid = normalizeWhatsAppJid(raw);
  if (!senderJid) return null;
  return senderJid.split('@')[0]?.replace(/\D/g, '') || null;
}

function isCommandPermitted(botInfo: BotInfo, msg: { key?: { remoteJid?: string | null; participant?: string | null } }): boolean {
  if (botInfo.permissions.allowAll) {
    return true;
  }

  const remoteJid = msg.key?.remoteJid ?? undefined;
  const chatId = normalizePermissionChatId(remoteJid);
  const senderNumber = extractSenderNumber(msg);

  const chatAllowed = !!chatId && botInfo.permissions.chats.includes(chatId);
  const numberAllowed = !!senderNumber && botInfo.permissions.numbers.includes(senderNumber);

  // Extra: if remoteJid is a @lid (DM from linked device), resolve it and check numbers
  const lidNumber = remoteJid?.endsWith('@lid')
    ? resolveLidToNumber(remoteJid)?.split('@')[0]?.replace(/\D/g, '') ?? null
    : null;
  const lidAllowed = !!lidNumber && botInfo.permissions.numbers.includes(lidNumber);

  return chatAllowed || numberAllowed || lidAllowed;
}

function applyPermissionMutation(
  botInfo: BotInfo,
  mode: 'grant' | 'revoke',
  targetArg: string | undefined,
  remoteJid: string | undefined
): BotPermissions | null {
  if (!targetArg) {
    return null;
  }

  const normalizedArg = targetArg.trim().toLowerCase();
  const next: BotPermissions = {
    allowAll: botInfo.permissions.allowAll,
    chats: [...botInfo.permissions.chats],
    numbers: [...botInfo.permissions.numbers]
  };

  if (normalizedArg === 'all') {
    next.allowAll = mode === 'grant';
    return sanitizePermissions(next);
  }

  if (normalizedArg === 'chat') {
    const chatId = normalizePermissionChatId(remoteJid ?? undefined);
    if (!chatId) {
      return null;
    }
    if (mode === 'grant') {
      next.chats.push(chatId);
    } else {
      next.chats = next.chats.filter((entry) => entry !== chatId);
    }
    return sanitizePermissions(next);
  }

  if (/^\+?\d{7,20}$/.test(normalizedArg)) {
    const normalizedNumber = normalizedArg.replace(/\D/g, '');
    if (mode === 'grant') {
      next.numbers.push(normalizedNumber);
    } else {
      next.numbers = next.numbers.filter((entry) => entry !== normalizedNumber);
    }
    return sanitizePermissions(next);
  }

  return null;
}

function parsePermArgs(primaryArg: string | undefined, secondaryArg: string | undefined): {
  mode: 'grant' | 'revoke';
  targetArg: string | undefined;
} {
  const normalizedPrimary = primaryArg?.trim().toLowerCase();
  if (normalizedPrimary && ['revoke', 'remove', 'rm', 'del', 'deny', 'block'].includes(normalizedPrimary)) {
    return { mode: 'revoke', targetArg: secondaryArg };
  }
  // Explicit grant keyword — shift target to secondaryArg
  if (normalizedPrimary && ['grant', 'add', 'allow'].includes(normalizedPrimary)) {
    return { mode: 'grant', targetArg: secondaryArg };
  }
  return { mode: 'grant', targetArg: primaryArg };
}

type OutboundMessageRecord = {
  jid: string;
  text: string;
  timestamp: number;
};

const outboundMessageCache: OutboundMessageRecord[] = [];

function rememberOutboundMessage(jid: string, text: string) {
  outboundMessageCache.push({ jid, text: text.trim().toLowerCase(), timestamp: Date.now() });
}

function wasRecentlySentByBot(jid: string | undefined, text: string | undefined): boolean {
  if (!jid || !text) {
    return false;
  }

  const normalizedText = text.trim().toLowerCase();
  const now = Date.now();

  while (outboundMessageCache.length > 0 && now - outboundMessageCache[0]!.timestamp > OUTBOUND_MESSAGE_TTL_MS) {
    outboundMessageCache.shift();
  }

  return outboundMessageCache.some((entry) => entry.jid === jid && entry.text === normalizedText);
}

async function sendTrackedMessage(
  sock: Awaited<ReturnType<WXATAConnection['createConnection']>>,
  jid: string,
  text: string
) {
  rememberOutboundMessage(jid, text);
  await sock.sendMessage(jid, { text });
}

function extractMessageText(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const content = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    ephemeralMessage?: { message?: unknown };
    viewOnceMessage?: { message?: unknown };
    viewOnceMessageV2?: { message?: unknown };
    viewOnceMessageV2Extension?: { message?: unknown };
  };

  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    extractMessageText(content.ephemeralMessage?.message) ??
    extractMessageText(content.viewOnceMessage?.message) ??
    extractMessageText(content.viewOnceMessageV2?.message) ??
    extractMessageText(content.viewOnceMessageV2Extension?.message)
  );
}

function senderMatchesRoot(
  sock: Awaited<ReturnType<WXATAConnection['createConnection']>>,
  msg: {
    key?: { fromMe?: boolean | null; remoteJid?: string | null; participant?: string | null };
  },
  rootTarget: string
): boolean {
  const normalizedRootTarget = rootTarget.trim().toLowerCase();
  const isSelfRoot = ['self', 'root', 'me', 'myself'].includes(normalizedRootTarget);

  // fromMe=true always means it's us — trust it when root is self
  if (isSelfRoot && msg.key?.fromMe) {
    return true;
  }

  // Also treat any fromMe message as root when root.target resolves to our own JID
  if (msg.key?.fromMe) {
    const selfJid = resolveSelfJid(sock);
    if (!selfJid) {
      // Can't resolve self yet — treat fromMe as root to avoid blocking commands on startup
      return true;
    }
    const rootJid = resolveTargetJid(sock, rootTarget);
    if (!rootJid) return true; // Same: can't resolve, don't block
    const selfNum = selfJid.split('@')[0]?.replace(/\D/g, '');
    const rootNum = rootJid.split('@')[0]?.replace(/\D/g, '');
    if (selfNum && rootNum && selfNum === rootNum) return true;
  }

  // participant can be empty string — use || not ??
  const rawSender = (msg.key?.participant || msg.key?.remoteJid) ?? undefined;

  // If sender is a @lid, resolve to real number for comparison
  const senderJid = rawSender?.endsWith('@lid')
    ? (resolveLidToNumber(rawSender) ?? normalizeWhatsAppJid(rawSender))
    : normalizeWhatsAppJid(rawSender);

  if (!senderJid) {
    return false;
  }

  const rootJid = resolveTargetJid(sock, rootTarget);
  if (!rootJid) {
    return false;
  }

  const senderNumber = senderJid.split('@')[0]?.replace(/\D/g, '');
  const rootNumber = rootJid.split('@')[0]?.replace(/\D/g, '');

  return !!senderNumber && !!rootNumber && senderNumber === rootNumber;
}

function resolveScriptTarget(
  sock: Awaited<ReturnType<WXATAConnection['createConnection']>>,
  botInfo: BotInfo,
  script: BotScript,
  argumentName: string | undefined,
  remoteJid: string | undefined
): string | null {
  const normalizedArgumentName = argumentName?.trim().toLowerCase();

  const globalTargetOverride = resolveGlobalTargetOverride(sock, botInfo, normalizedArgumentName);
  if (globalTargetOverride !== undefined) {
    return globalTargetOverride;
  }

  const fallbackArgument = script.defaultArgument?.trim().toLowerCase() || 'self';
  const selectedArgumentName = normalizedArgumentName || fallbackArgument;
  const argumentConfig = script.arguments?.[selectedArgumentName];

  const selectedTarget = argumentConfig?.target ?? script.target;

  if (selectedTarget.trim().toLowerCase() === 'chat' || selectedTarget.trim().toLowerCase() === 'here' || selectedTarget.trim().toLowerCase() === 'current') {
    return remoteJid ?? null;
  }

  return resolveTargetJid(sock, selectedTarget);
}

function resolveGlobalTargetOverride(
  sock: Awaited<ReturnType<WXATAConnection['createConnection']>>,
  botInfo: BotInfo,
  argumentName: string | undefined
): string | null | undefined {
  if (!argumentName) {
    return undefined;
  }

  if (['self', 'root', 'me', 'myself'].includes(argumentName)) {
    return resolveTargetJid(sock, botInfo.root.target);
  }

  if (/^\+?\d{7,20}$/.test(argumentName)) {
    const number = argumentName.replace(/\D/g, '');
    return number ? `${number}@s.whatsapp.net` : null;
  }

  return undefined;
}

function resolveScriptResponse(script: BotScript, argumentName: string | undefined): string {
  const normalizedArgumentName = argumentName?.trim().toLowerCase();
  const fallbackArgument = script.defaultArgument?.trim().toLowerCase() || 'self';
  const selectedArgumentName = normalizedArgumentName || fallbackArgument;
  const argumentConfig = script.arguments?.[selectedArgumentName];

  return argumentConfig?.response?.trim() || script.response;
}

function attachMessageHandler(sock: Awaited<ReturnType<WXATAConnection['createConnection']>>) {
  sock.ev.on('messages.upsert', async (m) => {
    for (const msg of m.messages) {
      // Always cache every message for anti-delete, regardless of type
      if (msg?.key?.id) storeMessage(msg);

      if (!msg || (m.type !== 'notify' && m.type !== 'append')) {
        continue;
      }

      const remoteJid = msg.key?.remoteJid;
      const text = extractMessageText(msg.message);
      const selfJid = resolveSelfJid(sock);
      const isSelfChat = typeof remoteJid === 'string' && typeof selfJid === 'string' && remoteJid === selfJid;
      const isBotEcho = msg.key?.fromMe && wasRecentlySentByBot(remoteJid ?? undefined, text ?? undefined);
      const botInfo = await readBotInfo();
      const isRootSender = senderMatchesRoot(sock, msg, botInfo.root.target);
      const hasPermission = isRootSender || isCommandPermitted(botInfo, msg);

      const participant = msg.key?.participant ?? '-';
      const textPreview = (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      dashboard.log(
        'DEBUG',
        `INBOUND type=${m.type} fromMe=${String(msg.key?.fromMe)} jid=${remoteJid ?? '-'} participant=${participant} text=${textPreview || '<none>'}`
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

      if (remoteJid?.endsWith('@broadcast') && botInfo.scripts.antibc && !msg.key?.fromMe) {
         try {
           const fs = require('fs');
           const configPath = path.resolve(DATA_DIR, 'antibc.json');
           let cfgEnabled = false;
           let cfgMsg = 'remove me from broadcast';
           if (fs.existsSync(configPath)) {
             try {
               const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
               if (typeof parsed.enabled === 'boolean') cfgEnabled = parsed.enabled;
               if (typeof parsed.message === 'string') cfgMsg = parsed.message;
             } catch(e) {}
           }
           if (cfgEnabled && msg.key?.participant) {
             await sendTrackedMessage(sock, msg.key.participant, cfgMsg);
             dashboard.log('SUCCESS', `Anti-broadcast replied to ${msg.key.participant}`);
           }
         } catch(e) {}
      }

      if (text) {
        const normalizedText = text.trim().toLowerCase();

        for (const [scriptName, script] of Object.entries(botInfo.scripts)) {
          const prefixPattern = escapeRegex(botInfo.prefix.trim());
          const triggerPattern = escapeRegex(script.trigger.trim());
          // Match prefix+trigger followed by optional arguments (any trailing content)
          // Only capture the first word argument for simple scripts; perm uses its own regex
          const triggerRegex = new RegExp(`^${prefixPattern}\\s*${triggerPattern}(?:\\s+(\\S+))?(?:\\s+\\S+)*$`, 'i');
          const triggerMatch = normalizedText.match(triggerRegex);

          if (triggerMatch) {
            const argumentName = triggerMatch[1];

            if (!hasPermission) {
              dashboard.log('WARN', `Blocked unpermitted command "${scriptName}" from ${remoteJid}`);
              break;
            }

            if (scriptName === 'perm') {
              if (!isRootSender) {
                const replyJid = resolveReplyJid(remoteJid);
                if (replyJid) await sendTrackedMessage(sock, replyJid, 'Permission denied. Root only.');
                break;
              }

              const permArgRegex = new RegExp(`^${prefixPattern}\\s*${triggerPattern}(?:\\s+(\\S+))?(?:\\s+(\\S+))?$`, 'i');
              const permArgMatch = normalizedText.match(permArgRegex);
              const primaryArg = permArgMatch?.[1];
              const secondaryArg = permArgMatch?.[2];
              const parsedPermArgs = parsePermArgs(primaryArg, secondaryArg);

              const nextPermissions = applyPermissionMutation(
                botInfo,
                parsedPermArgs.mode,
                parsedPermArgs.targetArg,
                remoteJid ?? undefined
              );
              const replyJid = resolveReplyJid(remoteJid);
              if (!nextPermissions) {
                if (replyJid) {
                  await sendTrackedMessage(
                    sock,
                    replyJid,
                    `Usage:\n${botInfo.prefix}${script.trigger} [grant|revoke] chat | all | +countrycodeNumber\n\nExamples:\n${botInfo.prefix}perm chat\n${botInfo.prefix}perm grant +2347041029093\n${botInfo.prefix}perm revoke chat`
                  );
                }
                break;
              }

              const updated = await updateBotInfo({ permissions: nextPermissions });
              const summary = `✅ Permissions ${parsedPermArgs.mode} complete.\nallowAll=${updated.permissions.allowAll}\nchats=${updated.permissions.chats.length}\nnumbers=${updated.permissions.numbers.length}`;
              if (replyJid) await sendTrackedMessage(sock, replyJid, summary);
              dashboard.log('SUCCESS', `Permission ${parsedPermArgs.mode} applied by ${remoteJid}`);
              break;
            }

            if (script.code && script.code.trim()) {
              try {
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const executor = new AsyncFunction('sock', 'msg', 'botInfo', 'remoteJid', 'argumentName', 'sendTrackedMessage', 'dashboard', 'require', '__rootdir', script.code);
                // Pass resolved JID so scripts can reply even when remoteJid is a @lid
                const execJid = resolveReplyJid(remoteJid) ?? remoteJid;
                // __rootdir = data directory (persistent disk on Render, workspace root locally)
                const __rootdir = DATA_DIR;
                await executor(sock, msg, botInfo, execJid, argumentName, sendTrackedMessage, dashboard, require, __rootdir);
                dashboard.log('SUCCESS', `${scriptName} JS executed by ${remoteJid}`);
              } catch (err: any) {
                dashboard.log('ERROR', `JS Extension Error (${scriptName}): ${err.message}`);
                const errReplyJid = resolveReplyJid(remoteJid);
                if (errReplyJid && hasPermission) {
                  await sendTrackedMessage(sock, errReplyJid, `[Extension Error] ${scriptName}:\n${err.message}`);
                }
              }
              break;
            }

            const targetJid = resolveScriptTarget(sock, botInfo, script, argumentName, resolveReplyJid(remoteJid) ?? remoteJid ?? undefined);
            if (targetJid) {
              const responseText = scriptName === 'menu' ? buildMenuResponse(botInfo) : resolveScriptResponse(script, argumentName);
              await sendTrackedMessage(sock, targetJid, responseText);
              dashboard.log('SUCCESS', `${scriptName} triggered by ${remoteJid}; response sent to ${targetJid}`);
            } else {
              dashboard.log('ERROR', `${scriptName} triggered but target could not be resolved`);
            }
            break;
          }
        }
      }

      if (text?.toLowerCase() === 'ping' && remoteJid) {
        await sendTrackedMessage(sock, remoteJid, 'pong 🟢');
        dashboard.log('SUCCESS', `Auto-reply [pong] sent to ${remoteJid}`);
      }

      const logMsg = `From: ${remoteJid} | Text: ${text}`;
      console.log(`[MSG] ${logMsg}`);
      dashboard.log('MSG', logMsg);
    }
  });

  sock.ev.on('messages.update', async (messageUpdates) => {
    const fs = require('fs');
    const rPath = require('path');
    
    for (const update of messageUpdates) {
      // A revoke/delete sets message to null. messageStubType may be 0, undefined, or absent.
      // The reliable signal is message === null on the update patch.
      const isRevoke = update.update?.message === null;
      if (!isRevoke) continue;

      const targetId = update.key?.id;
      if (!targetId) continue;

      const originalMsg = getMessage(targetId);
      if (!originalMsg) {
        dashboard.log('DEBUG', `Anti-delete: message ${targetId} not in DB (too old or never cached)`);
        continue;
      }

      const botInfo = await readBotInfo();
      if (!botInfo.scripts.antidel) continue;

      const cfgPath = rPath.resolve(DATA_DIR, 'antidel.json');
      const selfJid = sock.user?.id.split(':')[0] + '@s.whatsapp.net';
      const defaultTarget = (botInfo.permissions.numbers[0]
        ? botInfo.permissions.numbers[0] + '@s.whatsapp.net'
        : null) || selfJid;

      let cfg = { enabled: true, target: defaultTarget };
      try {
        if (fs.existsSync(cfgPath)) {
          const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          cfg.enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : cfg.enabled;
          if (typeof parsed.target === 'string' && parsed.target.includes('@')) cfg.target = parsed.target;
        }
      } catch(e) {}

      if (!cfg.enabled) continue;

      const sender = originalMsg.key?.participant || originalMsg.key?.remoteJid || 'unknown';
      const chatJid = originalMsg.key?.remoteJid || 'unknown';
      dashboard.log('INFO', `Anti-delete triggered: msg from ${sender} in ${chatJid}`);

      try {
        // Try forwarding the full message object
        await sock.sendMessage(cfg.target, { forward: originalMsg, force: true } as any);
        dashboard.log('SUCCESS', `Anti-delete: forwarded message from ${sender}`);
      } catch(forwardErr: any) {
        // Forward failed — extract whatever content we can and send as text
        dashboard.log('WARN', `Anti-delete forward failed (${forwardErr.message}), falling back to text`);
        try {
          const msgContent = originalMsg.message;
          const text = msgContent?.conversation
            || msgContent?.extendedTextMessage?.text
            || msgContent?.imageMessage?.caption
            || msgContent?.videoMessage?.caption
            || null;

          let fallback = `🗑️ *Deleted Message*\n👤 From: @${sender.split('@')[0]}\n💬 Chat: ${chatJid}\n`;
          if (text) {
            fallback += `\n📝 Content:\n${text}`;
          } else {
            const mediaType = msgContent?.imageMessage ? '🖼️ Image'
              : msgContent?.videoMessage ? '🎥 Video'
              : msgContent?.audioMessage ? '🎵 Audio'
              : msgContent?.stickerMessage ? '🎭 Sticker'
              : msgContent?.documentMessage ? '📄 Document'
              : '❓ Unknown media';
            fallback += `\n📎 Type: ${mediaType} (media not recoverable)`;
          }
          await sock.sendMessage(cfg.target, { text: fallback });
          dashboard.log('SUCCESS', `Anti-delete: sent fallback text for ${sender}`);
        } catch(textErr: any) {
          dashboard.log('ERROR', `Anti-delete: complete failure — ${textErr.message}`);
        }
      }
    }
  });
}

async function sendWelcomeMessage(sock: Awaited<ReturnType<WXATAConnection['createConnection']>>) {
  const botInfo = await readBotInfo();
  if (!botInfo.welcome.enabled) {
    return;
  }

  const targetJid = resolveTargetJid(sock, botInfo.root.target);
  if (!targetJid) {
    dashboard.log('ERROR', 'Welcome message enabled but target could not be resolved');
    return;
  }

  // Interpolate variables in welcome message
  const interpolatedText = botInfo.welcome.text
    .replace(/{prefix}/g, botInfo.prefix)
    .replace(/{bot}/g, botInfo.scripts.summoner?.trigger || 'bot')
    .replace(/{menu}/g, botInfo.scripts.menu?.trigger || 'menu');

  await sendTrackedMessage(sock, targetJid, interpolatedText);
  dashboard.log('SUCCESS', `Welcome message sent to ${targetJid}`);
}

async function ensureConfigFiles(): Promise<void> {
  // DATA_DIR is defined at module level — /data on Render, workspace root locally
  const dir = DATA_DIR;

  // Also seed botinfo.json from example if missing
  try { await fs.access(BOT_INFO_PATH); } catch {
    const examplePath = path.resolve(__dirname, '..', 'botinfo.example.json');
    try {
      const example = await fs.readFile(examplePath, 'utf-8');
      await fs.writeFile(BOT_INFO_PATH, example, 'utf-8');
      dashboard.log('INFO', 'Created botinfo.json from botinfo.example.json');
    } catch {
      await fs.writeFile(BOT_INFO_PATH, JSON.stringify(DEFAULT_BOT_INFO, null, 2), 'utf-8');
      dashboard.log('INFO', 'Created default botinfo.json');
    }
  }

  const antidelPath = path.resolve(dir, 'antidel.json');
  try { await fs.access(antidelPath); } catch {
    await fs.writeFile(antidelPath, JSON.stringify({ enabled: true, target: null }, null, 2), 'utf-8');
    dashboard.log('INFO', 'Created default antidel.json');
  }

  const antibcPath = path.resolve(dir, 'antibc.json');
  try { await fs.access(antibcPath); } catch {
    await fs.writeFile(antibcPath, JSON.stringify({ enabled: false, message: 'remove me from broadcast' }, null, 2), 'utf-8');
    dashboard.log('INFO', 'Created default antibc.json');
  }

  const warnsPath = path.resolve(dir, 'warns.json');
  try { await fs.access(warnsPath); } catch {
    await fs.writeFile(warnsPath, JSON.stringify({}, null, 2), 'utf-8');
    dashboard.log('INFO', 'Created default warns.json');
  }

  const varsPath = path.resolve(dir, 'vars.json');
  try { await fs.access(varsPath); } catch {
    await fs.writeFile(varsPath, JSON.stringify({}, null, 2), 'utf-8');
    dashboard.log('INFO', 'Created default vars.json');
  }
}

async function startBot() {
  dashboard.log('INFO', 'Initializing WXATA Backend System...');
  console.log('🚀 Initializing WXATA Backend...');
  await ensureConfigFiles();

  // Load persisted vars (e.g. DB_RETENTION_DAYS set via +vars)
  try {
    const varsPath = path.resolve(DATA_DIR, 'vars.json');
    const savedVars = JSON.parse(await fs.readFile(varsPath, 'utf-8'));
    if (savedVars.DB_RETENTION_DAYS) {
      setRetentionDays(+savedVars.DB_RETENTION_DAYS);
      dashboard.log('INFO', `DB retention loaded: ${savedVars.DB_RETENTION_DAYS} days`);
    }
  } catch { /* vars.json missing or empty — use default */ }

  let connectionManager: WXATAConnection | null = null;
  let activeSocket: Awaited<ReturnType<WXATAConnection['createConnection']>> | null = null;

  dashboard.onCommand(async (payload) => {
    try {
      if (payload.command === 'START_CONNECTION') {
        const { method, phoneNumber } = payload.data;

        dashboard.log('INFO', `Starting connection via ${method}...`);

        connectionManager = new WXATAConnection({
          phoneNumber,
          usePairingCode: method === 'PHONE',
          onQR: (qr) => {
            dashboard.sendQR(qr);
            qrcode.generate(qr, { small: true });
          },
          onPairingCode: (code) => {
            dashboard.sendPairingCode(code);
          },
          onOpen: () => {
            dashboard.log('SUCCESS', 'Bot is now fully operational');
            setTimeout(() => {
              const socketForWelcome = connectionManager?.getSocket();        
              if (socketForWelcome) {
                sendWelcomeMessage(socketForWelcome).catch((err) => {
                  console.error('Failed to send welcome message', err);       
                  dashboard.log('ERROR', 'Failed to send welcome message');   
                });
              }
            }, 15000); // Increased timeout to ensure session keys fully propagate to WhatsApp servers before sending
          }
        });

        activeSocket = await connectionManager.createConnection();
        attachMessageHandler(activeSocket);
      }

      if (payload.command === 'GET_BOT_INFO') {
        const botInfo = await readBotInfo();
        dashboard.broadcast({ event: 'bot-info', data: botInfo });
      }

      if (payload.command === 'UPDATE_BOT_INFO') {
        const updated = await updateBotInfo(payload.data ?? {});
        dashboard.broadcast({ event: 'bot-info', data: updated });
        dashboard.log('SUCCESS', 'Bot script configuration updated');
      }

      if (payload.command === 'QUICK_ACTION') {
        const { action } = payload.data;
        dashboard.log('WARN', `Executing Quick Action: ${action}`);

        switch (action) {
          case 'RESTART_BOT':
            dashboard.log('INFO', 'Restarting bot system...');
            process.exit(0);
            break;
          case 'TERMINATE':
            dashboard.log('ERROR', 'Terminating bot system...');
            process.exit(1);
            break;
          case 'EXPORT_DATA':
            dashboard.log('INFO', 'Exporting session logs...');
            break;
        }
      }
    } catch (err) {
      console.error('Dashboard command failed', err);
      dashboard.log('ERROR', 'Failed to execute dashboard command');
      dashboard.setConnectionStatus('DISCONNECTED');
    }
  });

  dashboard.setConnectionStatus('DISCONNECTED');
  dashboard.log('INFO', 'Backend ready. Waiting for START_CONNECTION command from dashboard.');
}

startBot().catch((err) => {
  console.error('CRITICAL: Failed to start WXATA system', err);
});
