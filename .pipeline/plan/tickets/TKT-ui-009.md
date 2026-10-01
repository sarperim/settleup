# TKT-ui-009: Join-by-code confirmation page

- Status: done (merged via PR #39 → dev, 2026-10-01; review loop clean pass 2 after one fixer round — artifacts `reviews/TKT-ui-009-round-{1,2}.md`)
- PR: https://github.com/sarperim/settleup/pull/39
- Size: S
- Scope:
  - Modify: `apps/web/src/pages/JoinPage.tsx` (+ colocated CSS)
  - Must NOT touch: `apps/web/src/styles/**`, any other page, `apps/web/src/routes.ts`, existing spec files (TC-GRP-032's new case belongs to TKT-ui-003)
- Traces to: FR-GRP-003, FR-GRP-004 (UI surfaces); UC-GRP-002
- Acceptance (page-alignment + existing TCs green):
  1. Page matches PG-009: the resolved group's name (nothing else) shown before confirming; confirm action; states — request pending, request already pending, already a member, code not found, re-request after rejection — unchanged in function, styled per the design direction
  2. TC-GRP-027 (join via UI) and TC-GRP-029 (reject + re-request) pass unmodified
  3. Full suite green (`pnpm test`, `pnpm test:e2e`) — no testid, role, label, or text-assertion changes
- Architecture refs: 03-api-design.md §6 (route, unchanged)
- UX refs: PG-009
- Dependencies: TKT-ui-001
- Parallel group: P-10
