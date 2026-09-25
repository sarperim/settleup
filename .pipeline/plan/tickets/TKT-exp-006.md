# TKT-exp-006: Expense UI — edit & delete (logger-only), page timing, 50-expense page (e2e)

- Status: todo
- Size: M
- Scope: **Create** the edit form and delete affordance in `apps/web/src/**` and the e2e specs:
  - Edit form (`/groups/:groupId/expenses/:expenseId/edit`) — single screen, prefilled from the expense detail; logger-only affordances (a member who is not the logger sees **no** edit/delete controls — BR-EXP-007 UI aspect).
  - E2e specs (self-contained, in-test UI setup incl. join-by-code): TC-EXP-029 (edit through the UI, non-logger sees no affordance), TC-EXP-030 (delete through the UI), TC-EXP-032 (page-load budget: expenses tab, add-expense form, edit form — T4, ≤ 2.0 s), TC-EXP-033 (50-expense ledger page within budget — 50 expenses seeded via direct Prisma, seed validity asserted).
  - **Must NOT touch**: `apps/api/**`, `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-EXP-008, FR-EXP-009, FR-EXP-011 (UI aspects) · UC-EXP-002 (main, UI), UC-EXP-003 (main, UI), UC-EXP-004 (main, UI) · NFR-EXP-002, NFR-EXP-004 (e2e half)
- Acceptance: TC-EXP-029, TC-EXP-030, TC-EXP-032, TC-EXP-033 green
- Architecture refs: 03-api-design.md §6 (SPA routes); 01-system-architecture.md §7 (NFR-EXP-002/004 rows); testing/expense-tracking.md §2 (TC-EXP-029, 030, 032, 033) + e2e conventions; testing/00-test-strategy.md §3 (T4), §5 (scale-fixture seeding)
- Dependencies: TKT-exp-004 (edit/delete routes), TKT-exp-005 (list + form pages), TKT-groups-006 (join-flow UI for in-test setup)
- Parallel group: P-7 (with TKT-bal-001 and TKT-bal-002 — verified disjoint: this ticket writes `apps/web/**` only; the balances tickets write `apps/api/**` only; no lockfile writers in the group)
