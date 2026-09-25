# TKT-exp-003: Ledger reads — list, detail, defensive cap, LedgerReadService

- Status: todo
- Size: S
- Scope: **Extend** `apps/api/src/ledger/**` and add integration specs:
  - `GET /api/groups/:groupId/expenses` — full list (no pagination), newest first, group-scoped only; defensive cap: > 500 rows → `500 LIST_TOO_LARGE`.
  - `GET /api/groups/:groupId/expenses/:expenseId` — detail incl. shares and timestamps; user references as `{ id, displayName }` only.
  - `LedgerReadService` — the exported read API C5 consumes for balance computation (group-scoped expense/share reads — arch §3 rule 1, 02 §6 ownership matrix).
  - Specs: TC-EXP-021 (ledger list, newest first, group scoping), TC-EXP-022 (detail shape), TC-EXP-025 (defensive cap at 501 — seeded via direct Prisma per the scale-fixture permission, fixture validity asserted).
  - **Must NOT touch**: `apps/web/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-EXP-011 · UC-EXP-004 (main) · BR-EXP-009 (mechanism — guard applied) · NFR-EXP-004 (list shape + cap)
- Acceptance: TC-EXP-021, TC-EXP-022, TC-EXP-025 green
- Architecture refs: 03-api-design.md §3b (list/detail rows, cap note); 01-system-architecture.md §2 (C4), §6, §7 (NFR-EXP-004 row), §9 flag 4; 02-data-model.md §4 (`@@index([groupId, createdAt])`), §6; testing/expense-tracking.md §2 (TC-EXP-021, 022, 025); testing/00-test-strategy.md §5 (seeding permission)
- Dependencies: TKT-exp-002
- Parallel group: none
