# TKT-bal-003: Settle-up view — outstanding plan + settled facts

- Status: in-progress
- Size: S
- Scope: **Extend** `apps/api/src/settlement/**` and add integration specs:
  - `GET /api/groups/:groupId/settlements` — `200 { outstanding: [{ payer, recipient, amountKurus }], settled: [{ id, payer, recipient, amountKurus, paidAt, undoneAt? }] }`:
    - `outstanding` computed **live** from current balances via the TKT-bal-001 suggestion engine (D-ARCH-004 — derived output, never stored; G-3: all assertions go through this API, never stored plan rows).
    - `settled` = the SETTLED/UNDONE `SettledPayment` facts, distinguished.
  - Register the suggestion-engine provider in the settlement module (the wiring deliberately absent from TKT-bal-002).
  - Specs: TC-BAL-007 (outstanding plan from the standing value fixture + initially empty settled list), TC-BAL-008 (all-zero group → empty `outstanding`, both a no-expense and a nets-to-zero group), TC-BAL-018 (structural properties at API level: two identical reads, plan zeroes balances, zero-balance member excluded, ≤ members−1 payments, random-remainder fixture).
  - **Must NOT touch**: `apps/api/src/settlement/engine/**`, `apps/api/src/ledger/**`, `apps/api/src/groups/**`, `apps/web/**`, `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-BAL-004, FR-BAL-005 (API side), FR-BAL-010 (read side) · UC-BAL-002 (main, A1) · BR-BAL-004/005/008/009/011 · D-ARCH-004, strategy G-3
- Acceptance: TC-BAL-007, TC-BAL-008, TC-BAL-018 green
- Architecture refs: 01-system-architecture.md §5.3, §6 (FR-BAL rows); 02-data-model.md §5.2 (facts-only resolution), §6; 03-api-design.md §3c (settlements row); testing/balances-settlement.md §2 (TC-BAL-007, 008, 018) + conventions (derived-state rule)
- Dependencies: TKT-bal-001, TKT-bal-002
- Parallel group: none
