# TKT-foundation-007: CI pipeline & unit-test runner bootstrap

- Status: in-progress
- Size: S
- Scope: **Create** the GitHub Actions workflow and the first real test-runner wiring, so that every ticket from here on is CI-checked (user decision at Gate 1 — CI lands early, not last):
  - `.github/workflows/ci.yml` — verbatim per 04-ci-pipeline.md §4, **complete and final from day one** (4 logical steps, Postgres 17 service container, env, concurrency, artifact upload; calls only the §3 root scripts).
  - Root `package.json`: replace the `pnpm test` stub with a real Vitest **unit project** run (`packages/shared/test/unit`, `apps/api/test/unit` — no `DATABASE_URL`, strategy §2/§8). This is a documented intermediate state: the integration project and Playwright land with TKT-foundation-006, which brings `pnpm test` / `pnpm test:e2e` to the final 04 §3 contract. Until then the not-yet-wired CI steps pass via the TKT-foundation-001 stubs — CI is green throughout while it gates install, lint, typecheck, migrations, and the unit suite.
  - **Must NOT touch**: `apps/api/src/**`, `apps/web/src/**`, `packages/shared/src/**`, `apps/api/prisma/**` (the workflow runs migrations; it does not change them), `.pipeline/**`.
- Traces to: Foundation (04-ci-pipeline.md is the enforcement life of all 125 TCs — landed early by user decision so code additions are checked from P-2 onward)
- Acceptance (explicit criteria):
  1. `.github/workflows/ci.yml` matches 04-ci-pipeline.md §4 exactly — all four logical steps, service container, env vars, concurrency, artifact upload; only §3 root scripts are called.
  2. `pnpm test` runs the unit project: TC-EXP-001, TC-EXP-002, TC-EXP-003 (landed with TKT-foundation-003) execute and pass; the unit project passes with `DATABASE_URL` unset.
  3. Deliberately breaking a unit spec makes `pnpm test` exit non-zero (verified, then reverted — the runner actually gates).
  4. Local rehearsal of the workflow's steps in order — `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `prisma migrate deploy` against a fresh PostgreSQL, `pnpm test`, `pnpm build`, E2E-db create + migrate, `pnpm test:e2e` (stub) — all pass.
  5. CI runs green on this ticket's own PR (the workflow it adds runs via the PR's merge ref) and on main once merged.
- Architecture refs: 04-ci-pipeline.md §2–§4 (steps, root script contract, workflow file), §5 (first-time setup — user-side), §8 (traceability); testing/00-test-strategy.md §2 (levels/runners), §8 (suite layout)
- Dependencies: TKT-foundation-001, TKT-foundation-002, TKT-foundation-003
- Parallel group: none — lands on main **before** P-2 so every later PR is CI-checked (sequencing dependency per user decision at Gate 1)

**User-side step after merge (04 §5 first-time setup checklist — manual, by the owner):** the remote already exists (`github.com/sarperim/settleup`) — watch the first "CI" run go green on the merge push, then protect `main` (require pull requests + the "Lint, test & build" status check). From that point every ticket's PR is red/green-gated.
