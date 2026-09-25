# TKT-exp-002: Log an expense — Ledger module create endpoint

- Status: todo
- Size: M
- Scope: **Create** `apps/api/src/ledger/**` (module, controller, service — C4) and integration specs:
  - `POST /api/groups/:groupId/expenses` — `GroupMemberGuard` applied (non-member → `404`); DTO validation → `400 VALIDATION_FAILED` + `details` (description 1–200, integer `amountKurus` 0…2^31−1, `payerId`, `participantIds[]`, `splitType`, `exactAmounts?`; **no date field anywhere** — BR-EXP-008); service checks in the amended fixed order `NO_PARTICIPANTS` → `PARTICIPANT_NOT_MEMBER` → `SPLIT_SUM_MISMATCH`; payer/participants validated against the group's membership (`MembershipService`); shares computed by the TKT-exp-001 engine with the **real CSPRNG provider wired here**; expense + shares written in **one DB transaction** (NFR-EXP-003); `createdAt` server-set, `editedAt` absent.
  - Strategy §5 factory `createExpense(memberCookie, groupId, expenseInput)` (lands here — it owns the route).
  - **Must NOT touch**: `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-EXP-001, FR-EXP-002, FR-EXP-003, FR-EXP-010 (create side) · UC-EXP-001 (main, A1, E1, E2, E3) · BR-EXP-001/002/003/004/006/010
- Acceptance: TC-EXP-007, TC-EXP-008, TC-EXP-009, TC-EXP-010, TC-EXP-011, TC-EXP-012, TC-EXP-013, TC-EXP-014 green
- Architecture refs: 01-system-architecture.md §2 (C4), §5.1, §6 (FR-EXP rows), §7 (NFR-EXP-001/003 rows); 02-data-model.md §4 (Expense/ExpenseShare), §5.4, §9 (invariants); 03-api-design.md §1, §3b (create row), §4 (service-level precedence, amended 2026-09-25); testing/expense-tracking.md §2 (TC-EXP-007…014) + conventions (structural remainder assertions at integration level — T5)
- Dependencies: TKT-exp-001, TKT-groups-001 (GroupMemberGuard, MembershipService, UsersService)
- Parallel group: none
