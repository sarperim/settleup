# Review Round 1 — PR #13 (TKT-accounts-004: Cross-route auth contract — CSRF, envelope, logs, retention)

PR: https://github.com/sarperim/settleup/pull/13
Branch: `tkt-accounts-004` → `dev` · Head at review: `0d7da29` · Base: `6720fa4` (= `origin/dev` tip; merge-base verified) · Mergeable state at dispatch: OPEN/MERGEABLE
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/settleup/review-TKT-accounts-004` — branch `review/tkt-accounts-004` at `0d7da29` (same commit as the PR head). Tree clean at review start, at every gate, and after both lead mutation checks (mutations A/B2 applied and reverted with `git checkout --`; verified clean). Scratch namespace `/tmp/opencode/review-acc-004/` (parallel PR #14 loop ran concurrently on TKT-accounts-005 — all lead/reviewer databases suffixed `-r4`; no collisions). Reviewer DBs (`settleup_review_c_r4` / `_k_r4` / `_s_r4`) truncated to zero rows after the lanes finished (lead-verified); the lead used `settleup_test_r4` for unit+integration and `settleup_e2e_r4` for the e2e phase. Local `psql` client absent (WSL quirk); the established node shim (`PSQL` override honored by `scripts/e2e-db.mjs`) was used for the lead's e2e-phase gate. No probe servers left listening (lead-verified).

Scope context: fourth Accounts & Access ticket — **test-only**: the four cross-route contract specs that only became executable once all four auth routes exist (TC-ACC-014 CSRF on all four state-changers, TC-ACC-022 §4 error envelope, TC-ACC-021 password-never-logged over a captured pino destination, TC-ACC-029 full-lifecycle persistence) plus the ticket-mandated log-capture testability hook in the integration bootstrap, per `.pipeline/plan/tickets/TKT-accounts-004.md`. Deferred TCs TC-ACC-015/018 are explicitly not this ticket's (integration phase).

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable test code: a 65-line modification of the test bootstrap `apps/api/test/integration/support/app.ts` (the log-capture hook — new runtime wiring in the harness) and 4 new spec files (500 lines). Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- The ticket pins automated acceptance TCs (TC-ACC-014, 021, 022, 029) — the compliance lane must verify them.
- The subject matter (CSRF enforcement, log hygiene for credentials, the auth error contract) is exactly the class the security lane exists for, even though zero production files change.

## Scope fence (allowed set) — verified held (lead + all three lanes, independently)

`git diff --name-status origin/dev...HEAD`: exactly 6 files, no renames, no mode changes (+564/−3):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-accounts-004.md` | status `todo`→`in-review` (single-line diff verified; nothing prior altered) |
| `apps/api/test/integration/support/app.ts` | the ticket-mandated log-capture testability hook (+65: `LogCapture`, `createLogCapture`, `CreateIntegrationAppOptions.logLevel`, `IntegrationApp.logs`, `createIntegrationApp(options?)` building pino over the in-memory stream and passing `{ logger }` to `createHttpApp`) |
| `apps/api/test/integration/tc-acc-014-csrf-header-required.spec.ts` | new — 4 tests (one per route) |
| `apps/api/test/integration/tc-acc-021-passwords-not-logged.spec.ts` | new — 1 test |
| `apps/api/test/integration/tc-acc-022-error-envelope.spec.ts` | new — 6 tests (one per trigger) |
| `apps/api/test/integration/tc-acc-029-lifecycle-persistence.spec.ts` | new — 1 test |

**Zero changes** to `apps/api/src/**` (the defect-fix allowance was NOT used — no production change at all), `apps/web/**`, `packages/**`, `apps/api/prisma/**`, root `package.json`, `pnpm-lock.yaml` (byte-identical — no new dependencies). The 23 pre-existing integration spec files are untouched (the only modified non-new file is `support/app.ts`); nothing prior could have been weakened or deleted. The must-NOT-touch list holds exactly. Deferred TCs TC-ACC-015/018 absent (grep + file list).

## Reviewer verdicts (pass 1, dispatched in parallel via `opencode run`)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations · 1 routed observation · 2 nits |
| code | **APPROVE** | **0 blockers** · 1 should-fix · 4 nits (1 routed) |
| security | **APPROVE** | **0 critical/high** · 3 low · 1 info |

