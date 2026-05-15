import type { WASocket } from '@whiskeysockets/baileys';

/**
 * Context passed to every command's execute function.
 * Mirrors the variables available in botinfo.json JS code blocks.
 */
export interface CommandContext {
  sock: WASocket;
  msg: any;
  remoteJid: string;
  argumentName: string | undefined;
  sendTrackedMessage: (sock: WASocket, jid: string, text: string, mentions?: string[]) => Promise<void>;
  botInfo: BotInfoSnapshot;
}

export interface BotInfoSnapshot {
  prefix: string;
  permissions: {
    allowAll: boolean;
    chats: string[];
    numbers: string[];
  };
}

/**
 * A command module. Drop a file implementing this interface into
 * the commands/ folder and the CommandHandler will auto-register it.
 */
export interface Command {
  /** Unique key — must match the trigger word */
  name: string;
  /** Short description shown in !menu */
  description: string;
  /** The trigger word (without prefix) */
  trigger: string;
  /** Where to send the response by default */
  target: 'chat' | 'self';
  /** Alternative shorthand triggers for the command */
  aliases?: string[];
  /** Whether this command requires root/sudo */
  requiresRoot?: boolean;
  /** Execute the command */
  execute(ctx: CommandContext): Promise<void>;
}
