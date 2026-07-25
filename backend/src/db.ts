import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const __dirname =
  typeof __filename !== 'undefined'
    ? path.dirname(__filename)
    : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:\/)/, '$1'));

const dbDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbFile = process.env.DB_FILE || path.join(dbDir, 'drug-reminder.db');
export const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      stop_backfill_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      per_box INTEGER NOT NULL DEFAULT 0,
      daily_dosage INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '粒',
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      before_stock INTEGER NOT NULL,
      after_stock INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'daily',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
    CREATE INDEX IF NOT EXISTS idx_stock_records_user_date ON stock_records(user_id, record_date);
    CREATE INDEX IF NOT EXISTS idx_stock_records_medicine_date ON stock_records(medicine_id, record_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_records_uniq ON stock_records(medicine_id, record_date, source);
    CREATE INDEX IF NOT EXISTS idx_units_user ON units(user_id);
  `);

  // 迁移：给旧表补列
  try {
    const medCols = db.prepare("PRAGMA table_info(medicines)").all() as { name: string }[];
    const medColNames = medCols.map((c) => c.name);
    if (!medColNames.includes('sort')) {
      db.exec("ALTER TABLE medicines ADD COLUMN sort INTEGER NOT NULL DEFAULT 0");
    }
    if (!medColNames.includes('unit')) {
      db.exec("ALTER TABLE medicines ADD COLUMN unit TEXT NOT NULL DEFAULT '粒'");
    }
    const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const userColNames = userCols.map((c) => c.name);
    if (!userColNames.includes('stop_backfill_date')) {
      db.exec("ALTER TABLE users ADD COLUMN stop_backfill_date TEXT");
    }
  } catch (e) {
    console.error('migration error:', e);
  }
}

export function ensureDefaultUnits(userId: number) {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM units WHERE user_id = ?').get(userId) as { cnt: number };
  if (existing.cnt > 0) return;
  const stmt = db.prepare('INSERT INTO units (user_id, name, sort) VALUES (?, ?, ?)');
  stmt.run(userId, '粒', 1);
  stmt.run(userId, '条', 2);
}
