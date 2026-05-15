import type { Command, CommandContext } from '../types';
import { addWin, getLeaderboard } from './GameUtils';

interface Player {
  id: string;
  name: string;
}

interface BombState {
  active: boolean;
  phase: 'lobby' | 'playing';
  players: Player[];
  currentHolderIndex: number;
  timer?: NodeJS.Timer | any;
  ticksLeft: number;
}

export const activeBombs = new Map<string, BombState>();

export class FunCommand implements Command {
  name = 'Fun Games';
  description = 'Play a fun mini-game (Hot Potato Bomb)!';
  trigger = 'fun';
  target: 'chat' | 'self' = 'chat';
  aliases = ['games', 'bomb', 'potato'];

  async execute(ctx: CommandContext): Promise<void> {
    const args = (ctx.argumentName || '').trim().toLowerCase().split(' ');
    const subcmd = args[0] || 'help';
    const groupId = ctx.remoteJid;
    const sender = ctx.msg?.key?.participant || ctx.msg?.participant || ctx.msg?.key?.remoteJid || 'unknown';
    const senderName = ctx.msg?.pushName || 'Player';

    if (subcmd === 'lb') {
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🎖️ *Fun Leaderboard* 🎖️\n${getLeaderboard(groupId)}`);
      return;
    }

    if (subcmd === 'bomb') {
      if (activeBombs.has(groupId)) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💣 A game is already active! Type *${ctx.botInfo.prefix}fun join* to enter if in lobby.`);
        return;
      }

      addWin(groupId, sender, senderName, 0); // Setup leaderboard with 0
      const state: BombState = {
        active: true,
        phase: 'lobby',
        players: [{ id: sender, name: senderName }],
        currentHolderIndex: -1,
        ticksLeft: Math.floor(Math.random() * 5) + 5 // 5 to 9 passes max
      };
      activeBombs.set(groupId, state);

      state.timer = setTimeout(async () => {
        if (state.players.length < 2) {
          await ctx.sendTrackedMessage(ctx.sock, groupId, `Not enough players joined the Bomb game. Cancelled!`);
          activeBombs.delete(groupId);
          return;
        }
        
        state.phase = 'playing';
        state.players.sort(() => Math.random() - 0.5); // Shuffle
        state.currentHolderIndex = Math.floor(Math.random() * state.players.length);
        
        const holder = state.players[state.currentHolderIndex]!;
        const names = state.players.map(p => p.name).join(', ');
        await ctx.sendTrackedMessage(ctx.sock, groupId, `💣 *BOMB PLANTED!* 💣\nPlayers: ${names}\n\nThe bomb is handed to @${holder.id.split('@')[0]}!\nQuick, pass it with *${ctx.botInfo.prefix}fun pass* before it explodes! (30s)`, [holder.id]);
        
        this.resetBombTimer(groupId, ctx, 30000);
      }, 60000); // 60s lobby

      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💣 *HOT POTATO BOMB LOBBY!* 💣\nType *${ctx.botInfo.prefix}fun join* within 60s to play!`);
      return;
    }

    if (subcmd === 'join') {
      const state = activeBombs.get(groupId);
      if (!state || state.phase !== 'lobby') {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `No active lobby! Start one with *${ctx.botInfo.prefix}fun bomb*`);
        return;
      }
      if (state.players.find(p => p.id === sender)) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `You already joined!`);
        return;
      }
      addWin(groupId, sender, senderName, 0); // Default to 0 points
      state.players.push({ id: sender, name: senderName });
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `✅ ${senderName} joined the game!`);
      return;
    }

    if (subcmd === 'pass') {
      const state = activeBombs.get(groupId);
      if (!state || state.phase !== 'playing') {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `The game isn't running!`);
        return;
      }

      const holder = state.players[state.currentHolderIndex]!;
      if (holder.id !== sender) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `You don't have the bomb! @${holder.id.split('@')[0]} has it!`, [holder.id]);
        return;
      }

      if (state.timer) clearTimeout(state.timer);
      
      state.ticksLeft--;
      if (state.ticksLeft <= 0 || Math.random() < 0.15) { // Can randomly explode instantly 15%
        await this.explodeBomb(groupId, ctx, state, holder);
        return;
      }
      
      let nextHolderIndex = -1;
      do {
        nextHolderIndex = Math.floor(Math.random() * state.players.length);
      } while (nextHolderIndex === state.currentHolderIndex && state.players.length > 1);
      
      state.currentHolderIndex = nextHolderIndex;
      const nextHolder = state.players[state.currentHolderIndex]!;
      
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `✅ Passed to @${nextHolder.id.split('@')[0]}! Quick, pass it again! (20s)`, [nextHolder.id]);
      this.resetBombTimer(groupId, ctx, 20000); // 20s pass timer
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💣 *Fun Games* 💣\n\n- *${ctx.botInfo.prefix}fun bomb* : Start Hot Potato\n- *${ctx.botInfo.prefix}fun join* : Join Lobby\n- *${ctx.botInfo.prefix}fun pass* : Toss the bomb\n- *${ctx.botInfo.prefix}fun lb* : Show leaderboard`);
  }

  private resetBombTimer(groupId: string, ctx: CommandContext, ms: number) {
    const state = activeBombs.get(groupId);
    if (!state) return;
    
    state.timer = setTimeout(async () => {
      const holder = state.players[state.currentHolderIndex]!;
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `⏳ *10 SECONDS LEFT* before the bomb explodes! Pass it quickly, @${holder.id.split('@')[0]}!`, [holder.id]);
      
      const subTimer = setTimeout(async () => {
        const boomState = activeBombs.get(groupId);
        if (boomState) {
          const boomHolder = boomState.players[boomState.currentHolderIndex]!;
          await this.explodeBomb(groupId, ctx, boomState, boomHolder, true);
        }
      }, 10000);
      
      // Store the final countdown timer
      state.timer = subTimer;
    }, ms - 10000);
  }

  private async explodeBomb(groupId: string, ctx: CommandContext, state: BombState, holder: Player, isTimeout: boolean = false) {
    addWin(groupId, holder.id, holder.name, -5); // Penalty
    
    const reason = isTimeout ? `Time ran out!` : `The fuse triggered while passing!`;
    await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💥 *KABOOM!* 💥\n${reason}\nIt exploded on @${holder.id.split('@')[0]}!\n\n@${holder.id.split('@')[0]} loses *5 points*.`, [holder.id]);
    
    state.players = state.players.filter(p => p.id !== holder.id);
    
    if (state.players.length <= 1) {
      if (state.players.length === 1) {
        const winner = state.players[0]!;
        addWin(groupId, winner.id, winner.name, 10);
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🏆 @${winner.id.split('@')[0]} survived and won the Hot Potato! (+10 pts)`, [winner.id]);
      } else {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💀 Everyone exploded! Nobody wins.`);
      }
      activeBombs.delete(groupId);
    } else {
      state.currentHolderIndex = Math.floor(Math.random() * state.players.length);
      const nextHolder = state.players[state.currentHolderIndex]!;
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `💣 A new bomb has been given to @${nextHolder.id.split('@')[0]}!\nPass it quickly! (30s)`, [nextHolder.id]);
      this.resetBombTimer(groupId, ctx, 30000);
    }
  }
}