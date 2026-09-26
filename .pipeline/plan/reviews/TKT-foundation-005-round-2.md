# Review Round 2 — TKT-foundation-005 (PR #5)

PR: https://github.com/sarperim/settleup/pull/5
Branch: `tkt-foundation-005` → `dev` · Head at review: `86cb739`
Review date: 2026-09-26
Isolated checkout: `/tmp/opencode/settleup-pr5-pass2` (branch `review-pass2/tkt-foundation-005` @ `86cb739`, clean)
Pass: **2 of 3** — fix-verification pass (round-1 fixes verified + fix commits reviewed for new problems)

## Loop position entering this pass

- Round 1 (artifact: `TKT-foundation-005-round-1.md`, head `b551c6b`): blast radius **FULL** → three reviewers dispatched in parallel. Verdicts: compliance CLEAN, code REQUEST CHANGES (blocker F-1), security CLEAN. Fixer dispatched → fix commits `60390f2` (F-1), `08124ea` (F-2), `e26b35f` (F-4), `283584e` (F-5), `e5710a3` (F-6), `0e6042f` (F-7); docs commits `6a19dfd` (round-1 artifact), `86cb739` (disposition). Fix range `b551c6b..86cb739`: 8 files, +104/−62, all under `apps/web/src/**` + `.pipeline/**`.
- Upstream routings from round 1 (never entered the fix loop, unchanged): F-3/F-8/C-2 → TKT-foundation-006 (harness owner) + CI owner; C-1 → planner; C-3 → architect/planner.
- This pass dispatch: **all three reviewers in parallel** (gate classification is a pass-1 decision; round 1 classified FULL and the fix commits ship executable logic + spec changes).

## Reviewer verdicts (pass 2, dispatched in parallel)

| Reviewer | Verdict | Blocking findings |
|----------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations · all round-1 items verified-fixed or routing stands · no new findings |
| code | **CLEAN** (approve) | 0 blockers · all six in-loop findings verified-fixed with independent mutation evidence · 1 new nit (F-9, non-blocking) |
| security | **CLEAN** (approve) | 0 findings at any severity · fixes tightened posture (F-4, F-5, F-6) |

## Baseline gates (review-lead run in the isolated checkout; reproduced by all three reviewers)

