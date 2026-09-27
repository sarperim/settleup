import { defineConfig } from 'vitest/config';

// TKT-foundation-006: the final Vitest runner — unit + integration projects
// (00-test-strategy.md §2/§8, 04-ci-pipeline.md §3 `pnpm test`).
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
//
// Integration specs share one database and truncate all tables before each
// test (strategy §3 T3, §7 rule 3), so they must not run in parallel across
// files — `fileParallelism: false` serializes them (which also pins
// `maxWorkers` to 1).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'packages/shared/test/unit/**/*.spec.ts',
            'apps/api/test/unit/**/*.spec.ts',
          ],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['apps/api/test/integration/**/*.spec.ts'],
          setupFiles: ['apps/api/test/integration/support/setup-env.ts'],
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
    ],
  },
});
