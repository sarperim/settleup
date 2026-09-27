# Review Round 1 — PR #11 (TKT-accounts-002: Login, throttle & logout, C2 core)

PR: https://github.com/sarperim/settleup/pull/11
Branch: `tkt-accounts-002` → `dev` · Head at review: `b087ed6` · Base: `7cfc69b` (= `origin/dev` tip; merge-base verified)
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/settleup/review-TKT-accounts-002` — branch `review/tkt-accounts-002` at `b087ed6` (same commit as the PR head). Tree clean at review start and at every gate; reviewer DBs (`settleup_review_c` / `_k` / `_s`) truncated to zero rows after the lanes finished; the lead used `settleup_test`; no probe servers left listening.

Scope context: second domain ticket of Accounts & Access — `POST /api/auth/login` (throttle per arch §8.2, F-6 dummy-hash fix), `POST /api/auth/logout`, shared `readSessionToken`, the `LoginThrottleService` + counter-reset testability hook, and 11 acceptance specs (TC-ACC-005…009, 016, 017, 030–033) per `.pipeline/plan/tickets/TKT-accounts-002.md`, with two coder-declared deviations (D-3: TC-ACC-008 step 3 asserted on the landed protected surface; D-4: TC-ACC-017 realized as register → logout → single login).

Environment note: three separate reviewer sessions — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — dispatched concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL (`settleup_review_c` / `_k` / `_s`; migrations applied; the lead used `settleup_test`). Review-lead gates below ran from scratch in the same checkout. Every claim in the ticket's implementation record was re-verified; nothing was trusted. Full lane reports preserved at `/tmp/opencode/review-r1/{compliance,code,security}-report.md`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable logic: 7 source files under `apps/api/src/auth/**` modified/added (including a new 84-line service with auth-adjacent state), the test harness `support/app.ts`, and 11 new spec files. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- Auth/session/throttle code is exactly the class the security lane exists for (credential verification, timing side channel, throttle keying, revocation).
- The ticket pins automated acceptance TCs (TC-ACC-005…009, 016, 017, 030–033) — the compliance lane must verify them.

## Scope fence (allowed set) — verified held

`git diff --name-status dev...HEAD`: exactly 20 files, no renames, no mode changes (1 ticket file modified, 7 src files, 12 test files):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-accounts-002.md` | status `todo`→`in-review`, PR line, implementation record appended (verified strictly additive; nothing prior altered) |
| `apps/api/src/auth/**` | `auth.constants.ts` (+`LOGIN_THROTTLE_MAX_FAILURES`/`WINDOW_MS`), `login-throttle.service.ts` (new), `auth.service.ts` (throttle + dummy-hash verify + logout), `auth.controller.ts` (IP plumbing + `POST /logout`), `auth.guard.ts` + `session-cookie.ts` (shared `readSessionToken`, moved verbatim), `auth.module.ts` (provide/export `LoginThrottleService`) |
| `apps/api/test/**` | `support/app.ts` (+`resetLoginThrottle()` hook) and 11 new specs `tc-acc-{005,006,007,008,009,016,017,030,031,032,033}-*.spec.ts` |

**Zero changes** to `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json`, `pnpm-lock.yaml`, `.github/workflows/**`, any other module or ticket file (verified by direct diff query). No new dependencies. The must-NOT-touch list holds exactly.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations · 2 planning defects routed upstream (R-3 confirmed, R-4 new) · 3 non-blocking observations/nits |
| code | REQUEST CHANGES | **0 blockers** · 2 should-fix · 6 nits |
| security | **CLEAN** | **0 critical/high** · 3 low · 2 info |

The code lane's request-changes verdict is severity-consistent with zero blocking findings: the lane assigned no finding at its own blocker tier (should-fix is not the blocker tier). Per the immutable mergeability rule (below) the pass is clean; the should-fix/low items remain open, non-blocking, and are surfaced to the user in the loop report — same adjudication as the accounts-001 round-1 precedent.

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0 (2.6 s; only the documented `@swc/core` build-scripts default-deny notice).
- `pnpm --filter api exec prisma generate` — exit 0 (fresh-worktree prerequisite; CI provides it).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test pnpm test` — **`Test Files 34 passed (34)`, `Tests 105 passed (105)`, exit 0** — matches the ticket's claim exactly (baseline arithmetic verified by the compliance lane: 23 files/93 tests at merge-base + 11 specs/12 tests = 34/105).
- `pnpm lint` — exit 0. `pnpm typecheck` — exit 0. `pnpm build` — exit 0 (web + api).
- CI on head `b087ed6`: run [36292878607](https://github.com/sarperim/settleup/actions/runs/36292878607) green (verified by the lead via `gh run view`).
- All three reviewer sessions independently ran the full suite green (34/105, exit 0) against their own databases; the security reviewer additionally booted the PR-head app in-process and live-probed timing, throttle keying/XFF behavior, 429 envelopes, logout authZ, cross-user revocation isolation, and log hygiene (server killed and DB truncated afterwards — verified by the lead); the code reviewer probed concurrent-burst admission, the F-2 interleave, and the D-3 404 claim (DB truncated afterwards).

## Compliance lane (summary)

- **TC coverage:** all eleven acceptance TCs present and faithfully translated — TC-ACC-005 (200 `{user}` + Set-Cookie + `me` round-trip, strengthened with exact body keys and id identity), 006 (401 + no Set-Cookie), 007 (full-body `toEqual` parity + no Set-Cookie on either, strengthened beyond code+message), 008 (204 + empty body + revoked-cookie 401s; step 3 per D-3, below), 009 (no-cookie and revoked-cookie both 401), 016 (name + `HttpOnly`/`Secure`/`SameSite=Lax` with `COOKIE_SECURE=true` pinned), 017 (exactly one row, 64-hex `tokenHash` ≠ raw token, `expiresAt` ∈ [createdAt+29 d, +31 d], `me` 200; setup per D-4, below), 030 (direct `users`-row read `email = "alice@test.local"` + mixed-case login 200), 031 (all five steps incl. no-`details`/no-`Retry-After`/no-Set-Cookie on the 429 and DTO-precedes-throttle), 032 (both discriminating 429s — ghost keying and case-variant key sharing), 033 (5 failures → success → 10 fresh 401s → 429 at the new 11th). No `.skip`/`.only`/`.todo`/commented-out expects anywhere in the new specs. All 11 call `truncateAllTables` **and** `ctx.resetLoginThrottle()` in `beforeEach`.
- **Throttle contract vs arch §8.2:** all 14 clauses verified individually (keying incl. nonexistent emails + lowercasing via the same normalization as lookup; client IP via pre-existing `trust proxy: 1`; only credential-verification failures count — CSRF 403 / DTO 400 structurally never reach `recordFailure`; fixed 15-min window anchored at the first counted failure, never extended; first ten processed normally; 11th+ `429 TOO_MANY_ATTEMPTS` standard envelope before verification, correct credentials blocked; cleared on success or expiry; login only; check order DTO → throttle → verification). Wall-clock expiry non-automation is the plan's own T6/G-6 exclusion — compliant.
- **Testability hook:** `LoginThrottleService.reset()` exists, provided/exported via `AuthModule`, surfaced as `IntegrationApp.resetLoginThrottle()`, used by all 11 new specs.
- **Implementation record:** faithful to the diff on every checked claim.

**Deviation adjudications:**

- **D-3 (TC-ACC-008 step 3): COMPLIANT — planning defect, routed upstream (R-3).** `GET /api/groups` is an unmatched route (only `@Controller('auth')` exists; C3 Groups not landed) → Nest's not-found handler returns `404 NOT_FOUND` and an `APP_GUARD` guard never fires for a nonexistent route — the literal step is unsatisfiable until C3 lands. The code lane empirically confirmed the 404 (with and without a cookie). The realized substitution asserts the revoked cookie → `401 UNAUTHENTICATED` on **both** protected routes that exist (`GET /api/auth/me`, `POST /api/auth/logout`) — the TC's intent ("the revoked token grants nothing anywhere") at the maximum strength the landed surface permits. The plan's own TC-ACC-015 sweep already enumerates `GET /api/groups` and is the natural owner of the literal assertion. No test was weakened.
- **D-4 (TC-ACC-017): COMPLIANT — planning defect, routed upstream (R-4).** The plan's precondition set is internally inconsistent: alice can only exist via `POST /api/auth/register` (factories use only the public API), and registration necessarily opens a session row (FR-ACC-010) — so "empty database + one login ⇒ exactly one row for alice" is unrealizable as written. The realized sequence (register → logout, 204 asserted → single login) makes every expected element assertable at full strength: exactly one row, hash shape, expiry window, `me` 200. The logout step is itself the feature under test in TC-ACC-008/009 (independently green), so a broken revoke would fail this spec loudly. No weakening.

## Code lane (summary)

Verified correct, on record: §8.2 sequential semantics traced exactly (window anchoring, inclusive expiry boundary on both paths, fresh-window-after-expiry at count 1, 10th-failure-processed-normally, throttled attempts can't touch the counter, `recordSuccess` deletes); `\n` key separator safe (`@IsEmail()` rejects newlines; Node's HTTP parser rejects CR/LF in header values); check order and counting scope (only the 401 path records); 429 carries no Set-Cookie; controller `request.ip ?? ''` well-defined under `trust proxy: 1`; the `readSessionToken` refactor is a verbatim move with no guard-behavior change and no import cycles; all 11 specs deterministic and isolated; no pre-existing test modified; ticket record faithful.

Should-fix findings (non-blocking — none assigned the blocker tier):

- **K-1** `auth.service.ts:126-149` + `login-throttle.service.ts:44-70` — concurrent-burst over-admission: the check→record gap spans the `findUnique` + Argon2id awaits, so a concurrent burst verifies more attempts than the ten per window the contract's brute-force-slowing purpose implies (empirically 37/50 wrong-password attempts 401'd in one window; sequential contract exact, 10→429 confirmed). Kept out of the blocker tier because the pinned §8.2 semantics are a sequential state machine implemented to the letter, all acceptance TCs pass, the counter still accumulates and blocks subsequent attempts, and the throttle is flagged hardening at 8-user single-instance scale. Fix: per-key promise-chain serialization (≈15 lines).
- **K-2** `session.service.ts:62-73` (via this PR's logout wiring) — the accounts-001 **F-2** race is now reachable: concurrent `resolve()`/`revoke()` on the same session → Prisma **P2025** → `500 INTERNAL` instead of `401` (demonstrated end-to-end through the live guard; security lane reproduced at 43/320 under synthetic concurrency). Both lanes adjudicated it the same carried-over should-fix/low, not a new blocker: the defective lines predate this diff, the window is one DB round-trip, only the session owner's own just-dying request is affected, it fails closed, security-neutral. This PR lights the path (ordinary SPA background-fetch + logout), so it should be fixed with or immediately after this PR. Fix: catch P2025 → `null` in `resolve()`, or `updateMany` + re-read (one line).

Nits: **K-3** floating `dummyHashPromise` (boot-hash failure → unhandledRejection crash instead of clean boot error; await it in `onModuleInit`) — same as security S-5; **K-4** `recordSuccess` before `sessions.issue` (a failed issue clears the counter on a failed login — verified-correct credentials only, no security impact; reorder for letter-conformance); **K-5** dead surface (exported `throttleKey`, unused `now` injection params — the plan's T6/G-6 excludes clock tests); **K-6** email normalization duplicated between `normalizeEmail` and `throttleKey` (drift risk for TC-ACC-032's shared-counter property); **K-7** no proactive expiry sweep in the throttle Map — same as security S-1; **K-8** the F-6 spy asserts call count but not the candidate hash format (pin `/^\$argon2id\$/`).

**F-6 fix verification (required): fix is real and correct.** Unconditional single Argon2id verification on every path (`user?.passwordHash ?? await dummyHashPromise`); dummy hash boot-computed from `randomBytes(32)` through the same `PasswordHasher` (identical validated params); the short-circuit that produced the round-1 5–10× timing split is gone; response parity unchanged (byte-identical 401s, no Set-Cookie); deterministic regression guard in `tc-acc-007` (spy asserts one verify call for a ghost email). Residual nits K-3/K-8 don't undermine it.

## Security lane (summary)

**F-6 (accounts-001, medium) — CLOSED, verified empirically.** Live probe of the PR head (n = 28 per arm, interleaved, equal-length passwords, throttle reset between batches): unknown email median **40.5 ms** (IQR 38.0–43.0) vs existing email + wrong password median **41.7 ms** (IQR 38.4–44.7) — **1.2 ms median delta**, Mann-Whitney p = 0.44, distributions statistically indistinguishable; contrast arm (throttled 429, fires before verification) 2.2 ms proves the measurement resolves a missing verify. Round-1 delta was 5–16 ms vs 52–81 ms (5–10×). Byte-identical bodies and headers on both arms. Dummy hash random per boot, same hasher/params as production hashes (decoded live: `argon2id v=19 m=19456 t=2 p=1`), never stored/logged/returned.

Verified clean, with live probes: throttle is no enumeration oracle (keyed on submitted email regardless of existence; ghost and existing emails produce byte-identical 429 bodies/headers/timing); 429 envelope exact (no `details`, no `Retry-After`, no Set-Cookie); victim lockout not possible behind the documented single Caddy hop (rightmost XFF wins under `trust proxy: 1` — forged entries land left of the real client IP and are ignored); logout authN/authZ correct (CSRF 403 first; no/garbage/empty cookie → 401; re-logout → 401; tokenHash-scoped `deleteMany` with cross-user isolation verified live); guard refactor no bypass; logging clean (554 captured lines: zero emails, passwords, cookie names, or raw session tokens); unexpected errors fold to the generic 500 envelope; no new dependencies, secrets, or config changes.

Findings: **S-1 low** — throttle Map retains expired never-revisited entries indefinitely (lazy expiry only; spray is Argon2id-rate-bounded ≈ 18–27 MB/hour at full saturation; restart clears; cheap opportunistic sweep if desired); **S-2 low** — = code lane K-2 (F-2 race activated; see above); **S-3 low** — the IP component's trust is deployment-contingent (exactly as trustworthy as the single proxy hop; on direct exposure it is fully attacker-controlled — both self-evasion and forged-pair lockout demonstrated — so the single-trusted-hop assumption should stay explicit; no code change required for this PR); **S-4 info** — logout does not clear the client cookie (dead cookie transmitted up to 30 days; contract demands only row deletion + bare 204 — conformant; `clearCookie` hygiene for a later ticket); **S-5 info** — = code lane K-3 (un-awaited boot hash rejection mode).

## Consolidated findings

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| K-1 | should-fix | code | `auth.service.ts:126-149` + `login-throttle.service.ts:44-70` | open, non-blocking | Concurrent burst over-admits past the 10-failure window (37/50 verified empirically); sequential §8.2 contract exact; fix = per-key serialization. |
| K-2 / S-2 | should-fix (code) / low (security) | code + security | `session.service.ts:62-73` via this PR's logout wiring | open, non-blocking (carried-over accounts-001 F-2, now live) | resolve/revoke race → P2025 → `500 INTERNAL` instead of `401`; ms window, session-owner-only, fails closed; one-line fix. |
| S-3 | low | security | `app.factory.ts:68` (pre-existing) + `auth.controller.ts:57` | open, non-blocking | Throttle IP component trusts exactly one proxy hop; attacker-controlled on direct exposure (evasion + forged-pair lockout demonstrated). Deployment assumption to keep explicit. |
| K-3 / S-5 | nit / info | code + security | `auth.service.ts:76-80` | open | Floating `dummyHashPromise` — boot-hash failure crashes via unhandledRejection; await it. |
| K-4 | nit | code | `auth.service.ts:147-149` | open | `recordSuccess` before `sessions.issue` — failed issue clears the counter on a failed login (correct credentials only). |
| K-5 | nit | code | `login-throttle.service.ts:32-34,44,62` | open | Dead surface: exported `throttleKey`, unused `now` params (T6/G-6 excludes clock tests). |
| K-6 | nit | code | `auth.service.ts:37-39` vs `login-throttle.service.ts:33` | open | Email normalization duplicated (lookup key vs throttle key); drift risk. |
| K-7 / S-1 | nit / low | code + security | `login-throttle.service.ts:38,50-52` | open | No proactive expiry sweep — distinct-key spray accumulates Map entries; Argon2id-rate-bounded. |
| K-8 | nit | code | `tc-acc-007-no-enumeration.spec.ts:63-76` | open | F-6 spy asserts call count only; pin candidate hash format `/^\$argon2id\$/`. |
| S-4 | info | security | `auth.controller.ts:63-69` | open | Logout leaves the dead cookie in the browser (contract-conformant; `clearCookie` hygiene later). |
| C-1 | observation | compliance | `tc-acc-033-throttle-reset-on-success.spec.ts:51` | open | Plan's "+ session" on step 2 asserted as status only; session issuance covered by TC-ACC-005/016/030 in this PR. |
| C-2 | nit | compliance | `tc-acc-030-email-case-normalization.spec.ts:43` | open | Registration's "+ session" not asserted (TC-ACC-001's subject, pre-existing green spec). |
| C-3 | observation | compliance | `tc-acc-002-*.spec.ts:45-48`, `tc-acc-004-*.spec.ts:105-113` (pre-existing files, in scope) | open | Two pre-existing login-exercising specs lack `resetLoginThrottle` — currently inert (per-file app isolation, ≤1 counted failure per key vs threshold 10); latent hygiene gap. |

Upstream routings (outside the loop, for the planner/test-planner): **R-3** (coder's routing, confirmed) — TC-ACC-008 step 3 has an unreflected cross-module dependency on C3 Groups; the literal `GET /api/groups` revoked-token assertion belongs to the TC-ACC-015 sweep. **R-4** (new, compliance lane) — TC-ACC-017's "empty database" precondition + "one login" → "exactly one row" is unrealizable through the public-API factory convention; amend the precondition to the realized form.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; R-3/R-4 are planning defects routed upstream, not PR violations.
- Code: zero findings at the blocker tier (2 should-fix, 6 nits — should-fix is not the blocker tier; the lane assigned no "must fix before merge" severity).
- Security: zero critical/high (3 low, 2 info — below the critical/high blocking threshold). F-6 from accounts-001 verified **closed**.

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings and upstream routings, and the loop's fixed sequence ends on a clean pass). The code lane's request-changes verdict carries no blocking-severity findings; it is recorded verbatim above and surfaced to the user with the reviewer's recommendations — the user (merge authority) may waive, defer to a later ticket, or route the should-fix items to a pre-merge fixer pass.

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel, zero open blocking findings → **MERGEABLE**. Loop ends early; passes 2–3 and both fix rounds unused.
- User action requested: merge PR #11 (via the orchestrator, per the dispatch contract — the review lead does not merge). After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking items for the next owner (user's call: pre-merge fixer pass, next ticket, or waive): K-1, K-2/S-2 (= accounts-001 F-2, now live — both lanes recommend fixing with or immediately after this PR), S-3, K-3…K-8, S-4, C-1…C-3; R-3/R-4 (planner/test-planner).

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user. This artifact is committed to the PR branch (gitignored `reviews/` dir force-added per the established pattern) so the review history lands in `dev` with the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).
