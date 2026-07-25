import { Router } from 'express';
import { db, ensureDefaultUnits } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

interface UnitRow {
  id: number;
  user_id: number;
  name: string;
  sort: number;
  created_at: string;
}

function toViewModel(row: UnitRow) {
  return {
    id: row.id,
    name: row.name,
    sort: row.sort,
    createdAt: row.created_at,
  };
}

router.get('/', authMiddleware, (req, res) => {
  ensureDefaultUnits(req.user!.userId);
  const rows = db
    .prepare('SELECT * FROM units WHERE user_id = ? ORDER BY sort ASC, id ASC')
    .all(req.user!.userId) as unknown as UnitRow[];
  res.json({ code: 0, data: rows.map(toViewModel) });
});

router.post('/', authMiddleware, (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ code: 400, message: '量词名称不能为空' });
    return;
  }
  const trimmed = name.trim();
  const exists = db
    .prepare('SELECT id FROM units WHERE user_id = ? AND name = ?')
    .get(req.user!.userId, trimmed) as { id: number } | undefined;
  if (exists) {
    res.status(400).json({ code: 400, message: '该量词已存在' });
    return;
  }
  const maxSort = db
    .prepare('SELECT COALESCE(MAX(sort), 0) as max_sort FROM units WHERE user_id = ?')
    .get(req.user!.userId) as { max_sort: number };
  const info = db
    .prepare('INSERT INTO units (user_id, name, sort) VALUES (?, ?, ?)')
    .run(req.user!.userId, trimmed, maxSort.max_sort + 1);
  const id = Number(info.lastInsertRowid);
  const row = db.prepare('SELECT * FROM units WHERE id = ?').get(id) as unknown as UnitRow;
  res.json({ code: 0, data: toViewModel(row) });
});

router.put('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ code: 400, message: '无效的ID' });
    return;
  }
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ code: 400, message: '量词名称不能为空' });
    return;
  }
  const existing = db.prepare('SELECT * FROM units WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as unknown as UnitRow | undefined;
  if (!existing) {
    res.status(404).json({ code: 404, message: '量词不存在' });
    return;
  }
  const trimmed = name.trim();
  const dup = db
    .prepare('SELECT id FROM units WHERE user_id = ? AND name = ? AND id != ?')
    .get(req.user!.userId, trimmed, id) as { id: number } | undefined;
  if (dup) {
    res.status(400).json({ code: 400, message: '该量词已存在' });
    return;
  }
  db.prepare('UPDATE units SET name = ? WHERE id = ? AND user_id = ?').run(trimmed, id, req.user!.userId);
  const row = db.prepare('SELECT * FROM units WHERE id = ?').get(id) as unknown as UnitRow;
  res.json({ code: 0, data: toViewModel(row) });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ code: 400, message: '无效的ID' });
    return;
  }
  const existing = db.prepare('SELECT * FROM units WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as unknown as UnitRow | undefined;
  if (!existing) {
    res.status(404).json({ code: 404, message: '量词不存在' });
    return;
  }
  const count = db
    .prepare('SELECT COUNT(*) as cnt FROM medicines WHERE user_id = ? AND unit = ?')
    .get(req.user!.userId, existing.name) as { cnt: number };
  if (count.cnt > 0) {
    res.status(400).json({ code: 400, message: '该量词正在被药品使用，无法删除' });
    return;
  }
  db.prepare('DELETE FROM units WHERE id = ? AND user_id = ?').run(id, req.user!.userId);
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
  const current = db.prepare('SELECT * FROM units WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as
    | UnitRow
    | undefined;
  if (!current) {
    res.status(404).json({ code: 404, message: '量词不存在' });
    return;
  }
  const all = db
    .prepare('SELECT * FROM units WHERE user_id = ? ORDER BY sort ASC, id ASC')
    .all(req.user!.userId) as unknown as UnitRow[];
  const idx = all.findIndex((u) => u.id === id);
  if (direction === 'up' && idx === 0) {
    res.json({ code: 0, message: '已经是第一个' });
    return;
  }
  if (direction === 'down' && idx === all.length - 1) {
    res.json({ code: 0, message: '已经是最后一个' });
    return;
  }
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  const swapUnit = all[swapIdx];
  const stmt = db.prepare('UPDATE units SET sort = ? WHERE id = ?');
  stmt.run(current.sort, swapUnit.id);
  stmt.run(swapUnit.sort, current.id);
  res.json({ code: 0, message: '排序成功' });
});

export default router;
