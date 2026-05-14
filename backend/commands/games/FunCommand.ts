import type { Command, CommandContext } from '../types';
import { addWin, getLeaderboard } from './GameUtils';

interface BombState {
  active: boolean;
  wires: string[];
  defuseWire: string;
  explodeWire: string;
  planter: string;
}

const activeBombs = new Map<string, BombState>();

export class FunCommand implements Command {
  name = 'Fun Games';
  description = 'Play a fun mini-game (Bomb Defusal)!';
  trigger = 'fun';
  target: 'chat' | 'self' = 'chat';

  async execute(ctx: CommandContext): Promise<void> {
    const args = (ctx.argumentName || '').trim().toLowerCase().split(' ');
    const subcmd = args[0];
    const groupId = ctx.remoteJid;
    const sender = ctx.msg?.key?.participant || ctx.msg?.participant || ctx.msg?.key?.remoteJid || 'unknown';
    const senderName = ctx.msg?.pushName || 'Player';

    if (subcmd === 'lb') {
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🏆 *Fun Leaderboard* 🏆\n${getLeaderboard(groupId)}`);
      return;
    }

    if (subcmd === 'bomb') {
      if (activeBombs.get(groupId)?.active) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💣 A bomb is already ticking! Cut a wire with ${ctx.botInfo.prefix}fun cut <color>`);
        return;
      }
      const allWires = ['red', 'blue', 'green', 'yellow', 'black', 'white'];
      const shuffled = allWires.sort(() => 0.5 - Math.random()).slice(0, 4);
      const defuseWire = shuffled[Math.floor(Math.random() * shuffled.length)]!;
      let explodeWire = shuffled[Math.floor(Math.random() * shuffled.length)]!;
      while (explodeWire === defuseWire) explodeWire = shuffled[Math.floor(Math.random() * shuffled.length)]!;

      activeBombs.set(groupId, {
        active: true,
        wires: shuffled,
        defuseWire,
        explodeWire,
        planter: sender
      });

      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💣 *BOMB PLANTED!* 💣\nWires: ${shuffled.join(', ')}\nQuick, cut a wire using *${ctx.botInfo.prefix}fun cut <color>* before it explodes!`);
      return;
    }

    if (subcmd === 'cut') {
      const bomb = activeBombs.get(groupId);
      if (!bomb || !bomb.active) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `No active bomb! Plant one with *${ctx.botInfo.prefix}fun bomb*`);
        return;
      }

      const color = args[1];
      if (!color || !bomb.wires.includes(color)) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `Choose a valid wire! Active wires: ${bomb.wires.join(', ')}`);
        return;
      }

      if (color === bomb.defuseWire) {
        bomb.active = false;
        addWin(groupId, sender, senderName, 3);
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🎉 *BOMB DEFUSED!* 🎉\n${senderName} cut the ${color} wire and saved everyone! (+3 pts)`);
      } else if (color === bomb.explodeWire) {
        bomb.active = false;
        addWin(groupId, sender, senderName, -2);
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💥 *KABOOM!* 💥\n${senderName} cut the wrong wire! The bomb exploded! (-2 pts)`);
      } else {
        bomb.wires = bomb.wires.filter(w => w !== color);
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `Snipped the ${color} wire... nothing happened. Keep guessing! Wires left: ${bomb.wires.join(', ')}`);
      }
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🎮 *Fun Games* 🎮\n\n- *${ctx.botInfo.prefix}fun bomb* : Plant a bomb\n- *${ctx.botInfo.prefix}fun cut <color>* : Defuse it\n- *${ctx.botInfo.prefix}fun lb* : Show leaderboard`);
  }
}