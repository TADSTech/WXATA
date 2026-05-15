import type { Command, CommandContext } from '../types';

export class WyrCommand implements Command {
  name = 'Would You Rather';
  description = 'Play a game of Would You Rather';
  trigger = 'wyr';
  target: 'chat' | 'self' = 'chat';
  aliases = ['wouldyourather', 'would', 'choice'];

  async execute(ctx: CommandContext): Promise<void> {
    const { sock, remoteJid, msg } = ctx;
    
    try {
      const response = await fetch('https://api.popcat.xyz/wyr');
      const data = await response.json() as any;
      const { ops1, ops2 } = data;

      const pollMessage = {
        name: 'Would you rather...',
        values: [`${ops1}, or`, ops2],
        selectableCount: 1,
      };

      await sock.sendMessage(
        remoteJid,
        { poll: pollMessage },
        { quoted: msg }
      );
    } catch (error) {
      console.error('Error fetching wyr:', error);
      await ctx.sendTrackedMessage(
        sock,
        remoteJid,
        "If you're seeing this, something major went wrong. Text the developer, ehe."
      );
    }
  }
}
