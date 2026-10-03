# TKT-ui-017: Add expense — 1:1 restyle (PG-007)

- Status: todo
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/AddExpensePage.tsx` + colocated `AddExpensePage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page (incl. `EditExpensePage.tsx` — TKT-ui-018's scope), `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-EXP-001…FR-EXP-007; UC-EXP-001; NFR-EXP-001 (30-second journey)
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches Figma board 06 "Add Expense" **1:1 — Desktop layout (`2:25213`) at 1230px, Mobile layout (`2:25401`) at 390px**; the frozen snapshot `figma/addexpense.png` is the pinned acceptance target. PR includes before/after screenshots at both widths; reviewer verifies against the design-context output and the snapshot.
  2. Structure per PG-007 frozen: single screen — description, amount (TRY), payer (defaults to acting user), participants (defaults to all), split-type choice (equal/exact), per-participant inputs when exact, inline client-side validation (no round-trips), success → return to group expenses. Structural deviation in the reference → STOP, flow back via the user.
  3. **The 30-second journey must not regress:** the restyle preserves the SC-003 enablers — common case = description + amount + submit (≤ 2 interactions), defaults, single screen. TC-EXP-028 passes unmodified and within its time bound.
  4. No horizontal scroll at 390px — the mobile panel is the longest form reference (~2157px scroll); the exact-split per-participant inputs must remain usable at 390px.
  5. TC-EXP-032, TC-EXP-033 (page timing, 50-expense ledger) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §7 NFR-EXP-001/002 rows (journey + budgets); 03-api-design.md §6 (route unchanged)
- UX refs: PG-007; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03), incl. the Figma source-of-truth subsection
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` — board 06 Add Expense: Desktop layout `2:25213` ("Add expense content" `2:25224`), Mobile layout `2:25401`. Read via figma MCP. Board chrome and state labels are scaffolding — implement the layout frames only.
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-012…016, 018, 019 — verified disjoint page-file scopes; the edit form is a separate component tree, no shared imports)
