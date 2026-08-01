import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const result = await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/index.mjs',
  format: 'esm',
  banner: {
    js: "import { createRequire } from 'node:module'; import nodePath from 'node:path'; import { fileURLToPath } from 'node:url'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = nodePath.dirname(__filename);",
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

// 打包完成后，如果 ../data/ 下存在数据库文件（主库/WAL/SHM），
// 将它们移动（move）到 dist/（即 index.mjs 同级）。如果 dist/ 已存在同名文件则覆盖。
try {
  const dataDir = path.resolve('data');
  const distDir = path.resolve('dist');
  const dbBasenames = ['drug-reminder.db', 'drug-reminder.db-wal', 'drug-reminder.db-shm'];
  let movedCount = 0;
  for (const base of dbBasenames) {
    const src = path.join(dataDir, base);
    const dst = path.join(distDir, base);
    if (fs.existsSync(src)) {
      // 覆盖目标（已存在时先删），避免 EXDEV 跨盘问题用 copy + unlink
      try {
        fs.copyFileSync(src, dst);
        fs.unlinkSync(src);
      } catch {
        // copy+unlink 失败时尝试原生 rename
        fs.renameSync(src, dst);
      }
      movedCount++;
      console.log(`[db-migrate] moved ${src} -> ${dst}`);
    }
  }
  if (movedCount > 0) {
    console.log(`[db-migrate] done, moved ${movedCount} file(s) to dist/`);
  } else {
    console.log('[db-migrate] no db files in data/, skip');
  }
} catch (e) {
  console.error('[db-migrate] failed:', e);
  process.exitCode = 1;
}

if (result.errors.length > 0) process.exit(1);
