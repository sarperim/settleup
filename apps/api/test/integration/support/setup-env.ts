/**
 * Integration test bootstrap (TKT-foundation-006; strategy §2/§3, domain-plan
 * conventions).
 *
 * This runs inside each integration worker before the spec file loads:
 *
 *   - **DATABASE_URL guard.** Integration tests drive the real NestJS app
 *     against a **real PostgreSQL** (strategy §2), so the project fails at once
 *     — only its own files, never the unit project — with one clear message
 *     when `DATABASE_URL` is unset (acceptance criterion 2). This lives here
 *     rather than in a `globalSetup` hook because a globalSetup error aborts
 *     the *entire* Vitest run before the unit project executes.
 *   - `COOKIE_SECURE=true` so the session cookie's `Secure`/`HttpOnly`/
 *     `SameSite=Lax` attributes are assertable (domain-plan conventions; the
 *     app default is already `true`, pinning it here keeps the harness
 *     explicit and independent of the ambient shell).
 *   - `PORT` is required by env validation but is never bound — the
 *     integration level talks to the in-process Node server over supertest
 *     (strategy §3 T2) — so a fixed placeholder is enough.
 *   - `LOG_LEVEL=error` (unless already set) so test output stays readable.
 */
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    [
      'The integration test project requires DATABASE_URL.',
      '',
      'Integration tests boot the NestJS app in-process and run against a real',
      'PostgreSQL (00-test-strategy.md §2) — there is no database to mock.',
      '',
      'Set it to a reachable PostgreSQL with the migrations applied, e.g.:',
      '  DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test pnpm test',
      '',
      'The unit project in this same run does not need DATABASE_URL and is unaffected.',
    ].join('\n'),
  );
}

process.env.COOKIE_SECURE = 'true';
process.env.PORT ??= '3999';
if (process.env.LOG_LEVEL === undefined) {
  process.env.LOG_LEVEL = 'error';
}
