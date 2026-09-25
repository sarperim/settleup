# TKT-bal-002: Balance engine & balances endpoint (derived, D-ARCH-004)

- Status: todo
- Size: M
- Scope: **Create** the settlement module root files in `apps/api/src/settlement/` (`settlement.module.ts`, balances controller/service — C5) and integration specs:
  - Balance engine per arch §5.2 / 02 §7 reference SQL: per (group, member) derived on demand — `Σ paid expenses − Σ own shares + Σ settled payments made − Σ settled payments received` — integer kuruş, one Prisma aggregation per group, always filtered by groupId (never cross-group). Nothing materialized (D-ARCH-004).
  - `GET /api/groups/:groupId/balances` — `GroupMemberGuard` (404 non-member); `200 { balances: [{ member: { id, displayName }, balanceKurus }], sumKurus: 0 }` (FR-BAL-001/002/003 read side).
  - Reads expenses/shares via `LedgerReadService` only (arch §3 rule 1).
  - Module skeleton registers only the balance components — the suggestion-engine provider wiring lands with TKT-bal-003 (this ticket must compile standalone: it branches parallel to TKT-bal-001).
  - **Carries the two expense-plan TCs deferred at the Expense gate** — both assert through this endpoint: TC-EXP-023 (zero-sum after every expense create/edit/delete — the SC-005 expense half) and TC-EXP-024 (50-expense ledger, newest first, `sumKurus === 0`).
  - Specs: TC-BAL-006 (per-member values from the standing value fixture), TC-EXP-023, TC-EXP-024.
  - **Must NOT touch**: `apps/api/src/settlement/engine/**` (TKT-bal-001, parallel), `apps/api/src/ledger/**`, `apps/api/src/groups/**`, `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-BAL-001, FR-BAL-002, FR-BAL-003 (read side) · UC-BAL-001 (main) · BR-BAL-001/002/003 · D-ARCH-004 · SC-005 (expense parameters — joint with TC-BAL-016)
- Acceptance: TC-BAL-006, TC-EXP-023, TC-EXP-024 green
- Architecture refs: 01-system-architecture.md §2 (C5), §5.2 (balance engine + zero-sum proof), §6 (FR-BAL rows); 02-data-model.md §7 (reference SQL), §6 (LedgerReadService read path); 03-api-design.md §3c (balances row); testing/balances-settlement.md §2 (TC-BAL-006) + standing value fixture; testing/expense-tracking.md §2 (TC-EXP-023, 024 — deferred here at the Expense gate: they require this endpoint)
- Dependencies: TKT-exp-003 (LedgerReadService), TKT-groups-001 (guards, MembershipService)
- Parallel group: P-7 (with TKT-exp-006 and TKT-bal-001 — verified disjoint: this ticket writes `apps/api/src/settlement/*.ts` module root files + `apps/api/test/integration/**` specs only; the engine subdir and `apps/web/**` are untouched)
