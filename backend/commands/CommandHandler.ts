import type { Command, CommandContext } from './types';

/**
 * CommandHandler — loads and routes typed command modules.
 *
 * Usage (future):
 *   const handler = new CommandHandler();
 *   handler.register(pingCommand);
 *   await handler.dispatch(trigger, context);
 *
 * Currently not wired into the main bot loop — the botinfo.json
 * script engine handles all commands. This class is ready for
 * migration when the module system is activated.
 */
export class CommandHandler {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.trigger.toLowerCase(), command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias.toLowerCase(), command);
      }
    }
  }

  registerMany(commands: Command[]): void {
    for (const cmd of commands) {
      this.register(cmd);
    }
  }

  has(trigger: string): boolean {
    return this.commands.has(trigger.toLowerCase());
  }

  get(trigger: string): Command | undefined {
    return this.commands.get(trigger.toLowerCase());
  }

  list(): Command[] {
    return Array.from(new Set(this.commands.values()));
  }

  async dispatch(trigger: string, ctx: CommandContext): Promise<boolean> {
    const command = this.get(trigger);
    if (!command) return false;

    try {
      await command.execute(ctx);
      return true;
    } catch (err: any) {
      console.error(`[CommandHandler] Error in command "${trigger}":`, err.message);
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `[Error] ${command.name}: ${err.message}`);
      return true;
    }
  }
}

export const commandHandler = new CommandHandler();