`pnpm install --frozen-lockfile` ok · `pnpm lint` ok · `pnpm typecheck` ok · `pnpm test` (root) **26/26** (5 files) · `pnpm --filter web test` **47/47** (5 files — round-1's 45 + the F-5/F-6 specs; arithmetic consistent) · `pnpm build` ok (`apps/web/dist/assets/index-COkDQLHi.js` 266.45 kB raw / **84.30 kB gzip** ≤ 300 KB, NFR-ACC-003). CI on head `86cb739`: green (run 36236928091). Local Node 22 / CI Node 24 (known, precedented).

## Round-1 finding verification (fixer's claims re-verified independently — never trusted)

| ID | Severity | Source | Status after pass 2 | Verification evidence (reviewer-gathered, not fixer-claimed) |
|----|----------|--------|---------------------|--------------------------------------------------------------|
| F-1 | **blocker** | code | **verified-fixed** (independently by code AND compliance lanes) | `App.spec.tsx:22-31` asserts per-page placeholder sentences; grep proves each of the 8 strings is rendered by exactly one page component and never by `RootLayout.tsx:17-20`. **Mutation tests re-run by reviewers** (scratch copies, never the worktree): code lane — 5 mutations (break `/`→catch-all, `/groups/:groupId`→wrong element, `/change-password`→LoginPage, delete `/join/:code`, `/groups/:groupId/expenses/new`→GroupViewPage), each fails exactly the right spec case(s); compliance lane — 2 mutation classes (`/`, `/change-password`, `/join/:code` → 3 failed/44 passed; `/groups/:groupId` → placeholder + tabs test, 2 failed/45 passed). The round-1 false-green class is closed. |
| F-2 | should-fix | code | **verified-fixed** | `Money.tsx` deleted (commit deletes 17 lines only); `components/` dir gone; zero references remain; `money.ts:10-11` + `money.spec.ts` still deliver the ticket's `formatKurus` wiring (identity-asserted `toBe(sharedFormatKurus)`). |
| F-3 | should-fix (routed) | code | **routing stands** (→ f-006/f-007) | Fix commits correctly touch no root runner / CI files. Out of this PR's write scope. |
| F-4 | nit | code | **verified-fixed** | `SpaRoutePattern` and `basePath` gone everywhere (grep); `ApiClientOptions` = `fetchImpl`/`onUnauthenticated` only; `buildUrl` uses hardcoded `API_BASE_PATH`. Security lane: removal of caller-controlled `basePath` strictly tightens the URL-prefix surface. |
| F-5 | nit | code | **verified-fixed** | `client.ts:57-61` default 401 handler → `window.location.assign(SPA_ROUTES.login)`; new spec `client.spec.ts:176-195` exercises the *default* path (no injected handler), stubs `globalThis.window`, asserts exactly one `assign(SPA_ROUTES.login)` + the typed `UNAUTHENTICATED` throw, cleans up in `finally`. Mutation-verified: corrupting the target to `/logout` fails this spec. Open-redirect assessed: fixed module-level literal, no user-influenced target, `?next=`-style vector closed by absence. |
| F-6 | nit | code | **verified-fixed** | `errors.ts:45-47` requires string `message` (else `null` → `INTERNAL` fallback); `:54-58` treats array `details` as absent. Cross-checked against the frozen `ErrorEnvelopeDto` (`packages/shared/src/errors.ts:53-58`): rejects no legitimate shape (`tsc` proves `string[]` ∉ `ErrorDetails`); reviewer edge-case matrix all green (missing/non-string `message`, `details` string/array/null, nested arrays as values, malformed 401 → `INTERNAL`, no redirect — fail-closed preserved). |
| F-7 | nit | code | **verified-fixed** | `routes.ts:23-28` exports `SPA_ROUTE_PARAMS`; `SPA_ROUTE_PATTERNS` composed from `SPA_ROUTES` + params (`:31-40`); `App.tsx:30-37` uses the same objects — value drift structurally impossible; `routes.spec.ts:13-24` still pins the literal §6 table as an independent check; catch-all carries the §6/UC-ACC-006 rationale (`App.tsx:38-41`). |
| F-8 | nit (routed) | code | **routing stands** (→ f-006) | `vitest` still undeclared in apps/web devDependencies — locked behind the P-2 freeze, as routed. |
| C-1 | doc/planning (routed) | compliance | **routing stands** (→ planner) | No code action; criterion-2 wording amendment remains with the planner. |
| C-2 | routing | compliance | **routing stands** (→ f-006) | Web suite still outside the root runner; owner f-006. |
| C-3 | routing | compliance | **routing stands** (→ architect/planner) | DEVIATION-1 source-resolution remains P-2-wide. |
| S-1 | info | security | **unchanged** (fail-safe preserved, marginally broadened) | Non-envelope 401 → `INTERNAL`, no redirect (`client.ts:129-138`); F-6 widens the fail-closed set; surfaced message is the fixed `'Unexpected error'` literal. e2e note for f-004's filter. |
| S-2 | info | security | **unchanged, posture improved** | `..` segments still unguarded (same-origin post-normalization, defense-in-depth only); F-4 removes the caller-controlled `basePath`, so the URL prefix can no longer be influenced at all. |

## New findings (pass 2)

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| F-9 | nit (non-blocking) | code | `apps/web/src/routes.spec.ts:33-38` | **open** (recorded; no fixer dispatch — clean pass ends the loop) | Side effect of fix `0e6042f`: the "keeps static paths in sync with the §6 patterns" test became tautological — `SPA_ROUTE_PATTERNS` is now *composed from* `SPA_ROUTES.register/login/groupsOverview/changePassword`, so `toContain(SPA_ROUTES.register)` etc. can never fail. Real drift protection is unaffected (the literal-array pin at `routes.spec.ts:13-24` catches actual drift). Dead test weight only. Recommended: delete or repurpose to assert builder/pattern shape-compatibility. Fold into a follow-up (natural owner: the f-006 harness work or the first domain-UI ticket touching `routes.ts`). |

Non-finding observations recorded by reviewers (no action): (a) ticket implementation record retains pre-fix numbers (45 tests / 84.24 kB) while the disposition records post-fix (47/47 / 84.30 kB) — consistent historical bookkeeping; (b) `client.ts` now imports `SPA_ROUTES` from `../routes` (app-internal coupling created by the F-5 de-duplication round 1 requested — harmless, no cycle); (c) security trust-boundary note: `parsed.details` passes `Record<string, unknown>` through a type cast for contract-validated envelopes (`errors.ts:59`) — frozen contract type, nothing consumes it yet, React escaping applies when domain pages render it; carried into domain-UI reviews.

## Fix-commit security review (security lane)

All six fix commits assessed threat-by-threat: default-401 redirect target (fixed literal, no open redirect, no `?next=` vector), test-seam isolation (`onUnauthenticated`/`fetchImpl` only ever passed in `client.spec.ts`; production singleton `createApiClient()` has zero options), `basePath` removal (strictly tighter), envelope strictness (fail-closed preserved and strengthened, raw body never surfaces), route composition (constants + `encodeURIComponent` on all builders; catch-all `<Navigate to={SPA_ROUTES.login} replace />`), spec changes and `Money.tsx` deletion (no new sinks; criterion-4 guards intact). No XSS sinks, no storage/cookie/console usage, no new dependencies (workspace-internal imports only; manifests and lockfile untouched).

## Acceptance criteria re-verification (compliance lane, fixed head)

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | All §6 routes render placeholders; dev-server deep links | **PASS** | 8/8 route cases assert page-unique content, mutation-verified non-false-green; §6 table pinned; tabs test intact; deep-link leg = recorded manual check (unchanged). |
| 2 | Wrapper per arch §8.2 + dev-proxy round-trip | **PASS** | CSRF header on every POST/PATCH/DELETE, `credentials: 'include'`, JSON bodies, same-origin guard, envelope parsing hardened to the frozen DTO, 401 `UNAUTHENTICATED` → redirect incl. now-tested production default; `INVALID_CREDENTIALS` non-redirect; proxy round-trip evidence unchanged (FLAG-1 accepted round 1). |
| 3 | Build + ≤ 300 KB gzipped | **PASS** | 266.45 kB raw / 84.30 kB gzip (lead + compliance measurements agree). |
| 4 | No email/credential rendered | **PASS** | No-email-regex + no-`<input>` assertions intact on all 8 routes; layout renders no identity; grep-clean. |

Scope fence re-verified on the fix range: nothing outside `apps/web/src/**` + `.pipeline/**` (append-only docs commits; disposition commit is +11/−0). Must-NOT-touch list respected across the full PR diff. No-TC-IDs claim re-confirmed (zero `foundation-005` mentions in `.pipeline/testing/`). No new deviations introduced by the fixes.

## Mergeability (pass 2)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Round-1 blocker F-1: verified-fixed (two independent mutation-verified re-checks).
- New finding F-9 is a nit — nits never block.
- Routed items (F-3/F-8/C-1/C-2/C-3) are upstream defects outside this PR's write scope, ruled out of the loop in round 1 — they do not block this PR.

**RESULT: MERGEABLE on pass 2. Loop ends early on a clean pass.**

## Loop status

- Pass 1 (round 1): NOT MERGEABLE (F-1 blocker) → fixer dispatched → fixes pushed.
- Pass 2 (this round): all three lanes CLEAN → **MERGEABLE**. No further fixer dispatch (pass cap not needed).
- User action requested: merge PR #5. After merge confirmation, the ticket's status moves to `done` (on `dev`) and the board can be regenerated from ticket files.
- Upstream routings remain open with their owners: F-3/F-8/C-2 → TKT-foundation-006 + CI owner; C-1 → planner; C-3 → architect/planner. F-9 (nit) → follow-up owner, no dispatch.

Environment notes: verification on Node v22.22.0 local (CI Node 24; engine warning known and precedented). Reviewer scratch/mutation copies were made outside the worktree and deleted after use; worktree left clean at `86cb739`.
