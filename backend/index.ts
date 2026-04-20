import { WXATAConnection } from './connection';
// @ts-ignore
import * as qrcode from 'qrcode-terminal';
import { dashboard } from './DashboardServer';
import fs from 'fs/promises';
import path from 'path';

interface BotScript {
  name: string;
  desc: string;
  trigger: string;
  response: string;
  target: string;
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

const BOT_INFO_PATH = path.resolve(__dirname, '..', 'botinfo.json');
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
    response: typeof input?.response === 'string' && input.response.trim() ? input.response.trim() : 'WXATA summoned successfully.',
    target: typeof input?.target === 'string' && input.target.trim() ? input.target.trim() : 'self',
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
  if (trimmedValue.includes('@s.whatsapp.net')) {
    const baseNumber = trimmedValue.split(':')[0]?.replace(/\D/g, '');
    return baseNumber ? `${baseNumber}@s.whatsapp.net` : trimmedValue;
  }

  const number = trimmedValue.replace(/\D/g, '');
  return number ? `${number}@s.whatsapp.net` : null;
}

function normalizePermissionChatId(jid: string | undefined | null): string | null {
  if (typeof jid !== 'string' || !jid.trim()) {
    return null;
  }

  const trimmed = jid.trim();
  if (trimmed.endsWith('@g.us')) {
    return trimmed;
  }

  return normalizeWhatsAppJid(trimmed);
}

function extractSenderNumber(msg: { key?: { participant?: string | null; remoteJid?: string | null } }): string | null {
  const senderJid = normalizeWhatsAppJid(msg.key?.participant ?? msg.key?.remoteJid ?? undefined);
  if (!senderJid) {
    return null;
  }

  return senderJid.split('@')[0]?.replace(/\D/g, '') || null;
}

function isCommandPermitted(botInfo: BotInfo, msg: { key?: { remoteJid?: string | null; participant?: string | null } }): boolean {
  if (botInfo.permissions.allowAll) {
    return true;
  }

  const chatId = normalizePermissionChatId(msg.key?.remoteJid ?? undefined);
  const senderNumber = extractSenderNumber(msg);

  const chatAllowed = !!chatId && botInfo.permissions.chats.includes(chatId);
  const numberAllowed = !!senderNumber && botInfo.permissions.numbers.includes(senderNumber);

  return chatAllowed || numberAllowed;
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
  if (normalizedPrimary && ['revoke', 'remove', 'rm', 'del', 'deny'].includes(normalizedPrimary)) {
    return { mode: 'revoke', targetArg: secondaryArg };
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

  if (isSelfRoot && msg.key?.fromMe) {
    return true;
  }

  const senderJid = normalizeWhatsAppJid(msg.key?.participant ?? msg.key?.remoteJid ?? undefined);
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

      if (!isRootSender && msg.key?.fromMe && !isSelfChat) {
        continue;
      }

      if (isBotEcho) {
        continue;
      }

      if (text) {
        const normalizedText = text.trim().toLowerCase();

        for (const [scriptName, script] of Object.entries(botInfo.scripts)) {
          const prefixPattern = escapeRegex(botInfo.prefix.trim());
          const triggerPattern = escapeRegex(script.trigger.trim());
          const triggerRegex = new RegExp(`^${prefixPattern}\\s*${triggerPattern}(?:\\s+(\\S+))?$`, 'i');
          const triggerMatch = normalizedText.match(triggerRegex);

          if (triggerMatch) {
            const argumentName = triggerMatch[1];

            if (!hasPermission) {
              continue;
            }

            if (scriptName === 'perm') {
              if (!isRootSender) {
                if (remoteJid) {
                  await sendTrackedMessage(sock, remoteJid, 'Permission denied. Root only.');
                }
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
              if (!nextPermissions) {
                if (remoteJid) {
                  await sendTrackedMessage(
                    sock,
                    remoteJid,
                    `Usage:\n${botInfo.prefix}${script.trigger} chat | all | +countrycodeNumber\n${botInfo.prefix}${script.trigger} revoke chat | all | +countrycodeNumber`
                  );
                }
                break;
              }

              const updated = await updateBotInfo({ permissions: nextPermissions });
              const summary = `Permissions ${parsedPermArgs.mode} complete. all=${updated.permissions.allowAll} chats=${updated.permissions.chats.length} numbers=${updated.permissions.numbers.length}`;
              if (remoteJid) {
                await sendTrackedMessage(sock, remoteJid, summary);
              }
              dashboard.log('SUCCESS', `Permission ${parsedPermArgs.mode} applied by ${remoteJid}`);
              break;
            }

            const targetJid = resolveScriptTarget(sock, botInfo, script, argumentName, remoteJid ?? undefined);
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

  await sendTrackedMessage(sock, targetJid, botInfo.welcome.text);
  dashboard.log('SUCCESS', `Welcome message sent to ${targetJid}`);
}

async function startBot() {
  dashboard.log('INFO', 'Initializing WXATA Backend System...');
  console.log('🚀 Initializing WXATA Backend...');

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
            const socketForWelcome = activeSocket;
            if (socketForWelcome) {
              setTimeout(() => {
                sendWelcomeMessage(socketForWelcome).catch((err) => {
                  console.error('Failed to send welcome message', err);
                  dashboard.log('ERROR', 'Failed to send welcome message');
                });
              }, 1500);
            }
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
