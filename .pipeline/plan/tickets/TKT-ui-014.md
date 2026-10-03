# TKT-ui-014: Change password — 1:1 restyle (PG-004)

- Status: todo
- Size: S
- Scope:
  - Modify: `apps/web/src/pages/ChangePasswordPage.tsx` + colocated `ChangePasswordPage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-ACC-006, FR-ACC-007; UC-ACC-004; ASM-003
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches `figma/changeaccount.png` **1:1 — left panel at 1230px, right panel at 390px**. PR includes before/after screenshots at both widths; reviewer verifies against the committed reference.
  2. Structure per PG-004 frozen: current-password + new-password inputs, submit, wrong-current-password error state, success confirmation (other sessions invalidated, acting session survives — D-ARCH-002). Structural deviation in the reference → STOP, flow back via the user.
  3. No horizontal scroll at 390px.
  4. TC-ACC-010, TC-ACC-011 (change-password flows), TC-ACC-026, TC-ACC-027 (timing) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §8.2 (CSP), §4 D-ARCH-002 (session invalidation semantics unchanged); 03-api-design.md §6 (route unchanged)
- UX refs: PG-004; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03)
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-012, 013, 015…019 — verified disjoint page-file scopes)
