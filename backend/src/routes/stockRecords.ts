import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import {
  backfillRecentDaysForUser,
  backfillRecentWeeksForUser,
  getUserStockRecords,
  countUserStockRecords,
  manualUpdateStock,
} from '../stockService.js';

const router = Router();

const AUTO_SOURCES = ['daily', 'weekly', '补更'];
const MANUAL_SOURCES = ['manual'];

/**
 * 「库存自动更新记录」：返回 daily/weekly/补更来源的记录（分页）
 */
router.get('/', authMiddleware, (req, res) => {
  const page = Math.max(1, Number((req.query as { page?: string }).page) || 1);
  const size = Math.min(100, Math.max(1, Number((req.query as { size?: string }).size) || 20));
  const offset = (page - 1) * size;
  const list = getUserStockRecords(req.user!.userId, size, offset, AUTO_SOURCES);
  const total = countUserStockRecords(req.user!.userId, AUTO_SOURCES);
  res.json({ code: 0, data: { list, total, page, size } });
});

/**
 * 「库存手动更新记录」：返回 source=manual 的记录（分页）
 */
router.get('/manual', authMiddleware, (req, res) => {
  const page = Math.max(1, Number((req.query as { page?: string }).page) || 1);
  const size = Math.min(100, Math.max(1, Number((req.query as { size?: string }).size) || 20));
  const offset = (page - 1) * size;
  const list = getUserStockRecords(req.user!.userId, size, offset, MANUAL_SOURCES);
  const total = countUserStockRecords(req.user!.userId, MANUAL_SOURCES);
  res.json({ code: 0, data: { list, total, page, size } });
});

/**
 * 手动新增一次库存调整（以盒为单位，可正可负）
 * body: { medicineId: number, quantityBoxes: number }
 */
router.post('/manual', authMiddleware, (req, res) => {
  const { medicineId, quantityBoxes } = (req.body || {}) as { medicineId?: number; quantityBoxes?: number };
  const mid = Number(medicineId);
  const qty = Number(quantityBoxes);
  if (!mid) {
    res.status(400).json({ code: 400, message: '请选择药品' });
    return;
  }
  if (!Number.isFinite(qty) || qty === 0) {
    res.status(400).json({ code: 400, message: '请输入数量(盒)，不能为0' });
    return;
  }
  try {
    const result = manualUpdateStock(req.user!.userId, mid, qty);
    res.json({ code: 0, data: result, message: '更新成功' });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e?.message || '更新失败' });
  }
});

router.post('/backfill', authMiddleware, (req, res) => {
  const days = Math.min(90, Math.max(1, Number((req.body as { days?: number }).days) || 30));
  const weeks = Math.min(12, Math.max(1, Math.ceil(days / 7)));
  const cntDay = backfillRecentDaysForUser(req.user!.userId, days);
  const cntWeek = backfillRecentWeeksForUser(req.user!.userId, weeks);
  res.json({ code: 0, data: { backfilledCount: cntDay + cntWeek, days, weeks } });
});

export default router;
