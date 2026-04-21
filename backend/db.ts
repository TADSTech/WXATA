import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(process.cwd(), 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'messages.sqlite'));
// Retention period for stored messages (default 3 days)
const EXTIRPATION_DAYS = +(process.env.DB_RETENTION_DAYS || 3);

// init — bun:sqlite uses db.run() for DDL, not db.exec()
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

export function storeMessage(msg: any) {
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
      Date.now(),
      JSON.stringify(msg),
      isViewOnce
    );
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

export function pruneOldMessages() {
  const cutoff = Date.now() - (EXTIRPATION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoff);
}
