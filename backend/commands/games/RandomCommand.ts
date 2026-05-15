import type { Command, CommandContext } from '../types';
import { addWin, getLeaderboard } from './GameUtils';

export class RandomCommand implements Command {
  name = 'Random Games';
  description = 'Play random casino-style games!';
  trigger = 'random';
  target: 'chat' | 'self' = 'chat';
  aliases = ['rd', 'casino', 'slots', 'flip'];

  async execute(ctx: CommandContext): Promise<void> {
    const args = (ctx.argumentName || '').trim().toLowerCase().split(' ');
    const subcmd = args[0];
    const groupId = ctx.remoteJid;
    const sender = ctx.msg?.key?.participant || ctx.msg?.participant || ctx.msg?.key?.remoteJid || 'unknown';
    const senderName = ctx.msg?.pushName || 'Player';

    if (subcmd === 'lb') {
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🎲 *Random Leaderboard* 🎲\n${getLeaderboard(groupId)}`);
      return;
    }

    if (subcmd === 'slots') {
      const symbols = ['🍒', '🍋', '🍊', '🎰', '🔔', '💎'];
      const result = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ];
      
      let msg = `🎰 *SLOTS* 🎰\n[ ${result.join(' | ')} ]\n`;
      if (result[0] === result[1] && result[1] === result[2]) {
        addWin(groupId, sender, senderName, 10);
        msg += `JACKPOT! 🎉 ${senderName} won 10 points!`;
      } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        addWin(groupId, sender, senderName, 2);
        msg += `A pair! ${senderName} won 2 points!`;
      } else {
        msg += `No match. Better luck next time, ${senderName}!`;
      }
      
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, msg);
      return;
    }

    if (subcmd === 'flip') {
      const choice = args[1];
      if (choice !== 'heads' && choice !== 'tails') {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `Usage: *${ctx.botInfo.prefix}random flip <heads/tails>*`);
        return;
      }
      const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
      if (choice === outcome) {
        addWin(groupId, sender, senderName, 1);
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🪙 Coin landed on *${outcome}*! You win 1 pt!`);
      } else {
        addWin(groupId, sender, senderName, -1);
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🪙 Coin landed on *${outcome}*! You lose 1 pt!`);
      }
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🎲 *Random Games* 🎲\n\n- *${ctx.botInfo.prefix}random slots* : Spin the slot machine\n- *${ctx.botInfo.prefix}random flip <heads/tails>* : Flip a coin\n- *${ctx.botInfo.prefix}random lb* : Show leaderboard`);
  }
}