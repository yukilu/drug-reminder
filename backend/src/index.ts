import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';

import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import medicineRoutes from './routes/medicines.js';
import stockRecordRoutes from './routes/stockRecords.js';
import unitRoutes from './routes/units.js';
import hospitalVisitRoutes from './routes/hospitalVisits.js';
import { updateAllStocksForDate, backfillRecentDays, todayStr, updateWeeklyStocksForWeekOfDate, backfillRecentWeeks } from './stockService.js';

const isDev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT) || (isDev ? 3001 : 80);

const __dirname =
  typeof __filename !== 'undefined'
    ? path.dirname(__filename)
    : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:\/)/, '$1'));

initDb();

// 启动时补更前 30 天
try {
  const backfilledDays = backfillRecentDays(30);
  const backfilledWeeks = backfillRecentWeeks(8); // 8周≈2个月
  const backfilledTotal = backfilledDays + backfilledWeeks;
  if (backfilledTotal > 0) {
    console.log(`[startup] 已补更 ${backfilledTotal} 条库存记录（日:${backfilledDays}, 周:${backfilledWeeks}）`);
  }
} catch (e) {
  console.error('[startup] 补更失败:', e);
}

const app = express();

if (isDev) {
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
}

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/stock-records', stockRecordRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/hospital-visits', hospitalVisitRoutes);

// 每日 00:00 执行库存扣减（前一天按日周期）
cron.schedule('0 0 0 * * *', () => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const count = updateAllStocksForDate(dateStr, 'daily');
    console.log(`[cron daily ${dateStr}] 更新了 ${count} 个药品库存`);
  } catch (e) {
    console.error('[cron daily] 每日库存更新失败:', e);
  }
});

// 每周一 00:00 执行上周按周周期的库存扣减（上周一-上周日算一个周期，扣减日期记为上周一）
cron.schedule('0 0 0 * * 1', () => {
  try {
    // 本周一的日期减去7天 = 上周一
    const today = new Date();
    const day = today.getDay() === 0 ? 7 : today.getDay(); // Sunday -> 7
    const mondayThisWeek = new Date(today);
    mondayThisWeek.setDate(today.getDate() - (day - 1));
    const mondayLastWeek = new Date(mondayThisWeek);
    mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);
    const y = mondayLastWeek.getFullYear();
    const m = String(mondayLastWeek.getMonth() + 1).padStart(2, '0');
    const d = String(mondayLastWeek.getDate()).padStart(2, '0');
    const weekStartStr = `${y}-${m}-${d}`;
    const count = updateWeeklyStocksForWeekOfDate(weekStartStr, 'weekly');
    console.log(`[cron weekly ${weekStartStr}] 更新了 ${count} 个药品库存`);
  } catch (e) {
    console.error('[cron weekly] 每周库存更新失败:', e);
  }
});

// 生产环境下托管前端静态文件
if (!isDev) {
  const webDist = path.resolve(__dirname, 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
    console.log('[prod] 已托管前端静态文件:', webDist);
  } else {
    console.warn('[prod] 未找到前端静态文件目录:', webDist);
  }
}

app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}  (${isDev ? 'development' : 'production'})`);
});
