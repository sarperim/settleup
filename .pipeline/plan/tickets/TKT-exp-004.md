# TKT-exp-004: Edit & delete expenses — logger-only, recompute rule, cross-route 404, CSRF

- Status: todo
- Size: M
- Scope: **Extend** `apps/api/src/ledger/**` and add integration specs:
  - `PATCH /api/groups/:groupId/expenses/:expenseId` — **logger only** (`403 NOT_LOGGER`, checked before field validation); validation as create; shares recomputed with a fresh random draw **iff** amount/participants/splitType changed — description-only and payer-only edits leave the stored shares untouched (BR-EXP-005); `editedAt` set on success only.
  - `DELETE /api/groups/:groupId/expenses/:expenseId` — logger only; **hard delete** of expense + shares (cascade — BR-EXP-011).
  - Nonexistent and cross-group expense ids → `404 NOT_FOUND` on GET/PATCH/DELETE (an expense is addressable only through its own group).
  - CSRF header required on the three expense state-changing routes, no side effects.
  - Specs: TC-EXP-015 (parameterized edit matrix), TC-EXP-016 (non-logger edit incl. precedence), TC-EXP-017 (failed edit leaves expense unchanged), TC-EXP-018 (hard delete incl. DB-level checks), TC-EXP-019 (non-logger delete), TC-EXP-020 (foreign/missing ids), TC-EXP-026 (persistence until logger deletes), TC-EXP-027 (CSRF).
  - **Must NOT touch**: `apps/web/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-EXP-006, FR-EXP-008, FR-EXP-009, FR-EXP-012 · UC-EXP-002 (main, E1, E2), UC-EXP-003 (main, E1) · BR-EXP-005/007/008/011 · NFR-EXP-005
- Acceptance: TC-EXP-015, TC-EXP-016, TC-EXP-017, TC-EXP-018, TC-EXP-019, TC-EXP-020, TC-EXP-026, TC-EXP-027 green
- Architecture refs: 03-api-design.md §3b (PATCH/DELETE rows), §4 (service-level precedence — `NOT_LOGGER` first, amended 2026-09-25); 02-data-model.md §4 (ExpenseShare cascade), §9; 01-system-architecture.md §5.1 (recompute rule), §6, §8.2 (CSRF); testing/expense-tracking.md §2 (TC-EXP-015…020, 026, 027)
- Dependencies: TKT-exp-002
- Parallel group: P-6 (with TKT-exp-005 — verified disjoint: this ticket writes `apps/api/src/ledger/**` + `apps/api/test/**` only; TKT-exp-005 writes `apps/web/**` only; neither touches the lockfile)
