# TKT-ui-018: Edit expense — 1:1 restyle (PG-008)

- Status: todo
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/EditExpensePage.tsx` + colocated `EditExpensePage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page (incl. `AddExpensePage.tsx` — TKT-ui-017's scope), `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-EXP-006, FR-EXP-008; UC-EXP-002
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches Figma board 07 "Edit Expense" **1:1 — Desktop layout (`2:25593`) at 1230px, Mobile layout (`2:25793`) at 390px**, including the board's state catalog: prefilled state, exact-split state with inline errors, and the permission-denied card. The frozen snapshot `figma/editexpense.png` is the pinned acceptance target. PR includes before/after screenshots at both widths; reviewer verifies against the design-context output and the snapshot.
  2. Structure per PG-008 frozen: the add-expense form prefilled with current values, same validation, save and abandon actions, success → return to group expenses; logger-only reachability unchanged — now presented as the in-page permission-denied state (iteration-3 design-pinned addition, PG-008), plus the breadcrumb (group / expense / edit) above the form. Structural deviation in the reference → STOP, flow back via the user.
  3. Visual consistency: the form's shared patterns (inputs, split-type choice, per-participant rows) follow the same reference language as `figma/addexpense.png` — the two form pages are verified as a pair in review.
  4. No horizontal scroll at 390px.
  5. TC-EXP-015, TC-EXP-029 (edit flows/affordances), TC-EXP-016, TC-EXP-017 (validation/logger-only), TC-EXP-032 (page timing) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §7 NFR-EXP-002 row (page budget); 03-api-design.md §6 (route unchanged)
- UX refs: PG-008 (structure references PG-007; incl. iteration-3 additions — breadcrumb, permission-denied state); `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03), incl. the Figma source-of-truth subsection
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` — board 07 Edit Expense: Desktop layout `2:25593` ("Edit expense content" `2:25604`), Mobile layout `2:25793`. Read via figma MCP. Board chrome and state labels are scaffolding — implement the layout frames only.
- Dependencies: TKT-ui-010, TKT-ui-011 (TKT-ui-017 is a parallel peer, not a dependency — but if both are in flight, review order prefers 017 first for the shared form language)
- Parallel group: P-12 (with TKT-ui-012…017, 019 — verified disjoint page-file scopes)
