import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// TKT-foundation-006: the final Vitest runner — unit + integration + web-unit
// projects (00-test-strategy.md §2/§8, 04-ci-pipeline.md §3 `pnpm test`).
//
// Acceptance F-1 fix (2026-09-27, user-directed): Vitest compiles TS with
// esbuild, which does NOT emit `design:paramtypes` (`emitDecoratorMetadata`),
// while production `nest build` (tsc) does. NestJS's global ValidationPipe
// reads that metadata to pick the DTO class; without it, DTO validation is
// silently skipped under Vitest. The SWC transform below reads
// `apps/api/tsconfig.json` (`emitDecoratorMetadata: true,
// experimentalDecorators: true`) and emits the metadata under Vitest, matching
// production semantics. Removing it re-opens the dropped f-004 FLAG-3 gap
// (pinned by apps/api/test/unit/harness.decorator-metadata.spec.ts).
//
//   - `unit`        — packages/shared/test/unit and apps/api/test/unit. Pure:
//                     no DATABASE_URL, no HTTP (strategy §2). TKT-foundation-007
//                     landed this project.
//   - `integration` — apps/api/test/integration. Boots the real NestJS app
//                     in-process over supertest against a real PostgreSQL
//                     (strategy §2/§3 T2–T3); its `setup-env.ts` fails only
//                     this project's files with a clear message when
//                     DATABASE_URL is unset, while the unit project still runs
//                     and passes (a project-scoped `setupFiles` guard, not a
//                     `globalSetup` hook, which would abort the whole run).
//   - `web-unit`    — apps/web/src mechanism specs (routes, api client, error
//                     parsing, money wiring, App routing/session guard), so
//                     the frozen CI step 3 (`pnpm test`) actually gates the
//                     SPA. Added by the post-acceptance finding **F-A4**
//                     (`.pipeline/acceptance-report.md` §I.7; carried since
//                     foundation F-4): these specs lived only in the manual
//                     `pnpm --filter web test` root, so a regression in route
//                     wiring / API client / error handling passed CI silently.
//                     They are DOM-free (`react-dom/server`; injected
//                     `fetch`), hence the plain `node` environment — no
//                     jsdom/happy-dom. TSX/JSX needs no `@vitejs/plugin-react`
//                     here: esbuild reads `jsx: react-jsx` from the nearest
//                     `apps/web/tsconfig.json`. `shared` is aliased to its
//                     source (exactly as `apps/web/vite.config.ts` does) so
//                     the specs run without a prior `shared` build.
//
// Integration specs share one database and truncate all tables before each
// test (strategy §3 T3, §7 rule 3), so they must not run in parallel across
// files — `fileParallelism: false` serializes them (which also pins
// `maxWorkers` to 1).
const sharedSrc = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [swc.vite()],
        test: {
          name: 'unit',
          include: [
            'packages/shared/test/unit/**/*.spec.ts',
            'apps/api/test/unit/**/*.spec.ts',
          ],
        },
      },
      {
        plugins: [swc.vite()],
        test: {
          name: 'integration',
          include: ['apps/api/test/integration/**/*.spec.ts'],
          setupFiles: ['apps/api/test/integration/support/setup-env.ts'],
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
      {
        resolve: {
          alias: {
            shared: sharedSrc,
          },
        },
        test: {
          name: 'web-unit',
          include: ['apps/web/src/**/*.spec.{ts,tsx}'],
          environment: 'node',
        },
      },
    ],
  },
});
