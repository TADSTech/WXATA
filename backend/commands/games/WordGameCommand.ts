import type { Command, CommandContext } from '../types';
import { addWin, getLeaderboard } from './GameUtils';

interface Player {
  id: string;
  name: string;
}

export interface WCGState {
  type: 'wcg' | 'wrg';
  active: boolean;
  phase: 'lobby' | 'playing';
  players: Player[];
  currentPlayerIndex: number;
  lastWord: string;
  usedWords: Set<string>;
  timer?: NodeJS.Timer | any;
  difficulty: number; // 0: easy, 1: medium, 2: hard
  rounds: number;
}

export const activeWCG = new Map<string, WCGState>();

const wordsByDifficulty = {
  easy: ['apple', 'ball', 'cat', 'dog', 'egg', 'fish', 'goat', 'hat', 'ice', 'jar', 'kite', 'lamp', 'moon', 'nest', 'owl', 'pen', 'queen', 'rat', 'sun', 'tree', 'unit', 'van', 'wolf', 'xray', 'yacht', 'zebra'],
  medium: ['whatsapp', 'bottle', 'garden', 'keyboard', 'phone', 'computer', 'orange', 'water', 'music', 'planet', 'rocket', 'silver', 'tiger', 'vessel', 'window', 'yellow', 'bridge', 'castle', 'dragon', 'engine'],
  hard: ['javascript', 'typescript', 'algorithm', 'blockchain', 'cryptography', 'dictionary', 'evolution', 'framework', 'generation', 'hieroglyph', 'innovation', 'juxtaposition', 'knowledge', 'labyrinth', 'metaphor']
};

const getWord = (difficulty: number) => {
  const list = difficulty === 0 ? wordsByDifficulty.easy : (difficulty === 1 ? wordsByDifficulty.medium : wordsByDifficulty.hard);
  return list[Math.floor(Math.random() * list.length)]!;
};

export class WordChainCommand implements Command {
  name = 'Word Chain Game';
  description = 'Play continuous Word Chain Game (WCG)!';
  trigger = 'wcg';
  target: 'chat' | 'self' = 'chat';
  aliases = ['wc', 'chain'];

