import { db } from './db.js';

interface Medicine {
  id: number;
  user_id: number;
  name: string;
  stock: number;
  per_box: number;
  daily_dosage: number;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return formatDate(new Date());
}

/**
 * 对指定药品在指定日期扣减库存并写入记录。
 * 如果当天该药品已经有同源记录，则跳过。
 */
function deductStockForMedicineOnDate(medicineId: number, dateStr: string, source: 'daily' | '补更'): boolean {
  const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId) as Medicine | undefined;
  if (!med) return false;
  if (med.daily_dosage <= 0) return false;

  const exists = db
    .prepare('SELECT id FROM stock_records WHERE medicine_id = ? AND record_date = ? AND source = ?')
    .get(medicineId, dateStr, source) as { id: number } | undefined;
  if (exists) return false;

  const before = med.stock;
  const after = Math.max(0, before - med.daily_dosage);
  const change = after - before;

  try {
    db.exec('BEGIN');
    db.prepare('UPDATE medicines SET stock = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(
      after,
      medicineId
    );
    db.prepare(
      `INSERT INTO stock_records (user_id, medicine_id, before_stock, after_stock, change_amount, record_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(med.user_id, medicineId, before, after, change, dateStr, source);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return true;
}

/**
 * 对所有药品执行某一天的库存更新。
 */
export function updateAllStocksForDate(dateStr: string, source: 'daily' | '补更' = 'daily'): number {
  const meds = db.prepare('SELECT id FROM medicines').all() as { id: number }[];
  let count = 0;
  for (const m of meds) {
    if (deductStockForMedicineOnDate(m.id, dateStr, source)) count++;
  }
  return count;
}

/**
 * 检查并补更最近 N 天中缺失的记录（按用户维度，每个用户单独判断 stop_backfill_date）。
 * 返回补更的药品-天数合计。
 */
export function backfillRecentDays(days: number): number {
  const users = db.prepare('SELECT id, stop_backfill_date FROM users').all() as Array<{
    id: number;
    stop_backfill_date: string | null;
  }>;
  let total = 0;
  for (const u of users) {
    total += backfillRecentDaysForUser(u.id, days);
  }
  return total;
}

/**
 * 只给指定用户补更最近 N 天。
 * 如果设置了 stop_backfill_date，则只补该日期之后的。
 */
export function backfillRecentDaysForUser(userId: number, days: number): number {
  const today = new Date();
  const user = db.prepare('SELECT stop_backfill_date FROM users WHERE id = ?').get(userId) as
    | { stop_backfill_date: string | null }
    | undefined;
  const stopDate = user?.stop_backfill_date ? new Date(user.stop_backfill_date) : null;
  const meds = db.prepare('SELECT id FROM medicines WHERE user_id = ?').all(userId) as { id: number }[];
  let total = 0;
  for (const m of meds) {
    for (let i = 1; i <= days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (stopDate && d <= stopDate) continue;
      const dateStr = formatDate(d);
      if (deductStockForMedicineOnDate(m.id, dateStr, '补更')) total++;
    }
  }
  return total;
}

/**
 * 查询某用户的库存更新记录（分页，按日期倒序）。
 */
export function getUserStockRecords(userId: number, limit = 50, offset = 0) {
  const rows = db
    .prepare(
      `SELECT sr.*, m.name as medicine_name
       FROM stock_records sr
       LEFT JOIN medicines m ON m.id = sr.medicine_id
       WHERE sr.user_id = ?
       ORDER BY sr.record_date DESC, sr.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId, limit, offset) as Array<{
    id: number;
    user_id: number;
    medicine_id: number;
    medicine_name: string;
    before_stock: number;
    after_stock: number;
    change_amount: number;
    record_date: string;
    source: string;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    beforeStock: r.before_stock,
    afterStock: r.after_stock,
    changeAmount: r.change_amount,
    recordDate: r.record_date,
    source: r.source,
    createdAt: r.created_at,
  }));
}
