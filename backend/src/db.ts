import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const __dirname =
  typeof __filename !== 'undefined'
    ? path.dirname(__filename)
    : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:\/)/, '$1'));

// 生产环境（打包后 dist/index.mjs 运行时）：
// 1. 先检查 ../data/ 下是否存在数据库文件，如存在 → 移动到 index.mjs 同级目录
// 2. 之后只在 index.mjs 同级目录读取和创建数据库，不再回退到 ../data/
// 开发环境（tsx 跑 src/db.ts）：沿用 ../data/ 目录，避免污染源码目录
const isDist =
  process.env.NODE_ENV === 'production' ||
  path.basename(__dirname) === 'dist' ||
  __dirname.replace(/\\/g, '/').endsWith('/dist');

const siblingPath = path.join(__dirname, 'drug-reminder.db');
const dataDir = path.resolve(__dirname, '../data');
const dataDirPath = path.join(dataDir, 'drug-reminder.db');

if (isDist) {
  // 生产环境：如 ../data 存在 DB 且 dist 同级没有 → 移动（含 WAL/SHM）
  if (fs.existsSync(dataDirPath) && !fs.existsSync(siblingPath)) {
    const baseNames = [
      'drug-reminder.db',
      'drug-reminder.db-wal',
      'drug-reminder.db-shm',
    ];
    for (const b of baseNames) {
      const src = path.join(dataDir, b);
      const dst = path.join(__dirname, b);
      if (fs.existsSync(src)) {
        try {
          // 先 copy 再删源（兼容跨盘）
          fs.copyFileSync(src, dst);
          try { fs.unlinkSync(src); } catch { /* ignore */ }
          console.log(`[db-move] ${src} -> ${dst}`);
        } catch (e) {
          console.warn(`[db-move] failed for ${b}:`, e);
        }
      }
    }
  }
}

// 最终 DB 路径：生产环境只走 index.mjs 同级；开发环境走 ../data/
const finalDir = isDist ? __dirname : dataDir;
const finalFile = process.env.DB_FILE || (isDist ? siblingPath : dataDirPath);
if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
export const db = new DatabaseSync(finalFile);

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

    CREATE TABLE IF NOT EXISTS hospital_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      visit_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_visits_uniq ON hospital_visits(user_id, visit_date);
    CREATE INDEX IF NOT EXISTS idx_hospital_visits_date ON hospital_visits(user_id, visit_date);

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
      unit TEXT NOT NULL DEFAULT '片',
      cycle TEXT NOT NULL DEFAULT 'daily',
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
      cycle TEXT NOT NULL DEFAULT 'daily',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
    CREATE INDEX IF NOT EXISTS idx_stock_records_user_date ON stock_records(user_id, record_date);
    CREATE INDEX IF NOT EXISTS idx_stock_records_medicine_date ON stock_records(medicine_id, record_date);
    -- 手动更新(source='manual')可能同一天多次操作，因此仅对自动/补更来源做唯一约束
    DROP INDEX IF EXISTS idx_stock_records_uniq;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_records_uniq
      ON stock_records(medicine_id, record_date, source, cycle)
      WHERE source IN ('daily', 'weekly', '补更');
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
      db.exec("ALTER TABLE medicines ADD COLUMN unit TEXT NOT NULL DEFAULT '片'");
    }
    if (!medColNames.includes('cycle')) {
      db.exec("ALTER TABLE medicines ADD COLUMN cycle TEXT NOT NULL DEFAULT 'daily'");
    }
    const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const userColNames = userCols.map((c) => c.name);
    if (!userColNames.includes('stop_backfill_date')) {
      db.exec("ALTER TABLE users ADD COLUMN stop_backfill_date TEXT");
    }
    const srCols = db.prepare("PRAGMA table_info(stock_records)").all() as { name: string }[];
    const srColNames = srCols.map((c) => c.name);
    if (!srColNames.includes('cycle')) {
      db.exec("ALTER TABLE stock_records ADD COLUMN cycle TEXT NOT NULL DEFAULT 'daily'");
    }
    // 迁移：旧的全量唯一索引→切换为仅针对自动/补更来源的部分唯一索引
    try {
      db.exec("DROP INDEX IF EXISTS idx_stock_records_uniq");
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_records_uniq
        ON stock_records(medicine_id, record_date, source, cycle)
        WHERE source IN ('daily', 'weekly', '补更')`);
    } catch { /* ignore */ }
  } catch (e) {
    console.error('migration error:', e);
  }
}

export function ensureDefaultUnits(userId: number) {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM units WHERE user_id = ?').get(userId) as { cnt: number };
  if (existing.cnt > 0) return;
  const stmt = db.prepare('INSERT INTO units (user_id, name, sort) VALUES (?, ?, ?)');
  stmt.run(userId, '片', 1);
  stmt.run(userId, '条', 2);
}
