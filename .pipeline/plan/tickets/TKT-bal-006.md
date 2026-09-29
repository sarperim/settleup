# TKT-bal-006: Balances & settle-up UI (e2e)

- Status: in-review
- PR: https://github.com/sarperim/settleup/pull/33
- Size: M
- Scope: **Create** the balances and settle-up tabs in `apps/web/src/**` (replacing the group-view placeholders) and e2e specs:
  - Balances tab: per-member balances with display names; the displayed balances visibly sum to zero.
  - Settle-up tab: outstanding suggestions (payer → recipient, kuruş-exact amounts — sub-lira rendered exactly, never rounded), mark-paid actions (the UI marks the suggestion the acting user is a party to), settled list with undo actions and undone entries distinguished.
  - E2e specs (self-contained identities + in-test UI setup incl. join-by-code and logging expenses through the UI form): TC-BAL-021 (balances view), TC-BAL-022 (settle-up view incl. the ₺0.01 sub-lira suggestion), TC-BAL-023 (mark paid through the UI — balances reach 0.00), TC-BAL-024 (undo through the UI — payment returns to outstanding), TC-BAL-026 (page-load budget on both tabs — T4, ≤ 2.0 s).
  - **Must NOT touch**: `apps/api/**`, `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml` (not lockfile-eligible in P-8).
- Traces to: FR-BAL-001, FR-BAL-004, FR-BAL-005, FR-BAL-007, FR-BAL-009, FR-BAL-010 (UI aspects) · UC-BAL-001 (main, UI), UC-BAL-002 (main, UI), UC-BAL-003 (main, UI), UC-BAL-004 (main, UI) · NFR-BAL-004 (page half) · OBJ-004 (visible zero-sum)
- Acceptance: TC-BAL-021, TC-BAL-022, TC-BAL-023, TC-BAL-024, TC-BAL-026 green
- Architecture refs: 03-api-design.md §6 (SPA routes — group view tabs); 01-system-architecture.md §2 (C1), §7 (NFR-BAL-004 row); testing/balances-settlement.md §2 (TC-BAL-021, 022, 023, 024, 026) + e2e conventions; testing/00-test-strategy.md §3 (T4)
- Dependencies: TKT-bal-003 (settle-up read), TKT-bal-004 (mark-paid/undo routes), TKT-exp-005 (expense form for in-test setup), TKT-groups-006 (join flow — transitive via exp-005)
- Parallel group: P-8 (with TKT-bal-005 — verified disjoint: this ticket writes `apps/web/**` only)
