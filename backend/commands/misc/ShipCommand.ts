import type { Command, CommandContext } from '../types';

function getRandomParticipant(participants: any[]): any {
  return participants[Math.floor(Math.random() * participants.length)];
}

function jidToNum(jid: string): string {
  return jid?.split('@')[0] || '';
}

export class ShipCommand implements Command {
  name = 'Ship';
  description = 'Find your partner in a group 💕';
  trigger = 'ship';
  target: 'chat' | 'self' = 'chat';
  aliases = ['sh', 'match', 'couple'];

  async execute(ctx: CommandContext): Promise<void> {
    const { sock, msg, remoteJid } = ctx;

    // Only allow in groups
    if (!remoteJid.endsWith('@g.us')) {
      await ctx.sendTrackedMessage(sock, remoteJid, '_*This command can only be used in groups.*_');
      return;
    }

    const sender = msg.key.participant || msg.key.remoteJid;
    
    // Check if reply or mentioned
    let target = null;
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      target = msg.message.extendedTextMessage.contextInfo.participant;
    } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
      target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    
    let metadata;
    try {
      metadata = await sock.groupMetadata(remoteJid);
    } catch (e) {
      await ctx.sendTrackedMessage(sock, remoteJid, '_*Could not fetch group metadata.*_');
      return;
    }

    const participants = metadata.participants || [];

    if (!target || target === sender) {
      let randomUser = getRandomParticipant(participants);
      let attempts = 0;
      // Trty to find someone else (max 10 attempts to avoid infinite loop in 1-person group)
      while (randomUser.id === sender && attempts < 10) {
        randomUser = getRandomParticipant(participants);
        attempts++;
      }
      target = randomUser.id;
    }

    if (!target || target === sender) {
      await ctx.sendTrackedMessage(sock, remoteJid, "_💔 Seems like you're destined to be alone_");
      return;
    }

    const caption = `💞 *Match Found:*\n@${jidToNum(sender)} ❤ @${jidToNum(target)}`;

    await sock.sendMessage(
      remoteJid,
      { 
        text: caption, 
        mentions: [sender, target] 
      },
      { quoted: msg }
    );
  }
}
