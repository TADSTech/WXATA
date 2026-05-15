import type { Command, CommandContext } from '../types';
import { addWin, getLeaderboard } from './GameUtils';

interface Player {
  id: string;
  name: string;
}

interface WCGState {
  active: boolean;
  phase: 'lobby' | 'playing';
  players: Player[];
  currentPlayerIndex: number;
  lastWord: string;
  usedWords: Set<string>;
  timer?: NodeJS.Timer | any;
}

const activeWCG = new Map<string, WCGState>();
const startWords = ['whatsapp', 'bot', 'game', 'javascript', 'phone', 'computer', 'apple', 'water', 'music'];

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
        await ctx.sendTrackedMessage(ctx.sock, groupId, `A game is already in progress! Type *${ctx.botInfo.prefix}wcg join* to enter if in lobby.`);
        return;
      }

      addWin(groupId, sender, senderName, 0); // Participants get 0
      const state: WCGState = {
        active: true,
        phase: 'lobby',
        players: [{ id: sender, name: senderName }],
        currentPlayerIndex: 0,
        lastWord: '',
        usedWords: new Set(),
      };
      activeWCG.set(groupId, state);

      state.timer = setTimeout(async () => {
        if (state.players.length < 2) {
          await ctx.sendTrackedMessage(ctx.sock, groupId, `Not enough players joined. Game cancelled!`);
          activeWCG.delete(groupId);
          return;
        }
        state.phase = 'playing';
        state.lastWord = startWords[Math.floor(Math.random() * startWords.length)]!;
        state.usedWords.add(state.lastWord);
        
        // Randomize player order
        state.players.sort(() => Math.random() - 0.5);
        state.currentPlayerIndex = 0;
        
        const currentPlayer = state.players[0]!;
        const playerNames = state.players.map(p => p.name).join(', ');
        await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Chain Started!* 🎮\nPlayers: ${playerNames}\n\nFirst word: *${state.lastWord}*\n\n@${currentPlayer.id.split('@')[0]}, it's your turn! Send a word starting with *${state.lastWord.slice(-1).toUpperCase()}* using *${ctx.botInfo.prefix}wcg play <word>*. You have 20s!`);
        
        this.startTurnTimer(groupId, ctx);
      }, 60000);

      await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Game Lobby Opened!* 🎮\nType *${ctx.botInfo.prefix}wcg join* within 60s to play!`);
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
      addWin(groupId, sender, senderName, 0); // Participants get 0
      state.players.push({ id: sender, name: senderName });
      await ctx.sendTrackedMessage(ctx.sock, groupId, `✅ ${senderName} joined!`);
      return;
    }

    if (subcmd === 'play') {
      const state = activeWCG.get(groupId);
      if (!state || state.phase !== 'playing') {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `Game is not running!`);
        return;
      }
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      if (currentPlayer.id !== sender) {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `Wait your turn! It's ${currentPlayer.name}'s turn.`);
        return;
      }

      const word = (args[1] || '').trim().toLowerCase();
      if (!word || word.length < 2) {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `Provide a valid word that starts with *${state.lastWord.slice(-1).toUpperCase()}*!`);
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
      addWin(groupId, sender, senderName, 1);

      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      const nextPlayer = state.players[state.currentPlayerIndex]!;

      await ctx.sendTrackedMessage(ctx.sock, groupId, `✅ ${senderName} played *${word}*!\n\nNext word must start with *${word.slice(-1).toUpperCase()}*.\n@${nextPlayer.id.split('@')[0]}, it's your turn! (20s)`);
      this.startTurnTimer(groupId, ctx);
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Games* 🎮\n\n- *${ctx.botInfo.prefix}wcg start* : Start lobby (60s)\n- *${ctx.botInfo.prefix}wcg join* : Join lobby\n- *${ctx.botInfo.prefix}wcg play <word>* : Play a word\n- *${ctx.botInfo.prefix}wcg lb* : Leaderboard`);
  }

  private startTurnTimer(groupId: string, ctx: CommandContext) {
    const state = activeWCG.get(groupId);
    if (!state) return;
    
    state.timer = setTimeout(async () => {
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      await ctx.sendTrackedMessage(ctx.sock, groupId, `⏰ *TIME'S UP!* ⏰\n${currentPlayer.name} failed to answer and is eliminated!`);
      
      state.players.splice(state.currentPlayerIndex, 1);
      
      if (state.players.length === 1) {
        const winner = state.players[0]!;
        addWin(groupId, winner.id, winner.name, 5);
        await ctx.sendTrackedMessage(ctx.sock, groupId, `🏆 *GAME OVER!* 🏆\n${winner.name} wins the Word Chain! (+5 pts)`);
        activeWCG.delete(groupId);
      } else {
        if (state.currentPlayerIndex >= state.players.length) state.currentPlayerIndex = 0;
        const nextPlayer = state.players[state.currentPlayerIndex]!;
        await ctx.sendTrackedMessage(ctx.sock, groupId, `Continuing... Next word starts with *${state.lastWord.slice(-1).toUpperCase()}*.\n@${nextPlayer.id.split('@')[0]}, it's your turn! (20s)`);
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
      if (activeWCG.has(groupId + '_wrg')) {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `A game is already in progress! Type *${ctx.botInfo.prefix}wrg join* to enter if in lobby.`);
        return;
      }

      addWin(groupId, sender, senderName, 0);
      const state: WCGState = {
        active: true,
        phase: 'lobby',
        players: [{ id: sender, name: senderName }],
        currentPlayerIndex: 0,
        lastWord: '',
        usedWords: new Set(),
      };
      activeWCG.set(groupId + '_wrg', state);

      state.timer = setTimeout(async () => {
        if (state.players.length < 2) {
          await ctx.sendTrackedMessage(ctx.sock, groupId, `Not enough players joined. Game cancelled!`);
          activeWCG.delete(groupId + '_wrg');
          return;
        }
        state.phase = 'playing';
        state.lastWord = startWords[Math.floor(Math.random() * startWords.length)]!;
        
        state.players.sort(() => Math.random() - 0.5);
        state.currentPlayerIndex = 0;
        
        const currentPlayer = state.players[0]!;
        const playerNames = state.players.map(p => p.name).join(', ');
        
        const scrambled = state.lastWord.split('').sort(() => Math.random() - 0.5).join('');
        
        await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Random Started!* 🎮\nPlayers: ${playerNames}\n\nUnscramble this word: *${scrambled}*\n\n@${currentPlayer.id.split('@')[0]}, it's your turn! Send the answer with *${ctx.botInfo.prefix}wrg play <word>*. You have 20s!`);
        
        this.startTurnTimer(groupId, ctx);
      }, 60000);

      await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Random Lobby Opened!* 🎮\nType *${ctx.botInfo.prefix}wrg join* within 60s to play!`);
      return;
    }

    if (subcmd === 'join') {
      const state = activeWCG.get(groupId + '_wrg');
      if (!state || state.phase !== 'lobby') {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `No active lobby! Start one with *${ctx.botInfo.prefix}wrg start*`);
        return;
      }
      if (state.players.find(p => p.id === sender)) {
         await ctx.sendTrackedMessage(ctx.sock, groupId, `You already joined!`);
         return;
      }
      addWin(groupId, sender, senderName, 0);
      state.players.push({ id: sender, name: senderName });
      await ctx.sendTrackedMessage(ctx.sock, groupId, `✅ ${senderName} joined!`);
      return;
    }

    if (subcmd === 'play') {
      const state = activeWCG.get(groupId + '_wrg');
      if (!state || state.phase !== 'playing') {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `Game is not running!`);
        return;
      }
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      if (currentPlayer.id !== sender) {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `Wait your turn! It's ${currentPlayer.name}'s turn.`);
        return;
      }

      const word = (args[1] || '').trim().toLowerCase();
      
      if (word !== state.lastWord) {
        await ctx.sendTrackedMessage(ctx.sock, groupId, `❌ Incorrect!`);
        return;
      }

      if (state.timer) clearTimeout(state.timer);
      addWin(groupId, sender, senderName, 1);

      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      const nextPlayer = state.players[state.currentPlayerIndex]!;
      
      state.lastWord = startWords[Math.floor(Math.random() * startWords.length)]!;
      const scrambled = state.lastWord.split('').sort(() => Math.random() - 0.5).join('');

      await ctx.sendTrackedMessage(ctx.sock, groupId, `✅ ${senderName} got it right!\n\nNext scrambled word: *${scrambled}*.\n@${nextPlayer.id.split('@')[0]}, it's your turn! (20s)`);
      this.startTurnTimer(groupId, ctx);
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, groupId, `🎮 *Word Random Game* 🎮\n\n- *${ctx.botInfo.prefix}wrg start* : Start lobby (60s)\n- *${ctx.botInfo.prefix}wrg join* : Join lobby\n- *${ctx.botInfo.prefix}wrg play <word>* : Play a word\n- *${ctx.botInfo.prefix}wrg lb* : Leaderboard`);
  }

  private startTurnTimer(groupId: string, ctx: CommandContext) {
    const state = activeWCG.get(groupId + '_wrg');
    if (!state) return;
    
    state.timer = setTimeout(async () => {
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      await ctx.sendTrackedMessage(ctx.sock, groupId, `⏰ *TIME'S UP!* ⏰\n${currentPlayer.name} failed to answer and is eliminated! The word was *${state.lastWord}*.`);
      
      state.players.splice(state.currentPlayerIndex, 1);
      
      if (state.players.length === 1) {
        const winner = state.players[0]!;
        addWin(groupId, winner.id, winner.name, 5);
        await ctx.sendTrackedMessage(ctx.sock, groupId, `🏆 *GAME OVER!* 🏆\n${winner.name} wins WRG! (+5 pts)`);
        activeWCG.delete(groupId + '_wrg');
      } else {
        if (state.currentPlayerIndex >= state.players.length) state.currentPlayerIndex = 0;
        const nextPlayer = state.players[state.currentPlayerIndex]!;
        
        state.lastWord = startWords[Math.floor(Math.random() * startWords.length)]!;
        const scrambled = state.lastWord.split('').sort(() => Math.random() - 0.5).join('');
        
        await ctx.sendTrackedMessage(ctx.sock, groupId, `Continuing... Next scrambled word is *${scrambled}*.\n@${nextPlayer.id.split('@')[0]}, it's your turn! (20s)`);
        this.startTurnTimer(groupId, ctx);
      }
    }, 20000);
  }
}
