# TKT-ui-002: Auth pages — login, register, change password

- Status: done (merged via PR #40 → dev, 2026-10-01; review loop clean pass 1 — artifacts `reviews/TKT-ui-002-round-1.md`)
- PR: https://github.com/sarperim/settleup/pull/40
- Size: M
- Scope:
  - Modify: `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/RegisterPage.tsx`, `apps/web/src/pages/ChangePasswordPage.tsx` (+ colocated `*.css` per page, created here)
  - Must NOT touch: `apps/web/src/styles/**` (foundation-owned — escalate needed shared-class changes, don't edit), any other page, `apps/web/src/api/**`, `apps/web/src/auth/**`, `apps/web/src/routes.ts`, `apps/api/**`, `packages/shared/**`, existing spec files
- Traces to: FR-ACC-001…007, FR-ACC-010 (UI surfaces of the accounts FRs)
- Acceptance (page-alignment + existing TCs green):
  1. Pages match PG-002, PG-003, PG-004 (`00-ux-pages.md`): form fields, submit, error states (bad credentials, email taken, invalid input, wrong current password), login throttled state, success transitions — unchanged in function, styled per the design direction
  2. TC-ACC-023, TC-ACC-024, TC-ACC-025, TC-ACC-026 (auth UI) and TC-ACC-027 (auth timing — ≤ 2 s budgets hold with the new styles/fonts) pass unmodified
  3. Full suite green (`pnpm test`, `pnpm test:e2e`) — includes the TC-BAL-025 lifecycle that traverses login/register — no testid, role, label, or text-assertion changes
- Architecture refs: 01-system-architecture.md §7 NFR-ACC-003 row; 03-api-design.md §6 (routes — unchanged)
- UX refs: PG-002, PG-003, PG-004; `00-ux-pages.md` § Design direction
- Dependencies: TKT-ui-001
- Parallel group: P-10
