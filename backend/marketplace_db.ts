import { Database } from "bun:sqlite";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = fs.existsSync("/data") ? "/data" : path.resolve(import.meta.dir, "..");
const DB_PATH = path.resolve(DATA_DIR, "marketplace.db");

let db: Database;

function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA temp_store = MEMORY");
    migrate();
  }
  return db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      bio TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      trigger TEXT NOT NULL,
      aliases TEXT DEFAULT '[]',
      type TEXT NOT NULL DEFAULT 'misc',
      target TEXT NOT NULL DEFAULT 'chat',
      response TEXT DEFAULT '',
      code TEXT DEFAULT '',
      default_argument TEXT DEFAULT '',
      author_id TEXT NOT NULL REFERENCES users(id),
      author_username TEXT NOT NULL,
      status TEXT DEFAULT 'approved',
      downloads INTEGER DEFAULT 0,
      version TEXT DEFAULT '1.0.0',
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL REFERENCES plugins(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
    CREATE INDEX IF NOT EXISTS idx_plugins_author ON plugins(author_id);
    CREATE INDEX IF NOT EXISTS idx_plugins_type ON plugins(type);
    CREATE INDEX IF NOT EXISTS idx_reviews_plugin ON reviews(plugin_id);
  `);
}

// ── Password Hashing ──────────────────────────────────────────────

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, "sha512").toString("hex");
  return { hash, salt: s };
}

function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

// ── Simple Token ──────────────────────────────────────────────────

function generateToken(userId: string): string {
  return `${userId}.${crypto.randomBytes(32).toString("hex")}`;
}

const validTokens = new Map<string, string>(); // token -> userId

export function createToken(userId: string): string {
  const token = generateToken(userId);
  validTokens.set(token, userId);
  return token;
}

export function getUserIdFromToken(token: string): string | null {
  return validTokens.get(token) || null;
}

// ── Users ─────────────────────────────────────────────────────────

export interface MarketplaceUser {
  id: string;
  username: string;
  email: string;
  bio: string;
  created_at: string;
}

export function registerUser(username: string, email: string, password: string): { user: MarketplaceUser; token: string } | { error: string } {
  const d = getDb();

  const existing = d.query("SELECT id FROM users WHERE username = ? OR email = ?").get(username, email) as any;
  if (existing) return { error: "Username or email already taken" };

  const id = crypto.randomUUID();
  const { hash, salt } = hashPassword(password);

  d.query("INSERT INTO users (id, username, email, password_hash, salt) VALUES (?, ?, ?, ?, ?)").run(id, username, email, hash, salt);

  const user: MarketplaceUser = { id, username, email, bio: "", created_at: new Date().toISOString() };
  const token = createToken(id);
  return { user, token };
}

export function loginUser(username: string, password: string): { user: MarketplaceUser; token: string } | { error: string } {
  const d = getDb();
  const row = d.query("SELECT * FROM users WHERE username = ?").get(username) as any;
  if (!row) return { error: "Invalid credentials" };

  if (!verifyPassword(password, row.password_hash, row.salt)) return { error: "Invalid credentials" };

  const user: MarketplaceUser = { id: row.id, username: row.username, email: row.email, bio: row.bio, created_at: row.created_at };
  const token = createToken(row.id);
  return { user, token };
}

// ── Plugins ───────────────────────────────────────────────────────

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  trigger: string;
  aliases: string[];
  type: string;
  target: string;
  response: string;
  code: string;
  default_argument: string;
  author_id: string;
  author_username: string;
  status: string;
  downloads: number;
  version: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

function rowToPlugin(row: any): MarketplacePlugin {
  return {
    ...row,
    aliases: JSON.parse(row.aliases || "[]"),
    tags: JSON.parse(row.tags || "[]"),
  };
}

// Simple malicious code checks
function checkMaliciousCode(code: string): { safe: boolean; reason?: string } {
  if (!code) return { safe: true };

  const dangerous = [
    { pattern: /process\.exit/gi, reason: "Calls process.exit()" },
    { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/gi, reason: "Imports child_process" },
    { pattern: /require\s*\(\s*['"]fs['"]\s*\)\s*\.\s*(writeFileSync|writeFile|unlink|unlinkSync|rm|rmSync)\s*\(/gi, reason: "Writes/deletes files (outside __rootdir)" },
    { pattern: /eval\s*\(/gi, reason: "Uses eval()" },
    { pattern: /new\s+Function\s*\(/gi, reason: "Uses new Function()" },
    { pattern: /while\s*\(\s*true\s*\)/gi, reason: "Infinite loop detected" },
    { pattern: /setInterval\s*\(\s*[^,]+,\s*0\s*\)/gi, reason: "Zero-interval setInterval" },
  ];

  for (const { pattern, reason } of dangerous) {
    if (pattern.test(code)) return { safe: false, reason };
  }

  return { safe: true };
}

export function publishPlugin(
  data: Omit<MarketplacePlugin, "id" | "downloads" | "status" | "created_at" | "updated_at">
): { plugin: MarketplacePlugin } | { error: string } {
  const d = getDb();

  const existing = d.query("SELECT id FROM plugins WHERE trigger = ? AND author_id = ?").get(data.trigger, data.author_id) as any;
  if (existing) return { error: "You already have a plugin with this trigger" };

  const malicious = checkMaliciousCode(data.code);
  const status = malicious.safe ? "approved" : "pending";

  const id = crypto.randomUUID();
  d.query(`
    INSERT INTO plugins (id, name, description, trigger, aliases, type, target, response, code, default_argument, author_id, author_username, status, version, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.name, data.description, data.trigger,
    JSON.stringify(data.aliases), data.type, data.target,
    data.response, data.code, data.default_argument,
    data.author_id, data.author_username, status, data.version,
    JSON.stringify(data.tags)
  );

  const row = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  return { plugin: rowToPlugin(row) };
}

