import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

interface Medicine {
  id: number;
  user_id: number;
  name: string;
  stock: number;
  per_box: number;
  daily_dosage: number;
  unit: string;
  sort: number;
  created_at: string;
  updated_at: string;
}

function toViewModel(row: Medicine) {
  return {
    id: row.id,
    name: row.name,
    stock: row.stock,
    perBox: row.per_box,
    dailyDosage: row.daily_dosage,
    unit: row.unit,
    sort: row.sort,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', authMiddleware, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM medicines WHERE user_id = ? ORDER BY sort ASC, id DESC')
    .all(req.user!.userId) as unknown as Medicine[];
  res.json({ code: 0, data: rows.map(toViewModel) });
});

router.post('/', authMiddleware, (req, res) => {
  const { name, stock, perBox, dailyDosage, unit } = req.body as {
    name?: string;
    stock?: number;
    perBox?: number;
    dailyDosage?: number;
    unit?: string;
  };
  if (!name || name.trim().length === 0) {
    res.status(400).json({ code: 400, message: '药品名称不能为空' });
    return;
  }
  const s = Number(stock) || 0;
  const p = Number(perBox) || 0;
  const d = Number(dailyDosage) || 0;
  const u = unit?.trim() || '粒';
  if (s < 0 || p < 0 || d < 0) {
    res.status(400).json({ code: 400, message: '数量不能为负数' });
    return;
  }
  const maxSort = db
    .prepare('SELECT COALESCE(MAX(sort), 0) as max_sort FROM medicines WHERE user_id = ?')
    .get(req.user!.userId) as { max_sort: number };
  const info = db
    .prepare(
      'INSERT INTO medicines (user_id, name, stock, per_box, daily_dosage, unit, sort) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(req.user!.userId, name.trim(), s, p, d, u, maxSort.max_sort + 1);
  const id = Number(info.lastInsertRowid);
  const row = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id) as unknown as Medicine;
  res.json({ code: 0, data: toViewModel(row) });
});

router.put('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ code: 400, message: '无效的ID' });
    return;
  }
  const { name, stock, perBox, dailyDosage, unit } = req.body as {
    name?: string;
    stock?: number;
    perBox?: number;
    dailyDosage?: number;
    unit?: string;
  };
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as unknown as Medicine | undefined;
  if (!existing) {
    res.status(404).json({ code: 404, message: '药品不存在' });
    return;
  }
  const newName = name !== undefined ? name.trim() : existing.name;
  if (!newName) {
    res.status(400).json({ code: 400, message: '药品名称不能为空' });
    return;
  }
  const s = stock !== undefined ? Number(stock) : existing.stock;
  const p = perBox !== undefined ? Number(perBox) : existing.per_box;
  const d = dailyDosage !== undefined ? Number(dailyDosage) : existing.daily_dosage;
  const u = unit !== undefined ? (unit.trim() || existing.unit) : existing.unit;
  if (s < 0 || p < 0 || d < 0) {
    res.status(400).json({ code: 400, message: '数量不能为负数' });
    return;
  }
  db.prepare(
    `UPDATE medicines SET name = ?, stock = ?, per_box = ?, daily_dosage = ?, unit = ?, updated_at = datetime('now','localtime') WHERE id = ? AND user_id = ?`
  ).run(newName, s, p, d, u, id, req.user!.userId);
  const row = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id) as unknown as Medicine;
  res.json({ code: 0, data: toViewModel(row) });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ code: 400, message: '无效的ID' });
    return;
  }
  const existing = db.prepare('SELECT id FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user!.userId);
  if (!existing) {
    res.status(404).json({ code: 404, message: '药品不存在' });
    return;
  }
  db.prepare('DELETE FROM medicines WHERE id = ? AND user_id = ?').run(id, req.user!.userId);
  res.json({ code: 0, message: '删除成功' });
});

router.post('/:id/move', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const { direction } = req.body as { direction?: 'up' | 'down' };
  if (!id) {
    res.status(400).json({ code: 400, message: '无效的ID' });
    return;
  }
  if (direction !== 'up' && direction !== 'down') {
    res.status(400).json({ code: 400, message: '无效的方向' });
    return;
  }
  const current = db.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as
    | Medicine
    | undefined;
  if (!current) {
    res.status(404).json({ code: 404, message: '药品不存在' });
    return;
  }
  const all = db
    .prepare('SELECT * FROM medicines WHERE user_id = ? ORDER BY sort ASC, id DESC')
    .all(req.user!.userId) as unknown as Medicine[];
  const idx = all.findIndex((m) => m.id === id);
  if (direction === 'up' && idx === 0) {
    res.json({ code: 0, message: '已经是第一个' });
    return;
  }
  if (direction === 'down' && idx === all.length - 1) {
    res.json({ code: 0, message: '已经是最后一个' });
    return;
  }
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  const swapMed = all[swapIdx];
  const stmt = db.prepare('UPDATE medicines SET sort = ? WHERE id = ?');
  stmt.run(current.sort, swapMed.id);
  stmt.run(swapMed.sort, current.id);
  res.json({ code: 0, message: '排序成功' });
});

export default router;
