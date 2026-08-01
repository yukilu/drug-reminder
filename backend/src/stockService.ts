import { db } from './db.js';

interface Medicine {
  id: number;
  user_id: number;
  name: string;
  stock: number;
  per_box: number;
  daily_dosage: number;
  cycle: 'daily' | 'weekly';
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
 * 给定某日期，返回它所在周的周一日期字符串（周一为一周的开始）。
 */
function weekMondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  return formatDate(d);
}

/**
 * 对指定药品在指定日期/周扣减库存并写入记录。
 * cycle: daily —— dailyDosage 表示每天用量，扣除 1 天 * daily_dosage
 * cycle: weekly —— dailyDosage 表示每周用量，扣除 1 周 * daily_dosage
 * record_date： daily 传当天日期字符串；weekly 传当周周一日期字符串
 * 如果已经有同源同周期记录，则跳过。
 */
function deductStock(
  medicineId: number,
  recordDate: string,
  source: 'daily' | 'weekly' | '补更',
  cycle: 'daily' | 'weekly'
): boolean {
  const med = db.prepare('SELECT * FROM medicines WHERE id = ?').get(medicineId) as Medicine | undefined;
  if (!med) return false;
  const medCycle: 'daily' | 'weekly' = med.cycle === 'weekly' ? 'weekly' : 'daily';
  if (medCycle !== cycle) return false;
  if (med.daily_dosage <= 0) return false;

  const exists = db
    .prepare('SELECT id FROM stock_records WHERE medicine_id = ? AND record_date = ? AND source = ? AND cycle = ?')
    .get(medicineId, recordDate, source, cycle) as { id: number } | undefined;
  if (exists) return false;

  const deductAmount = med.daily_dosage; // daily 下=1天用量，weekly下=1周用量
  const before = med.stock;
  const after = Math.max(0, before - deductAmount);
  const change = after - before;

  try {
    db.exec('BEGIN');
    db.prepare('UPDATE medicines SET stock = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(
      after,
      medicineId
    );
    db.prepare(
      `INSERT INTO stock_records (user_id, medicine_id, before_stock, after_stock, change_amount, record_date, source, cycle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(med.user_id, medicineId, before, after, change, recordDate, source, cycle);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return true;
}

/**
 * 对所有 daily 周期的药品，在指定日期执行扣减（用于每日零点和补更）。
 */
export function updateAllStocksForDate(dateStr: string, source: 'daily' | '补更' = 'daily'): number {
  const meds = db.prepare("SELECT id FROM medicines WHERE cycle = 'daily' OR cycle IS NULL OR cycle = ''").all() as { id: number }[];
  let count = 0;
  for (const m of meds) {
    if (deductStock(m.id, dateStr, source, 'daily')) count++;
  }
  return count;
}

/**
 * 对所有 weekly 周期的药品，在指定周（weekMondayStr 为该周周一）执行扣减。
 * 每周一零点运行一次，扣减上周周期。
 */
export function updateWeeklyStocksForWeekOfDate(weekMondayStr: string, source: 'weekly' | '补更' = 'weekly'): number {
  const meds = db.prepare("SELECT id FROM medicines WHERE cycle = 'weekly'").all() as { id: number }[];
  let count = 0;
  for (const m of meds) {
    if (deductStock(m.id, weekMondayStr, source, 'weekly')) count++;
  }
  return count;
}

/**
 * 补更最近 N 天和最近 N 周（合并调用，返回合计补更条数）。
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

export function backfillRecentWeeks(weeks: number): number {
  const users = db.prepare('SELECT id, stop_backfill_date FROM users').all() as Array<{
    id: number;
    stop_backfill_date: string | null;
  }>;
  let total = 0;
  for (const u of users) {
    total += backfillRecentWeeksForUser(u.id, weeks);
  }
  return total;
}

export function backfillRecentDaysForUser(userId: number, days: number): number {
  const today = new Date();
  const user = db.prepare('SELECT stop_backfill_date FROM users WHERE id = ?').get(userId) as
    | { stop_backfill_date: string | null }
    | undefined;
  const stopDate = user?.stop_backfill_date ? new Date(user.stop_backfill_date) : null;
  const meds = db.prepare("SELECT id FROM medicines WHERE user_id = ? AND (cycle = 'daily' OR cycle IS NULL OR cycle = '')").all(userId) as { id: number }[];
  let total = 0;
  for (const m of meds) {
    for (let i = 1; i <= days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (stopDate && d <= stopDate) continue;
      const dateStr = formatDate(d);
      if (deductStock(m.id, dateStr, '补更', 'daily')) total++;
    }
  }
  return total;
}

export function backfillRecentWeeksForUser(userId: number, weeks: number): number {
  const today = new Date();
  const user = db.prepare('SELECT stop_backfill_date FROM users WHERE id = ?').get(userId) as
    | { stop_backfill_date: string | null }
    | undefined;
  const stopDate = user?.stop_backfill_date ? new Date(user.stop_backfill_date) : null;
  const meds = db.prepare("SELECT id FROM medicines WHERE user_id = ? AND cycle = 'weekly'").all(userId) as { id: number }[];
  if (meds.length === 0) return 0;

  // 今天所在周的周一
  const tDay = today.getDay() === 0 ? 7 : today.getDay();
  const mondayThisWeek = new Date(today);
  mondayThisWeek.setDate(today.getDate() - (tDay - 1));

  let total = 0;
  for (let i = 1; i <= weeks; i++) {
    // i=1 表示上周（过去已经完整/部分经过的一周）
    const weekMonday = new Date(mondayThisWeek);
    weekMonday.setDate(mondayThisWeek.getDate() - i * 7);
    if (stopDate && weekMonday <= stopDate) continue;
    const weekMondayStr = formatDate(weekMonday);
    for (const m of meds) {
      if (deductStock(m.id, weekMondayStr, '补更', 'weekly')) total++;
    }
  }
  return total;
}

/**
 * 查询某用户的库存更新记录（分页，按日期倒序）。
 * sourceFilter：可选，仅返回指定来源的记录（不传则返回所有自动/补更来源，用于"自动更新记录"页）
 */
export function getUserStockRecords(userId: number, limit = 50, offset = 0, sourceFilter?: string[]) {
  const whereParts: string[] = ['sr.user_id = ?'];
  const params: any[] = [userId];
  if (sourceFilter && sourceFilter.length > 0) {
    whereParts.push(`sr.source IN (${sourceFilter.map(() => '?').join(',')})`);
    params.push(...sourceFilter);
  }
  params.push(limit, offset);
  const rows = db
    .prepare(
      `SELECT sr.*, m.name as medicine_name
       FROM stock_records sr
       LEFT JOIN medicines m ON m.id = sr.medicine_id
       WHERE ${whereParts.join(' AND ')}
       ORDER BY sr.record_date DESC, sr.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params) as Array<{
    id: number;
    user_id: number;
    medicine_id: number;
    medicine_name: string;
    before_stock: number;
    after_stock: number;
    change_amount: number;
    record_date: string;
    source: string;
    cycle: 'daily' | 'weekly';
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
    cycle: r.cycle || 'daily',
    createdAt: r.created_at,
  }));
}

