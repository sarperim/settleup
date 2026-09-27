/**
 * System-test bootstrap (TKT-accounts-003; accounts-access.md TC-ACC-028).
 *
 * This runs inside the system worker before the spec loads and is the e2e-phase
 * analogue of the integration `setup-env.ts`. The system level runs **post
 * build** against the e2e database (`E2E_DATABASE_URL`) — the same database the
 * Playwright suite boots the built app against.
 *
 *   - `E2E_DATABASE_URL` is required (accounts-access.md TC-ACC-028
 *     preconditions: "built artifact exists … against E2E_DATABASE_URL").
 *     `DATABASE_URL` is then pointed at it, because the app factory and the
 *     built CLI both read `DATABASE_URL` (01-system-architecture.md §8.5). The
 *     e2e phase passes `E2E_DATABASE_URL`; resolving it here keeps the system
 *     project self-contained and independent of ambient shell state.
 *   - `COOKIE_SECURE=true`, a placeholder `PORT` (never bound) and
 *     `LOG_LEVEL=error` mirror the integration harness (strategy §3).
 */
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim();
if (!e2eDatabaseUrl) {
  throw new Error(
    [
      'The system test project requires E2E_DATABASE_URL.',
      '',
      'TC-ACC-028 exercises the built owner password-reset CLI against the e2e',
      'database — the same one the Playwright suite boots the built app against',
      '(accounts-access.md §2, 01-system-architecture.md §10 amended).',
      '',
      'Set it to a reachable PostgreSQL with the migrations applied, e.g.:',
      '  E2E_DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_e2e pnpm test:system',
    ].join('\n'),
  );
}

// The app factory and the built CLI both read DATABASE_URL.
process.env.DATABASE_URL = e2eDatabaseUrl;
process.env.COOKIE_SECURE = 'true';
process.env.PORT ??= '3999';
if (process.env.LOG_LEVEL === undefined) {
  process.env.LOG_LEVEL = 'error';
}
