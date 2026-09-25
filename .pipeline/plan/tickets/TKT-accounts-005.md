# TKT-accounts-005: Auth UI — register, login, change password, logout (e2e)

- Status: todo
- Size: M
- Scope: **Create** the auth pages in `apps/web/src/**` (replacing the TKT-foundation-005 placeholders) and e2e specs in `apps/web/test/e2e/**`:
  - `/register`, `/login`, `/change-password` pages wired to the frozen DTO types and the shell's API client: forms with client-side validation (field limits from `packages/shared`), error display from the typed error envelope, post-success navigation per the use cases.
  - Logout control in the shell navigation (calls `POST /api/auth/logout`, then the browser is at `/login`).
  - Anonymous-redirect behavior on protected routes via the shell's 401 handling (UC-ACC-006 UI aspect).
  - E2e specs (self-contained identities per the accounts plan's e2e conventions): TC-ACC-023, TC-ACC-024, TC-ACC-025, TC-ACC-026, TC-ACC-027 (timing per strategy §3 T4: median of 3, one retry on breach, ≤ 2.0 s hard gate).
  - **Must NOT touch**: `apps/api/**`, `packages/shared/src/**`, root `package.json` / `pnpm-lock.yaml` (not lockfile-eligible in P-3).
- Traces to: FR-ACC-001, FR-ACC-003, FR-ACC-005, FR-ACC-006, FR-ACC-009, FR-ACC-010 (UI aspects) · UC-ACC-001 (main), UC-ACC-002 (main), UC-ACC-003 (main), UC-ACC-004 (main), UC-ACC-006 (main) · NFR-ACC-003
- Acceptance: TC-ACC-023, TC-ACC-024, TC-ACC-025, TC-ACC-026, TC-ACC-027 green
- Architecture refs: 03-api-design.md §6 (SPA routes); 01-system-architecture.md §2 (C1), §7 (NFR-ACC-003 row); testing/accounts-access.md §2 (TC-ACC-023…027) + e2e conventions (self-contained, order-independent); testing/00-test-strategy.md §3 (T4 timing policy)
- Dependencies: TKT-accounts-001, TKT-accounts-002, TKT-accounts-003 (backend routes), TKT-foundation-005 (SPA shell — transitive via foundation)
- Parallel group: P-3 (with TKT-accounts-004 — verified disjoint: this ticket writes `apps/web/**` only)
