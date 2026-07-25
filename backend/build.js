import { build } from 'esbuild';

build({
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
}).catch(() => process.exit(1));
