# TKT-ui-015: Groups overview — 1:1 restyle (PG-005)

- Status: todo
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/GroupsOverviewPage.tsx` + colocated `GroupsOverviewPage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page (incl. `JoinPage.tsx` — the code-entry destination), `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-GRP-001, FR-GRP-002, FR-GRP-003, FR-GRP-009; UC-GRP-001, UC-GRP-002 (code entry); UC-ACC-002 step 3 (post-login landing)
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches `figma/groups.png` **1:1 — left panel at 1230px, right panel at 390px**. PR includes before/after screenshots at both widths; reviewer verifies against the committed reference.
  2. Structure per PG-005 frozen: the user's group list (each opens the group view), empty state, create-group action with name input + invalid-name error, and the **join-by-code entry** (added in iteration 2 to close the UC-GRP-002 gap) navigating to PG-009. Structural deviation in the reference → STOP, flow back via the user — especially if the reference omits the code entry.
  3. No horizontal scroll at 390px.
  4. TC-GRP-003, TC-GRP-026 (create), TC-GRP-004 (invalid name), TC-GRP-009/027 or the equivalent join-entry UI specs, TC-GRP-031 (page timing) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §8.2 (CSP); 03-api-design.md §6 (routes unchanged — `/` and `/join/:code`)
- UX refs: PG-005; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03)
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-012…014, 016…019 — verified disjoint page-file scopes)