Full lane reports preserved at `/tmp/opencode/review-acc-004/{compliance,code,security}-report.md`.

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0. `pnpm --filter api exec prisma generate` — exit 0 (fresh-worktree prerequisite; CI provides it).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test_r4 pnpm test` — **`Test Files 43 passed (43)`, `Tests 125 passed (125)`, exit 0** — matches the ticket's claim exactly (baseline arithmetic: 39/113 at the acc-003 merge-base + 4 files/+12 tests = 43/125; new tests 4+1+6+1).
- `pnpm lint` — exit 0. `pnpm typecheck` — exit 0. `pnpm build` — exit 0.
- `E2E_DATABASE_URL=…settleup_e2e_r4 PSQL=<node shim> pnpm test:e2e` — **exit 0**: e2e-db (database created, migrations applied) → `pnpm test:system` **1/1 passed** → Playwright chromium spa-canary **1 passed**.
- CI on head `0d7da29`: run [36297284266](https://github.com/sarperim/settleup/actions/runs/36297284266) "Lint, test & build" **SUCCESS** (verified by the lead via `gh`; PR OPEN/MERGEABLE, commits `d80084c` + `0d7da29` only).
- All three reviewer sessions independently ran the suite green (43/125, exit 0) against their own `-r4` databases.

**Lead mutation checks (the coder's two claims, independently re-derived; tree restored + verified clean after each):**

- **Mutation A — CSRF middleware disabled** (`csrf.middleware.ts` handler reduced to `next(); return;`): `tc-acc-014` **failed 4/4** (header-less register/login/logout/password returned 2xx instead of 403). The coder's claim reproduces.
- **Mutation B — request logger leaks `body: req.body`**: `tc-acc-021` **still passed** — pino's redact layer (`*.password`) censored `body.password` before the sink. This is the platform's defense-in-depth (foundation F-S-6) working as designed, and confirms the spec's scan point is post-redaction.
- **Mutation B2 — password logged under a non-redacted key** (`pw: req.body?.password`): `tc-acc-021` **failed** with `Sup3r-Secret-Pw-9x` visible in the captured output. This is the shape of the coder's second claim ("unredacted logged key → TC-ACC-021 failed") and it reproduces.
- **Built-logger redaction probe** (lead, against `dist/common/logging/logger.js`): `{ body: { password, currentPassword, newPassword } }` logged at info → `password` censored, **`currentPassword`/`newPassword` pass through un-redacted** (see S4-1/K4-1 below).

## Compliance lane (summary)

- **TC coverage:** all four acceptance TCs present and faithfully translated — TC-ACC-014 (all four routes header-less → `403 CSRF_HEADER_MISSING`, per-route no-side-effect proofs: register → no Set-Cookie + `user.count()==0` + `session.count()==0` + would-be credentials fail login; login → session count unchanged + prior session still valid; logout → session not revoked; password → old password still authenticates, new one rejected), TC-ACC-021 (literal `Sup3r-Secret-Pw-9x` byte-exact per the plan; register → login → logout; scan of every captured line; non-vacuity via `logLevel: 'info'` + explicit path-presence assertions), TC-ACC-022 (all six plan triggers with exact statuses/codes and the full §4 envelope assertion — only top-level `error`, keys ⊆ {code, message, details}, non-empty message, no stack traces), TC-ACC-029 (all six lifecycle steps with id/email/displayName re-asserted at every step plus a final direct-row check). No `.skip`/`.only`/`.todo`/commented-out expects; every new spec truncates all tables and resets the login throttle in `beforeEach` (021 additionally clears the capture).
- **The log-capture hook matches the plan's mandated precondition** ("app bootstrap routes pino output to a captured in-memory destination (test harness)") exactly; wires through pre-existing foundation extension points (`createHttpApp({ logger })`, `buildLogger(level, stream)` — both verified present on `origin/dev`); zero production files touched; `logLevel` exists solely for non-vacuity, not gold-plating; additive signature, all pre-existing callers unchanged.
- **Architecture adherence:** 03 §1/§4, 01 §8.2/§8.4 all pinned by the specs (details in the lane report). No gold-plating.
- **Deferred TCs honored**; **defect-fix allowance unused** (zero `apps/api/src/**` diff).

## Code lane (summary)

Verified on record: the hook's stream satisfies pino's `DestinationStream` with **synchronous** `write` (empirically confirmed against the repo's pino 9.5.0 — no buffering/nextTick hop, so `res.on('finish')` lines are in the capture before the supertest promise resolves; no ordering hazard); the default level chain (`options.logLevel ?? process.env.LOG_LEVEL ?? 'info'`) is sound given `setup-env.ts` pins `LOG_LEVEL=error` (behavior change for pre-existing specs is stdout → memory at the same `error` level — no assertion impact, negligible memory); the `{ logger }` path is the right choice (the alternative `loggerStream` option cannot override the level per-app, which TC-ACC-021 legitimately needs); all four specs match sibling conventions exactly, are deterministic and isolated, and their assertions catch the regression directions they own (014: per-route 403+code+side-effects — mutation-confirmed; 022: extra top-level key / missing message / stack-in-body all fail by assertion; 029: any id/email/displayName mutation fails at the next step or the row check). F-3/F-4 prior-findings claims verified (below). No dead code beyond the K4-3 interface members; comments match behavior.

## Security lane (summary)

Verified clean: the PR weakens nothing (zero production files; hook consumes pre-existing foundation options; no new dependencies — lockfile byte-identical). **The scan point is the right measurement point** — the capture sits at the pino destination, post-serialization, post-redaction, byte-for-byte what would reach stdout in production. **No sink bypass on the request path**: exhaustive scan of `apps/api/src` found exactly two logger call sites (request-logging middleware at `info`, `AllExceptionsFilter` at `error`); Nest's built-in logger disabled; no Prisma query logging; the only `console.*`/stdout writes live in the off-HTTP-path owner CLI and are credential-free. TC-ACC-021 is real, non-vacuous, and mutation-sensitive (A/B/B2 evidence). Secrets clean (fixture passwords only, `@test.local` emails, no `.env`/keys/tokens in the diff). CSRF middleware semantics verified (strict `===` on the header value — wrong value is also rejected, though unpinned by any spec → S4-4).

## R3-1 adjudication (acc-003's C3-2/R3-1 — TC-ACC-014 automation ownership)

**Resolved cleanly by this PR; no route left unowned; no planner action needed.** The acc-003 round routed "TC-ACC-014 automation ownership" upstream because the CSRF enumeration — including `POST /api/auth/password`, made live by acc-003 — had no owning spec anywhere at that time. The routing and this ticket are not in conflict: TKT-accounts-004's scope **assigned TC-ACC-014 to this PR for all four routes at plan time** (commit `bd3e13d`, Gates 1–4 — before the acc-003 review ran; verified by `git log --follow` on the ticket file: this PR's only ticket edit is the status flip). The new spec delivers exactly that assignment — four per-route tests including `POST /api/auth/password` (spec lines 117–147). The apparent tension is a sequencing artifact of parallel plan/review phases (ownership assigned at plan time, flagged before the owner landed), not a planning defect. **The coder following the ticket was correct**; the flag is discharged.

## Log-capture hook design adjudication (three lanes + lead, unanimous)

**Sound and correctly shaped.** (1) Test-only wiring over pre-existing foundation extension points — zero production behavior change (all lanes verified by diff query against base). (2) Correct measurement point: production logger constructor, capture at the destination, post-redaction — the spec scans what production would emit, and the redaction layer is exercised rather than bypassed (mutation B proved it censors `body.password`). (3) Synchronous destination semantics — no finish/assertion race (code lane verified empirically). (4) Non-vacuity by construction — `logLevel: 'info'` matches the request-logging middleware's emit level (the only info-level sink), plus explicit path-presence assertions. (5) Additive, backward-compatible signature; the 23 pre-existing spec files untouched and green. Residual nits recorded as findings (K4-2/C4-3 lost stdout diagnostics on failure; K4-3 `lines` aliasing; K4-4 raw `LOG_LEVEL` read before env validation — all nit-tier, none affecting correctness of this PR's deliverable).

## Prior-findings claims (acc-001 F-3/F-4) — verified

- **F-4 (cookie attributes) — resolved by an earlier PR, claim accurate:** `tc-acc-016-cookie-attributes.spec.ts` asserts `HttpOnly`/`Secure`/`SameSite=Lax`, landed in `1eb49c8` (TKT-accounts-002), untouched by this diff. (acc-001's F-4 also named Path/Max-Age, which the landed spec does not assert — landed code, outside this PR's lane, noted for the record.)
- **F-3 (guard-rejection coverage) — "partially covered" claim accurate, precisely enumerated:** the **no-cookie** direction is now doubly covered (tc-acc-009 pre-existing; this PR's tc-acc-022 anonymous `GET /api/auth/me` → `401 UNAUTHENTICATED`). The **garbage-token** direction has no literal spec but takes the identical code path to the revoked-token direction (`readSessionToken` → hash → `findUnique` miss → null → 401), which is covered by tc-acc-008/009/012 — effectively covered (code-lane analysis; the compliance lane counts it uncovered by spec-literalism — recorded both ways, immaterial to the routing). The **expired-session** direction (row present, `expiresAt` backdated) remains uncovered anywhere — routed (C4-1/K4-5 → R4-2).

## Consolidated findings

IDs scoped to this PR/round (prior-round IDs referenced explicitly where carried).

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| K4-1 | should-fix (non-blocking) | code | `tc-acc-021-passwords-not-logged.spec.ts:53-79` | open, non-blocking | The spec drives register/login/logout but not `POST /api/auth/password` — the route carrying `currentPassword`/`newPassword`, neither covered by pino's redact paths. The lead's mutation B demonstrated the class: a request-logger `body` regression passes TC-ACC-021 today (redact censors `body.password`); the same regression on the password route would leak both fields undetected. The TC's literal steps (register/login/logout per the plan) are satisfied — hence should-fix, not blocker. Fix is cheap and in-scope: drive the password change with a distinctive `currentPassword`/`newPassword` and assert neither substring appears. The plan-side half is routed (S4-2 → R4-1). |
| S4-1 | low (non-blocking) | security | `apps/api/src/common/logging/logger.ts:15-23` (pre-existing platform, NOT in this diff) | open, non-blocking | Redaction blind spot: `REDACTED_KEYS` covers `password`/`*.password` but not `currentPassword`/`newPassword` (lead-probed against the built logger). No live leak path — nothing logs bodies today. Follow-up platform hardening ticket: add the two keys (→ R4-3). |
| S4-2 | low (non-blocking) | security | `tc-acc-021` + plan entry `accounts-access.md:237-242` | open, non-blocking (routed) | Coverage matrix gap originates in the test plan: TC-ACC-021's steps omit the password-change route, and the capture runs at `info` (a future debug-level body log would evade CI while being real under a `LOG_LEVEL=debug` boot). Route to test-planner (→ R4-1). Same subject as K4-1. |
| S4-3 | low (non-blocking) | security | `tc-acc-022-error-envelope.spec.ts:33-52` | open, non-blocking | `error.message` is only checked to be a non-empty string — an internal-detail-bearing message avoiding `/stack/i` and `' at '` would pass; no 500/INTERNAL trigger in the matrix (the TC lists none). One-line strengthening: pin `message` to the exact `DEFAULT_MESSAGES` value per trigger. |
| S4-4 | info | security | CSRF coverage suite-wide | open | Wrong-header-**value** direction (`X-Requested-With: foo`) unpinned anywhere; the middleware's strict `===` is correct but a loosening regression would pass CI. Presence is the real CSRF signal, so this is hardening degradation, not a bypass. Add one wrong-value case to tc-acc-014 or route as a TC step amendment. |
| C4-1 | observation (routed) | compliance | suite-wide (outside this diff) | routed upstream (R4-2) | F-3 residue: the expired-session guard-rejection direction (backdated `expiresAt` → 401) has no owning spec and no owning TC (TC-ACC-015's sweep is anonymous-only; TC-ACC-017 is structural per strategy G-6). Planner/test-planner to assign. |
| C4-2 | nit | compliance | `tc-acc-022-error-envelope.spec.ts` | open | The spec freezes `details` presence/absence per trigger (absent for four codes, `{field:'email'}` for EMAIL_TAKEN) — one step beyond the plan's shape-only expectation, consistent with §4's documentation. Acceptable strengthening; flagged so the team knows current behavior is pinned. |
| C4-3 | nit | compliance | `support/app.ts:93-104` | open | Captured logs never dumped on failure — pre-PR, error-level lines appeared under failing tests; now invisible (DX regression). Same subject as K4-2. |
| K4-2 | nit | code | `support/app.ts:93-104` | open | Lost stdout diagnostics for failing integration tests (the filter's `unhandled_exception` line now lands in the capture with no dump path). Optional: flush `ctx.logs.text()` on failure or on `app.close()`. |
| K4-3 | nit | code | `support/app.ts:29-38` | open | `LogCapture.lines`/`.stream` have no spec consumers; `lines` is a live aliased array whose `clear()` silently empties held references. Trim the interface or document the aliasing trap. |
| K4-4 | nit | code | `support/app.ts:100-103` | open | Raw `process.env.LOG_LEVEL` read builds the logger **before** `createHttpApp`'s `loadEnv` validation — a malformed value (e.g. empty string, not skipped by `??`) surfaces as pino's raw error instead of the project's clean env message; `logLevel?: string` is looser than `LogLevel`. Edge case (setup-env pins `error`). |
| K4-5 | nit (routed) | code | suite-wide (outside this diff) | routed upstream (R4-2) | `SessionService.resolve`'s expiry branch has zero coverage anywhere — no spec backdates `expiresAt`. Two-line follow-up spec; route to the accounts domain's next ticket or the integration-phase backlog. Same subject as C4-1. |

Upstream routings (outside the loop, for the planner/test-planner): **R4-1** — test-plan amendment for TC-ACC-021: add the password-change route to its steps (and consider pinning the capture level to `trace` — free today, nothing logs below info). **R4-2** — assign an owner for the expired-session guard-rejection direction (F-3 residue; C4-1/K4-5). **R4-3** — platform hardening follow-up: `REDACTED_KEYS` += `currentPassword`/`newPassword` (S4-1). Carried, still open, still not this PR's responsibility: acc-003's **S3-1** (medium — login/change eviction race; follow-up hardening ticket recommended there), S3-2, and the remaining acc-001/002 non-blocking items.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; R4-1/R4-2 are test-plan/planning defects routed upstream, not PR violations.
- Code: zero findings at the blocker tier (1 should-fix — K4-1 — below the blocking threshold, consistent with the acc-001/002/003 precedents where should-fix items did not block a clean pass).
- Security: zero critical/high (3 low, 1 info — below the critical/high blocking threshold).

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings and upstream routings, and the loop's fixed sequence ends on a clean pass). Same adjudication as the accounts-001/002/003 round-1 precedents: open non-blocking items are surfaced to the user, who may waive, defer to a later ticket, route a pre-merge fixer pass, or fix K4-1 cheaply pre-merge.

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel, zero open blocking findings → **MERGEABLE**. Loop ends early; passes 2–3 and both fix rounds unused.
- User/orchestrator action requested: merge PR #13. After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking items for the next owner (user's call: pre-merge fixer pass, follow-up ticket, or waive): **K4-1/S4-2** (TC-ACC-021 password-route coverage — cheap in-spec fix, plan-side amendment routed), S4-1 (redact keys → R4-3), S4-3, S4-4, C4-2, C4-3/K4-2, K4-3, K4-4; R4-1/R4-2/R4-3 (planner/test-planner).
- Carried context from prior rounds (still open, still not this PR's responsibility): acc-003's S3-1 (medium), S3-2, S3-4; acc-002's and acc-001's other open items — except **F-4, resolved by TKT-accounts-002's landed spec** (verified here), and **F-3, now partially covered** (no-cookie doubly pinned; garbage-token effectively covered via the revoked-token path; expired-session routed via R4-2).

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user/orchestrator. This artifact is committed to the PR branch (force-add; `.pipeline/plan/reviews/` is gitignored) so the review history lands in `dev` with the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).
