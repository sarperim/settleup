# TKT-ui-012: Login — 1:1 restyle (PG-002)

- Status: todo
- Size: S
- Scope:
  - Modify: `apps/web/src/pages/LoginPage.tsx` + colocated `LoginPage.css`
  - Must NOT touch: `apps/web/src/styles/**`, `apps/web/src/layout/**`, any other page, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-ACC-003, FR-ACC-004; UC-ACC-002; UC-ACC-006 (redirect target)
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Rendered page matches `figma/login.png` **1:1 — left panel at 1230px viewport, right panel at 390px viewport**. PR includes before/after screenshots at both widths; reviewer verifies against the committed reference.
  2. Structure per PG-002 frozen: email + password inputs, submit, credentials error state, throttled state (429 `TOO_MANY_ATTEMPTS`), link to register, success → groups overview. If the reference shows content or actions PG-002 does not pin (or omits pinned ones), STOP — flow back via the user as a plan amendment; do not improvise.
  3. No horizontal scroll at 390px.
  4. TC-ACC-005, TC-ACC-006, TC-ACC-007 (login flows and errors), TC-ACC-027 (page timing) pass unmodified; full suite green.
- Architecture refs: 01-system-architecture.md §8.2 (CSP — no remote assets); 03-api-design.md §6 (route unchanged)
- UX refs: PG-002; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03)
- Dependencies: TKT-ui-010, TKT-ui-011
- Parallel group: P-12 (with TKT-ui-013…019 — verified disjoint: each ticket writes only its own page component + colocated CSS; none touch shared styles, the shell, other pages, or the lockfile)
