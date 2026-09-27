# Review Round 1 — PR #10 (TKT-accounts-001: Registration & session establishment, C2 core)

PR: https://github.com/sarperim/settleup/pull/10
Branch: `tkt-accounts-001` → `dev` · Head at review: `dbd9716` · Base: `5aaa225` (= `origin/dev` tip; merge-base verified)
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/settleup/review-TKT-accounts-001` — branch `review/tkt-accounts-001` at `dbd9716` (same commit as the PR head; the coder's own worktree `/tmp/opencode/settleup/TKT-accounts-001` on `tkt-accounts-001` was left untouched). Tree clean at review start, after every reviewer session, and at every gate.

Scope context: first domain ticket of Accounts & Access — the C2 Auth module (`POST /api/auth/register`, `GET /api/auth/me`, global `AuthGuard`, session service, `UsersService` read API, Argon2id utility, register DTO + §4 precedence) per `.pipeline/plan/tickets/TKT-accounts-001.md`, with two coder-declared deviations (DEVIATION-1: minimal `POST /api/auth/login`; DEVIATION-2: TC-ACC-004 observation via row count + follow-up login).

Environment note: unlike the PR #9 precedent (lanes executed in-session), this round **dispatched three separate reviewer sessions** — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL (`settleup_review_c` / `_k` / `_s`; migrations applied; the lead used `settleup_test`). Concurrent suite runs therefore cannot collide (integration specs share one DB and truncate per test — `fileParallelism: false`). Review-lead gates below ran from scratch in the same checkout. Every claim in the ticket's implementation record was re-verified; nothing was trusted.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable logic: 13 new source files under `apps/api/src/auth/**` plus the `app.module.ts` module registration, and 8 new test files. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- Auth/session code is exactly the class the security lane exists for (token handling, credential verification, cookie attributes, guard bypass).
- The ticket pins automated acceptance TCs (TC-ACC-001/002/003/004/019/020/034) — the compliance lane must verify them.

## Scope fence (allowed set) — verified held

`git diff --name-status origin/dev...HEAD`: exactly 23 files, no renames, no mode changes (1 ticket file modified, 1 src file modified, 21 new files):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-accounts-001.md` | status `todo`→`in-review`, PR line, implementation record appended (additive; nothing prior altered) |
| `apps/api/src/app.module.ts` | +`AuthModule` import/registration (2-line wiring the global-guard architecture requires; RED proof in the record confirms necessity) |
| `apps/api/src/auth/**` | 13 new files: constants, `public.decorator`, `password`, `password-hasher.service`, `session.service`, `session-cookie`, `users.service`, `auth.service`, `auth.controller`, `auth.guard`, `auth.module`, `dto/{register,login}.dto` |
| `apps/api/test/**` | 8 new files: `tc-acc-{001,002,003,004,020,034}` integration specs, `tc-acc-019` unit spec, `support/factories.ts` |

**Zero changes** to `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json`, `pnpm-lock.yaml`, `.github/workflows/**`, any other module or ticket file (verified by direct diff query — 0 lines). No new dependencies (the `argon2` import pre-exists on `origin/dev`). The must-NOT-touch list holds exactly.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations · 2 planning defects routed upstream (not PR violations) · 3 non-blocking observations |
| code | REQUEST CHANGES | **0 blockers** · 5 should-fix · 4 nits |
| security | REQUEST CHANGES | **0 critical/high** · 1 medium · 4 non-blocking notes |

Both request-changes verdicts are severity-consistent with zero blocking findings: neither lane assigned its own blocking tier (blocker / critical-high). Per the immutable mergeability rule (below) the pass is clean; the should-fix/medium items remain open, non-blocking, and are surfaced to the user in the loop report.

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0 (2s; only the documented `@swc/core` build-scripts default-deny notice).
- `pnpm --filter api exec prisma generate` — exit 0 (fresh-worktree prerequisite, pre-existing since f-004; CI provides it at `ci.yml:76`).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test pnpm test` — **`Test Files 23 passed (23)`, `Tests 93 passed (93)`, exit 0** — matches the ticket's claim exactly.
- `pnpm lint` — exit 0. `pnpm typecheck` — exit 0. `pnpm build` — exit 0 (web 266.45 kB raw / 84.30 kB gzip; api via `nest build`).
- CI on head `dbd9716`: run [36290763693](https://github.com/sarperim/settleup/actions/runs/36290763693) green ("Lint, test & build", 1m8s; annotations are pre-existing runner/Node-20 deprecation notices, no failures) — verified by the lead via `gh run view`.
- All three reviewer sessions independently ran the full suite green (23/93, exit 0) against their own databases; the security reviewer additionally booted the compiled PR-head app and live-probed the guard, CSRF, DTO whitelist, cookie attributes, email-length bounds, and login timing (probe server killed and its DB truncated afterwards).

## Compliance lane (summary)

- **TC coverage:** all seven acceptance TCs present and faithfully translated — TC-ACC-001 (exact payload, 201/`{user}`/displayName/non-empty id, `settleup_session` Set-Cookie, no-verification round-trip, `me`→200 same id), TC-ACC-002 (both steps verbatim incl. `details.field="email"` and login→`401 INVALID_CREDENTIALS`), TC-ACC-003 (`ALICE@Test.Local`→409 + no-Set-Cookie strengthening), TC-ACC-004 (all 12 rows a–l with exact inputs/statuses/fields, each an isolated truncated iteration; 12/12 verified green), TC-ACC-019 (unit, decode→argon2id m=19456/t=2/p=1, verify/reject; env→hasher chain covered by the pre-existing foundation boot-env spec), TC-ACC-020 (row read, `^\$argon2id\$`, ≠ plaintext), TC-ACC-034 (400 naming `password`, not 409; only the original row remains). No `.skip`/`.only`/`.todo` anywhere in the new specs.
- **Scope:** held exactly (table above).
- **Architecture adherence:** verified against all pinned sections — C2 sole writer of `users`/`sessions`; `UsersService` read-only export `{ id, displayName }` (FR-ACC-008 boundary); global `AuthGuard` via `APP_GUARD` with exactly register/login `@Public()`; Argon2id params from validated env (§7 defaults); 256-bit `randomBytes(32)` token, SHA-256-hex storage only, sliding 30-day expiry pushed on resolve; cookie `HttpOnly`/`Secure(COOKIE_SECURE)`/`SameSite=Lax`/`Path=/`/`maxAge` 30d; `request.user = { id }` context; `409 EMAIL_TAKEN` + `details.field`; DTO-precedes-service precedence proven by TC-ACC-034; P2002 race mapped to the same 409; `registerUser(email, password, displayName)` factory shape exact per strategy §5; register response mirrors the frozen shared `UserDto`.
- **Ticket-file edit:** strictly additive + the two header lines; record faithful to the diff (one prose imprecision, F-8).

**Deviation adjudications:**

- **DEVIATION-1 (minimal login in this ticket): COMPLIANT.** TC-ACC-002 step 2 (accounts-access.md:47→:50) and TC-ACC-004's expected result (:80) invoke `POST /api/auth/login`, and both TCs are in this ticket's acceptance list — without login those TCs cannot be automated as written. The implementation is wholly in `apps/api/src/auth/**`, builds exactly what those steps need (lowercased lookup, Argon2id verify, session + cookie, generic `401 INVALID_CREDENTIALS`), and nothing more (throttle, logout, counter-reset hook, TC-ACC-007 parity test all correctly left to TKT-accounts-002). The 200 happy path is intrinsic to a verify-based login.
- **DEVIATION-2 (row-count observation + 400-vs-401): COMPLIANT.** The `users`-row count is a **stronger** observation than the plan's indirect login probe (the plan itself uses direct row reads — TC-ACC-020 :234, Gate-2 F2 resolution :6). The plan's literal "follow-up login → `401`" is unsatisfiable for malformed-email rows under the pinned 03 §4 precedence (DTO validation precedes service checks) — the docs win over the plan's parenthetical. Rows j/k cannot form a login at all (the spec correctly skips them); row l's follow-up does return 401; only row i yields 400. Residual looseness in the assertion is F-8 (nit). No test was weakened.

**Planning-defect routings (upstream — never enter the fix loop):**

- **R-1 → planner:** TKT-accounts-001's scope built no login while its acceptance TCs (plan: TC-ACC-002 step 2, TC-ACC-004 expected result) require one — a ticket-internal contradiction the coder resolved the only fidelity-preserving way (DEVIATION-1). The scope bullet or the TC sequencing should be fixed at the plan level.
- **R-2 → planner/test-planner:** TC-ACC-004's expected-result wording ("a follow-up login with that row's credentials → `401`") is unsatisfiable as written for rows whose payload is itself invalid; reword to "the credentials do not authenticate (401, or 400 where the payload itself is invalid)".

## Code lane (summary)

Verified correct, on record: P2002 race handling (hashing outside the transaction), transactional user+session creation with rollback, byte-identical 401 envelopes on login, benign concurrent sliding-expiry updates, cookie read backed by `cookie-parser` with typeof-guard, `@Public()` reflector pattern, `normalizeEmail` consistency (TC-ACC-003), `decodeArgon2Hash` regex (anchored, correct alternation), inlined DTO limits following the error-contract FLAG precedent with values matching `FIELD_LIMITS`, `UserProfile` mirroring the frozen `UserDto`, `revoke()` ticket-mandated.

Should-fix findings (all non-blocking — none assigned the blocker tier):

- **F-1** `users.service.ts:34-44` — `getUserRefs` batch method beyond the ticket's singular "`id` → `{ id, displayName }`" pin, zero consumers, zero tests. Code lane: delete, land with the consuming C3 ticket. Compliance lane: lean-acceptable (group-scoped read models are inherently plural; pinned boundary and shape preserved) — **inter-lane assessment conflict, user decides**.
- **F-2** `session.service.ts:62-69` — `resolve()`'s findUnique→update window races `revoke()` (and any future logout): Prisma throws **P2025** on update-not-found (lead-verified empirically; the reviewer's "P2005" was the wrong code, same substance) which propagates through the guard as `500 INTERNAL` instead of `401`. Latent today (no route calls `revoke()`), delivered API of this module, wired to logout in TKT-accounts-002. Fix: catch P2025 → `null`, or `updateMany` + re-read.
- **F-3** whole suite — guard rejection paths have zero coverage: no `/api/auth/me` call without a valid cookie anywhere. No-cookie→401, garbage-token→401, expired-session→401 (two-line `expiresAt` backdate) all untested; the anonymous-rejection direction is invisible to CI. (Security lane verified all three paths live — behavior correct, coverage gap real; TC-ACC-015's sweep is scheduled later.)
- **F-4** `tc-acc-001:38` — session cookie attributes never asserted although the harness pins `COOKIE_SECURE=true` explicitly to make them assertable; a regression dropping `httpOnly`/`sameSite`/`secure` from `sessionCookieOptions` passes CI silently. (Security lane live-verified the current attributes are correct.)
- **F-5** `tc-acc-020:30-33` — the `PasswordHasher`→stored-hash seam is untested: TC-ACC-019 tests the pure function with literals, TC-ACC-020 only the `$argon2id$` prefix; a swapped `memoryCost`/`timeCost` wiring stays green while violating NFR-ACC-001. Fix: decode the stored hash and assert m=19456/t=2/p=1.

Nits: **F-6** `SESSION_TTL_MS` recomputed in `expiryFrom` (drift would desync cookie from DB expiry); **F-7/F-8** DEVIATION-2 prose overgeneralizes rows i–l (only row i yields 400; j/k skip the login; l returns 401) and `expect([400, 401]).toContain(...)` is looser than the record claims — tighten per-row or fix the wording; **F-9** dead export `ARGON2ID_ALGORITHM` (documented for TC-ACC-020, never imported).

## Security lane (summary)

**F-6(s) MEDIUM — login timing side channel defeats the "no enumeration on login" contract.** `auth.service.ts:105-107`: the short-circuit `user !== null && await verify(...)` skips Argon2id entirely for unknown emails. Response bodies are byte-identical (verified), but measured live against the PR head: unknown email 5–16 ms vs existing email + wrong password 52–81 ms — a 5–10× delta, trivially separable, directly undermining 03-api-design.md §2's "generic — no enumeration on login". The TKT-accounts-002 throttle does not mitigate it (enumeration uses one attempt per distinct email, never approaching the 10-failure threshold), and TC-ACC-007 asserts only body equality, so nothing would catch the regression. Fix is one line (unconditional verify against a fixed dummy hash when the user is absent). The reviewer's own framing: either fix it here, or record an explicit decision scheduling it to TKT-accounts-002 — "a decision, not an accident". (Also flagged by the code lane as a referral, F-9 there.)

Verified clean, with live probes against the booted PR-head app: injection (all Prisma parameterized; validation-pipe whitelist strips injected `passwordHash`/`isAdmin`); authn/authz (`@Public()` is compile-time metadata on exactly register+login; no-cookie/garbage/empty/array-cookie all → 401; CSRF fires first); secrets (no logging in the auth module; token and password appear zero times in captured request logs); data exposure (hash never projected; non-P2002 errors fold to generic 500 with no internals; the 409 disclosure is contract-mandated); crypto (256-bit CSPRNG token, 64-hex SHA-256 storage ≁ cookie value, Argon2id params boot-validated, no ReDoS, no timing-sensitive manual compares); dependencies (none added); configuration (`COOKIE_SECURE` default true, flows validated-config→controller→cookie; live `Set-Cookie: settleup_session=…; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`); resource exhaustion (password/displayName bounded; `@IsEmail()` empirically bounds email ≤ ~320 chars — 64-char local part 201, 100+ → 400, 40 KB → 400; body capped at 100 kb; throttle correctly deferred per plan).

Non-blocking notes: expired session rows never deleted (hygiene, negligible at current scale); register unthrottled by explicit contract (03 §4) — each attempt costs ~19 MiB/~100 ms Argon2id, noted for the record under NFR-ACC-002; `readPositiveInt` for `ARGON2_*` has no upper bound (operator-controlled env, fail-fast at boot, no attacker path).

## Consolidated findings

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| F-1 | should-fix | code (+compliance counter-assessment) | `apps/api/src/auth/users.service.ts:34-44` | open, non-blocking | `getUserRefs` gold-plating: unconsumed, untested, beyond the singular pin. Code: delete. Compliance: lean-acceptable (plural read models, boundary preserved). User decides. |
| F-2 | should-fix | code | `apps/api/src/auth/session.service.ts:62-69` | open, non-blocking | resolve()/revoke() race → Prisma **P2025** (lead-verified; reviewer wrote P2005) → `500 INTERNAL` instead of `401`. Latent; TKT-accounts-002 wires logout to `revoke()`. |
| F-3 | should-fix | code (+security note) | whole suite (`/api/auth/me` coverage) | open, non-blocking | Guard rejection paths (no cookie / garbage / expired) have zero coverage; behavior live-verified correct. |
| F-4 | should-fix | code | `apps/api/test/integration/tc-acc-001-register-session.spec.ts:38` | open, non-blocking | Cookie attributes (HttpOnly/Secure/SameSite/Path/Max-Age) never asserted though the harness exists to assert them; behavior live-verified correct. |
| F-5 | should-fix | code | `apps/api/test/integration/tc-acc-020-password-hash-stored.spec.ts:30-33` | open, non-blocking | `PasswordHasher` config-wiring seam untested; decode stored hash and assert m/t/p. |
| F-6 | medium | security | `apps/api/src/auth/auth.service.ts:105-107` | open, non-blocking | Login timing side channel (unknown email skips Argon2id; measured 5–16 ms vs 52–81 ms) defeats 03 §2 "no enumeration on login"; throttle in TKT-accounts-002 does not mitigate; one-line dummy-hash fix. |
| F-7 | nit | code | `apps/api/src/auth/session.service.ts:38-40` vs `auth.constants.ts:11` | open | 30-day-ms constant recomputed in `expiryFrom` instead of importing `SESSION_TTL_MS`. |
| F-8 | nit | code + compliance | `tc-acc-004…spec.ts:79-86` + ticket record line 27 | open | DEVIATION-2 prose overgeneralizes rows i–l (only row i → 400; j/k skip; l → 401) and the `[400, 401]` assertion is looser than claimed. |
| F-9 | nit | code | `apps/api/src/auth/password.ts:15` | open | Dead export `ARGON2ID_ALGORITHM`. |
| F-10 | nit | compliance | `apps/api/src/auth/auth.module.ts:29` | open | `SessionService` exported with no consumer in this diff (plausibly for the arch §10 owner CLI); zero behavioral impact. |
| F-11 | info | security | `session.service.ts` | open | Expired session rows never deleted (hygiene). |
| F-12 | info | security | register route | open | Register unthrottled by explicit contract (03 §4); ~19 MiB/~100 ms per attempt — recorded under NFR-ACC-002. |
| F-13 | info | security | `apps/api/src/config/env.ts` (`readPositiveInt`) | open | `ARGON2_*` env has no upper bound (operator-controlled, fail-fast, no attacker path). |

Upstream routings (outside the loop, for the planner): **R-1** ticket-scope contradiction re login (root cause of DEVIATION-1); **R-2** TC-ACC-004's unsatisfiable "→ 401" wording (root cause of DEVIATION-2's 400 nuance).

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; R-1/R-2 are planning defects routed upstream, not PR violations.
- Code: zero findings at the blocker tier (5 should-fix, 4 nits — should-fix is not the blocker tier; the reviewer assigned no "must fix before merge" severity).
- Security: zero critical/high (1 medium — below the critical/high blocking threshold).

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings and upstream routings, and the loop's fixed sequence ends on a clean pass). The two request-changes verdicts carry no blocking-severity findings; they are recorded verbatim above and surfaced to the user with the reviewers' recommendations — the user (merge authority) may waive, defer to TKT-accounts-002, or route the should-fix items to the fixer before merging.

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel, zero open blocking findings → **MERGEABLE**. Loop ends early; passes 2–3 and both fix rounds unused.
- User action requested: merge PR #10 (via the orchestrator, per the dispatch contract — the review lead does not merge). After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking items for the next owner (TKT-accounts-002 or a pre-merge fixer pass, user's call): F-1…F-6 (should-fix/medium), F-7…F-13 (nits/info), R-1/R-2 (planner).

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user. This artifact is committed to the PR branch (gitignored `reviews/` dir force-added per the f-004/f-005/f-006/PR-0009 pattern) so the review history lands in `dev` with the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).
