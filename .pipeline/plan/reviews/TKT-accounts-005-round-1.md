# Review Round 1 — PR #14 (TKT-accounts-005: Auth UI — register, login, change password, logout)

PR: https://github.com/sarperim/settleup/pull/14
Branch: `tkt-accounts-005` → `dev` · Head at review: `e230597` · Base: `6720fa4` (= `origin/dev` tip; merge-base verified)
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/settleup/review-TKT-accounts-005` — branch `review/tkt-accounts-005` at `e230597` (same commit as the PR head). Tree clean at review start and at every gate. Scratch namespace `/tmp/opencode/review-acc-005/` (a second review loop ran concurrently on PR #13 — all scratch, databases (`*_r5` / `*_c5` / `*_k5` / `*_s5`) and the e2e port (3015) were uniquely named; zero collisions, lead-verified). All five review databases truncated to zero rows after the lanes finished (lead-verified); no servers left listening (port 3015 down, lead-verified); worktree clean at close.

Scope context: fifth domain ticket of Accounts & Access — the auth UI: `/register`, `/login`, `/change-password` pages wired to the frozen DTO types and the shell's API client (client-side validation from `shared` `FIELD_LIMITS`, typed §4 error-envelope display, post-success navigation), session state (`AuthContext` + `RequireAuth` guard), shell display name + logout control, the public/protected route split, and the e2e specs for TC-ACC-023…027, per `.pipeline/plan/tickets/TKT-accounts-005.md`.

Environment note: three reviewer sessions — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — dispatched concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL (`settleup_review_c5` / `_k5` / `_s5`; migrations applied; the lead used `settleup_test_r5` + `settleup_e2e_r5`). Local `psql` client absent (WSL quirk, same constraint the coder hit); the established node shim (`PSQL` override honored by `scripts/e2e-db.mjs`) let the lead run the **real** `pnpm test:e2e` end-to-end rather than mirroring the coder's manual prisma phases. Every claim in the ticket's implementation record was re-verified; nothing was trusted. Full lane reports preserved at `/tmp/opencode/review-acc-005/{compliance,code,security}-report.md`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable SPA logic: 10 files under `apps/web/src/**` (new `AuthContext.tsx`, `RequireAuth.tsx`; reworked route tree, shell layout with a logout control that calls the API, three real credential forms) plus 4 e2e spec/helper files. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- Credential-handling and session-state code (password forms, session bootstrap, logout) is squarely in the security lane's remit; the rework of pre-existing foundation specs is squarely in the compliance lane's remit (weakening check).
- The ticket pins automated acceptance TCs (TC-ACC-023…027) — the compliance lane must verify them.

## Scope fence (allowed set) — verified held (lead + compliance lane, independently)

`git diff --name-status origin/dev...HEAD`: exactly 14 files, no renames, no mode changes (+860/−93):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-accounts-005.md` | status `todo`→`in-review`, PR line, implementation record (verified strictly additive) |
| `apps/web/src/**` (10 files) | `App.tsx` (public/protected split), `App.spec.tsx` (rework), `auth/AuthContext.tsx` + `auth/RequireAuth.tsx` (new), `layout/RootLayout.tsx`, `pages/{Register,Login,ChangePassword}Page.tsx` |
| `apps/web/test/e2e/**` (4 files) | `auth-ui.spec.ts` (new, TC-ACC-023…026), `auth-timing.spec.ts` (new, TC-ACC-027), `helpers/auth.ts` + `helpers/timing.ts` (new), `spa-canary.spec.ts` (rework) |

**Zero changes** to `apps/api/**`, `packages/shared/src/**`, root `package.json`, `pnpm-lock.yaml`, `.github/**`, `apps/web/playwright.config.ts`, vite/tsconfig (verified by direct diff query — 0-line diff on every must-not-touch path). No new dependencies. The must-NOT-touch list holds exactly.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations · 1 nit · 3 observations · 3 planning defects routed upstream |
| code | **REQUEST CHANGES** | **0 blockers** · 3 should-fix · 7 nits |
| security | **APPROVE** | **0 critical/high** · 2 low · 3 info |

The code lane's request-changes verdict carries **zero blocker-tier findings** (its own words: "none of which individually must block merge"). Per the immutable mergeability rule and the accounts-001 round-1 precedent (two request-changes verdicts, zero blocking-severity findings each → mergeable), a request-changes label does not block when the lane's own blocking tier is empty. The verdict is recorded verbatim and surfaced below.

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0. `pnpm --filter api exec prisma generate` — exit 0 (fresh-worktree prerequisite; CI provides it).
- `pnpm lint` — exit 0 (api + web). `pnpm typecheck` — exit 0 (api + web).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test_r5 pnpm test` — **`Test Files 39 passed (39)`, `Tests 113 passed (113)`, exit 0** (33.23 s) — matches the ticket's claim exactly.
- `pnpm --filter web test` — **5 files / 44 tests passed**, exit 0 — matches the claim exactly (FLAG-1: outside root `pnpm test`, pre-existing).
- `pnpm build` — exit 0; **web 275.15 kB raw / 86.81 kB gzip** (≤ 300 KB NFR-ACC-003) — matches the claim exactly; `apps/api/dist/main.js` emitted.
- **The real e2e phase**, not a mirror: `E2E_DATABASE_URL=…settleup_e2e_r5 PSQL=<node shim> E2E_PORT=3015 pnpm test:e2e` — **exit 0**: e2e-db (database exists, migrations applied) → `pnpm test:system` **1/1 passed** (TC-ACC-028 against the built CLI) → Playwright chromium **6 passed** (canary + TC-ACC-023/024/025/026/027, 10.2 s). This supersedes the coder's manual-prisma workaround: the local sandbox lacks `psql`, but the established `PSQL` shim runs the genuine chain.
- **DEVIATION-1 premise independently demonstrated by the lead's own e2e run:** after the chain, the e2e DB contains BOTH `alice@test.local` (seeded by the system phase's TC-ACC-028, which truncates only `beforeEach` and never after) AND `alice-e2e@test.local` (Playwright TC-ACC-023). With the plan's raw identities, TC-ACC-023 would hit `409 EMAIL_TAKEN` on the first run and again on a CI retry (`retries: 1`, same DB, `e2e-db.mjs` never truncates). The namespacing is what makes the chained phase pass.
- CI on head `e230597`: run [36297634130](https://github.com/sarperim/settleup/actions/runs/36297634130) "Lint, test & build" **SUCCESS** (verified by the lead via `gh`; includes the real `pnpm test:e2e` on CI's Node 24).
- All three reviewer sessions independently ran the suites green (39/113 and 5/44, exit 0) against their own databases; the security lane additionally traced the error-path provenance (non-envelope bodies can never reach the DOM as error text), the CSRF routing of all four mutating calls, and the server-side reality of logout revocation; the code lane re-derived the route-split semantics against `origin/dev` and the DTO contracts; the compliance lane re-verified the DEVIATION-1 premise link-by-link and the old-vs-new spec coverage route-by-route.

## Compliance lane (summary)

- **TC coverage:** all five acceptance TCs present and faithfully translated — TC-ACC-023 (register → `/`, display name + logout chrome visible, `/verif/i` count 0; the "no login step" reading adjudicated sound: one user action then `/` await — a required login step would fail the await), 024 (self-contained bob journey: UI register → UI logout → UI login → `/`), 025 (logout → `/login`; anonymous deep link → `/login`; no-data sentinel non-vacuous — `GroupViewPage` renders `<h1>Group</h1>`, and "at any point" holds by construction since `RequireAuth` returns `<Navigate>` before children render), 026 (all three expected results incl. the separate old-password check asserting error display AND staying on `/login`), 027 (median of 3, one retry on breach, 2.0 s hard gate — T4-consistent). No `.skip`/`.only`/`.todo`/commented-out expects (grep-verified).
- **Scope:** held exactly (independently re-verified by direct diff query).
- **Architecture:** 03 §6 public/protected split exact (`/register`,`/login` public; everything else guarded; catch-all approximates §6's protected-row redirect as before); 01 §2 C1 display-names-never-emails held and asserted; the `AuthContext` bootstrap client's no-op 401 handler adjudicated a sanctioned use of the client's documented injectability (`createApiClient({ onUnauthenticated })`) — the React guard owns navigation, avoiding double-navigation, while the app-wide default stays in force elsewhere; NFR-ACC-003 timing per T4. **No gold-plating.**
- **Implementation record:** faithful on every checked claim except one wording overstatement (C-1 below).

## Code lane (summary)

Verified correct, on record: the route-split semantics (catch-all placement and end-state identical to `origin/dev`; two `RootLayout` instances remount statelessly — correctness-neutral); the fail-closed session bootstrap design; `signIn` adoption without a second round-trip; the login-page **no-client-validation omission adjudicated CORRECT** (the frozen `LoginDto` deliberately exempts login from the password policy — `password` MinLength(1); client-side enforcing 8–128 at login would exceed the frozen contract; same for `currentPassword` on change-password — the accounts-003 precedent); `EMAIL_PATTERN` divergence effectively one-directional (regex more permissive than `@IsEmail` → server 400 renders in-form; server stays authoritative); `submitting`-on-success benign; `e2eIdentity` retry determinism consistent with strategy §5 and the only thing that makes CI retries meaningful against the persistent e2e DB; `logout()` has no timing hole (the POST is awaited before navigation — a silently-unrevoked session would fail TC-ACC-025 step 2); median math and T4 retry semantics correct; hook deps correct, no effect loops; Playwright `fullyParallel` safe (isolated contexts, unique identities).

Three should-fix findings (detail in the table below): the timing gate measures the document `load` event, not the rendered page the TC's own precondition exists to enable (K-1); an unserialized mount-`refresh()` vs `signIn` race can bounce a just-registered user to `/login` (K-2, narrow window, self-recovering); and the edit-expense route lost all coverage in the App.spec rework (K-3 — the same finding as compliance's C-1, independently derived by both lanes).

## Security lane (summary)

Verified clean: **XSS** — every new render path escapes by construction (React text children; no `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function`/user-built `href`/`window.open` in the diff, grep-verified); non-envelope bodies can never reach the DOM as error text (`readBody` → non-JSON → `undefined` → fixed fallback literals; single `ApiError` construction site validates the envelope shape). **Credentials** — `type="password"` everywhere, autoComplete hints correct except one info item, zero storage writes, zero console logging, passwords never echoed. **Guard is not a security boundary — confirmed:** all authorization remains server-side; default context is anonymous; authenticated chrome reachable only via a successful `/auth/me` or `signIn` from a same-origin response. **Redirects** — every target is a static constant; no `?next=`/user-controlled parameter introduced. **CSRF** — all four mutating calls route through the `api` wrapper (header added); no raw `fetch` in the diff. **Disclosure** — displayName-only chrome, `details` never rendered, EMAIL_RE absence asserted for authenticated chrome. **Dependencies/config** — zero delta (lockfile byte-identical). Two low findings: silent `maxLength` truncation asymmetry (register truncates >128-char pastes, login doesn't → unexplainable lockout; S-1) and failed-logout presenting logged-out UI while the server session lives (S-2). S3-1 (accounts-003 login/change eviction race) remains open as a prior follow-up — not this PR's finding.

## Consolidated findings

IDs scoped to this PR/round. K-3 and C-1 are the same defect found independently by two lanes (route-coverage regression in the App.spec rework); recorded once each, cross-referenced.

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| K-1 | should-fix (non-blocking) | code | `helpers/timing.ts:20-27` | open, non-blocking | TC-ACC-027's gate times `page.goto` to the `load` event — it excludes the `/auth/me` bootstrap round-trip and the render it gates, so the TC's own precondition (register so `/change-password` *renders*) is measurably inert and NFR-ACC-003's "end-to-end page load" is undercounted for the protected page. Partial gate (catches bundle bloat), not broken. Fix: wait for a per-route render anchor inside each timed sample; T4 semantics unchanged. |
| K-2 | should-fix (non-blocking) | code | `AuthContext.tsx:60-77` | open, non-blocking | Stale-async race: a mount-time `refresh()` resolving after a user-triggered `signIn` overwrites the authenticated state (or adopts the pre-login user) → successful register/login bounced to `/login`. Narrow window (needs `/auth/me` slower than the Argon2-bound POST), self-recovering. Fix: generation counter (~6 lines). |
| K-3 / C-1 | should-fix (code) + nit (compliance) | code + compliance (independent) | `App.spec.tsx:78-86` | open, non-blocking | Edit-expense route wiring lost **all** coverage in the rework (absent from every spec list; old spec asserted it; documented project history of exactly this mechanism breaking — foundation-005 round-1 F-1). Also: `/`, addExpense, join downgraded to loading-only assertions (path-in-guarded-tree proven, page-component wiring no longer proven). Contradicts DEVIATION-3's "preserving coverage" wording. Fix: one line (add the route to the `it.each`), ideally + authenticated `<h1>` assertions. No shipped-code defect — wiring correct today. |
| K-4 | nit | code | `RootLayout.tsx:7-9` | open | Comment misdescribes the chrome condition ("no session provider on public routes" — false: provider is app-level); anonymous-chrome flash on public pages for authenticated users while `loading`. |
| K-5 | nit | code | `RootLayout.tsx:22-30`, `ChangePasswordPage.tsx` submit | open | On an expired session, logout/change-password `401 UNAUTHENTICATED` fires the `api` singleton's hard `window.location.assign('/login')` before the page catch — benign double navigation to the same URL (the exact thing the bootstrap client's no-op handler exists to avoid, on a different call site). Fix: non-redirecting client for the logout POST. |
| K-6 | nit | code | `AuthContext.tsx:52-56` | open | Speculative surface: injectable `client` prop unused by any test; `refresh()` exposed but unconsumed. YAGNI — drop or exercise. |
| K-7 | nit | code | the three pages | open | a11y inconsistency: `aria-invalid` only on RegisterPage; inert `minLength` attributes under `noValidate`. |
| K-8 | nit | code | `auth-ui.spec.ts:88-94` | open | TC-ACC-026's old-password step asserts alert presence, not content — any error would satisfy it. Polish: match the INVALID_CREDENTIALS text. |
| K-9 | nit | code | `RequireAuth.tsx:38-39` | open | Guard loading state renders bare (no shell chrome) on protected deep links. Cosmetic, accessible, sub-second. |
| K-10 | nit | code | the three pages | open | Form state machine triplicated — deliberate non-abstraction at this size; revisit when the expense-form tickets land. |
| C-2 | observation | compliance | `LoginPage.tsx` | closed (adjudicated correct) | No client-side validation on login — matches the frozen `LoginDto` (policy exempt at login; MinLength(1)); adjudicated CORRECT by both lanes, not a gap. |
| C-3 | observation | compliance | `helpers/timing.ts:17` | open (same subject as K-1) | `waitUntil: 'load'` as the "page load" measure — defensible under the strategy's vocabulary; the code lane judges the /auth/me exclusion a should-fix (K-1). |
| C-4 | observation | compliance | `auth-ui.spec.ts:16-25` | closed (adjudicated faithful) | "No login step" asserted behaviorally (single user action + `/` await), not as URL history — sound; "no email-verification" via `/verif/i` count 0 + authenticated landing. |
| S-1 | low (non-blocking) | security | `RegisterPage.tsx:116-118`, `ChangePasswordPage.tsx:70-72` | open, non-blocking | `maxLength` silently truncates >128-char pasted passwords at register but not at login → unexplainable lockout; makes the explicit `> maxLength` validate branch unreachable. Fix: drop `maxLength` (JS validation already renders the explicit error) or apply consistently. |
| S-2 | low (non-blocking) | security | `RootLayout.tsx:23-31` | open, non-blocking | Failed logout POST leaves the server session alive while the UI shows logged-out; on a shared machine the browser silently re-authenticates at `/`. Fix: distinguish the failure (warning and/or one retry) instead of the unconditional clean transition. |
| S-3 | info | security | `AuthContext.tsx:66-76` | closed (adjudicated clean) | `refresh()` fails closed to anonymous on any error — correct default; no phishing elevation over baseline. |
| S-4 | info | security | `RegisterPage.tsx:110-121` | open | Register password input lacks `autoComplete="new-password"`. One-line hardening. |
| S-5 | info | security | `helpers/auth.ts:34-41` | closed (adjudicated clean) | e2e identity scheme sound: deterministic, no secrets, no real domains; full-suite re-run against a non-fresh DB would collide (covered by the fresh-DB convention + retry suffix). |

**Upstream routings (planning defects, not PR violations — the fixer fixes code, not documents):**

- **P-1** (route to test-planner, cf. coder's C-4 flag): TC-ACC-023's precondition "fresh e2e database" is impossible in the chained e2e phase the plan itself defines (`test:system` runs first against the same DB and leaves users; `e2e-db.mjs` never truncates).
- **P-2** (route to test-planner): plan TC bodies pin literal fixed emails while Gate 2 F3 + determinism rule 1 require unique identities — the bodies under-specify the resolved intent; amend the wording to the namespaced-identity scheme.
- **P-3** (route to planner/test-planner): TC-ACC-025's group-creation precondition depends on TKT-groups-004, which depends on this ticket (circular). When groups-004 lands, strengthen TC-ACC-025 to a real groupId with real data.

## Deviation adjudications

- **DEVIATION-1 (e2e identity isolation) — acceptable-with-routing; NOT a violation.** Premise verified airtight by the compliance lane (chain order, shared DB, alice-seeding + persistence, no truncation, CI retry) AND demonstrated live by the lead's own e2e run (both `alice@test.local` and `alice-e2e@test.local` in the DB afterwards). The namespacing keeps identities fixed and deterministic (same email per `(base, retry)`, display names and passwords unchanged — every plan assertion unaffected) and **realizes the plan's own Gate 2 F3 resolution** ("unique identities") that the TC bodies under-specified. Routed as P-1/P-2 for the test-planner's C-4 decision.
- **DEVIATION-2 (TC-ACC-025 precondition) — acceptable-with-routing.** The plan's group-creation precondition requires TKT-groups-004's deliverable (circular dependency); the spec fully exercises the ticket-owned assertions (logout → `/login`; anonymous deep link → `/login` with no data — sentinel non-vacuous, "at any point" by construction), does not paper over the gap (inline NOTE + ticket record), and the residual gap is test realism (real groupId with real data), routed as P-3.
- **DEVIATION-3 (foundation-005 spec reworks) — acceptable in substance; the "preserving coverage" claim is overstated.** The rework was necessary and the auth/guard coverage is materially stronger; spa-canary is not weakened (still proves harness criterion 4, now plus the anonymous redirect). But edit-expense lost all coverage and three routes were downgraded to loading-only — K-3/C-1. One-line fix recommended.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; P-1/P-2/P-3 are planning defects routed upstream, not PR violations.
- Code: zero findings at the blocker tier (3 should-fix, 7 nits — should-fix is not the blocker tier; the reviewer assigned no "must fix before merge" severity and said so explicitly).
- Security: zero critical/high (2 low, 3 info — below the critical/high blocking threshold).

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings and upstream routings, and the loop's fixed sequence ends on a clean pass). The code lane's request-changes verdict carries no blocking-severity findings — same adjudication as the accounts-001 round-1 precedent; recorded verbatim and surfaced here. The user (merge authority) may merge as-is, waive specific findings, or route the should-fix items (K-1/K-2/K-3+C-1, S-1/S-2) to a pre-merge fixer pass or follow-up ticket.

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel, zero open blocking findings → **MERGEABLE**. Loop ends early; passes 2–3 and both fix rounds unused.
- User action requested: merge PR #14 (via the orchestrator, per the dispatch contract — the review lead does not merge). After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking items for the next owner (user's call: pre-merge fixer pass, follow-up ticket, or waive): **K-1** (timing-gate measurement), **K-2** (stale-async race), **K-3/C-1** (edit-expense coverage, one-liner), S-1, S-2, K-4…K-10, S-4, C-3; P-1/P-2/P-3 (test-planner/planner). Recommended bundling: K-3+C-1, S-1, S-4, K-5 are trivial one-liners; K-1 and K-2 are small focused fixes; S-2 is a UX-hardening decision.
- Carried context from prior rounds (still open, not this PR's responsibility): accounts-003's S3-1 (login/change eviction race — follow-up hardening ticket), S3-2, S3-4, K3-1…K3-3, C3-1; FLAG-1/FLAG-2 (web mechanism specs outside root `pnpm test`; e2e dir outside web lint/typecheck globs) — pre-existing, confirmed unchanged.

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user/orchestrator. This artifact is committed to the PR branch (gitignored `reviews/` dir force-added per the established pattern) so the review history lands in `dev` with the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).
