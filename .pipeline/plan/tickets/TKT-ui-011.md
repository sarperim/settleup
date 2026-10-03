# TKT-ui-011: App shell — responsive chrome per the references (PG-001)

- Status: todo
- Size: M
- Scope:
  - Modify: `apps/web/src/layout/RootLayout.tsx` + colocated `RootLayout.css`
  - Must NOT touch: `apps/web/src/styles/**` (frozen by TKT-ui-010), any page component, `apps/web/src/api/**`, `apps/web/src/routes.ts`, `apps/api/**`, existing spec files, `figma/**`
- Traces to: FR-ACC-005, FR-ACC-008; UC-ACC-003 (logout); UC-ACC-006 (guard behavior renders through the shell)
- Acceptance (page-alignment, explicit + existing TCs green):
  1. Shell chrome matches the chrome visible in the reference screens — **desktop panel at 1230px viewport and mobile panel at 390px viewport, 1:1** (app name, acting user's display name, nav to groups overview and change password, logout). Mobile chrome behavior is whatever the right panels show — reproduce it, do not improvise.
  2. Structure per PG-001 unchanged: display name never email; authenticated vs anonymous nav sets; logout ends the session and returns to login.
  3. No horizontal scroll at 390px.
  4. PR includes before/after screenshots at both viewports; reviewer verifies against the committed references.
  5. TC-ACC-008, TC-ACC-009, TC-ACC-025 (logout/session behavior) and TC-ACC-027 (auth page timing) pass unmodified; full suite green — no testid, role, label, or text-assertion changes.
- Architecture refs: 01-system-architecture.md §8.2 (CSP); §6 route table via 03-api-design.md §6 (routes frozen — nav targets unchanged)
- UX refs: PG-001; `00-ux-pages.md` § Design contract — Figma reference screens (2026-10-03)
- Dependencies: TKT-ui-010 (refreshed tokens)
- Parallel group: none — lands before the page tickets: every page screenshot includes the shell, so page verification is only meaningful against the new chrome
