# TKT-ui-016: Group view — 1:1 restyle (PG-006)

- Status: todo
- Size: L
- Scope:
  - Modify: `apps/web/src/pages/GroupViewPage.tsx` + colocated `GroupViewPage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-GRP-002, FR-GRP-005, FR-GRP-006, FR-GRP-007, FR-GRP-010, FR-EXP-011, FR-BAL-001, FR-BAL-004, FR-BAL-006; UC-GRP-003, UC-GRP-004, UC-GRP-005, UC-EXP-004, UC-BAL-001…004
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches Figma board 05 "Group View" **1:1 — Desktop layout (`2:24555`) at 1230px, Mobile layout (`2:24878`) at 390px** — across all six PG-006 regions: header (group name; creator-only join code + copy affordance), Expenses (list, add entry, logger-only edit/delete, empty state), Balances (per-member signed balances, zero-sum total), Settle-up (outstanding suggestions with party-only mark-paid, settled list with party-only undo, undone labels, nothing-owed state), Members (creator marked), Join-requests (creator-only approve/reject, empty state). This is the tallest reference (~3642px) — the full scroll length must match at both viewports. The frozen snapshot `figma/groupview.png` is the pinned acceptance target. PR includes before/after screenshots at both widths, all regions visible; reviewer verifies against the design-context output and the snapshot.
  2. Structure per PG-006 frozen, including loading/error states per section and logger-only / creator-only / party-only affordance visibility. Structural deviation in the reference → STOP, flow back via the user. Do not drop a region the reference compresses or reorders without confirmation.
  3. No horizontal scroll at 390px.
  4. Existing TCs pass unmodified: TC-GRP-013, TC-GRP-014, TC-GRP-016, TC-GRP-030 (members/requests), TC-GRP-031 (timing), TC-EXP-029, TC-EXP-030, TC-EXP-031, TC-EXP-033 (expense affordances/list/50-expense page), TC-BAL-006, TC-BAL-007, TC-BAL-009, TC-BAL-010, TC-BAL-013, TC-BAL-014, TC-BAL-021, TC-BAL-022 (balances/settle-up UI), TC-BAL-025 (lifecycle smoke); full suite green.
  5. Size note: one ticket, one reference, one acceptance — but the coder may split the *PR* by region if a single session cannot land all six regions 1:1 at both viewports; the ticket closes only when every region matches.
- Architecture refs: 01-system-architecture.md §8.2 (CSP), §7 NFR-GRP-003/NFR-EXP-002/NFR-BAL-004 rows (page budgets — restyle must not regress the ≤ 2 s timing TCs above); 03-api-design.md §6 (route unchanged)
- UX refs: PG-006 (all six regions); `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03), incl. the Figma source-of-truth subsection
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` — board 05 Group View: Desktop layout `2:24555` ("Group workspace" content `2:24566`), Mobile layout `2:24878`. Read via figma MCP. Board chrome and state labels are scaffolding — implement the layout frames only.
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-012…015, 017…019 — verified disjoint page-file scopes)
