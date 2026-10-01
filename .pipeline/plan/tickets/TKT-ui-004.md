# TKT-ui-004: Group view — page shell & Expenses section

- Status: done (merged via PR #44 → dev, 2026-10-01; review loop clean pass 1 — artifact `reviews/TKT-ui-004-round-1.md`)
- PR: https://github.com/sarperim/settleup/pull/44
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/GroupViewPage.tsx` (+ colocated CSS)
  - May add: a copy affordance for the join code (clipboard write via `navigator.clipboard`, non-blocking fallback) in the header region
  - Must NOT touch: `apps/web/src/styles/**`, any other page, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files
- Traces to: FR-GRP-002 (join code visible to creator), FR-EXP-011 (expenses list), UC-EXP-004; UC-EXP-002/003 (edit/delete entry points live here)
- Acceptance (page-alignment + existing TCs green):
  1. Page shell and Expenses section match PG-006: group name; creator-only join code with a copy affordance; section navigation (Expenses / Balances / Settle-up / Members); expenses list (description, amount, payer, participants, created/edited timestamps); add-expense entry; logger-only edit/delete affordances; empty state
  2. TC-EXP-029, TC-EXP-030 (logger-only edit/delete affordances), TC-EXP-031, TC-EXP-033 (list rendering, 50-expense page timing) pass unmodified; TC-BAL-025 (lifecycle, traverses the ledger) green
  3. Full suite green (`pnpm test`, `pnpm test:e2e`) — no testid, role, label, or text-assertion changes
- Architecture refs: 01-system-architecture.md §7 NFR-EXP-002/004 rows (page budgets); 03-api-design.md §6 (group-view route, unchanged)
- UX refs: PG-006 (header region, Expenses section)
- Dependencies: TKT-ui-001
- Parallel group: P-10
