import cron from 'node-cron';
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export const THEMES = [
  "Reflection / Quotes",       // 0 - Sunday
  "Business / News / Motivation", // 1 - Monday
  "Casual / Tech",             // 2 - Tuesday
  "Funny / Mid-week Memes",    // 3 - Wednesday
  "Throwback / Stories",       // 4 - Thursday
  "Weekend Vibes / Entertainment",// 5 - Friday
  "Lifestyle / Relax"          // 6 - Saturday
];

export interface ScheduledPost {
  id: string;
  postAt: number; // timestamp ms
  text: string;
  imageUrls: string[];
  applyStickers: boolean;
}

const scheduledPosts: ScheduledPost[] = [];

const ASSETS_DIR = path.resolve(__dirname, 'assets', 'stickers');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

export async function overlayStickers(imageBuffer: Buffer): Promise<Buffer> {
  const sticker1Path = path.join(ASSETS_DIR, 'sticker1.png');
  const sticker2Path = path.join(ASSETS_DIR, 'sticker2.png');
  
  if (!fs.existsSync(sticker1Path) || !fs.existsSync(sticker2Path)) {
    // If stickers are missing, just return original image
    return imageBuffer;
  }

  try {
    const baseImage = sharp(imageBuffer);
    const metadata = await baseImage.metadata();
    
    if (!metadata.width || !metadata.height) {
      return imageBuffer;
    }

    // Scale stickers to be 15% of the image width
    const stickerWidth = Math.floor(metadata.width * 0.15);

    const s1 = await sharp(sticker1Path).resize({ width: stickerWidth }).toBuffer();
    const s2 = await sharp(sticker2Path).resize({ width: stickerWidth }).toBuffer();

    return await baseImage
      .composite([
        { input: s1, gravity: 'northwest' }, // Top-Left
        { input: s2, gravity: 'southeast' }  // Bottom-Right
      ])
      .toBuffer();
  } catch (error) {
    console.error("Error overlaying stickers:", error);
    return imageBuffer;
  }
}

export async function fetchMeme(theme: string): Promise<{ text: string, imageBuffer: Buffer | null }> {
  try {
    // Basic fallback logic: fetch a random meme from meme-api
    const res = await axios.get('https://meme-api.com/gimme');
    if (res.data && res.data.url) {
      const imgRes = await axios.get(res.data.url, { responseType: 'arraybuffer' });
      return { text: res.data.title || theme, imageBuffer: Buffer.from(imgRes.data) };
    }
  } catch (e) {
    console.error("Error fetching meme:", e);
  }
  return { text: `Theme of the day: ${theme}`, imageBuffer: null };
}

export async function fetchQuote(): Promise<string> {
  try {
    const res = await axios.get('https://zenquotes.io/api/random');
    if (res.data && res.data.length > 0) {
      return `"${res.data[0].q}" - ${res.data[0].a}`;
    }
  } catch (e) {
    console.error("Error fetching quote:", e);
  }
  return "Stay positive, work hard, make it happen.";
}

const initializedAccounts = new Set<string>();

export function initTVMiniapp(sock: any, accountId: string) {
  if (initializedAccounts.has(accountId)) {
    return;
  }
  initializedAccounts.add(accountId);
  console.log(`[TV-Miniapp] Initialized for account ${accountId}`);

  // 1. Post Theme at 7:00 AM every day
  cron.schedule('0 7 * * *', async () => {
    const dayIndex = new Date().getDay();
    const theme = THEMES[dayIndex];
    try {
      await sock.sendMessage('status@broadcast', { text: `Good morning! 🌅\n\nToday's Theme: *${theme}*` });
      console.log(`[TV-Miniapp] Posted theme: ${theme}`);
    } catch (e) {
      console.error("[TV-Miniapp] Failed to post theme:", e);
    }
  });

  // 2. Post staggered content every 2 hours between 8 AM and 10 PM
  // We'll run a cron job every 2 hours (8, 10, 12, 14, 16, 18, 20, 22)
  cron.schedule('0 8-22/2 * * *', async () => {
    // Add randomized jitter (0 to 15 minutes) so it feels human
    const jitterMs = Math.floor(Math.random() * 15 * 60 * 1000);
    
    setTimeout(async () => {
      const dayIndex = new Date().getDay();
      const theme = THEMES[dayIndex];
      
      try {
        // Randomly decide between a quote or a meme
        const isMeme = Math.random() > 0.5;
        if (isMeme) {
          const meme = await fetchMeme(theme);
          if (meme.imageBuffer) {
            const brandedImage = await overlayStickers(meme.imageBuffer);
            await sock.sendMessage('status@broadcast', { 
              image: brandedImage, 
              caption: meme.text 
            });
            console.log(`[TV-Miniapp] Posted branded meme status.`);
          } else {
            await sock.sendMessage('status@broadcast', { text: meme.text });
          }
        } else {
          const quote = await fetchQuote();
          await sock.sendMessage('status@broadcast', { text: quote });
          console.log(`[TV-Miniapp] Posted quote status.`);
        }
      } catch (e) {
        console.error("[TV-Miniapp] Failed to post content:", e);
      }
    }, jitterMs);
  });
}

// Global reference for sock
let _tvSock: any = null;

export function setTvSock(sock: any) {
  _tvSock = sock;
}

export function scheduleTweetPost(post: ScheduledPost) {
  scheduledPosts.push(post);
  console.log(`[TV-Miniapp] Scheduled post ${post.id} for ${new Date(post.postAt).toISOString()}`);
}

// Poll scheduled posts every minute
cron.schedule('* * * * *', async () => {
  if (!_tvSock) return;
  const now = Date.now();
  
  for (let i = scheduledPosts.length - 1; i >= 0; i--) {
    const post = scheduledPosts[i];
    if (now >= post.postAt) {
      // time to post
      try {
        let imageBuffer: Buffer | undefined;
        if (post.imageUrls && post.imageUrls.length > 0) {
          const imgRes = await axios.get(post.imageUrls[0], { responseType: 'arraybuffer' });
          imageBuffer = Buffer.from(imgRes.data);
          if (post.applyStickers) {
            imageBuffer = await overlayStickers(imageBuffer);
          }
        }
        
        if (imageBuffer) {
           await _tvSock.sendMessage('status@broadcast', { 
             image: imageBuffer, 
             caption: post.text 
           });
        } else {
           await _tvSock.sendMessage('status@broadcast', { text: post.text });
        }
        console.log(`[TV-Miniapp] Posted scheduled tweet ${post.id}`);
      } catch (e) {
        console.error(`[TV-Miniapp] Failed to post scheduled tweet ${post.id}`, e);
      }
      
      // remove from queue
      scheduledPosts.splice(i, 1);
    }
  }
});
