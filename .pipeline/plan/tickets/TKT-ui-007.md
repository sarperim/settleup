# TKT-ui-007: Add-expense form — the 30-second journey

- Status: in-progress
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/AddExpensePage.tsx` (+ colocated CSS)
  - Must NOT touch: `apps/web/src/styles/**`, any other page (including `EditExpensePage.tsx` — separate ticket), `apps/web/src/api/**`, `apps/web/src/routes.ts`, existing spec files
- Traces to: FR-EXP-001…FR-EXP-007 (UI surfaces); UC-EXP-001; NFR-EXP-001, SC-003
- Acceptance (page-alignment + existing TCs green):
  1. Page matches PG-007: single screen; description; TRY amount; payer selection (defaults to acting user); participant selection (defaults to all members); equal/exact split choice with per-participant inputs when exact; inline client-side validation with no round-trips until submit; success returns to the group ledger — unchanged in function, styled per the design direction
  2. TC-EXP-028 (timed add-expense journey, ≤ 30 s) and TC-EXP-031 pass unmodified — the styling must not degrade the SC-003 path (e.g., no added round-trips, no focus traps)
  3. Full suite green (`pnpm test`, `pnpm test:e2e`) — no testid, role, label, or text-assertion changes
- Architecture refs: 01-system-architecture.md §7 NFR-EXP-001 row (defaults, ≤ 2 interactions, single screen); 03-api-design.md §6 (route, unchanged)
- UX refs: PG-007
- Dependencies: TKT-ui-001
- Parallel group: P-10
