# TKT-ui-019: Join by code — 1:1 restyle (PG-009)

- Status: todo
- Size: S
- Scope:
  - Modify: `apps/web/src/pages/JoinPage.tsx` + colocated `JoinPage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page (incl. `GroupsOverviewPage.tsx` — the code entry lives there, TKT-ui-015's scope), `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-GRP-003, FR-GRP-004; UC-GRP-002; BR-GRP-004, BR-GRP-010
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches Figma board 08 "Join by Code" **1:1 — Desktop layout (`2:25997`) at 1230px, Mobile layout (`2:26087`) at 390px**, including the board's five-state request catalog (pending, already pending, already member, code not found, rejected-may-re-request). The frozen snapshot `figma/joinbycode.png` is the pinned acceptance target. PR includes before/after screenshots at both widths; reviewer verifies against the design-context output and the snapshot.
  2. Structure per PG-009 frozen: code resolved to the group's **name only** before confirming; confirm action places the join request; all five states — pending, already-pending, already-member, code-not-found, rejected-user-may-re-request; privacy note beneath the card (iteration-3 design-pinned addition, PG-009). Structural deviation in the reference → STOP, flow back via the user.
  3. No horizontal scroll at 390px.
  4. TC-GRP-008, TC-GRP-009, TC-GRP-010 (join flow + errors), TC-GRP-011, TC-GRP-012 (already-member / re-request), TC-GRP-027, TC-GRP-031 (timing) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §8.2 (CSP); 03-api-design.md §6 (route unchanged — `/join/:code`)
- UX refs: PG-009 (incl. iteration-3 addition — privacy note); `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03), incl. the Figma source-of-truth subsection
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` — board 08 Join by Code: Desktop layout `2:25997` ("Join content" `2:26008`), Mobile layout `2:26087`. Read via figma MCP. Board chrome and state labels are scaffolding — implement the layout frames only.
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-012…018 — verified disjoint page-file scopes)
