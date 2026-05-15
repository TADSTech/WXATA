import type { Command, CommandContext } from '../types';

export class AlexaCommand implements Command {
  name = 'Alexa Music';
  description = 'Play Music Using Sayan Official API 🚀';
  trigger = 'alexa';
  target: 'chat' | 'self' = 'chat';
  aliases = ['play', 'al', 'music'];

  async execute(ctx: CommandContext): Promise<void> {
    const { sock, remoteJid, argumentName } = ctx;

    if (!argumentName || argumentName.trim() === '') {
      await ctx.sendTrackedMessage(sock, remoteJid, '_*Please Enter A Song Name, Ex: Alexa Teri Ishq Main*_');
      return;
    }

    const query = argumentName.trim();
    const api = `https://api.sayan-nexuswork.workers.dev/music?query=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(api);
      const data = await res.json() as any;

      if (data.status !== 'success') {
        await ctx.sendTrackedMessage(sock, remoteJid, '_*No Results Found For Your Query, Try Another Song*_');
        return;
      }

      const caption = `☘️  Ꭲɪᴛʟᴇ : ${data.title}\n\n❒ ⏱️ Ꭰᴜʀᴀᴛɪᴏɴ : ${data.duration}\n\n❒ 🎭 Ꮩɪᴇᴡꜱ : ${data.views}\n\n❒ 📺 Ꮯʜᴀɴɴᴇʟ : ${data.channel}\n\n❒🎙️ Ꮯʀᴇᴀᴛᴏʀ : ${data.creator}\n\n*Uꜱᴇ Ꮋᴇᴀᴅᴘʜᴏɴᴇꜱ Fᴏʀ Ᏼᴇꜱᴛ Ꭼxᴘᴇʀɪᴇɴᴄᴇ... ☊*`;

      // Since we don't have exactly `message.sendFromUrl` like the original script,
      // we'll fetch the image and send it, then fetch the audio and send it.
      let thumbBuffer;
      if (data.thumbnail) {
          try {
             const tRes = await fetch(data.thumbnail);
             thumbBuffer = Buffer.from(await tRes.arrayBuffer());
             await sock.sendMessage(remoteJid, { image: thumbBuffer, caption }, { quoted: ctx.msg });
          } catch(e) {
             await ctx.sendTrackedMessage(sock, remoteJid, caption);
          }
      } else {
        await ctx.sendTrackedMessage(sock, remoteJid, caption);
      }

      const audioRes = await fetch(data.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://youtube.com/'
        }
      });

      if (!audioRes.ok) throw new Error('Audio fetch failed');

      const buffer = Buffer.from(await audioRes.arrayBuffer());

      if (!buffer) {
          await ctx.sendTrackedMessage(sock, remoteJid, '_*Audio Buffer Failed, Please Try Again*_');
          return;
      }

      await sock.sendMessage(
        remoteJid,
        {
          audio: buffer,
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: `${data.title}-sayanXstudio.mp3`,
          contextInfo: {
            externalAdReply: {
              title: data.title,
              body: data.creator,
              mediaType: 1,
              showAdAttribution: false,
              renderLargerThumbnail: false,
              thumbnailUrl: data.thumbnail
            }
          }
        },
        { quoted: ctx.msg }
      );

    } catch (e) {
      console.error(e);
      await ctx.sendTrackedMessage(sock, remoteJid, '_*Server Not Responding Right Now, Please Try Again Later*_');
    }
  }
}