export function getPlugins(opts: {
  status?: string;
  type?: string;
  search?: string;
  author?: string;
  sort?: string;
  limit?: number;
  offset?: number;
} = {}): { plugins: MarketplacePlugin[]; total: number } {
  const d = getDb();

  let where = "WHERE status = ?";
  const params: any[] = [opts.status || "approved"];

  if (opts.type && opts.type !== "all") {
    where += " AND type = ?";
    params.push(opts.type);
  }
  if (opts.search) {
    where += " AND (name LIKE ? OR description LIKE ? OR trigger LIKE ?)";
    const q = `%${opts.search}%`;
    params.push(q, q, q);
  }
  if (opts.author) {
    where += " AND author_username LIKE ?";
    params.push(`%${opts.author}%`);
  }

  const countRow = d.query(`SELECT COUNT(*) as total FROM plugins ${where}`).get(...params) as any;
  const total = countRow?.total || 0;

  let orderBy = "ORDER BY downloads DESC";
  if (opts.sort === "newest") orderBy = "ORDER BY created_at DESC";
  if (opts.sort === "name") orderBy = "ORDER BY name ASC";

  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const rows = d.query(`SELECT * FROM plugins ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];

  return { plugins: rows.map(rowToPlugin), total };
}

export function getPluginById(id: string): MarketplacePlugin | null {
  const d = getDb();
  const row = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  return row ? rowToPlugin(row) : null;
}

export function getPluginByTrigger(trigger: string, authorId: string): MarketplacePlugin | null {
  const d = getDb();
  const row = d.query("SELECT * FROM plugins WHERE trigger = ? AND author_id = ?").get(trigger, authorId) as any;
  return row ? rowToPlugin(row) : null;
}

export function incrementDownload(id: string): void {
  const d = getDb();
  d.query("UPDATE plugins SET downloads = downloads + 1 WHERE id = ?").run(id);
}

export function updatePlugin(id: string, userId: string, data: Partial<MarketplacePlugin>): { plugin: MarketplacePlugin } | { error: string } {
  const d = getDb();
  const existing = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  if (!existing) return { error: "Plugin not found" };
  if (existing.author_id !== userId) return { error: "Not authorized" };

  const malicious = checkMaliciousCode(data.code || existing.code);
  const newStatus = malicious.safe ? "approved" : "pending";

  d.query(`
    UPDATE plugins SET name = ?, description = ?, trigger = ?, aliases = ?, type = ?,
    target = ?, response = ?, code = ?, default_argument = ?, status = ?, version = ?,
    tags = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.description ?? existing.description,
    data.trigger ?? existing.trigger,
    JSON.stringify(data.aliases ?? JSON.parse(existing.aliases || "[]")),
    data.type ?? existing.type,
    data.target ?? existing.target,
    data.response ?? existing.response,
    data.code ?? existing.code,
    data.default_argument ?? existing.default_argument,
    newStatus,
    data.version ?? existing.version,
    JSON.stringify(data.tags ?? JSON.parse(existing.tags || "[]")),
    id
  );

  const row = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  return { plugin: rowToPlugin(row) };
}

