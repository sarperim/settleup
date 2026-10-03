# TKT-ui-013: Register — 1:1 restyle (PG-003)

- Status: in-review
- PR: https://github.com/sarperim/settleup/pull/51 (base `tkt-ui-010`, stacked)
- Size: S
- Scope:
  - Modify: `apps/web/src/pages/RegisterPage.tsx` + colocated `RegisterPage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-ACC-001, FR-ACC-002, FR-ACC-010; UC-ACC-001
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches Figma board 02 "Create Account" **1:1 — Desktop layout (`2:24121`) at 1230px, Mobile layout (`2:24185`) at 390px**; the frozen snapshot `figma/createaccount.png` is the pinned acceptance target. PR includes before/after screenshots at both widths; reviewer verifies against the design-context output and the snapshot.
  2. Structure per PG-003 frozen: email, password, display-name inputs; submit; email-taken and invalid-input error states; success → immediate session → groups overview. Structural deviation in the reference → STOP, flow back via the user.
  3. No horizontal scroll at 390px.
  4. TC-ACC-001, TC-ACC-002, TC-ACC-003, TC-ACC-004 (register flows, email non-enumeration parity), TC-ACC-027 (page timing) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §8.2 (CSP); 03-api-design.md §6 (route unchanged)
- UX refs: PG-003; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03), incl. the Figma source-of-truth subsection
- Figma refs: file `XzY4HLCoW70yfI9NgeLXqC` — board 02 Create Account: Desktop layout `2:24121`, Mobile layout `2:24185`. Read via figma MCP. Board chrome and state labels are scaffolding — implement the layout frames only.
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-012, 014…019 — verified disjoint page-file scopes)
