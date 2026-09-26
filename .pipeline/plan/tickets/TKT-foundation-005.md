# TKT-foundation-005: SPA shell — router, layout, API client

- Status: in-progress
- Size: M
- Scope: **Create** `apps/web/src/**` (beyond the TKT-foundation-001 placeholder) and **modify** `apps/web/vite.config.ts`:
  - React Router setup with the 03-api-design.md §6 route table as placeholder pages: `/register`, `/login`, `/`, `/groups/:groupId` (Expenses / Balances / Settle-up / Members tab placeholders), `/groups/:groupId/expenses/new`, `/groups/:groupId/expenses/:expenseId/edit`, `/join/:code`, `/change-password`.
  - Root layout + minimal navigation shell.
  - API client (single fetch wrapper — arch §8.2): same-origin `/api` only, JSON bodies, `X-Requested-With: XMLHttpRequest` on every mutating call, cookie credentials, `401 UNAUTHENTICATED` → redirect to `/login`, error-envelope parsing into typed errors using the shared error-code union (TKT-foundation-003).
  - `formatKurus` display helper wired from `packages/shared`.
  - Vite dev proxy `/api` → the local api `PORT`.
  - **Must NOT touch**: root `package.json` / `pnpm-lock.yaml` (not lockfile-eligible in P-2 — use the baseline installed by TKT-foundation-001), `apps/api/**`, `packages/**`.
- Traces to: Foundation (arch 01 §2 C1 — SPA talks only to the JSON API)
- Acceptance (explicit criteria):
  1. All 03 §6 routes render their placeholders; direct deep-link navigation works in the dev server (production history fallback is TKT-foundation-004's criterion 4).
  2. The wrapper is implemented per arch §8.2 — header on every mutation, envelope parsing, 401 → `/login` redirect — and a dev-proxy round-trip to the running api demonstrates JSON request/response handling (the api's 404 envelope parses as a typed error).
  3. `pnpm build` succeeds and the initial JS bundle stays ≤ 300 KB gzipped (NFR-ACC-003 translation, arch §7).
  4. No email address or credential is rendered anywhere in the shell.
  - Full behavioral verification of the wrapper (redirects, headers on real routes) arrives with the domain e2e TCs (e.g. TC-ACC-025, TC-EXP-028) — this ticket delivers the mechanism.
- Architecture refs: 03-api-design.md §6 (SPA routes); 01-system-architecture.md §2 (C1 boundaries), §7 (NFR-ACC-003 row), §8.2 (fetch wrapper / CSRF header)
- Dependencies: TKT-foundation-001, TKT-foundation-003, TKT-foundation-007 (sequencing: CI live on main before this ticket's PR — user decision at Gate 1)
- Parallel group: P-2 (with TKT-foundation-004 — verified disjoint: this ticket writes `apps/web/**` only)
