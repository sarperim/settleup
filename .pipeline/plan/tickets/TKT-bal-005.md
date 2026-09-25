# TKT-bal-005: Settlement contract & invariants — SC-005 completion, isolation, retention, CSRF

- Status: todo
- Size: S
- Scope: **Create** specs under `apps/api/test/integration/**` (test-only ticket; minimal defect fixes within `apps/api/src/settlement/**` flow through the PR review — flagged, not scope creep):
  - TC-BAL-016 — zero-sum holds after settle → settle → undo → undo (the settlement half of the SC-005 operation matrix; with TC-EXP-023 from TKT-bal-002 the full matrix is green — NFR-BAL-001).
  - TC-BAL-017 — balances never mix across groups (expense in A, settlement in A, group B stays all-zero).
  - TC-BAL-019 — settled rows are retained forever (settle two → undo one → settle a regenerated suggestion → undo again; direct `settled_payments` table reads; nothing deleted or rewritten).
  - TC-BAL-020 — CSRF header required on the two settlement state-changing routes, no side effects.
  - **Must NOT touch**: `apps/web/**`, `apps/api/src/settlement/engine/**`, `apps/api/src/ledger/**`, `apps/api/src/groups/**`, `packages/**`, root `package.json` / `pnpm-lock.yaml`.
- Traces to: FR-BAL-003 (full matrix complete), FR-BAL-002 (isolation) · UC-BAL-003/004 postconditions · BR-BAL-001/003, NFR-BAL-001/005 · OBJ-004, SC-005 · API §1 (CSRF)
- Acceptance: TC-BAL-016, TC-BAL-017, TC-BAL-019, TC-BAL-020 green
- Architecture refs: 01-system-architecture.md §5.2 (zero-sum by construction), §7 (NFR-BAL-001/005 rows), §8.2 (CSRF); 02-data-model.md §5.2, §7; 03-api-design.md §3c, §4; testing/balances-settlement.md §2 (TC-BAL-016, 017, 019, 020)
- Dependencies: TKT-bal-004
- Parallel group: P-8 (with TKT-bal-006 — verified disjoint: this ticket writes `apps/api/test/**` only; TKT-bal-006 writes `apps/web/**` only; neither touches the lockfile)
