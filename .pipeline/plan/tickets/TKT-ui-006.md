# TKT-ui-006: Group view — Members section & join-requests region

- Status: in-review
- PR: https://github.com/sarperim/settleup/pull/46
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/GroupViewPage.tsx` (+ colocated CSS) — the members tab section and the creator-only join-requests region
  - Must NOT touch: the page shell / expenses / balances / settle-up regions beyond what colocated section styling requires, `apps/web/src/styles/**`, other pages, existing spec files
- Traces to: FR-GRP-005, FR-GRP-006, FR-GRP-007, FR-GRP-010; UC-GRP-003, UC-GRP-004, UC-GRP-005
- Acceptance (page-alignment + existing TCs green):
  1. Sections match PG-006: Members — all members by display name (never email) with the creator marked; Join requests (creator only) — pending requests by display name with approve/reject actions and empty state
  2. TC-GRP-028, TC-GRP-029, TC-GRP-030 (approve / reject / handling view) and TC-GRP-031 (handling-view timing) pass unmodified
  3. Full suite green (`pnpm test`, `pnpm test:e2e`) — no testid, role, label, or text-assertion changes
- Architecture refs: 01-system-architecture.md §7 NFR-GRP-003 row; 03-api-design.md §6 (group-view route, unchanged)
- UX refs: PG-006 (Members section, Join-requests region)
- Dependencies: TKT-ui-005 (same file — sequential)
- Parallel group: none
