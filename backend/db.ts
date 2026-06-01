import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';

// Use Render's persistent disk at /data if available, otherwise local db/
const DB_DIR = fs.existsSync('/data')
  ? '/data'
  : path.resolve(process.cwd(), 'db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'messages.sqlite'));

// Optimize SQLite for high performance and low lock contention under heavy WhatsApp message loads
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA synchronous = NORMAL;');
db.run('PRAGMA temp_store = MEMORY;');

export function getRetentionDays(): number {
  try {
    const VARS_PATH = path.resolve(process.cwd(), 'vars.json');
    if (fs.existsSync(VARS_PATH)) {
      const vars = JSON.parse(fs.readFileSync(VARS_PATH, 'utf8'));
      if (vars.DB_RETENTION_DAYS) {
        return +(vars.DB_RETENTION_DAYS);
      }
    }
  } catch (e) {}
  return +(process.env.DB_RETENTION_DAYS || 3);
}

export function setRetentionDays(days: number): void {
  // Provided for compatibility; writes can be handled via vars.json or process.env
}

export function getMaxMessages(): number {
  try {
    const VARS_PATH = path.resolve(process.cwd(), 'vars.json');
    if (fs.existsSync(VARS_PATH)) {
      const vars = JSON.parse(fs.readFileSync(VARS_PATH, 'utf8'));
      if (vars.DB_MAX_MESSAGES) {
        return +(vars.DB_MAX_MESSAGES);
      }
    }
  } catch (e) {}
  return +(process.env.DB_MAX_MESSAGES || 200); // Default to 200 messages as requested
}

export function setMaxMessages(limit: number): void {
  // Provided for compatibility; writes can be handled via vars.json or process.env
}

// init
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    remoteJid TEXT,
    participant TEXT,
    fromMe INTEGER,
    timestamp INTEGER,
    messagePayload TEXT,
    viewOnce INTEGER DEFAULT 0
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp)`);

let insertCounter = 0;

export function storeMessage(msg: any, explicitTimestamp?: number) {
  if (!msg?.key?.id) return;
  const isViewOnce = msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV2Extension ? 1 : 0;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages (id, remoteJid, participant, fromMe, timestamp, messagePayload, viewOnce)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(
      msg.key.id,
      msg.key.remoteJid,
      msg.key.participant || msg.key.remoteJid,
      msg.key.fromMe ? 1 : 0,
      explicitTimestamp || Date.now(),
      JSON.stringify(msg),
      isViewOnce
    );

    // Enforce max capacity limit every 100 stored messages to keep SQLite footprint consistently small
    insertCounter++;
    if (insertCounter >= 100) {
      insertCounter = 0;
      queueMicrotask(() => {
        const pruned = pruneToMaxCapacity();
        if (pruned > 0) {
          console.log(`[DB] Auto-pruned ${pruned} messages to maintain max capacity of ${getMaxMessages()}`);
        }
      });
    }
  } catch (e) {
    console.error('Failed to store message', e);
  }
}

export function getMessage(id: string): any | null {
  const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  try {
    return JSON.parse(row.messagePayload);
  } catch {
    return null;
  }
}

export function pruneOldMessages(): number {
  const days = getRetentionDays();
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const result = db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
  return (result as any).changes ?? 0;
}

export function pruneToMaxCapacity(): number {
  const limit = getMaxMessages();
  const count = getMessageCount();
  if (count <= limit) return 0;
  const overflow = count - limit;
  try {
    const result = db.prepare(`
      DELETE FROM messages WHERE id IN (
        SELECT id FROM messages ORDER BY timestamp ASC LIMIT ?
      )
    `).run(overflow);
    return (result as any).changes ?? 0;
  } catch (e) {
    console.error('[DB] Failed to prune messages to capacity limit', e);
    return 0;
  }
}

export function getMessageCount(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
  return row?.count ?? 0;
}

// Scheduled prune — runs every 12 hours automatically
setInterval(() => {
  const deletedOld = pruneOldMessages();
  const deletedCap = pruneToMaxCapacity();
  if (deletedOld > 0 || deletedCap > 0) {
    console.log(`[DB] Scheduled prune: removed ${deletedOld} expired messages and ${deletedCap} overflow messages`);
  }
}, 12 * 60 * 60 * 1000);

// Also run an initial prune shortly after startup
setTimeout(() => {
  const deletedOld = pruneOldMessages();
  const deletedCap = pruneToMaxCapacity();
  if (deletedOld > 0 || deletedCap > 0) {
    console.log(`[DB] Startup prune: removed ${deletedOld} expired messages and ${deletedCap} overflow messages`);
  }
}, 10000); // 10 seconds after startup

