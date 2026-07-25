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
import { updateAllStocksForDate, backfillRecentDays, todayStr } from './stockService.js';

const isDev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT) || (isDev ? 3001 : 80);

const __dirname =
  typeof __filename !== 'undefined'
    ? path.dirname(__filename)
    : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:\/)/, '$1'));

initDb();

// 启动时补更前 30 天
try {
  const backfilled = backfillRecentDays(30);
  if (backfilled > 0) {
    console.log(`[startup] 已补更 ${backfilled} 条库存记录`);
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

// 每日 00:00 执行库存扣减
cron.schedule('0 0 0 * * *', () => {
  try {
    const date = todayStr();
    const count = updateAllStocksForDate(date, 'daily');
    console.log(`[cron ${date}] 更新了 ${count} 个药品库存`);
  } catch (e) {
    console.error('[cron] 每日库存更新失败:', e);
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
