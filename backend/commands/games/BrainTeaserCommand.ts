import type { Command, CommandContext } from '../types';
import { addWin, getLeaderboard } from './GameUtils';

interface TeaserState {
  active: boolean;
  type: 'math' | 'word';
  answer: string;
}

const activeTeasers = new Map<string, TeaserState>();

const WORDS = ['developer', 'javascript', 'typescript', 'computer', 'keyboard', 'internet', 'whatsapp', 'programming', 'software', 'hardware'];

export class BrainTeaserCommand implements Command {
  name = 'Brain Teasers';
  description = 'Test your brain with math or word puzzles!';
  trigger = 'brainteaser';
  target: 'chat' | 'self' = 'chat';

  async execute(ctx: CommandContext): Promise<void> {
    const args = (ctx.argumentName || '').trim().toLowerCase().split(' ');
    const subcmd = args[0];
    const groupId = ctx.remoteJid;
    const sender = ctx.msg?.key?.participant || ctx.msg?.participant || ctx.msg?.key?.remoteJid || 'unknown';
    const senderName = ctx.msg?.pushName || 'Player';

    if (subcmd === 'lb') {
      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🧠 *Brain Teaser Leaderboard* 🧠\n${getLeaderboard(groupId)}`);
      return;
    }

    if (subcmd === 'math') {
      if (activeTeasers.get(groupId)?.active) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `A puzzle is already active! Answer with *${ctx.botInfo.prefix}brainteaser ans <answer>*`);
        return;
      }
      
      const a = Math.floor(Math.random() * 50) + 10;
      const b = Math.floor(Math.random() * 20) + 5;
      const ops = ['+', '-', '*'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      
      let ans = 0;
      if (op === '+') ans = a + b;
      if (op === '-') ans = a - b;
      if (op === '*') ans = a * (Math.floor(Math.random() * 5) + 2); // Keep mult simpler
      
      const displayOp = op === '*' ? 'x' : op;
      const question = op === '*' ? `${a} x ${ans/a}` : `${a} ${displayOp} ${b}`;
      
      activeTeasers.set(groupId, {
        active: true,
        type: 'math',
        answer: ans.toString()
      });

      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🧠 *MATH BLITZ!* 🧠\nWhat is: *${question}* ?\nFirst to answer with *${ctx.botInfo.prefix}brainteaser ans <number>* wins 2 pts!`);
      return;
    }

    if (subcmd === 'word') {
      if (activeTeasers.get(groupId)?.active) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `A puzzle is already active! Answer with *${ctx.botInfo.prefix}brainteaser ans <answer>*`);
        return;
      }

      const word = WORDS[Math.floor(Math.random() * WORDS.length)]!;
      const scrambled = word.split('').sort(() => 0.5 - Math.random()).join('');

      activeTeasers.set(groupId, {
        active: true,
        type: 'word',
        answer: word
      });

      await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🔡 *WORD SCRAMBLE!* 🔡\nUnscramble this word: *${scrambled.toUpperCase()}*\nFirst to answer with *${ctx.botInfo.prefix}brainteaser ans <word>* wins 2 pts!`);
      return;
    }

    if (subcmd === 'ans') {
      const teaser = activeTeasers.get(groupId);
      if (!teaser || !teaser.active) {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `No active puzzle! Start one with *${ctx.botInfo.prefix}brainteaser math* or *word*`);
        return;
      }

      const guess = (args[1] || '').trim();
      if (guess === teaser.answer) {
        teaser.active = false;
        addWin(groupId, sender, senderName, 2);
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `✅ *CORRECT!* ✅\n${senderName} got it! The answer was ${teaser.answer}. (+2 pts)`);
      } else {
        await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `❌ Incorrect! Try again.`);
      }
      return;
    }

    await ctx.sendTrackedMessage(ctx.sock, ctx.remoteJid, `🧠 *Brain Teasers* 🧠\n\n- *${ctx.botInfo.prefix}brainteaser math* : Start a math blitz\n- *${ctx.botInfo.prefix}brainteaser word* : Start a word scramble\n- *${ctx.botInfo.prefix}brainteaser ans <answer>* : Submit your answer\n- *${ctx.botInfo.prefix}brainteaser lb* : Show leaderboard`);
  }
}