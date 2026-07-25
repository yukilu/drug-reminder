import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { backfillRecentDaysForUser, getUserStockRecords } from '../stockService.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const limit = Math.min(100, Number((req.query as { limit?: string }).limit) || 50);
  const offset = Number((req.query as { offset?: string }).offset) || 0;
  const list = getUserStockRecords(req.user!.userId, limit, offset);
  res.json({ code: 0, data: { list, total: list.length } });
});

router.post('/backfill', authMiddleware, (req, res) => {
  const days = Math.min(90, Math.max(1, Number((req.body as { days?: number }).days) || 30));
  const count = backfillRecentDaysForUser(req.user!.userId, days);
  res.json({ code: 0, data: { backfilledCount: count, days } });
});

export default router;
