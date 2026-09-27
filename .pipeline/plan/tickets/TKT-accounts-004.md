# TKT-accounts-004: Cross-route auth contract — CSRF, envelope, logs, retention

- Status: done
- PR: https://github.com/sarperim/settleup/pull/13 (base: dev — merged 2026-09-27, review loop clean pass 1; R3-1 ownership question resolved — ticket was right)
- Size: S
- Scope: **Create** specs under `apps/api/test/integration/**` (and the log-capture testability hook in the test bootstrap) — the cross-route contract assertions that only become executable once all four auth routes exist:
  - TC-ACC-014 — CSRF header required on all 4 auth state-changing routes (register, login, logout, password), no side effects.
  - TC-ACC-022 — every auth error trigger produces exactly the §4 error envelope.
  - TC-ACC-021 — passwords never appear in logs (pino output routed to a captured in-memory destination by the test harness — build the hook here).
  - TC-ACC-029 — the account persists across the full exercised lifecycle (register → login → change password → logout → login → me).
  - Test-only ticket: the routes already exist (TKT-accounts-001…003). If verification exposes a defect, the minimal fix lands within `apps/api/src/auth/**` / platform files via the PR review — flagged, not scope creep.
  - **Must NOT touch**: `apps/web/**`, `packages/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-ACC-009 (cross-route aspect) · ASM-004 · NFR-ACC-001 (no password in logs), NFR-ACC-004 (retention) · API §1/§4 (CSRF + error contract)
- Acceptance: TC-ACC-014, TC-ACC-021, TC-ACC-022, TC-ACC-029 green
- Architecture refs: 03-api-design.md §1 (CSRF convention), §4 (error contract); 01-system-architecture.md §8.2 (CSRF), §8.4 (logging discipline); testing/accounts-access.md §2 (TC-ACC-014, 021, 022, 029)
- Dependencies: TKT-accounts-001, TKT-accounts-002, TKT-accounts-003
- Parallel group: P-3 (with TKT-accounts-005 — verified disjoint: this ticket writes `apps/api/test/**` (+ `apps/api/src/auth/**` fixes only if defects surface); TKT-accounts-005 writes `apps/web/**` only; neither touches the lockfile)

**Deferred TCs (flagged for Gate 3 — integration phase):** TC-ACC-015 (anonymous → all 21 protected endpoints → 401) and TC-ACC-018 (no email in any group-scoped payload) enumerate routes of all four domains; they can only pass when the full route table exists. They are **not** re-carried here — they land in the integration phase, completing FR-ACC-009's exhaustive matrix and FR-ACC-008's payload matrix. In-domain coverage of the mechanisms: the AuthGuard (this domain, TC-ACC-009/025) and the displayName-only read models (TKT-accounts-001's `UsersService`).
