# TKT-accounts-005: Auth UI — register, login, change password, logout (e2e)

- Status: in-review
- PR: https://github.com/sarperim/settleup/pull/14 (base: dev)
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

**Implementation record (coder, 2026-09-27):**

- Deliverables: `/register`, `/login`, `/change-password` pages (`apps/web/src/pages/`) wired to the frozen DTO types + shell API client, with `FIELD_LIMITS` client-side validation, typed §4 error-envelope display, and post-success navigation; session state (`apps/web/src/auth/AuthContext.tsx`, `RequireAuth.tsx`) + shell display name and logout control (`layout/RootLayout.tsx`); app-level route tree with public/protected split (`App.tsx`); e2e specs `apps/web/test/e2e/auth-ui.spec.ts` (TC-ACC-023…026), `auth-timing.spec.ts` (TC-ACC-027) + helpers; updated `spa-canary.spec.ts`.
- Acceptance evidence (local, Node 22 / pnpm 10.34.5; CI Node 24): `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm test` 39 files / 113 tests ✓ · `pnpm --filter web test` 5 files / 44 tests ✓ · `pnpm build` ✓ (web 86.81 kB gzip ≤ 300 KB) · e2e phase `pnpm test:system` 1/1 ✓ then Playwright **6 passed** (TC-ACC-023/024/025/026/027 + canary). CI runs the real `pnpm test:e2e` on the PR.
- DEVIATION-1 (e2e identity isolation, harness reality C-4): the e2e phase runs `TC-ACC-028` (system) before Playwright and that spec leaves `alice@test.local` in the shared e2e DB; with the plan's raw fixed identities TC-ACC-023 fails `EMAIL_TAKEN`. `e2eIdentity()` namespaces emails as `<base>-e2e@test.local` (display names/passwords unchanged) and appends the deterministic Playwright retry index. Verified by reproducing the raw-identity failure, then green with isolation.
- DEVIATION-2 (TC-ACC-025 precondition): the plan's "creates a group ('Trip') from the groups overview" requires the groups overview/create-group UI and the groups API — TKT-groups-004's deliverable, absent in this worktree (and TKT-groups-004 depends on this ticket — circular). The spec exercises the ticket-owned assertions (logout → `/login`; anonymous `/groups/:groupId` → `/login`, no data) with a placeholder id; the guard fires before any group data. Routed to the planner/test-planner.
- DEVIATION-3 (foundation-005 specs, necessary): replacing the placeholders made `apps/web/src/App.spec.tsx` (placeholder-text + no-`<input>` assertions) and the e2e `spa-canary.spec.ts` (`/` no longer serves anonymous) obsolete. Both reworked to assert the new intended behavior, preserving coverage (public forms, guard states, group-view tabs, no email in chrome). Not weakenings.
- Must-NOT-touch compliance: only `apps/web/src/**` and `apps/web/test/e2e/**` changed.