/**
 * 分页统计某用户库存记录数。
 */
export function countUserStockRecords(userId: number, sourceFilter?: string[]): number {
  const whereParts: string[] = ['user_id = ?'];
  const params: any[] = [userId];
  if (sourceFilter && sourceFilter.length > 0) {
    whereParts.push(`source IN (${sourceFilter.map(() => '?').join(',')})`);
    params.push(...sourceFilter);
  }
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM stock_records WHERE ${whereParts.join(' AND ')}`)
    .get(...params) as { cnt: number };
  return row?.cnt || 0;
}

interface Medicine {
  id: number;
  user_id: number;
  name: string;
  stock: number;
  per_box: number;
  daily_dosage: number;
  cycle: 'daily' | 'weekly';
}

/**
 * 手动更新库存（以盒为单位调整）。
 * quantityBoxes 正数=入库增加，负数=出库扣减。
 * 会同时更新 medicines.stock 并写入 stock_records（source='manual'）。
 */
export function manualUpdateStock(userId: number, medicineId: number, quantityBoxes: number): {
  id: number;
  beforeStock: number;
  afterStock: number;
  changeAmount: number;
  changeBoxes: number;
} {
  if (!Number.isFinite(quantityBoxes)) throw new Error('数量(盒)格式错误');
  if (quantityBoxes === 0) throw new Error('数量(盒)不能为0');

  const med = db.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?')
    .get(medicineId, userId) as Medicine | undefined;
  if (!med) throw new Error('药品不存在');

  const perBox = Math.max(0, med.per_box || 0);
  const changeAmount = Math.round(quantityBoxes * perBox);
  if (changeAmount === 0) throw new Error('药品规格为0，无法按盒增减');

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const recordDate = `${y}-${m}-${d}`;

  const before = med.stock;
  const after = before + changeAmount;
  if (after < 0) throw new Error('扣减后库存不能为负数');

  try {
    db.exec('BEGIN');
    db.prepare('UPDATE medicines SET stock = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(after, medicineId);
    const info = db.prepare(
      `INSERT INTO stock_records
       (user_id, medicine_id, before_stock, after_stock, change_amount, record_date, source, cycle)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)`
    ).run(userId, medicineId, before, after, changeAmount, recordDate, med.cycle || 'daily');
    db.exec('COMMIT');
    return {
      id: Number(info.lastInsertRowid),
      beforeStock: before,
      afterStock: after,
      changeAmount,
      changeBoxes: quantityBoxes,
    };
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

export { weekMondayOf };