  async execute(ctx: CommandContext): Promise<void> {
    const args = (ctx.argumentName || '').trim().toLowerCase().split(' ');
    const subcmd = args[0] || 'help';
    const groupId = ctx.remoteJid;
    const sender = ctx.msg?.key?.participant || ctx.msg?.participant || ctx.msg?.key?.remoteJid || 'unknown';
    const senderName = ctx.msg?.pushName || 'Player';

    if (subcmd === 'lb') {
      await ctx.sendTrackedMessage(ctx.sock, groupId, `🏆 *Word Game Leaderboard* 🏆\n${getLeaderboard(groupId)}`);
      return;
    }

    if (subcmd === 'start') {
      if (activeWCG.has(groupId)) {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `A game is already in progress! Type *${ctx.botInfo.prefix}wcg join* to enter.`);
        return;
      }

      addWin(groupId, sender, senderName, 0);
      const state: WCGState = {
        type: 'wcg',
        active: true,
        phase: 'lobby',
        players: [{ id: sender, name: senderName }],
        currentPlayerIndex: 0,
        lastWord: '',
        usedWords: new Set(),
        difficulty: 0,
        rounds: 0
      };
      activeWCG.set(groupId, state);

      state.timer = setTimeout(async () => {
        if (state.players.length < 2) {
          await ctx.sendTrackedMessage(ctx.sock, groupId, `Not enough players joined. Game cancelled!`);
          activeWCG.delete(groupId);
          return;
        }
        state.phase = 'playing';
        state.lastWord = getWord(0);
        state.usedWords.add(state.lastWord);
        
        state.players.sort(() => Math.random() - 0.5);
        state.currentPlayerIndex = 0;
        
        const currentPlayer = state.players[0]!;
        const playerNames = state.players.map(p => p.name).join(', ');
        const mention = currentPlayer.id;
        
        await ctx.sendTrackedMessage(
          ctx.sock, 
          groupId, 
          `🎮 *Word Chain Started!*\nPlayers: ${playerNames}\n\nFirst word: *${state.lastWord}*\n\n@${mention.split('@')[0]}, it's your turn! Send a word starting with *${state.lastWord.slice(-1).toUpperCase()}*.\n\nDifficulty: *EASY*`,
          [mention]
        );
        
        this.startTurnTimer(groupId, ctx);
      }, 60000);

      await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Game Lobby Opened!*\nType *${ctx.botInfo.prefix}wcg join* within 60s to play!`);
      return;
    }

    if (subcmd === 'join') {
      const state = activeWCG.get(groupId);
      if (!state || state.phase !== 'lobby') {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `No active lobby! Start one with *${ctx.botInfo.prefix}wcg start*`);
        return;
      }
      if (state.players.find(p => p.id === sender)) {
         await ctx.sendTrackedMessage(ctx.sock, groupId, `You already joined!`);
         return;
      }
      addWin(groupId, sender, senderName, 0);
      state.players.push({ id: sender, name: senderName });
      await ctx.sendTrackedMessage(ctx.sock, groupId, `✅ *${senderName}* joined!`);
      return;
    }

    if (subcmd === 'play') {
      await this.handlePlay(ctx, groupId, sender, senderName, args[1] || '');
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Games*\n\n- *${ctx.botInfo.prefix}wcg start* : Start lobby\n- *${ctx.botInfo.prefix}wcg join* : Join lobby\n- *Just type the word* while it's your turn!\n- *${ctx.botInfo.prefix}wcg lb* : Leaderboard`);
  }

  async handlePlay(ctx: CommandContext, groupId: string, sender: string, senderName: string, word: string): Promise<void> {
    const state = activeWCG.get(groupId);
    if (!state || state.phase !== 'playing' || state.type !== 'wcg') return;

    const currentPlayer = state.players[state.currentPlayerIndex]!;
    if (currentPlayer.id !== sender) return;

    word = word.trim().toLowerCase();
    if (!word || word.length < 2) {
      await ctx.sendTrackedMessage(ctx.sock, groupId, `Provide a valid word starting with *${state.lastWord.slice(-1).toUpperCase()}*!`);
      return;
    }
    
    const expectedChar = state.lastWord.slice(-1);
    if (!word.startsWith(expectedChar)) {
      await ctx.sendTrackedMessage(ctx.sock, groupId, `❌ Word must start with *${expectedChar.toUpperCase()}*!`);
      return;
    }
    if (state.usedWords.has(word)) {
      await ctx.sendTrackedMessage(ctx.sock, groupId, `❌ Word already used!`);
      return;
    }

    if (state.timer) clearTimeout(state.timer);
    state.usedWords.add(word);
    state.lastWord = word;
    state.rounds++;
    
    // Increase difficulty every 5 rounds
    if (state.rounds % 5 === 0 && state.difficulty < 2) {
      state.difficulty++;
    }

    addWin(groupId, sender, senderName, 1);

    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const nextPlayer = state.players[state.currentPlayerIndex]!;
    const diffLabel = state.difficulty === 0 ? 'EASY' : (state.difficulty === 1 ? 'MEDIUM' : 'HARD');

    await ctx.sendTrackedMessage(
      ctx.sock, 
      groupId, 
      `✅ *${senderName}* played *${word}*!\n\nNext word starts with *${word.slice(-1).toUpperCase()}*.\n@${nextPlayer.id.split('@')[0]}, your turn! (20s)\nDifficulty: *${diffLabel}*`,
      [nextPlayer.id]
    );
    this.startTurnTimer(groupId, ctx);
  }

  private startTurnTimer(groupId: string, ctx: CommandContext) {
    const state = activeWCG.get(groupId);
    if (!state) return;
    
    state.timer = setTimeout(async () => {
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      await ctx.sendTrackedMessage(ctx.sock, groupId, `⏰ *TIME'S UP!*\n*${currentPlayer.name}* is eliminated!`);
      
      state.players.splice(state.currentPlayerIndex, 1);
      
      if (state.players.length === 1) {
        const winner = state.players[0]!;
        addWin(groupId, winner.id, winner.name, 5);
        await ctx.sendTrackedMessage(ctx.sock, groupId, `🏆 *GAME OVER!*\n*${winner.name}* wins! (+5 pts)`);
        activeWCG.delete(groupId);
      } else {
        if (state.currentPlayerIndex >= state.players.length) state.currentPlayerIndex = 0;
        const nextPlayer = state.players[state.currentPlayerIndex]!;
        const diffLabel = state.difficulty === 0 ? 'EASY' : (state.difficulty === 1 ? 'MEDIUM' : 'HARD');
        await ctx.sendTrackedMessage(
          ctx.sock, 
          groupId, 
          `Continuing... Next word starts with *${state.lastWord.slice(-1).toUpperCase()}*.\n@${nextPlayer.id.split('@')[0]}, your turn!\nDifficulty: *${diffLabel}*`,
          [nextPlayer.id]
        );
        this.startTurnTimer(groupId, ctx);
      }
    }, 20000);
  }
}

