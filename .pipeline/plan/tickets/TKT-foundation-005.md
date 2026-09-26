# TKT-foundation-005: SPA shell — router, layout, API client

- Status: done (merged via PR #5 → dev, 2026-09-26; review loop closed clean at pass 2 — artifacts in .pipeline/plan/reviews/TKT-foundation-005-round-{1,2}.md)
- PR: https://github.com/sarperim/settleup/pull/5 (base: dev)
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

**Implementation record (recorded for the review loop):**

- LOCAL VERIFICATION (Node 22 local; CI runs Node 24): `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (root — 26 tests), `pnpm build` all green. `pnpm --filter web test` → 45 passed (5 files). Build: `dist/assets/index-B0VgnoYA.js` = 266.36 kB raw / **84.24 kB gzip** (≤ 300 KB, NFR-ACC-003).
- Acceptance 1: `src/App.spec.tsx` static-renders every §6 route through the real router tree; `src/routes.spec.ts` pins the literal §6 patterns. Manual dev-server check (`vite --port 5288`) — `/groups/g1`, `/join/ABC123`, `/change-password` serve `index.html` (SPA fallback).
- Acceptance 2: wrapper behavior covered by `src/api/client.spec.ts` + `src/api/errors.spec.ts` (CSRF header on all mutations, JSON body, cookie credentials, same-origin path guard, §4 envelope parsing incl. representative `409 EMAIL_TAKEN` / `404 NOT_FOUND`, `401 UNAUTHENTICATED` → handler, `401 INVALID_CREDENTIALS` non-redirect). Dev-proxy round-trip proven against the f-001 API skeleton (`PORT=5311`): `POST http://localhost:5288/api/ping` returned the API's JSON 404 through the proxy.
- Acceptance 3 / 4: see above (bundle size; `src/App.spec.tsx` asserts no email-shaped token and no `<input>` on every route).
- TC COVERAGE: the coverage matrix assigns **no TC IDs** to TKT-foundation-005 — the shell has no stand-alone TCs and full behavioral verification is TC-ACC-025 / TC-EXP-028 (domain e2e, f-006 harness). The specs above are criteria-level mechanism tests, not TC IDs.

- FLAG-1 (criterion 2, live envelope leg): the api on this branch is the f-001 skeleton — no §4 exception filter (TKT-foundation-004), so its 404 body is Nest's default, **not** the §4 envelope. The "404 envelope parses as a typed error" leg is therefore proven at unit level against the frozen `packages/shared` shapes (TKT-foundation-003), not against a live route, as the ticket permits. The dev-proxy round-trip itself is demonstrated. Full live verification arrives with f-004 and the domain e2e TCs.
- FLAG-2 (runner wiring): apps/web specs are **not** in the root Vitest project (root `vitest.config.ts` includes only `packages/shared/test/unit` and `apps/api/test/unit`; owned by f-007/f-006). They run via `pnpm --filter web test`; adding the web suite to the root runner is routed to TKT-foundation-006 (harness owner). Recorded so the reviewer does not read the root `pnpm test` green as executing the web specs.

- DEVIATION-1 (outside literal write scope, not on must-NOT-touch list): `apps/web/tsconfig.json` gained a `paths` entry mapping `shared` → `../../packages/shared/src/index.ts`, and `apps/web/vite.config.ts` gained the matching `resolve.alias`. The workspace package's `types` resolves to `packages/shared/dist/index.d.ts`, which does not exist before `pnpm build` (CI order: lint → typecheck → test → build), so without source resolution the SPA cannot typecheck in CI. `packages/**` remains untouched. **P-2-wide concern** (TKT-foundation-004 hits the same): a repo-wide fix (shared `exports`/project references, or building shared before the quality gates) is routed to the architect/planner.
- DEVIATION-2 (minor): `apps/web/package.json` gained `"test": "vitest run"`. No dependency or lockfile change (`pnpm install --frozen-lockfile` still passes). Makes the web suite runnable and forward-compatible with a recursive runner.
- DEVIATION-3 (suite-location convention): mechanism specs are co-located at `apps/web/src/**/*.spec.{ts,tsx}` rather than `test/unit/`. `00-test-strategy.md` §8 defines no web unit directory (web has only `test/e2e`, owned by TKT-foundation-006); co-location keeps the specs inside this ticket's `apps/web/src/**` write scope while the existing web lint/typecheck globs gate them. Recorded for the reviewer; if the test-planner wants `apps/web/test/unit`, that is a planner/test-plan decision.

**ROUND 1 DISPOSITION (fixer, 2026-09-26 — artifact: `.pipeline/plan/reviews/TKT-foundation-005-round-1.md`):**

- F-1 (blocker, false-green route cases): **fixed** — `App.spec.tsx` CASES now assert each page's unique placeholder sentence (never root-layout nav labels); verified in a throwaway scratch copy that breaking the `/` and `/change-password` route elements fails exactly those two cases.
- F-2 (dead `Money.tsx`): **fixed** — component deleted; the ticket's `formatKurus` wiring remains delivered by `money.ts` + `money.spec.ts`. Reintroduce with the first domain page that renders money, specced there.
- F-3 / F-8 / C-1 / C-2 / C-3: **no action** — routed upstream (f-006/f-007 harness + CI, planner criterion wording, architect source-resolution); outside this PR's write scope, recorded in the round artifact.
- F-4 (dead exports): **fixed** — `SpaRoutePattern` type and the unused `basePath` option removed (`buildUrl` now uses the fixed `API_BASE_PATH`).
- F-5 (untested default 401 redirect): **fixed** — production default handler now redirects to `SPA_ROUTES.login` (no duplicated literal) and is covered by a new spec that stubs `globalThis.window`.
- F-6 (lenient envelope parsing): **fixed** — `parseErrorEnvelope` requires a string `message` (else `null` → INTERNAL fallback) and treats array `details` like non-object details (omitted, never surfaced); specs extended.
- F-7 (hand-typed patterns, uncommented catch-all): **fixed** — `routes.ts` exports `SPA_ROUTE_PARAMS` and composes `SPA_ROUTE_PATTERNS` from it; `App.tsx` route props use the constants; the catch-all carries the §6 protected-route row (UC-ACC-006) rationale.
- Gates after fixes: lint ✓, typecheck ✓, root `pnpm test` 26/26 ✓, `pnpm --filter web test` 47/47 ✓ (45 + F-5/F-6 specs), `pnpm build` 84.30 kB gzip ≤ 300 KB ✓.

**ROUND 2 (review-lead, 2026-09-26 — artifact: `.pipeline/plan/reviews/TKT-foundation-005-round-2.md`):**

- Pass 2 (fix-verification): compliance **CLEAN**, code **CLEAN**, security **CLEAN** — all three lanes dispatched in parallel on head `86cb739`.
- F-1 verified-fixed independently by two lanes (mutation tests re-run: breaking `/`, `/groups/:groupId`, `/change-password`, `/join/:code`, `/groups/:groupId/expenses/new` wiring each fails exactly the right spec cases). F-2, F-4, F-5, F-6, F-7 all verified-fixed; F-3/F-8/C-1/C-2/C-3 routings stand.
- One new nit F-9 (tautological sync test in `routes.spec.ts:33-38`, side effect of the F-7 fix — non-blocking, no drift-protection loss; fold into a follow-up).
- Gates on head: lint ✓, typecheck ✓, root `pnpm test` 26/26 ✓, `pnpm --filter web test` 47/47 ✓, `pnpm build` 84.30 kB gzip ≤ 300 KB ✓, CI green.
- **Zero open blocking findings → MERGEABLE. Loop ended early on a clean pass 2.**
