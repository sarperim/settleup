# TKT-ui-003: Groups overview + join-by-code entry (closes UC-GRP-002 gap)

- Status: in-progress
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/GroupsOverviewPage.tsx` (+ colocated CSS)
  - Create (test): the TC-GRP-032 case in `apps/web/test/e2e/join-flow-ui.spec.ts` (next free ID; permanent)
  - Modify (docs): `.pipeline/testing/groups-membership.md` — add TC-GRP-032 to the plan (amendment approved with this ticket)
  - Must NOT touch: `apps/web/src/styles/**`, any other page, `apps/web/src/routes.ts` (navigates to the existing `/join/:code` route — no route-table change), `apps/api/**`, `packages/shared/**`, other spec files
- Traces to: FR-GRP-001, FR-GRP-003, FR-GRP-009; UC-GRP-001, UC-GRP-002 (the "entering the code" path — currently missing from the UI; see `00-ux-pages.md` § Provenance)
- Acceptance:
  1. Page matches PG-005: groups list (each opens the group view), empty state, create-group form with invalid-name error state, and the **new join-by-code entry** — a code input that navigates to `/join/:code` for the entered code
  2. **New TC-GRP-032** (this ticket owns it): from the signed-in overview, entering a valid code lands on the join page with the group's name shown before confirming; entering an unknown code reaches the join page's code-not-found state. Added to the spec and the groups test plan
  3. TC-GRP-026 (groups overview UI) passes unmodified; full suite green (`pnpm test`, `pnpm test:e2e`) — no changes to existing testids, roles, labels, or text assertions
- Architecture refs: 03-api-design.md §6 (route table — unchanged; entry navigates to existing `/join/:code`), §3 (join-requests endpoints — already implemented)
- UX refs: PG-005 (join-by-code entry), PG-009 (destination)
- Dependencies: TKT-ui-001
- Parallel group: P-10
