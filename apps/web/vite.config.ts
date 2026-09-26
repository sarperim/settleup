import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Web SPA config (TKT-foundation-005).
//
// - Dev proxy: same-origin `/api/*` is forwarded to the local API `PORT`
//   (architecture §10: api:3007), so the SPA always talks to `/api` and the
//   browser sees a single origin (arch 01 §2 C1).
// - `shared` alias: the workspace package points at its built `dist/`; the
//   Vite dev server, `vite build` and Vitest resolve its TypeScript source
//   directly so the SPA does not depend on a prior `pnpm --filter shared
//   build` (mirrors the tsconfig `paths` entry in apps/web/tsconfig.json).
// - Vitest project: the wrapper/route mechanism specs live beside their
//   modules under `src/**`. They run in the `node` environment (no DOM) —
//   React pages are static-rendered with `react-dom/server` where needed.
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      shared: sharedSrc,
    },
  },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT ?? '3007'}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.spec.{ts,tsx}'],
    environment: 'node',
  },
});