export function deletePlugin(id: string, userId: string): { success: boolean } | { error: string } {
  const d = getDb();
  const existing = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  if (!existing) return { error: "Plugin not found" };
  if (existing.author_id !== userId) return { error: "Not authorized" };

  d.query("DELETE FROM plugins WHERE id = ?").run(id);
  return { success: true };
}

export function getMyPlugins(userId: string): MarketplacePlugin[] {
  const d = getDb();
  const rows = d.query("SELECT * FROM plugins WHERE author_id = ? ORDER BY created_at DESC").all(userId) as any[];
  return rows.map(rowToPlugin);
}

// ── Seed starter plugins ──────────────────────────────────────────

export function seedStarterPlugins(): void {
  const d = getDb();
  const count = (d.query("SELECT COUNT(*) as c FROM plugins").get() as any).c;
  if (count > 0) return; // Already seeded

  // Check for starter-plugins directory
  const pluginsDir = path.resolve(import.meta.dir, "../marketplace/starter-plugins");
  if (!fs.existsSync(pluginsDir)) return;

  // Create a system author
  const systemId = "00000000-0000-0000-0000-000000000000";
  const existingUser = d.query("SELECT id FROM users WHERE id = ?").get(systemId) as any;
  if (!existingUser) {
    const { hash, salt } = hashPassword("system-do-not-delete");
    d.query("INSERT OR IGNORE INTO users (id, username, email, password_hash, salt) VALUES (?, ?, ?, ?, ?)").run(
      systemId, "WXATA", "system@wxata.dev", hash, salt
    );
  }

  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.resolve(pluginsDir, file), "utf-8");
      const plugin = JSON.parse(raw);
      const id = crypto.randomUUID();

      d.query(`
        INSERT OR IGNORE INTO plugins (id, name, description, trigger, aliases, type, target, response, code, default_argument, author_id, author_username, status, version, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)
      `).run(
        id, plugin.name, plugin.desc || plugin.description || "", plugin.trigger,
        JSON.stringify(plugin.aliases || []), plugin.type || "misc",
        plugin.target || "chat", plugin.response || "",
        plugin.code || "", plugin.defaultArgument || plugin.default_argument || "",
        systemId, "WXATA", plugin.version || "1.0.0",
        JSON.stringify(plugin.tags || [])
      );
    } catch (e) {
      console.error(`[marketplace] Failed to seed ${file}:`, e);
    }
  }

  const finalCount = (d.query("SELECT COUNT(*) as c FROM plugins WHERE status = 'approved'").get() as any).c;
  console.log(`📦 Marketplace: ${finalCount} starter plugins seeded`);
}

export function seedStarterPluginsFromFilesystem(): void {
  seedStarterPlugins();
}

// ── Admin functions ───────────────────────────────────────────────

export function getPendingPlugins(): MarketplacePlugin[] {
  const d = getDb();
  const rows = d.query("SELECT * FROM plugins WHERE status = 'pending' ORDER BY created_at DESC").all() as any[];
  return rows.map(rowToPlugin);
}

export function approvePlugin(id: string): { plugin: MarketplacePlugin } | { error: string } {
  const d = getDb();
  const row = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  if (!row) return { error: "Plugin not found" };

  d.query("UPDATE plugins SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(id);
  const updated = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  return { plugin: rowToPlugin(updated) };
}

export function rejectPlugin(id: string): { plugin: MarketplacePlugin } | { error: string } {
  const d = getDb();
  const row = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  if (!row) return { error: "Plugin not found" };

  d.query("UPDATE plugins SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(id);
  const updated = d.query("SELECT * FROM plugins WHERE id = ?").get(id) as any;
  return { plugin: rowToPlugin(updated) };
}
