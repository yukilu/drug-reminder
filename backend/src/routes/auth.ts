import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, ensureDefaultUnits } from '../db.js';
import { signToken, authMiddleware } from '../auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    return;
  }
  if (username.length < 2 || username.length > 32) {
    res.status(400).json({ code: 400, message: '用户名长度 2-32' });
    return;
  }
  if (password.length < 6 || password.length > 64) {
    res.status(400).json({ code: 400, message: '密码长度 6-64' });
    return;
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
  if (exists) {
    res.status(400).json({ code: 400, message: '用户名已存在' });
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  const userId = Number(info.lastInsertRowid);
  ensureDefaultUnits(userId);
  const token = signToken({ userId, username });
  res.json({ code: 0, data: { token, user: { id: userId, username } } });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    return;
  }
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | { id: number; username: string; password_hash: string; created_at: string }
    | undefined;
  if (!row) {
    res.status(400).json({ code: 400, message: '用户名或密码错误' });
    return;
  }
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) {
    res.status(400).json({ code: 400, message: '用户名或密码错误' });
    return;
  }
  const token = signToken({ userId: row.id, username: row.username });
  res.json({ code: 0, data: { token, user: { id: row.id, username: row.username, createdAt: row.created_at } } });
});

router.get('/me', authMiddleware, (req, res) => {
  const row = db
    .prepare('SELECT id, username, created_at, stop_backfill_date FROM users WHERE id = ?')
    .get(req.user!.userId) as
    | { id: number; username: string; created_at: string; stop_backfill_date: string | null }
    | undefined;
  if (!row) {
    res.status(404).json({ code: 404, message: '用户不存在' });
    return;
  }
  res.json({
    code: 0,
    data: {
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
      stopBackfillDate: row.stop_backfill_date,
    },
  });
});

router.put('/stop-backfill-date', authMiddleware, (req, res) => {
  const { date } = req.body as { date?: string | null };
  if (date !== undefined && date !== null && date !== '') {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      res.status(400).json({ code: 400, message: '日期格式错误' });
      return;
    }
  }
  const value = date && date !== '' ? String(date).slice(0, 10) : null;
  db.prepare('UPDATE users SET stop_backfill_date = ? WHERE id = ?').run(value, req.user!.userId);
  res.json({ code: 0, message: '设置成功', data: { stopBackfillDate: value } });
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
  if (!oldPassword || !newPassword) {
    res.status(400).json({ code: 400, message: '参数不完整' });
    return;
  }
  if (newPassword.length < 6 || newPassword.length > 64) {
    res.status(400).json({ code: 400, message: '新密码长度 6-64' });
    return;
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.userId) as
    | { password_hash: string }
    | undefined;
  if (!row) {
    res.status(404).json({ code: 404, message: '用户不存在' });
    return;
  }
  const ok = bcrypt.compareSync(oldPassword, row.password_hash);
  if (!ok) {
    res.status(400).json({ code: 400, message: '原密码错误' });
    return;
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user!.userId);
  res.json({ code: 0, message: '密码修改成功' });
});

export default router;