export class WordRandomCommand implements Command {
  name = 'Word Random Game';
  description = 'Play Word Random Game (WRG) - unscramble words!';
  trigger = 'wrg';
  target: 'chat' | 'self' = 'chat';
  aliases = ['wr', 'unscramble'];
  
  async execute(ctx: CommandContext): Promise<void> {
    const args = (ctx.argumentName || '').trim().toLowerCase().split(' ');
    const subcmd = args[0] || 'help';
    const groupId = ctx.remoteJid;
    const sender = ctx.msg?.key?.participant || ctx.msg?.participant || ctx.msg?.key?.remoteJid || 'unknown';
    const senderName = ctx.msg?.pushName || 'Player';

    if (subcmd === 'lb') {
      await ctx.sendTrackedMessage(ctx.sock, groupId, `🏆 *Word Game Leaderboard* 🏆\n${getLeaderboard(groupId)}`);
      return;
    }

    if (subcmd === 'start') {
      if (activeWCG.has(groupId)) {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `A game is already in progress!`);
        return;
      }

      addWin(groupId, sender, senderName, 0);
      const state: WCGState = {
        type: 'wrg',
        active: true,
        phase: 'lobby',
        players: [{ id: sender, name: senderName }],
        currentPlayerIndex: 0,
        lastWord: '',
        usedWords: new Set(),
        difficulty: 0,
        rounds: 0
      };
      activeWCG.set(groupId, state);

      state.timer = setTimeout(async () => {
        if (state.players.length < 2) {
          await ctx.sendTrackedMessage(ctx.sock, groupId, `Not enough players joined. Game cancelled!`);
          activeWCG.delete(groupId);
          return;
        }
        state.phase = 'playing';
        state.lastWord = getWord(0);
        
        state.players.sort(() => Math.random() - 0.5);
        state.currentPlayerIndex = 0;
        
        const currentPlayer = state.players[0]!;
        const playerNames = state.players.map(p => p.name).join(', ');
        const scrambled = state.lastWord.split('').sort(() => Math.random() - 0.5).join('');
        
        await ctx.sendTrackedMessage(
          ctx.sock, 
          groupId, 
          `🎮 *Word Random Started!*\nPlayers: ${playerNames}\n\nUnscramble: *${scrambled}*\n\n@${currentPlayer.id.split('@')[0]}, your turn!\nDifficulty: *EASY*`,
          [currentPlayer.id]
        );
        
        this.startTurnTimer(groupId, ctx);
      }, 60000);

      await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Random Lobby Opened!*\nType *${ctx.botInfo.prefix}wrg join* within 60s to play!`);
      return;
    }

    if (subcmd === 'join') {
      const state = activeWCG.get(groupId);
      if (!state || state.phase !== 'lobby') {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `No active lobby!`);
        return;
      }
      if (state.players.find(p => p.id === sender)) {
         await ctx.sendTrackedMessage(ctx.sock, groupId, `You already joined!`);
         return;
      }
      addWin(groupId, sender, senderName, 0);
      state.players.push({ id: sender, name: senderName });
      await ctx.sendTrackedMessage(ctx.sock, groupId, `✅ *${senderName}* joined!`);
      return;
    }

    if (subcmd === 'play') {
      await this.handlePlay(ctx, groupId, sender, senderName, args[1] || '');
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Random Game*\n\n- *${ctx.botInfo.prefix}wrg start* : Start lobby\n- *${ctx.botInfo.prefix}wrg join* : Join lobby\n- *Just type the word* while it's your turn!\n- *${ctx.botInfo.prefix}wrg lb* : Leaderboard`);
  }

  async handlePlay(ctx: CommandContext, groupId: string, sender: string, senderName: string, word: string): Promise<void> {
    const state = activeWCG.get(groupId);
    if (!state || state.phase !== 'playing' || state.type !== 'wrg') return;

    const currentPlayer = state.players[state.currentPlayerIndex]!;
    if (currentPlayer.id !== sender) return;

    word = word.trim().toLowerCase();
    if (word !== state.lastWord) {
      await ctx.sendTrackedMessage(ctx.sock, groupId, `❌ *Incorrect!* Try again.`);
      return;
    }

    if (state.timer) clearTimeout(state.timer);
    addWin(groupId, sender, senderName, 1);
    state.rounds++;

    if (state.rounds % 5 === 0 && state.difficulty < 2) {
      state.difficulty++;
    }

    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const nextPlayer = state.players[state.currentPlayerIndex]!;
    
    state.lastWord = getWord(state.difficulty);
    const scrambled = state.lastWord.split('').sort(() => Math.random() - 0.5).join('');
    const diffLabel = state.difficulty === 0 ? 'EASY' : (state.difficulty === 1 ? 'MEDIUM' : 'HARD');

    await ctx.sendTrackedMessage(
      ctx.sock, 
      groupId, 
      `✅ *${senderName}* got it right!\n\nNext scrambled: *${scrambled}*\n@${nextPlayer.id.split('@')[0]}, your turn!\nDifficulty: *${diffLabel}*`,
      [nextPlayer.id]
    );
    this.startTurnTimer(groupId, ctx);
  }

  private startTurnTimer(groupId: string, ctx: CommandContext) {
    const state = activeWCG.get(groupId);
    if (!state) return;
    
    state.timer = setTimeout(async () => {
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      await ctx.sendTrackedMessage(ctx.sock, groupId, `⏰ *TIME'S UP!*\n*${currentPlayer.name}* is eliminated! The word was *${state.lastWord}*.`);
      
      state.players.splice(state.currentPlayerIndex, 1);
      
      if (state.players.length === 1) {
        const winner = state.players[0]!;
        addWin(groupId, winner.id, winner.name, 5);
        await ctx.sendTrackedMessage(ctx.sock, groupId, `🏆 *GAME OVER!*\n*${winner.name}* wins! (+5 pts)`);
        activeWCG.delete(groupId);
      } else {
        if (state.currentPlayerIndex >= state.players.length) state.currentPlayerIndex = 0;
        const nextPlayer = state.players[state.currentPlayerIndex]!;
        
        state.lastWord = getWord(state.difficulty);
        const scrambled = state.lastWord.split('').sort(() => Math.random() - 0.5).join('');
        const diffLabel = state.difficulty === 0 ? 'EASY' : (state.difficulty === 1 ? 'MEDIUM' : 'HARD');
        
        await ctx.sendTrackedMessage(
          ctx.sock, 
          groupId, 
          `Continuing... Next scrambled: *${scrambled}*\n@${nextPlayer.id.split('@')[0]}, your turn!\nDifficulty: *${diffLabel}*`,
          [nextPlayer.id]
        );
        this.startTurnTimer(groupId, ctx);
      }
    }, 20000);
  }
}
