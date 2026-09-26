import { defineConfig } from 'vitest/config';

// TKT-foundation-007: the Vitest unit project (strategy §2/§8 runner wiring).
//
//   - Unit target dirs: packages/shared/test/unit and apps/api/test/unit.
//   - No DATABASE_URL — unit tests are pure (strategy §2). When DATABASE_URL is
//     unset, only the unit project runs; integration (apps/api/test/integration)
//     and Playwright e2e land with TKT-foundation-006.
//   - passWithNoTests: intended interim behavior per the ticket — the unit
//     suites themselves are still being landed (TC-EXP-001..003 arrive with
//     TKT-foundation-003), so a runner run with zero files yet must stay green
//     and still gate lint/typecheck/build. A real failing spec always fails
//     the run regardless of this flag (ticket acceptance criterion 3).
export default defineConfig({
  test: {
    include: [
      'packages/shared/test/unit/**/*.spec.ts',
      'apps/api/test/unit/**/*.spec.ts',
    ],
    passWithNoTests: true,
  },
});
