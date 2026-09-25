# TKT-foundation-006: Integration & e2e harness (completes the runner contract)

- Status: todo
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
