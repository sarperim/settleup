# TKT-bal-007: SC-007 full lifecycle end-to-end (CI step-4 smoke)

- Status: done (merged via PR #34 → dev, 2026-09-30; review loop closed clean at pass 1, zero blocking findings — blast radius FULL, all three reviewers ran; compliance faithful on TC-BAL-025, security approve, code approve with 3 non-blocking nits C-1…C-3; round artifact `reviews/TKT-bal-007-round-1.md`)
- PR: https://github.com/sarperim/settleup/pull/34
- Evidence: TC-BAL-025 green — `pnpm exec playwright test test/e2e/lifecycle-ui.spec.ts` 1 passed; `pnpm test:e2e` system 1 + Playwright 24/24 passed (fresh DB, production build); `pnpm test` 313/313; `pnpm lint` and `pnpm typecheck` pass.
- Size: S
- Scope: **Create** the flagship e2e journey in `apps/web/test/e2e/**` — the SC-007 lifecycle through the UI against the production build:
  - TC-BAL-025 — two fresh browser contexts, fresh e2e database: register `lale@test.local` → create group "Trip" → register `mert@test.local` → join via the join code → lale approves → lale logs an expense (100.00, payer lale, both participants, even equal split → deterministic 50.00/50.00) → settle-up view → mark the suggested payment paid (by its recipient) → balances show 0.00 → mert undoes the settlement → balances revert → the outstanding suggestion (mert → lale 50.00) renders again — **the debt is outstanding again** (SC-007's terminal assertion).
  - This is the journey CI step 4 boots and runs on every push (`04-ci-pipeline.md` §2 step 4) — the SC-001 adoption path.
  - **Must NOT touch**: `apps/api/**`, `apps/web/src/**` (the pages exist; defects found flow back to the owning tickets via review), `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: SC-007, SC-001 (path), OBJ-001 · secondary: UC-ACC-001, UC-GRP-001, UC-GRP-002, UC-GRP-003, UC-EXP-001, UC-BAL-002, UC-BAL-003, UC-BAL-004
- Acceptance: TC-BAL-025 green
- Architecture refs: 04-ci-pipeline.md §2 (step 4), §8 (traceability: SC-007/SC-001 path); 03-api-design.md §6; testing/balances-settlement.md §2 (TC-BAL-025); testing/00-test-strategy.md §1 (SC-007 verification approach)
- Dependencies: TKT-bal-006 (settle-up UI — with its transitive deps covering register, group, join/approve, and expense-form UIs)
- Parallel group: none — final domain ticket of the build
