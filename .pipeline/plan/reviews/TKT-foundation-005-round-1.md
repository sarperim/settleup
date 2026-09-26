# Review Round 1 — TKT-foundation-005 (PR #5)

PR: https://github.com/sarperim/settleup/pull/5
Branch: `tkt-foundation-005` → `dev` · Head at review: `b551c6b`
Review date: 2026-09-26
Isolated checkout: `/tmp/opencode/settleup-pr5` (branch `review/tkt-foundation-005` tracking `origin/tkt-foundation-005`, clean, in sync)

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three reviewers dispatched.** Reasoning recorded:

- The diff ships executable logic (React app code, fetch wrapper, route tree), touches build config (`apps/web/vite.config.ts`, `apps/web/tsconfig.json`), a package manifest (`apps/web/package.json` — one `test` script, DEVIATION-2), and 5 spec files. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- The ticket pins 4 explicit acceptance criteria verified by automated mechanism specs — the compliance-reviewer must verify them, which mandates the full pipeline.
- Diff files (25): 21 under `apps/web/src/**` (in write scope), `apps/web/vite.config.ts` (in scope), `apps/web/package.json` (DEVIATION-2), `apps/web/tsconfig.json` (DEVIATION-1), `.pipeline/plan/tickets/TKT-foundation-005.md` (process bookkeeping, precedented). Scope fence verified: zero changes to root `package.json`, `pnpm-lock.yaml`, `apps/api/**`, `packages/**`; `pnpm install --frozen-lockfile` passes.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Reviewer | Verdict | Blocking findings |
|----------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations (3 routing items → upstream owners) |
| code | **REQUEST CHANGES** | 1 blocker (F-1), 2 should-fix (F-2, F-3-routed), 5 nits (F-4…F-8) |
| security | **CLEAN** (approve) | 0 findings (2 non-blocking observations) |

## Baseline gates (review-lead run, reproduced independently by code-reviewer; local Node 22, CI Node 24 — known and precedented)

`pnpm install --frozen-lockfile` ok · `pnpm lint` ok · `pnpm typecheck` ok · `pnpm test` (root) 26 passed / 5 files · `pnpm build` ok (`apps/web/dist/assets/index-B0VgnoYA.js` 266.36 kB raw / **84.24 kB gzip** ≤ 300 KB, NFR-ACC-003) · `pnpm --filter web test` 45 passed / 5 files. CI run 36226546709 green. Root `pnpm test` does not execute the web specs (FLAG-2, accurate — root `vitest.config.ts` includes only shared + api unit dirs).

## Acceptance criteria verification (compliance lane)

| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| 1. All 03 §6 routes render placeholders; dev-server deep links | **PASS with F-1 caveat** | `routes.ts` pins the 8 §6 patterns in table order; `App.spec.tsx` renders all 8 through the real router tree + 4-tab test; deep-link leg is a recorded manual dev-server check (production fallback is f-004's criterion 4). **Caveat (F-1):** 3 of 8 route cases assert nav-colliding headings — demonstrated false-green; automated evidence overstated for `/`, `/change-password`, partially `/groups/:groupId`. |
| 2. Wrapper per arch §8.2 + dev-proxy round-trip | **PASS** | CSRF header on every POST/PATCH/DELETE (the architecture's complete mutating set — 03 defines no PUT), absent on GET; `credentials: 'include'`; JSON bodies; same-origin guard rejects absolute/protocol-relative pre-fetch; §4 envelope parsing incl. 409 `EMAIL_TAKEN` / 404 `NOT_FOUND` / non-envelope → `INTERNAL`; 401 `UNAUTHENTICATED` → handler + typed throw, 401 `INVALID_CREDENTIALS` → no redirect. Proxy round-trip demonstrated (POST `/api/ping` → API JSON 404 through dev proxy). Live §4-envelope leg carried by FLAG-1 (accepted — see below). |
| 3. `pnpm build` + bundle ≤ 300 KB gzipped | **PASS** | 84.24 kB gzip (review-lead + code-reviewer builds; compliance's independent read-only measurement 84.2 kB). |
| 4. No email/credential rendered | **PASS** | `App.spec.tsx` asserts no email-regex match and no `<input>` on every route; `RootLayout` renders no identity; zero `localStorage`/`sessionStorage`/`document.cookie`/`console.*` usage (security ripgrep). |

No-TC-IDs claim **verified true** (`TKT-foundation-005` has no entry in `.pipeline/testing/` coverage matrix; the 4 criteria are the criteria-level contract; TC-ACC-025 / TC-EXP-028 exist in the approved plans as the deferral target). Suite arithmetic verified: 13+9+17+4+2 = 45 tests.

## Consolidated findings

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| F-1 | **blocker** | code | `apps/web/src/App.spec.tsx:21-27` + `RootLayout.tsx:19-20` | **open → fixer (MUST FIX)** | Route-case headings collide with root-layout nav labels (`/`→'Groups', `/groups/:groupId`→'Group' ⊂ 'Groups', `/change-password`→'Change password'): 45/45 pass with those routes' wiring deliberately broken (reviewer demonstrated with broken route elements in a scratch copy; 2 of 8 routes have no failing assertion on regression, a 3rd covered only by the tabs test). False-green on acceptance criterion 1. Fix: assert page-unique content (placeholder text / per-route headings). |
| F-2 | should-fix | code | `apps/web/src/components/Money.tsx` | **open → fixer** | Dead, untested code beyond ticket scope: nothing imports `Money`; the ticket's "formatKurus display helper wired from packages/shared" is fully delivered by `money.ts` + `money.spec.ts` (identity-asserted). Remove it (reintroduce with the first domain page that renders money, specced there), or wire + spec it now. |
| F-3 | should-fix (routed) | code | `.github/workflows/ci.yml` + root `vitest.config.ts` | **routed out of loop → TKT-foundation-006 / f-007 (CI owner)** | The PR's 45 specs never run in CI (root runner excludes web; no CI step runs `pnpm --filter web test`). Zero ongoing regression protection until f-006 wires the runner. Not fixable within this PR's write scope (root config + workflow files are outside `apps/web/**`). FLAG-2 accepted as recorded deviation; consequence needs loop-level tracking. |
| F-4 | nit | code | `routes.ts:21`, `client.ts:46-48` | open (non-blocking) | Dead exports: `SpaRoutePattern` never imported; `basePath` option documented "exists for tests" but never exercised. |
| F-5 | nit | code | `client.ts:56-62` | open (non-blocking) | Production default 401→`/login` redirect is the only untested executable path in `client.ts`; `'/login'` literal duplicates `SPA_ROUTES.login`. |
| F-6 | nit | code | `errors.ts:43-49` | open (non-blocking) | `parseErrorEnvelope` accepts non-string `message` (→ `''`) and array `details` — more lenient than the frozen `ErrorEnvelopeDto`. |
| F-7 | nit | code | `App.tsx:31-38` vs `routes.ts` | open (non-blocking) | Parameterized route patterns hand-typed in `App.tsx` despite `routes.ts` declaring itself the single composition point; catch-all `*`→`/login` approximates §6's protected-route row without a comment. |
| F-8 | nit | code | `apps/web/package.json:12`, `vite.config.ts:10` | **routed out of loop → f-006** (ties to DEVIATION-2 follow-up) | `vitest` is an implicit hoisted dependency of apps/web (not declared in its devDependencies — forced by the P-2 lockfile freeze). Declare when the freeze lifts. |
| C-1 | doc/planning (routed) | compliance | ticket line 16 vs deps line 21 | **routed out of loop → planner** | Criterion 2's live-envelope parenthetical ("the api's 404 envelope parses as a typed error") presumes f-004's exception filter, which is not in f-005's dependency list. Planning defect, not a PR defect — the delivered evidence (live round-trip + unit-proven parsing against frozen f-003 shapes) satisfies the criterion's intent. Recommended amendment: reword or add the conditional dependency note. |
| C-2 | routing | compliance | root `vitest.config.ts` | **routed out of loop → f-006** | Same class as F-3/F-8: web suite not in root runner; `vitest` undeclared in apps/web. Sub-item for the harness owner. |
| C-3 | routing | compliance | `apps/web/tsconfig.json` + `vite.config.ts` | **routed out of loop → architect/planner** | DEVIATION-1's source-resolution workaround is P-2-wide (f-004 hits the same `shared` `types → dist` vs CI-order problem). Repo-wide fix (shared `exports`, project references, or build-before-gates) to be decided centrally. |
| S-1 | info | security | `client.ts:131-142` | open (no action) | A 401 with a non-envelope body (e.g. proxy-generated HTML 401) falls back to `INTERNAL` and does not redirect — fail-safe choice; cover in domain e2e once f-004's filter exists. |
| S-2 | info | security | `client.ts:69-74` | open (no action) | `buildUrl` guards `//host`/absolute but not `..` segments — still same-origin after normalization, first-party paths; defense-in-depth only. |

## Positions on the ticket's FLAG/DEVIATION record (all three reviewers, independently)

- **FLAG-1** (live §4-envelope leg not demonstrable — api is f-001 skeleton): **accepted** by all three lanes. The ticket's own deferral note (line 19) anticipates it; the parser is verified fail-closed against the frozen shared shapes; the dev-proxy round-trip itself was demonstrated; f-004's exception filter verified absent on this branch. Full live verification arrives with f-004 + TC-ACC-025/TC-EXP-028.
- **FLAG-2** (web specs run via package script, not root `pnpm test`): **accepted**; routing to TKT-foundation-006 is scope-forced, not discretionary. Consequence tracked as F-3/C-2.
- **DEVIATION-1** (tsconfig `paths` + vite alias `shared` → source): **accepted deviation with owner** — P-2-wide concern, architect ruling pending (same class as PR #6's FLAG-1). Forced by CI gate order (typecheck before build; `packages/shared` `types` points at not-yet-built `dist/`); both resolution sides kept in sync; `packages/**` untouched. Routed as C-3.
- **DEVIATION-2** (`"test": "vitest run"` in `apps/web/package.json`): **accepted.** The must-NOT-touch invariants are the *root* package.json and the lockfile — both untouched (verified); the addition stays inside the ticket's own package and is necessary to make the acceptance evidence runnable. Within the spirit of "modify apps/web". Follow-up (undeclared `vitest`) routed as F-8.
- **DEVIATION-3** (specs co-located under `apps/web/src/**`): **accepted.** Test strategy defines no web unit directory; co-location stays inside the literal write scope and is gated by the existing web lint/typecheck globs. Directory decision belongs to the test-planner if wanted.

## Security verification summary

No vulnerability with a plausible attack path. XSS sinks absent (React-escaped params only, `encodeURIComponent` on all path builders); no open redirect (hardcoded `/login` literals, no return-URL parameter anywhere — the classic `?next=` vector is closed by absence); CSRF header mechanics correct at the single `request()` choke point (method-driven, complete against 03's verb set — no PUT endpoints exist); `credentials: 'include'` + site-relative paths = same-origin by construction; fail-closed envelope parsing (non-contract bodies never reach the DOM); dev proxy is dev-server-only and loopback; no new dependencies (diff-verified: only the `test` script line; lockfile untouched); no secrets/PII/storage/console usage. Dependencies, configuration, and resource-exhaustion lanes all clean.

## Upstream defects routed out of the loop (never enter the fix loop)

1. **F-3 / C-2 → TKT-foundation-006 (harness owner) + CI owner (f-007):** wire the web suite into a CI-executed runner (root vitest project or a `pnpm --filter web test` CI step); also declare `vitest` in apps/web devDependencies when the P-2 lockfile freeze lifts (F-8). Recommend the loop gates dependent domain UI tickets on this landing.
2. **C-1 → planner:** amend ticket criterion 2's live-envelope parenthetical (presumes f-004, not in f-005's dependency list).
3. **C-3 / DEVIATION-1 → architect/planner:** decide the repo-wide `shared` source-resolution strategy (shared `exports`, project references, or build-before-gates); P-2-wide, f-004 hits the same.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ONE — F-1** (code-review blocker, demonstrated false-green on acceptance criterion 1).

**RESULT: NOT MERGEABLE on pass 1.**

## Loop status

Fixer dispatched for round 1 with this artifact (triage: fix / dispute / escalate). Mandatory: F-1. Should-fix: F-2. Nits F-4…F-7 at fixer's judgment (minimal-diff discipline); F-3/F-8/C-1/C-2/C-3 routed out of the loop — no code action. Pass 2 will verify F-1/F-2 resolution and review the fix commits for new problems.

Environment notes: verification on Node v22.22.0 local (CI Node 24; engine warning known and precedented). Reviewer scratch artifacts cleaned; worktree left clean at `b551c6b`.
