import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

function toViewModel(row: { id: number; user_id: number; visit_date: string; created_at: string }) {
  return {
    id: row.id,
    visitDate: row.visit_date,
    createdAt: row.created_at,
  };
}

router.get('/', authMiddleware, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM hospital_visits WHERE user_id = ? ORDER BY visit_date DESC, id DESC')
    .all(req.user!.userId) as Array<{ id: number; user_id: number; visit_date: string; created_at: string }>;
  res.json({ code: 0, data: rows.map(toViewModel) });
});

/**
 * 获取当前时间之后的两次配药时间，用于计算需补天数。
 * 同时返回配药天数（next2 - next1）。若不足两次则 days 为 null。
 */
router.get('/next-cycle-days', authMiddleware, (req, res) => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const rows = db
    .prepare('SELECT visit_date FROM hospital_visits WHERE user_id = ? AND visit_date >= ? ORDER BY visit_date ASC LIMIT 2')
    .all(req.user!.userId, todayStr) as Array<{ visit_date: string }>;
  if (rows.length < 2) {
    res.json({ code: 0, data: { days: null, next1: rows[0]?.visit_date || null, next2: null } });
    return;
  }
  const d1 = new Date(rows[0].visit_date);
  const d2 = new Date(rows[1].visit_date);
  const days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
  res.json({ code: 0, data: { days, next1: rows[0].visit_date, next2: rows[1].visit_date } });
});

router.post('/', authMiddleware, (req, res) => {
  const { visitDate } = req.body as { visitDate?: string };
  if (!visitDate) {
    res.status(400).json({ code: 400, message: '请选择日期' });
    return;
  }
  const d = new Date(visitDate);
  if (isNaN(d.getTime())) {
    res.status(400).json({ code: 400, message: '日期格式错误' });
    return;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const value = `${y}-${m}-${dd}`;
  try {
    const info = db
      .prepare('INSERT OR IGNORE INTO hospital_visits (user_id, visit_date) VALUES (?, ?)')
      .run(req.user!.userId, value);
    if (Number(info.changes) === 0) {
      res.status(400).json({ code: 400, message: '该日期已存在' });
      return;
    }
    const row = db
      .prepare('SELECT * FROM hospital_visits WHERE user_id = ? AND visit_date = ?')
      .get(req.user!.userId, value) as { id: number; user_id: number; visit_date: string; created_at: string };
    res.json({ code: 0, data: toViewModel(row) });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e?.message || '新增失败' });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ code: 400, message: '无效ID' });
    return;
  }
  const existing = db.prepare('SELECT id FROM hospital_visits WHERE id = ? AND user_id = ?').get(id, req.user!.userId);
  if (!existing) {
    res.status(404).json({ code: 404, message: '记录不存在' });
    return;
  }
  db.prepare('DELETE FROM hospital_visits WHERE id = ? AND user_id = ?').run(id, req.user!.userId);
  res.json({ code: 0, message: '删除成功' });
});

export default router;
