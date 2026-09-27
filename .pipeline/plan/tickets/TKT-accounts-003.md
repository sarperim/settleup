# TKT-accounts-003: Password change & owner reset CLI

- Status: done
- PR: https://github.com/sarperim/settleup/pull/12 (base: dev — merged 2026-09-27, review loop clean pass 1; K-2/S-2 race fixed and verified here)
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

**Implementation record (coder, 2026-09-27):**

- Deliverables:
  - `apps/api/src/auth/dto/change-password.dto.ts` — `currentPassword` required (min 1, never re-policy-checked), `newPassword` 8–128 (bounds shared with `register.dto.ts`, D-ARCH-003). DTO validation precedes the service check, so wrong-current + policy-violating-new → `400 VALIDATION_FAILED` (TC-ACC-035).
  - `auth.service.ts` — `changePassword(userId, dto, actingToken)`: load user → verify `currentPassword` (`400 INVALID_CURRENT_PASSWORD`, nothing changed) → hash new password → one transaction: update `passwordHash` + `deleteMany` sessions where `userId` and `tokenHash != hash(actingToken)`. Acting session identified from the raw cookie token.
  - `auth.controller.ts` — `POST /api/auth/password` (`204`, protected by the global `AuthGuard`, CSRF-covered like every POST).
  - `apps/api/src/scripts/set-password.ts` — standalone CLI (emitted to `dist/scripts/set-password.js` by `nest build`): reads the new password from stdin (trailing newline stripped), enforces 8–128, `loadEnv` for `DATABASE_URL` + pinned Argon2id params (placeholder `PORT` since the CLI never listens), then one transaction: update `passwordHash` + delete **all** of the account's sessions. No HTTP surface; email/password never logged.
  - `session.service.ts` — `resolve()` maps Prisma `P2025` (row deleted between the read and the sliding-expiry write) to `null` → `401` (see K-2/S-2 below).
  - Specs: integration `tc-acc-{010,011,012,013,035}-*.spec.ts`; system `tc-acc-028-owner-reset-cli.spec.ts` + `test/system/support/setup-env.ts`; root `vitest.system.config.ts`.
- Acceptance evidence (local, Node 22 / pnpm 10.34.5; CI runs Node 24): `DATABASE_URL=… pnpm test` → **Test Files 39 passed, Tests 113 passed**, exit 0 (baseline 34/105; +5 files/+8 tests) · `E2E_DATABASE_URL=… pnpm test:e2e` → e2e DB create+migrate, `test:system` **1/1 passed**, Playwright spa-canary 1/1 passed · `pnpm lint` exit 0 · `pnpm typecheck` exit 0 · `pnpm build` exit 0 (confirms `dist/scripts/set-password.js` is emitted). RED proof: pre-implementation, the 5 integration specs failed `expected 404 to be <2xx/4xx>` (route absent); green after wiring.
- **e2e-phase runner composition (root `package.json` — the ticket's conditional allowance, no dependency changes):** added `test:system` (`vitest run --config vitest.system.config.ts`) and inserted it into `test:e2e` after `scripts/e2e-db.mjs` and before Playwright, so TC-ACC-028 runs post-build against `E2E_DATABASE_URL` alongside Playwright. The system project is deliberately **not** in `vitest.config.ts`, keeping CI step 3 (`pnpm test`) unit+integration only. `pnpm-lock.yaml` unchanged; `.github/workflows/ci.yml` untouched.
- **K-2/S-2 (accounts-002 review, should-fix/low) handled:** the resolve()/revoke() race (Prisma `P2025` → `500 INTERNAL` instead of `401`) is exercised by this ticket's own session deletions — password change deletes all-except-acting, the CLI deletes all. `SessionService.resolve()` now treats `P2025` as "session gone" → `null` (fails closed; observable contract unchanged on the sequential path). Minimal one-branch fix; both reviewer lanes recommended fixing it with/after the predecessor PR. No dedicated concurrency test (would need a deterministic interleaving hook; the sequential contract is covered by the acceptance specs).
- No new dependencies. `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `.github/workflows/ci.yml` and `pnpm-lock.yaml` untouched; root `package.json` changed only for the runner composition above.
