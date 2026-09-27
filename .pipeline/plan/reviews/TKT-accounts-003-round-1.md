# Review Round 1 — PR #12 (TKT-accounts-003: Password change & owner reset CLI)

PR: https://github.com/sarperim/settleup/pull/12
Branch: `tkt-accounts-003` → `dev` · Head at review: `2cd2eaa` · Base: `dfa0cb9` (= `origin/dev` tip; merge-base verified)
Review date: 2026-09-27
Isolated checkout: `/tmp/opencode/settleup/review-TKT-accounts-003` — branch `review/tkt-accounts-003` at `2cd2eaa` (same commit as the PR head). Tree clean at review start and at every gate; reviewer DBs (`settleup_review_c` / `_k` / `_s`) truncated to zero rows after the lanes finished (lead-verified); the lead used `settleup_test` for unit+integration and `settleup_e2e` for the e2e phase; no probe servers left listening (lead-verified).

Scope context: third domain ticket of Accounts & Access — `POST /api/auth/password` (current-password verify, 8–128 policy, DTO-precedes-service precedence, Argon2id hash rotation, all-other-sessions delete in one transaction per D-ARCH-002), the owner reset CLI `dist/scripts/set-password.js` (non-interactive piped stdin, hash write + **all**-session delete in one transaction, no HTTP surface), the system spec for TC-ACC-028 wired into the e2e phase, and the carried-over K-2/S-2 fix (`SessionService.resolve()` P2025 → null), per `.pipeline/plan/tickets/TKT-accounts-003.md`.

Environment note: three reviewer sessions — `compliance-reviewer`, `code-reviewer`, `security-reviewer` — dispatched concurrently via `opencode run` against this checkout, each with its own provisioned PostgreSQL (`settleup_review_c` / `_k` / `_s`; migrations applied; the lead used `settleup_test` + `settleup_e2e`). Local `psql` client absent (WSL quirk); the established node shim (`PSQL` override honored by `scripts/e2e-db.mjs`) was used for the lead's e2e-phase gate. Every claim in the ticket's implementation record was re-verified; nothing was trusted. Full lane reports preserved at `/tmp/opencode/r12-review-r1/{compliance,code,security}-report.md`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff ships executable auth logic: 4 source files under `apps/api/src/auth/**` modified/added plus the new 108-line CLI script `apps/api/src/scripts/set-password.ts`; 6 new spec files; a new root runner config `vitest.system.config.ts`; root `package.json` scripts. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- Auth/session/credential code is exactly the class the security lane exists for (password verification, session invalidation, a CLI that writes credential hashes).
- The ticket pins automated acceptance TCs (TC-ACC-010…013, 028, 035) — the compliance lane must verify them.

## Scope fence (allowed set) — verified held (lead + compliance lane, independently)

