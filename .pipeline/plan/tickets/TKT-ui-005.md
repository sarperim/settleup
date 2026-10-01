# TKT-ui-005: Group view — Balances & Settle-up sections

- Status: in-review
- PR: https://github.com/sarperim/settleup/pull/45
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/GroupViewPage.tsx` (+ colocated CSS) — the balances and settle-up tab sections only
  - Must NOT touch: the page shell / expenses / members / join-requests regions beyond what colocated section styling requires, `apps/web/src/styles/**`, other pages, existing spec files
- Traces to: FR-BAL-001, FR-BAL-004, FR-BAL-005, FR-BAL-006; UC-BAL-001, UC-BAL-002, UC-BAL-003, UC-BAL-004
- Acceptance (page-alignment + existing TCs green):
  1. Sections match PG-006: Balances — every member's signed balance by display name with the visible zero-sum total; Settle-up — outstanding suggestions with party-only mark-paid, settled list with party-only undo, undone entries labelled, nothing-owed state
  2. TC-BAL-021, TC-BAL-022, TC-BAL-023, TC-BAL-024 (balances/settle-up UI) and TC-BAL-026 (page timing — ≤ 2 s holds with the new styles) pass unmodified
  3. Full suite green (`pnpm test`, `pnpm test:e2e`) — no testid, role, label, or text-assertion changes
- Architecture refs: 01-system-architecture.md §7 NFR-BAL-004 row; 03-api-design.md §6 (group-view route, unchanged)
- UX refs: PG-006 (Balances section, Settle-up section)
- Dependencies: TKT-ui-004 (same file — sequential)
- Parallel group: none
