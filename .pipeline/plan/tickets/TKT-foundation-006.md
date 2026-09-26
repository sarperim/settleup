# TKT-foundation-006: Integration & e2e harness (completes the runner contract)

- Status: in-review
- Size: M
- Scope: **Create** the DB-backed and browser-level harness layers that grow TKT-foundation-007's unit runner into the final 04-ci-pipeline.md §3 script contract:
  - Vitest **integration project** (`apps/api/test/integration`): requires `DATABASE_URL`, boots the NestJS app in-process (supertest), truncates all tables before each test, sets `COOKIE_SECURE=true` (00-test-strategy.md §2/§3 T2–T3, domain-plan conventions).
  - Integration bootstrap under `apps/api/test/`: app factory, truncate-all-tables helper, supertest client. (Strategy §5 factories — `registerUser`, `createGroup`, `joinAndApprove`, `createExpense` — land with the domain tickets that own their routes, not here.)
  - Root `package.json`: extend `pnpm test` from TKT-foundation-007's unit-only run to the full unit + integration run; replace the `pnpm test:e2e` stub with the real Playwright run (04 §3 final state).
  - Playwright: `apps/web/playwright.config.ts` booting the built api + web as `webServer` against `E2E_DATABASE_URL`; e2e database create + `prisma migrate deploy` step (04 §4 step 4).
  - Canary specs: one integration canary (`apps/api/test/integration/`) — unknown `/api` path → 404 in the §4 error envelope, run twice consecutively to prove truncate-per-test; one e2e canary (`apps/web/test/e2e/`) — loads `/` and asserts the SPA renders.
  - **Must NOT touch**: `.github/workflows/ci.yml` (final since TKT-foundation-007 — the scripts it calls mature underneath it), `apps/api/src/**` (import the app module; do not modify it), `packages/shared/src/**`, `apps/web/src/**`.
- Traces to: Foundation (the harness executes the 87 integration + 23 e2e + 1 system TCs of the approved test plan)
- Acceptance (explicit criteria):
  1. `pnpm test` runs unit + integration against a real PostgreSQL: the shared unit specs and the integration canary pass; a second consecutive run also passes (truncate works — no cross-run data).
  2. The unit project still passes with `DATABASE_URL` unset; the integration project fails with a clear message when it is unset (strategy §2).
  3. Deliberately breaking a canary makes `pnpm test` exit non-zero (verified, then reverted — the runner actually gates).
  4. `pnpm build && pnpm test:e2e`: Playwright boots the built app against a fresh `E2E_DATABASE_URL` database; the canary loads `/` and asserts the rendered SPA.
  5. CI stays green on this ticket's PR with **no workflow-file change** — proof the runner matured underneath the frozen workflow.
  6. `pnpm lint` and `pnpm typecheck` still exit 0 (harness code is lint/type clean).
- Architecture refs: 04-ci-pipeline.md §3 (root script contract — final state), §4 steps 3–4; testing/00-test-strategy.md §2 (levels/runners), §3 (T1–T6 Gate-1 decisions), §5 (data strategy), §7 (determinism rules), §8 (suite layout); domain-plan conventions blocks (truncate, COOKIE_SECURE, X-Requested-With, supertest)
- Dependencies: TKT-foundation-001, TKT-foundation-002, TKT-foundation-003, TKT-foundation-004, TKT-foundation-005, TKT-foundation-007
- Parallel group: none — final foundation ticket; all domain tickets depend on the frozen contracts + the completed harness

**Implementation record (coder, 2026-09-26):**

- Deliverables: `vitest.config.ts` now declares two projects (`unit`, `integration`); `apps/api/test/integration/` (support: app factory + supertest client, truncate-all-tables, bootstrap env guard; canary spec); `apps/web/playwright.config.ts`; `apps/web/test/e2e/spa-canary.spec.ts`; `scripts/e2e-db.mjs`; root `package.json` `test:e2e` real run; `scripts/e2e-stub.mjs` removed. **Not touched:** `.github/workflows/ci.yml`, `apps/api/src/**`, `packages/shared/src/**`, `apps/web/src/**`.
- Acceptance evidence (local, Node 22 / pnpm 10.34.5; CI runs Node 24):
  1. `DATABASE_URL=… pnpm test` **twice consecutively** → `Test Files 15 passed`, `Tests 72 passed`, exit 0 both runs.
  2. `pnpm test` with `DATABASE_URL` unset → unit `Tests 70 passed (14 files)`; integration canary `FAIL` with the explicit "requires DATABASE_URL" message; exit 1.
  3. Deliberately breaking the canary (404 → 500) → `Tests 2 failed | 70 passed`, exit 1; reverted (clean tree).
  4. `DROP DATABASE settleup_e2e` then `pnpm build && E2E_DATABASE_URL=… pnpm test:e2e` → script creates + migrates the fresh DB, Playwright boots `apps/api/dist/main.js` serving the built SPA, `1 passed`, exit 0.
  5. CI on the PR — recorded below once the run completes; no workflow-file change.
  6. `pnpm lint` exit 0; `pnpm typecheck` exit 0.
- DEVIATION-1 (root `test:e2e`): it runs `playwright install chromium` before `playwright test`. pnpm's `onlyBuiltDependencies` allowlist (`pnpm-workspace.yaml`) blocks Playwright's postinstall and the frozen `ci.yml` has no browser-install step, so CI would otherwise have no browser to launch. Alternative (allow-listing `playwright`) edits `pnpm-workspace.yaml`, outside this ticket's stated root-`package.json` scope.
- DEVIATION-2 (e2e DB setup): `scripts/e2e-db.mjs` performs 04 §4 step 4's "create E2E database & apply migrations" idempotently. In CI the frozen workflow's step already ran, so the create is skipped and `prisma migrate deploy` is a no-op; locally the script is the only setup. Mirrors TKT-foundation-007 DEVIATION-3's maintenance-DB create fix.
- NOTE-1 (registry guard): the integration project's `DATABASE_URL` check is a project-scoped `setupFiles` guard, not a `globalSetup` hook — a throwing `globalSetup` aborts the entire run before the unit project executes, which would fail acceptance criterion 2.
- NOTE-2 (canary self-test): the integration canary writes one `User` row directly via Prisma purely to prove truncate-per-test removed it on the next test (no API write route exists until the domain tickets); domain write paths remain API-driven per strategy §5.
- FLAG-1 (f-005 FLAG-2): `apps/web/src/**/*.spec.{ts,tsx}` mechanism specs remain outside root `pnpm test`. This ticket's scope defines `pnpm test` as the f-007 unit project (shared + api) + integration, and strategy §8 lists the web suite as e2e only; wiring the web mechanism specs into the root runner is a planner/test-plan decision, not taken here.
- FLAG-2 (lint/typecheck coverage): the new harness test dirs and `playwright.config.ts` sit outside the packages' lint/typecheck globs (pre-existing convention — `apps/api` covers `src/**` only, `apps/web` `src` only). The new files were ESLint-verified directly (clean). Extending the globs would surface pre-existing type errors in `apps/api/test/unit` (e.g. `tc-foundation-004-a5-request-logging.spec.ts`, `unmapped-exception-status.spec.ts`), which is out of this ticket's scope; routed to the planner if desired.