`git diff --name-status origin/dev...HEAD`: exactly 15 files, no renames, no mode changes (+824/−7):

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-accounts-003.md` | status `todo`→`in-review`, PR line, implementation record (verified strictly additive; nothing prior altered) |
| `apps/api/src/auth/**` | `auth.controller.ts` (+`POST /password`), `auth.service.ts` (+`changePassword`), `dto/change-password.dto.ts` (new), `session.service.ts` (K-2/S-2 P2025 fix — in the ticket's `apps/api/src/auth/**` scope) |
| `apps/api/src/scripts/set-password.ts` | new — the ticket's "create" bullet |
| `apps/api/test/integration/**` | 5 new specs `tc-acc-{010,011,012,013,035}-*.spec.ts` |
| `apps/api/test/system/**` | new `tc-acc-028-owner-reset-cli.spec.ts` + `support/setup-env.ts` — the ticket's "under `apps/api/test/system/**`" bullet |
| root `package.json` | runner composition only (adjudicated below) |
| root `vitest.system.config.ts` | new — runner-composition infrastructure (adjudicated below) |

**Zero changes** to `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, `.github/workflows/ci.yml`, `pnpm-lock.yaml` (verified by direct diff query — empty; lockfile byte-identical). No new dependencies. No pre-existing spec or source file modified — nothing could have been weakened or deleted. The must-NOT-touch list holds exactly.

**Runner-composition exception — adjudicated WITHIN the ticket's allowance** (ticket line 10: "runner composition only if unavoidable — no dependency changes"):

- **Unavoidable: yes.** Ticket bullet 3 itself mandates "`pnpm test:e2e` runs it post-build against `E2E_DATABASE_URL`", and `test:e2e` is a root script by the root-script contract (04-ci-pipeline.md §3). Wiring the system spec into the e2e phase cannot be done without editing root `package.json`. The exception is exercised for exactly this and nothing else (one hunk, scripts block only).
- **No dependency changes: confirmed** (devDependencies untouched; lockfile 0-line diff).
- **CI step-3 contract preserved:** the system project is not in `vitest.config.ts`; the compliance lane's `pnpm test` run collected **39** files (not 40) — the system spec is provably absent from `pnpm test`. `test:e2e` retains its 04 §3 must-do sequence (e2e DB → Playwright against `E2E_DATABASE_URL` on the built app) with `test:system` inserted after `e2e-db` and before Playwright, exactly as bullet 3 authorizes ("extend the e2e-phase runner composition").
- **Root `vitest.system.config.ts`** judged part of the runner composition: root-level test infrastructure per 04 §3, mirroring the existing root `vitest.config.ts` (same SWC transform and decorator-metadata rationale), and the minimal mechanism to keep the system project out of CI step 3.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking findings |
|------|---------|-------------------|
| compliance | **CLEAN** (compliant) | 0 violations · 1 nit · 3 observations (2 routed upstream) |
| code | **APPROVE** | **0 blockers** · 0 should-fix · 3 nits |
| security | **APPROVE** | **0 critical/high** · 1 medium · 4 info |

## Baseline gates (review-lead run, from scratch in the isolated worktree)

- `pnpm install --frozen-lockfile` — exit 0. `pnpm --filter api exec prisma generate` — exit 0 (fresh-worktree prerequisite; CI provides it).
- `DATABASE_URL=postgresql://settleup:settleup@127.0.0.1:5432/settleup_test pnpm test` — **`Test Files 39 passed (39)`, `Tests 113 passed (113)`, exit 0** (34.11 s) — matches the ticket's claim exactly (baseline arithmetic verified by the code and compliance lanes: 34/105 at merge-base + 5 files/+8 tests = 39/113; the system spec's +1/+1 runs only in the e2e phase).
- `pnpm lint` — exit 0. `pnpm typecheck` — exit 0. `pnpm build` — exit 0; **`apps/api/dist/scripts/set-password.js` emitted** (+ `.d.ts` + maps; CommonJS, `require.main === module` intact).
- `E2E_DATABASE_URL=…settleup_e2e PSQL=<node shim> pnpm test:e2e` — **exit 0**: e2e-db (database exists, migrations applied) → `pnpm test:system` **1/1 passed** (drove the built CLI against `E2E_DATABASE_URL`) → Playwright chromium spa-canary **1 passed** (358 ms).
- CI on head `2cd2eaa`: run [36295235648](https://github.com/sarperim/settleup/actions/runs/36295235648) "Lint, test & build" **SUCCESS** (verified by the lead via `gh`).
- All three reviewer sessions independently ran the suite green (39/113, exit 0) plus `pnpm test:system` (1/1) against their own databases. The security reviewer additionally live-probed the built artifact: HTTP authN/CSRF/403/401/400/204 envelopes, log hygiene at debug level (0 secret-bearing lines), CLI edge paths (9/9 probes incl. missing env, unknown email, CRLF, newline equivalence, 129-char), a deterministic P2025 probe of `resolve()`, and the S3-1 eviction-race demonstration; the code reviewer probed P2025 semantics against real Prisma 6.19.3, the constructibility of `PrismaClientKnownRequestError` for spy-based tests, and CLI edge behavior (9/9); the compliance reviewer verified the setup-env fail-fast and the build-emission chain (`nest-cli.json` → `dist/scripts/`). Reviewer DBs truncated to zero afterwards (lead-verified); probe scripts preserved under `/tmp/opencode/` for reproduction.

## Compliance lane (summary)

- **TC coverage:** all six acceptance TCs present and faithfully translated — TC-ACC-010 (204 + empty body + old dead + new works + id + Set-Cookie), 011 (`400 INVALID_CURRENT_PASSWORD` + nothing changed, both directions), 012 (cookie A survives 200 / cookie B dead 401 `UNAUTHENTICATED` — both discriminators of the deleteMany predicate), 013 (7/8/128/129 boundary rows with `VALIDATION_FAILED` pinned on the 400s), 028 (genuinely **system level**: built-artifact existence asserted, `spawn(process.execPath, [CLI_PATH, email])` with `password-cli-1\n` piped to stdin, exit 0 + empty stderr + direct-DB session count 0 + new password 200 + old password 401 + pre-CLI cookie 401), 035 (`VALIDATION_FAILED` wins over wrong-current; old password still live). No `.skip`/`.only`/`.todo`/commented-out expects; every new spec truncates all tables and resets the login throttle in `beforeEach`.
- **CLI contract per the amended §10 runbook:** `node dist/scripts/set-password.js <email>`; whole-stdin read with exactly one trailing newline stripped; 8–128 enforced; `loadEnv` (fail-fast, names the missing variable; pinned Argon2id defaults); one `$transaction`: hash write + `deleteMany` of **all** the account's sessions; no HTTP surface; email/password never logged (all output messages verified generic).
- **Architecture adherence:** D-ARCH-002/§8.1 (all-except-acting delete in one transaction, acting row identified by the same hash function the guard resolved), D-ARCH-003/03 §2 (8–128 with bounds imported from `register.dto.ts`; `currentPassword` only required — legacy passwords must still authenticate), 03 §4 precedence (DTO validation precedes the service check, pinned live by TC-ACC-035), 02 §4 (no schema change needed; prisma tree untouched). **No gold-plating.**
- **Implementation record:** faithful to the diff on every checked claim.

## Code lane (summary)

Verified correct, on record: transaction atomicity and ordering on both write paths (Argon2 hashing outside the transaction; `user.update` + scoped `deleteMany` commit or roll back together); acting-session identification via the identical `hashSessionToken` the guard/issue path use (cannot kill the acting row, cannot spare another); defensive 401 on vanished user; Nest lifecycle order guarantees the TC-ACC-035 precedence (CSRF → guard → pipe → handler); `readAllStdin` decodes UTF-8 once after concat (no split-multibyte corruption); `stripTrailingNewline` strips exactly one `\r?\n` (9/9 edge probes); `process.exitCode = 1` (not `process.exit`) so streams flush; standalone `PrismaClient` + `$disconnect` in `finally` is the right script shape; runner pick-up verified clean in **both** directions (`pnpm test` = 39 files, no system; `pnpm test:system` = 1 file, no integration); e2e-chain ordering safe (sequential `&&`; system truncates before Playwright seeds); spec determinism, isolation, and assertion strength; baseline arithmetic; no dead code; comments match behavior.

**K-2/S-2 fix verification (required): fix is real and correct** — all three lanes agree. `Prisma` namespace import pre-exists; the `isMissingRecord` predicate matches real Prisma 6.19.3 behavior (empirically reproduced: update-on-deleted-row → `PrismaClientKnownRequestError` code `P2025`); the try wraps only the `update`, so the catch cannot swallow anything else; every non-P2025 error rethrows (security lane probed this direction too); sequential contract unchanged (update-on-live-row still succeeds); fails closed in every direction — `null` is the unauthenticated outcome, so the fix can never resurrect access. This PR's write paths (`deleteMany` in `changePassword` and in the CLI) are exactly the concurrent deleters that make the race reachable — the fix is load-bearing here.

**No-dedicated-concurrency-test adjudication (three lanes):** defensible and non-blocking, with one accuracy correction on record. No acceptance TC requires a concurrency test; the prior round's 43/320 reproduction was synthetic and unfit as a deterministic CI gate; a probabilistic stress test would be flaky and prove nothing the sequential specs don't. The coder's justification is **partly inaccurate**: a deterministic spy-based regression guard for the catch branch is feasible with zero production hooks (`new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: 'test' })` is constructible in a spec — verified in this tree; `vi.spyOn(ctx.prisma.session, 'update').mockRejectedValueOnce(err)` → assert `resolve()` → `null`). Omission recorded as **nit K3-2**, not should-fix: the branch is five lines, verified correct by this review, and the regression consequence is the original low-severity, fails-closed, session-owner-only bug.

## Security lane (summary)

Verified clean, with live probes against the built artifact: `POST /api/auth/password` correctly fenced (global AuthGuard — no cookie → 401; CSRF — missing header → `403 CSRF_HEADER_MISSING`; `userId` from the guard-resolved context, never client input — no IDOR); the current-password gate is unconditional and precedes any write; the acting-session filter is not bypassable (SHA-256 preimage; empty token → defensive throw → unfiltered delete impossible; if the acting row is gone mid-flight the deleteMany removes *all* rows — fail-closed); the CLI deletes with no sparing filter (3→0 verified) and never leaks the password (stdin-only, never argv, zero occurrences in captured debug-level logs across the whole change flow; CLI `fail()` messages generic; Prisma error output masks credentials — marker secret appeared 0 times); Argon2id params identical to the app path (decoded `argon2id, m=19456, t=2, p=1` — NFR-ACC-001); `400 INVALID_CURRENT_PASSWORD` is not an enumeration oracle (route is authenticated — the caller is by definition the account owner; no `details`); response shapes exact (204 empty, no Set-Cookie on success); no new dependencies, no committed keys; `vitest.system.config.ts` weakens nothing.

**S3-1 (medium, non-blocking) — the one substantive finding:** an old-password login racing the password change (or the owner CLI) survives the D-ARCH-002 eviction. The login path verifies against a pre-change snapshot read, then inserts its session *after* the change's `deleteMany` has run — the new row is never covered by the revocation. Demonstrated against the PR head with the real dist services: change-first, old-password login at +40 ms → **4/6** rounds left a post-change session alive; +60 ms → **6/6**; +80 ms fails as expected. The surviving session is a normal 30-day sliding session — persistence through the recovery action, which D-ARCH-002 exists to prevent. **Why medium, not high:** the precondition is full compromise of the current password — at that point the account is already fully controlled; the race only buys persistence through the reset. Fix options (any one): CAS-guard the login issuance against the verified hash, a `passwordVersion` column bumped by both writers and checked in `resolve()`, or `SELECT … FOR UPDATE` across login's verify+issue. Recommended routing: follow-up hardening ticket; the user decides.

## Consolidated findings

IDs scoped to this PR/round (prior-round IDs referenced explicitly where carried).

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| S3-1 | medium (non-blocking) | security | `auth.service.ts:201-206` racing `auth.service.ts:134-149`; same window in `set-password.ts:93-101` | open, non-blocking | Old-password login racing the change/CLI survives the session invalidation (4–6/6 demonstrated; requires full credential compromise). Fix: CAS-guard issuance / `passwordVersion` / row lock. Route to follow-up hardening ticket — user's call. |
| K3-1 | nit | code | `set-password.ts:25-27` | open | CLI duplicates the 8–128 policy bounds instead of importing `PASSWORD_MIN/MAX_LENGTH` from `register.dto.ts` (importable in the emitted CJS). Drift would hit the recovery path first. |
| K3-2 | nit | code | `session.service.ts:85-95` | open | The P2025→null branch has no automated regression guard; a deterministic spy-based spec is feasible without production hooks (coder's justification partly inaccurate — recorded). Fix verified correct by this review; omission non-blocking. |
| K3-3 | nit | code | `tc-acc-028-owner-reset-cli.spec.ts:69-85` | open | `runSetPasswordCli` lacks an `error` listener on `child.stdin` (EPIPE → uncaught exception instead of clean test failure). Unreachable as written; harden the template for future system specs. |
| C3-1 | nit | compliance | `tc-acc-028-owner-reset-cli.spec.ts` step-2 block | open | TC-ACC-028 expected cell 2 asserts `200` + `user.id` but not the `settleup_session` Set-Cookie (tc-acc-010's identical cell does). Coverage intact suite-wide; one-line strengthening for a later pass. |
| S3-2 | info | security | `auth.service.ts:186-196` (routed by code lane) | open | `POST /api/auth/password` is an unthrottled Argon2id verify oracle for the acting user's current password (stolen-cookie scenario). Contract-conformant — the amended §8.2 throttle is login-endpoint-only; ~20 attempts/s vs ≥8-char policy not practically viable. Optional hardening alongside S3-1. |
| S3-3 | info | security | `auth.service.ts:190-196` | closed (adjudicated clean) | `INVALID_CURRENT_PASSWORD` vs login's `INVALID_CREDENTIALS` — not an enumeration oracle (route is authenticated). No fix. |
| S3-4 | info | security | `set-password.ts:32-38` | open | CLI stdin read unbounded before the length check — owner-run tool, self-DoS only. Optional: reject > ~1 KiB early. |
| S3-5 | info | security | `set-password.ts:103-106` | closed (adjudicated clean) | Prisma failure output on CLI errors includes local path/code frame but masks credentials (marker probe: 0 occurrences). Operator-local stderr only. No fix. |
| C3-2 | observation | compliance | `accounts-access.md:183` | routed upstream (R3-1) | TC-ACC-014 (CSRF enumeration incl. `POST /api/auth/password`) names a now-live route but has no owning automated spec anywhere. Not this PR's acceptance list — planner to assign an owner. |
| C3-3 | observation | compliance | `00-test-strategy.md` §2, `04-ci-pipeline.md` §3 | routed upstream (R3-2) | Permanent docs word the e2e phase as "Playwright" only; the Vitest system project now runs there too (sanctioned by TC-ACC-028's own entry + 99-matrix + ticket bullet 3). Substance consistent; docs could name it explicitly. |
| C3-4 | observation | compliance | `session.service.ts:85-95` | open (same subject as K3-2) | The P2025 branch is structurally verified but unexercised by automated tests — accepted risk, consistent with the prior round's should-fix/low disposition, now fixed. |

Upstream routings (outside the loop, for the planner/test-planner): **R3-1** — TC-ACC-014's automation ownership (the CSRF enumeration now includes this PR's route). **R3-2** — permanent-doc wording for the system project in the e2e phase. The security lane's S3-1 fix recommendation (follow-up hardening ticket) is recorded above for the user — it is a code-level item, not a planning defect, so it stays a finding rather than a routing.

## Mergeability (pass 1)

Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**

- Compliance: **compliant** — zero violations; R3-1/R3-2 are planning/doc defects routed upstream, not PR violations.
- Code: zero findings at the blocker tier (0 should-fix, 3 nits).
- Security: zero critical/high (1 medium, 4 info — below the critical/high blocking threshold). K-2/S-2 from accounts-002 verified **fixed** by all three lanes.

**RESULT: MERGEABLE on pass 1 — the loop ends early on a clean pass. No fixer dispatch** (nothing blocking to fix; the open items are non-blocking quality findings, one medium hardening recommendation, and upstream routings, and the loop's fixed sequence ends on a clean pass). Same adjudication as the accounts-001/002 round-1 precedents: open non-blocking items are surfaced to the user, who may waive, defer to a later ticket, or route a pre-merge fixer pass.

## Loop status

- Pass 1 (this round): all three lanes dispatched in parallel, zero open blocking findings → **MERGEABLE**. Loop ends early; passes 2–3 and both fix rounds unused.
- User action requested: merge PR #12 (via the orchestrator, per the dispatch contract — the review lead does not merge). After merge confirmation, the ticket's status moves to `done` and the board can be regenerated.
- Open non-blocking items for the next owner (user's call: pre-merge fixer pass, follow-up ticket, or waive): **S3-1** (medium — login/change eviction race; recommended follow-up hardening ticket with the three fix options), K3-1, K3-2/C3-4, K3-3, C3-1, S3-2, S3-4; R3-1/R3-2 (planner/test-planner).
- Carried context from prior rounds (still open, still not this PR's responsibility): accounts-002's K-1, S-1, S-3, S-4, K-3…K-8, C-1…C-3, R-3/R-4 — except **K-2/S-2, now verified fixed in this PR**.

Ticket status remains `in-review` — the merge decision and the `done` transition belong to the user/orchestrator. This artifact is committed to the PR branch so the review history lands in `dev` with the merge; the PR head moves forward by this docs-only commit and CI re-runs on it (expected green — touches only `.pipeline/plan/`).
