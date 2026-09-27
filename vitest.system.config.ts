import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// TKT-accounts-003: the **system** Vitest project — the e2e-phase system level
// (00-test-strategy.md §2, 04-ci-pipeline.md §3/§4 step 4; accounts-access.md
// TC-ACC-028).
//
// It is deliberately NOT part of `vitest.config.ts`'s unit/integration run:
// system specs are **post-build** and need `E2E_DATABASE_URL` plus the built
// `apps/api/dist/scripts/set-password.js`, so they run only from the e2e phase
// (`pnpm test:system`, invoked by `pnpm test:e2e` right after the e2e database
// is created and migrated, alongside Playwright). Keeping them out of
// `pnpm test` preserves the CI step-3 contract (unit + integration only).
//
// The SWC transform matches `vitest.config.ts`: NestJS's global ValidationPipe
// reads `design:paramtypes` metadata, which esbuild does not emit but the
// production `nest build` (tsc) does — see that file's header for the full
// rationale (TKT-foundation-006/f-001 FLAG-3).
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [swc.vite()],
        test: {
          name: 'system',
          include: ['apps/api/test/system/**/*.spec.ts'],
          setupFiles: ['apps/api/test/system/support/setup-env.ts'],
          // System specs share the single e2e database; serialize them.
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
    ],
  },
});
