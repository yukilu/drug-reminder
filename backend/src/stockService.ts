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
 * dateFilter：可选，按 record_date 精确过滤（YYYY-MM-DD）
 */
export function getUserStockRecords(userId: number, limit = 50, offset = 0, sourceFilter?: string[], dateFilter?: string) {
  const whereParts: string[] = ['sr.user_id = ?'];
  const params: any[] = [userId];
  if (sourceFilter && sourceFilter.length > 0) {
    whereParts.push(`sr.source IN (${sourceFilter.map(() => '?').join(',')})`);
    params.push(...sourceFilter);
  }
  if (dateFilter) {
    whereParts.push('sr.record_date = ?');
    params.push(dateFilter);
  }
  params.push(limit, offset);
  const rows = db
    .prepare(
      `SELECT sr.*, m.name as medicine_name, m.per_box as medicine_per_box
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
    medicine_per_box: number;
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
    perBox: r.medicine_per_box || 0,
    createdAt: r.created_at,
  }));
}

/**
 * 分页统计某用户库存记录数。
 * dateFilter：可选，按 record_date 精确过滤（YYYY-MM-DD）
 */
export function countUserStockRecords(userId: number, sourceFilter?: string[], dateFilter?: string): number {
  const whereParts: string[] = ['user_id = ?'];
  const params: any[] = [userId];
  if (sourceFilter && sourceFilter.length > 0) {
    whereParts.push(`source IN (${sourceFilter.map(() => '?').join(',')})`);
    params.push(...sourceFilter);
  }
  if (dateFilter) {
    whereParts.push('record_date = ?');
    params.push(dateFilter);
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

// ==================== 配药补货 ====================

/**
 * 计算单个药品在配药后需补的量（粒数）。
 * dispensingDate: 刚过去的配药日期
 * nextVisitDate: 下一次配药日期（若没有则返回0）
 * currentStock: 当前库存（已扣减当天用量后）
 */
function calcReplenishPills(
  med: Medicine,
  dispensingDate: string,
  nextVisitDate: string | null
): { pills: number; boxes: number } {
  if (!nextVisitDate) return { pills: 0, boxes: 0 };
  const isWeekly = med.cycle === 'weekly';
  const dosage = med.daily_dosage;
  if (dosage <= 0) return { pills: 0, boxes: 0 };

  const periodDays = Math.max(1, daysBetween(dispensingDate, nextVisitDate));

  // 周期内需要的总量
  let requiredForPeriod: number;
  if (isWeekly) {
    requiredForPeriod = Math.max(0, Math.ceil(periodDays / 7)) * dosage;
  } else {
    requiredForPeriod = periodDays * dosage;
  }

  // 需补 = 周期需要 - 当前已有库存
  const pills = Math.max(0, requiredForPeriod - med.stock);
  const boxes = med.per_box > 0 ? Math.ceil(pills / med.per_box) : 0;
  return { pills, boxes };
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

/**
 * 在每日0点扣减后调用：检查昨天是否为配药日，若是则自动补货。
 * recordDate 记为今天（补货执行日），source='配药补货'。
 * 返回补货的记录条数。
 */
export function replenishAfterDispensingDay(): number {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const todayStr = formatDate(today);

  // 找到昨天有配药记录的用户
  const users = db
    .prepare('SELECT DISTINCT user_id FROM hospital_visits WHERE visit_date = ?')
    .all(yesterdayStr) as Array<{ user_id: number }>;

  let total = 0;
  for (const u of users) {
    total += replenishForUser(u.user_id, yesterdayStr, todayStr);
  }
  return total;
}

/**
 * 对单个用户执行配药补货。
 * dispensingDate: 配药日（昨天）
 * recordDate: 记录日期（今天）
 */
function replenishForUser(userId: number, dispensingDate: string, recordDate: string): number {
  // 找到配药日之后的下一次配药日期
  const nextVisit = db
    .prepare('SELECT visit_date FROM hospital_visits WHERE user_id = ? AND visit_date > ? ORDER BY visit_date ASC LIMIT 1')
    .get(userId, dispensingDate) as { visit_date: string } | undefined;

  const nextVisitDate = nextVisit?.visit_date || null;

  const meds = db
    .prepare('SELECT * FROM medicines WHERE user_id = ?')
    .all(userId) as Medicine[];

  let count = 0;
  for (const med of meds) {
    if (med.daily_dosage <= 0) continue;

    // 防止重复补货：同药品同日期同source已存在则跳过
    const exists = db
      .prepare('SELECT id FROM stock_records WHERE medicine_id = ? AND record_date = ? AND source = ?')
      .get(med.id, recordDate, '配药补货') as { id: number } | undefined;
    if (exists) continue;

    const { pills } = calcReplenishPills(med, dispensingDate, nextVisitDate);
    if (pills <= 0) continue;

    const before = med.stock;
    const after = before + pills;

    try {
      db.exec('BEGIN');
      db.prepare('UPDATE medicines SET stock = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(
        after,
        med.id
      );
      db.prepare(
        `INSERT INTO stock_records (user_id, medicine_id, before_stock, after_stock, change_amount, record_date, source, cycle)
         VALUES (?, ?, ?, ?, ?, ?, '配药补货', ?)`
      ).run(userId, med.id, before, after, pills, recordDate, med.cycle || 'daily');
      db.exec('COMMIT');
      count++;
    } catch {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    }
  }
  return count;
}

/**
 * 预览下一次配药日的补货情况（供前端展示）。
 * 返回下一次配药日期、下一次配药后的补货预览。
 */
export function getReplenishPreview(userId: number): {
  nextDispensingDate: string | null;
  nextNextDate: string | null;
  periodDays: number | null;
  items: Array<{
    medicineId: number;
    medicineName: string;
    pills: number;
    boxes: number;
    unit: string;
    currentStock: number;
    perBox: number;
    cycle: 'daily' | 'weekly';
    dailyDosage: number;
  }>;
} {
  const today = formatDate(new Date());

  // 找到今天及之后的配药日期
  const visits = db
    .prepare('SELECT visit_date FROM hospital_visits WHERE user_id = ? AND visit_date >= ? ORDER BY visit_date ASC LIMIT 2')
    .all(userId, today) as Array<{ visit_date: string }>;

  if (visits.length === 0) {
    return { nextDispensingDate: null, nextNextDate: null, periodDays: null, items: [] };
  }

  const nextDispensingDate = visits[0].visit_date;
  const nextNextDate = visits[1]?.visit_date || null;

  let periodDays: number | null = null;
  if (nextNextDate) {
    periodDays = Math.max(1, daysBetween(nextDispensingDate, nextNextDate));
  }

  // 预览：以配药日的"次日"为执行日，计算每个药品的补货量
  const meds = db
    .prepare('SELECT * FROM medicines WHERE user_id = ?')
    .all(userId) as Medicine[];

  const items = meds
    .filter((m) => m.daily_dosage > 0)
    .map((med) => {
      const { pills, boxes } = calcReplenishPills(med, nextDispensingDate, nextNextDate);
      return {
        medicineId: med.id,
        medicineName: med.name,
        pills,
        boxes,
        unit: med.unit || '片',
        currentStock: med.stock,
        perBox: med.per_box,
        cycle: (med.cycle === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly',
        dailyDosage: med.daily_dosage,
      };
    })
    .filter((m) => m.pills > 0);

  return { nextDispensingDate, nextNextDate, periodDays, items };
}

export { weekMondayOf };
