import { WXATAConnection } from './connection';
// @ts-ignore
import * as qrcode from 'qrcode-terminal';
import { dashboard } from './DashboardServer';
import fs from 'fs/promises';
import path from 'path';

interface BotScript {
  trigger: string;
  response: string;
  target: string;
}

interface BotInfo {
  prefix: string;
  scripts: Record<string, BotScript>;
  root: BotRoot;
  welcome: BotWelcome;
}

interface BotRoot {
  target: string;
}

interface BotWelcome {
  enabled: boolean;
  text: string;
}

const BOT_INFO_PATH = path.resolve(__dirname, '..', 'botinfo.json');
const OUTBOUND_MESSAGE_TTL_MS = 15_000;
const DEFAULT_BOT_INFO: BotInfo = {
  prefix: '!',
  scripts: {
    summoner: {
      trigger: 'summon',
      response: 'WXATA summoned successfully.',
      target: 'self'
    }
  },
  root: {
    target: 'self'
  },
  welcome: {
    enabled: true,
    text: '╔════════════════════════════╗\n║   WELCOME TO WXATA         ║\n║   SYSTEM ONLINE            ║\n╚════════════════════════════╝'
  }
};

function sanitizeBotScript(input: Partial<BotScript> | undefined): BotScript {
  return {
    trigger: typeof input?.trigger === 'string' && input.trigger.trim() ? input.trigger.trim() : 'summon',
    response: typeof input?.response === 'string' && input.response.trim() ? input.response.trim() : 'WXATA summoned successfully.',
    target: typeof input?.target === 'string' && input.target.trim() ? input.target.trim() : 'self'
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

function migrateLegacyBotInfo(input: Record<string, unknown>): Partial<BotInfo> {
  const defaultSummoner: BotScript = {
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

  const scripts = Object.entries(scriptsInput as Record<string, Partial<BotScript>>).reduce<Record<string, BotScript>>(
    (accumulator, [name, script]) => {
      const normalizedName = name.trim();
      if (normalizedName) {
        accumulator[normalizedName] = sanitizeBotScript(script);
      }
      return accumulator;
    },
    {}
  );

  if (!Object.keys(scripts).length) {
    scripts.summoner = sanitizeBotScript(DEFAULT_BOT_INFO.scripts.summoner);
  }

  return {
    prefix,
    scripts,
    root: sanitizeBotRoot(rootInput as Partial<BotRoot> | undefined),
    welcome: sanitizeBotWelcome(welcomeInput as Partial<BotWelcome> | undefined)
  };
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
          const triggerRegex = new RegExp(`^${prefixPattern}\\s*${triggerPattern}$`, 'i');

          if (triggerRegex.test(normalizedText) && isRootSender) {
            const targetJid = resolveTargetJid(sock, script.target);
            if (targetJid) {
              await sendTrackedMessage(sock, targetJid, script.response);
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
