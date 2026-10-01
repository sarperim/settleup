# TKT-ui-008: Edit-expense form

- Status: todo
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/EditExpensePage.tsx` (+ colocated CSS)
  - Must NOT touch: `apps/web/src/styles/**`, any other page (including `AddExpensePage.tsx`), `apps/web/src/routes.ts`, existing spec files
- Traces to: FR-EXP-006, FR-EXP-008 (UI surfaces); UC-EXP-002
- Acceptance (page-alignment + existing TCs green):
  1. Page matches PG-008: the PG-007 form prefilled with current values, same validation; logger-only reachability; save and abandon actions; success returns to the group ledger — unchanged in function, styled consistently with the add-expense form via the shared classes from TKT-ui-001
  2. TC-EXP-029, TC-EXP-030 (edit journeys incl. logger-only denial), TC-EXP-032, TC-EXP-033 (page timing, 50-expense context) pass unmodified
  3. Full suite green (`pnpm test`, `pnpm test:e2e`) — no testid, role, label, or text-assertion changes
- Architecture refs: 01-system-architecture.md §7 NFR-EXP-002 row; 03-api-design.md §6 (route, unchanged)
- UX refs: PG-008 (structure references PG-007)
- Dependencies: TKT-ui-001
- Parallel group: P-10
