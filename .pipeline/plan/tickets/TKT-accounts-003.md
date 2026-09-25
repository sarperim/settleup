# TKT-accounts-003: Password change & owner reset CLI

- Status: todo
- Size: M
- Scope: **Extend** `apps/api/src/auth/**`, **create** `apps/api/src/scripts/set-password.ts` (emitted to `dist/scripts/` by the api build), and add specs:
  - `POST /api/auth/password` — verify current password (`400 INVALID_CURRENT_PASSWORD`), enforce new-password policy with DTO-precedes-service precedence (TC-ACC-035), update the Argon2id hash, delete all of the user's session rows **except the acting one** (D-ARCH-002), `204`.
  - Owner reset CLI `set-password.js` (arch §10 runbook, amended 2026-09-25): `node dist/scripts/set-password.js <email>` accepts the new password via **non-interactive piped stdin**, writes the Argon2id hash, and **deletes all of the user's session rows** in the same operation; no HTTP surface.
  - System spec for TC-ACC-028 under `apps/api/test/system/**`, wired into the **e2e phase** (`pnpm test:e2e` runs it post-build against `E2E_DATABASE_URL`, alongside Playwright — extend the e2e-phase runner composition; no new dependencies).
  - **Must NOT touch**: `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `.github/workflows/ci.yml`, root `package.json` / `pnpm-lock.yaml` (runner composition only if unavoidable — no dependency changes).
- Traces to: FR-ACC-006, FR-ACC-007 · UC-ACC-004 (main, E1), UC-ACC-005 (automatable steps 3+5) · ASM-003 · D-ARCH-002 · D-ARCH-003
- Acceptance: TC-ACC-010, TC-ACC-011, TC-ACC-012, TC-ACC-013, TC-ACC-028, TC-ACC-035 green
- Architecture refs: 01-system-architecture.md §0 (D-ARCH-002/003), §8.1 (password-change session invalidation), §10 (owner password-reset runbook, amended); 03-api-design.md §2 (password row), §4 (precedence note); 02-data-model.md §4; testing/accounts-access.md §2 (TC-ACC-010…013, 028, 035)
- Dependencies: TKT-accounts-001, TKT-accounts-002
- Parallel group: none
