# Acceptance Report — Settle Up

Phase verdicts: **Foundation — ACCEPTED** (2026-09-27, §II below) · **Accounts & Access — ACCEPTED** (2026-09-27, §I below). No red tests in either phase, no missing due TCs, no scope creep, no weakened test case, no dropped routed flag in the accounts phase. **Post-verdict (accounts): F-A1 deferred by user decision (not MVP-relevant); F-A4 fixed via PR #15 (review clean pass 1, merged `8f8d6a0`, re-verified 48/169 ×2) — see §I.9.**

---

# I. Accounts & Access Domain Acceptance (TKT-accounts-001…005)

**Verdict: ACCEPTED** for the Accounts & Access domain — all five tickets verified together on the merged state, as the user requested (per-PR review loops had already closed clean individually; this pass owns the cross-ticket and domain-boundary verification). No red tests, no missing due TCs, no extra test falsely claiming a TC ID, no unmet ticket acceptance criterion, no scope violation across the five PRs. Open items are carried findings and recorded non-blocking follow-ups (§I.7) — none blocks the domain.

- **Scope:** domain acceptance of the 5 accounts tickets (all `done`, PRs #10–#14 → dev, 2026-09-27). This is **not** project acceptance — 22 of 34 tickets are `todo`; SCs depending on groups/expenses/balances remain pending by design.
- **Verified ref:** `dev` @ `d8d6165` (2026-09-27), clean worktree, synced with `origin/dev`. All five merge commits (`76b1e70` #10, `20e09f8` #11, `85d7ecf` #12, `1b9ad0f` #13, `25efe16` #14) are ancestors of this ref. `dev` is this repo's integration trunk per USER-DECISION-3 (`master` intentionally lags until MVP release); all five PRs' merge-ref CI runs are green (runs 36292324720 / 36294479101 / 36296513417 / 36299128966 / 36300007776).
- **Verifier:** acceptance agent (independent re-execution; no code or documents modified except this report).
- **Environment note:** local runs on Node 22.22.0 / pnpm 10.34.5 against PostgreSQL 17.11 (repo pins `engines >=24`; CI runs Node 24 and is green on every PR) — same recorded precedent as every prior local verification (foundation F-8, informational).

## 1. Environment & full-suite results (independent, on dev @ d8d6165)

| Check | Command | Result |
|---|---|---|
| Frozen install | `pnpm install --frozen-lockfile` | ✅ exit 0 |
| Prisma client | `pnpm --filter api exec prisma generate` | ✅ exit 0 |
| Lint | `pnpm lint` | ✅ exit 0 (3 projects) |
| Typecheck | `pnpm typecheck` | ✅ exit 0 (3 projects) |
| Migrations (fresh throwaway DB `settleup_acc_phase`) | `prisma migrate deploy` | ✅ 8 tables applied cleanly |
| Unit + integration | `DATABASE_URL=… pnpm test` — **run twice consecutively** | ✅ **43 files / 125 tests passed, both runs** (foundation baseline 16/74 → accounts added 27 integration files + 1 unit file, 51 tests; arithmetic reconciles with every ticket's claim: 23/93 → 34/105 → 39/113 → 43/125) |
| DB-unset guard | `pnpm test` with `DATABASE_URL` unset | ✅ unit 74/74 pass; integration fails with "The integration test project requires DATABASE_URL."; ELIFECYCLE non-zero — the guard now fires even under `vitest list` (incidentally re-proven) |
| Build | `pnpm build` | ✅ shared → api → web; SPA bundle **86.81 kB gzip** (≤ 300 KB budget, matches acc-005's claim); `dist/scripts/set-password.js` emitted |
| E2E phase (fresh `settleup_e2e`) | drop DB → `E2E_DATABASE_URL=… pnpm test:e2e` | ✅ full chain in one command: e2e-db create+migrate → **system 1/1** (TC-ACC-028 against the built CLI) → Playwright **6/6** (TC-ACC-023/024/025/026/027 + spa-canary) |
| Web mechanism suite | `pnpm --filter web test` | ✅ **5 files / 44 tests** (matches acc-005's claim; still outside root runner & CI — finding F-A4) |
| CI (GitHub Actions, Node 24) | all five PR merge refs | ✅ every run green, step-level verified via `gh` |

## 2. Ticket acceptance verification (all 5 `done`)

**TKT-accounts-001 (registration & session establishment)** — acceptance TC-ACC-001/002/003/004/019/020/034 ✅ all green (specs verified line-by-line against the plan: 004's full 12-row table a–l with exact inputs/bounds, 019's decoded argon2id m=19456/t=2/p=1, 034's DTO-precedes-uniqueness). DEVIATION-1 (minimal login — required by its own TCs) and DEVIATION-2 (row-count observation; rows i–l login latitude) documented in-ticket and adjudicated compliant in round 1. Must-NOT-touch held (PR file list: only `apps/api/src/auth/**` + `app.module.ts` wiring + test files; no web/shared/prisma/lockfile). PR #10 → dev.

**TKT-accounts-002 (login, throttle & logout)** — acceptance TC-ACC-005/006/007/008/009/016/017/030/031/032/033 ✅ all green (031's five steps exact incl. no-`details`/no-`Retry-After`/no-cookie on 429; 032's two keying scenarios; 033's reset semantics; 007 byte-identical bodies + the F-6 spy). Throttle §8.2 semantics implemented per the amendment; required testability hook (`IntegrationApp.resetLoginThrottle()`) present and used by all specs that touch login. **F-6 (timing side channel) closed here and empirically verified** by the review (unknown vs existing email statistically indistinguishable, Mann-Whitney p=0.44; contrast arm resolves the measurement). D-3 (TC-ACC-008 step 3 → landed protected surface; `GET /api/groups` 404s while C3 is absent) and D-4 (TC-ACC-017 sequence) documented, adjudicated, routed (R-3/R-4). PR #11 → dev.

**TKT-accounts-003 (password change & owner reset CLI)** — acceptance TC-ACC-010/011/012/013/028/035 ✅ all green (012's both deleteMany discriminators; 028 genuinely system-level: built-artifact existence asserted, `spawn` of `dist/scripts/set-password.js` with piped stdin, exit 0, direct-DB session count 0, new password 200, old 401, pre-CLI cookie 401 — stronger than the plan's HTTP-only observation). **K-2/S-2 (P2025 race → 500) fixed here** and verified by all three review lanes (fails closed to 401). Runner-composition exception used exactly as pre-adjudicated: root `package.json` diff is precisely `test:system` + its insertion into `test:e2e` (2 lines); `pnpm-lock.yaml` and frozen `ci.yml` byte-identical. System project correctly outside `vitest.config.ts` (CI step 3 unchanged: unit+integration only). PR #12 → dev.

**TKT-accounts-004 (cross-route contract specs)** — acceptance TC-ACC-014/021/022/029 ✅ all green (014: all four routes with per-route no-side-effect DB-level proofs; 021: non-vacuous capture at the pino destination with the literal `Sup3r-Secret-Pw-9x`; 022: all six triggers with the full §4 envelope assertion; 029: six-step lifecycle with id/email/displayName re-asserted at every step + final row check). Test-only as scoped — the defect-fix allowance went unused (zero `apps/api/src/**` changes). **R3-1 resolved here:** TC-ACC-014's ownership was this ticket's by plan-time assignment; the acc-003 flag was a sequencing artifact. Deferred TC-ACC-015/018 correctly absent. PR #13 → dev.

**TKT-accounts-005 (auth UI e2e)** — acceptance TC-ACC-023/024/025/026/027 ✅ all green (027 implements the T4 policy verbatim: median of 3, one retry on breach, ≤ 2.0 s gate; 026 asserts both the new-password success and the old-password rejection-with-error). D-1 (e2eIdentity namespacing — premise independently demonstrated: the chained system phase seeds `alice@test.local` into the shared e2e DB, so raw plan identities would 409), D-2 (TC-ACC-025 placeholder groupId while groups-004 is unlanded — circular dependency, routed P-3), D-3 (App.spec/canary rework) all documented and adjudicated; no plan assertion weakened. Scope: `apps/web/**` only. PR #14 → dev.

## 3. Coverage-matrix reconciliation (accounts scope, both directions)

- **Planned TCs due now: 33 of 35** (the domain owns all of TC-ACC-001…035 except the two cross-domain deferrals). **All 33 exist as automated specs, are faithful translations of the plan's steps and expected values (verified case-by-case against `accounts-access.md` §2 — routes, payloads, statuses, error codes, `details` shapes, boundary rows, parameterization tables), and pass** in the 125-test root run (49 accounts tests: 47 integration across 27 files + 2 unit), the system run (1), and Playwright (5). Parameterized structures match the plan exactly: TC-ACC-004 (12 rows), TC-ACC-013 (4 rows), TC-ACC-014 (4 routes), TC-ACC-022 (6 triggers).
- **Planned TCs not yet due: TC-ACC-015 and TC-ACC-018** — deferred at the domain gate to TKT-integ-001/002 per the Gate-4 ledger; both tickets carry them verbatim in scope and acceptance (verified in the ticket files). Not a finding — this is the phase boundary working as designed. No accounts artifact claims them.
- **Tests without planned TCs (extra-test direction):** three kinds, all legitimate and documented — (a) the F-6 deterministic spy companion inside `tc-acc-007` (verification of the closed timing-side-channel fix; the plan TC's own assertions unchanged); (b) the web mechanism suite, 44 tests (foundation-era mechanism specs, reworked under acc-005 DEVIATION-3 — coverage documented as changed: edit-expense route coverage dropped, finding F-A6); (c) the updated `spa-canary.spec.ts`. **None falsely claims a TC ID; no `.skip`/`.only`/`.todo` in any accounts spec** (verified by list + read).
- **Deviations ledger:** every deviation (acc-001 D-1/D-2, acc-002 D-3/D-4, acc-003 runner composition, acc-005 D-1/D-2/D-3) is documented in its ticket file and adjudicated in a tracked review artifact — none weakened a test case (confirmed by direct spec-vs-plan comparison, not by trusting the adjudications).

## 4. Cross-ticket integration & e2e (the "checked together" pass — my ownership)

- **P-3 parallel-merge integrity:** PRs #13/#14 merged 4 seconds apart; their file sets are **disjoint** (verified by direct PR file listing: #13 = `apps/api/test/**` + pipeline docs; #14 = `apps/web/**` + pipeline docs — zero intersection). GitHub CI never ran on the literal #13+#14 combined merge ref (#14's final run 36300007776 was created at ~09:24, before #13 merged at 09:27:44) — **informational, F-A3**: the combined state is instead proven by this acceptance run's full local re-execution on `d8d6165`, which contains both merges, and by the disjoint scopes. Every subsequent merge-ref CI run includes both.
- **Full-lifecycle composition across tickets:** TC-ACC-029 (integration) and TC-ACC-026 (e2e) drive register → login → change password → logout → re-login through the routes of tickets 001+002+003 in one flow, the latter through ticket 005's UI; TC-ACC-014/021/022 (ticket 004) assert the CSRF/envelope/log contracts across all four routes that tickets 001–003 landed. All green on the merged state.
- **e2e-phase runner composition (acc-003's change + acc-005's identity scheme):** the single `pnpm test:e2e` chain — fresh DB → system spec (TC-ACC-028, raw `alice@test.local`) → Playwright (namespaced identities) — runs green end-to-end; the DEVIATION-1 namespacing is exactly what makes the shared-DB chain viable (the review-lead demonstrated the raw-identity failure mode live; the collision premise verified).
- **Harness continuity:** the PR #9 decorator-metadata pin still passes in the 125 (DTO validation runs for real — the foundation F-1 risk did not materialize in the domain wave).

## 5. Success criteria status (project level)

| SC | Verification path (matrix §2) | Status at accounts exit |
|---|---|---|
| SC-001 | real-world adoption + TC-BAL-025 path | pending (domain) |
| SC-002 | TC-EXP-004/005/008 · TC-BAL-001…004 | pending (exp-001/bal-001, todo) |
| SC-003 | TC-EXP-028 | pending (exp-005, todo) |
| SC-004 | TC-ACC-027 · GRP-031 · EXP-032/033 · BAL-026 | **accounts share verified** — TC-ACC-027 green (all three auth pages ≤ 2.0 s under the T4 policy; SPA bundle 86.81 kB gzip ≤ 300 KB); remaining page families pending their domain e2e tickets |
| SC-005 | TC-EXP-023 + TC-BAL-016 | pending (domain) |
| SC-006 | TC-ACC-015 + TC-GRP-021 | pending (integ-001, todo — 21-endpoint matrix needs the full route table) |
| SC-007 | TC-BAL-025 | pending (bal-007, todo) |

No accounts artifact claims any SC as complete. Every SC retains a defined, approved verification path — no unverifiable SCs.

## 6. NFR verification status

| NFR | Method (matrix §5) | Status |
|---|---|---|
| NFR-ACC-001 | ACC-019/020/021/031/032/033 | **executed, green** — Argon2id params + hash-only storage + no password in logs + full throttle contract (window-expiry rollover excluded by design, L-3) |
| NFR-ACC-003 | ACC-027 ≤ 2 s (T4) | **executed, green** (+ bundle budget) — with the K-1 caveat that the gate times the `load` event, undercounting the protected page's bootstrap (recorded finding, below) |
| NFR-ACC-004 | ACC-029 + no-delete contract review | **executed, green** |
| NFR-ACC-002 | deployment review | not due (integ-003) |
| NFR-ACC-005 | GRP-024 scale fixture | not due (groups domain) |

No unexecuted-but-claimed NFRs. NFR-ACC-001's throttle translation is fully exercised modulo the accepted L-3 wall-clock limitation.

## 7. Findings (accounts phase)

| # | Type | Finding & evidence | Severity | Suggested routing |
|---|---|---|---|---|
| **F-A1** | open security follow-up (carried) | **S3-1 (acc-003 round 1):** an old-password login racing a password change / owner CLI reset can survive the D-ARCH-002 session eviction (demonstrated 4–6/6 against the built services; requires full credential compromise, hence medium/non-blocking). Three fix options on record (CAS-guard / passwordVersion / row lock). The single most substantive open code finding of the domain. **→ User decision (2026-09-27): not important for MVP — deferred.** No hardening ticket now; the race's precondition is full credential compromise (at which point the account is already lost), so the persistence-through-reset exposure is accepted for MVP. Revisit only if the deployment/threat model changes (e.g., public hosting beyond the friend group). | ~~Medium — decide hardening ticket~~ → Deferred (user decision, MVP scope) | ~~user → coder~~ |
| **F-A2** | open quality follow-ups (carried, recorded) | acc-002 K-1 (concurrent-burst throttle over-admission — sequential §8.2 contract exact); acc-004 K4-1/S4-2 + R4-3 (TC-ACC-021 doesn't drive `POST /api/auth/password`; pino `REDACTED_KEYS` lacks `currentPassword`/`newPassword` — a body-logging regression there would leak undetected); acc-005 K-2 (stale mount-`refresh()` race), K-1 (TC-ACC-027 gates on `load`, excluding the `/auth/me` bootstrap — NFR-ACC-003 undercounted for the protected page), S-1/S-2 (maxLength truncation asymmetry; failed-logout UI state). All cheap, all on record in tracked round artifacts. | Low–medium | user / coder (batch with next auth touch) |
| **F-A3** | parallel-merge CI gap (observation, mitigated) | The literal #13+#14 combined merge ref never ran on GitHub CI (PR #14's final run started before #13 merged; PRs merged 4 s apart). Mitigated: verified-disjoint file scopes + this acceptance run's full local re-execution of the combined state on `d8d6165`. Every later run includes both. No action needed; recorded because "CI green on the merge" is claimed per-PR, not per-combination, for P-3. | Info | none |
| **F-A4** | ungated tests (carried foundation F-4, 4th consecutive phase, scope grew) | The web mechanism suite — now 44 tests including acc-005's reworked `App.spec.tsx` route-coverage specs — was outside root `pnpm test` and outside CI (`ci.yml` runs `pnpm test` and `pnpm test:e2e` only). They passed when run manually. acc-005 made these specs more valuable (they are the only route-wiring coverage for the SPA), which raises the stakes of the gap. **→ RESOLVED (fixed, post-verdict):** user-directed fix via **PR #15** — a third `web-unit` project in root `vitest.config.ts` (node environment, project-scoped `shared` source alias mirroring apps/web's own vite config; no new dependencies, jsdom-free — the specs are DOM-free) so the existing CI step `pnpm test` executes them. Frozen `ci.yml` and `pnpm-lock.yaml` byte-identical; the 5 spec files' content unchanged. Review-lead: **all three lanes CLEAN, mergeable pass 1** (artifact `reviews/PR-0015-fa4-web-unit-gating-round-1.md`, commit `784a8ce`); gate proof independently reproduced in both directions (pre-fix, a mutated web spec left root `pnpm test` green — the gap demonstrated; post-fix, the same mutation fails, exit 1); CI on the final head (run 36303707808) executes **48 files / 169 tests on Node 24**. Merged at `8f8d6a0` (2026-09-27); addendum recorded in TKT-foundation-006 (PR #9 precedent). Acceptance re-verification on the merged state: **48 files / 169 tests, two consecutive green runs**. | ~~Medium~~ → Resolved | ~~test-planner~~ |
| **F-A5** | route-coverage regression in ungated specs (carried acc-005 K-3/C-1) | The App.spec rework dropped all edit-expense route coverage (and downgraded `/`, addExpense, join to loading-only assertions). No shipped-code defect (wiring correct today); lands naturally with TKT-exp-005/006. Compounds F-A4 since the dropped coverage is itself ungated. | Low | coder (with exp-005/006) |
| **F-A6** | planner routings pending action (recorded, not dropped) | Eleven plan-level routings from the accounts reviews — R-1/R-2 (acc-001), R-3/R-4 (acc-002), R3-2 (acc-003), R4-1/R4-2 (acc-004), P-1/P-2/P-3 (acc-005), plus the standing C-4 e2e-identity decision — are recorded with substance in **tracked** review artifacts and aggregated in the (gitignored, regenerable) run-report. Verified: **no routing exists only in an untracked file** — the foundation F-1 dropped-flag failure mode did not recur. But none has been planner-acted-on yet; the next `/run` or doc pass should consume them (several amend `accounts-access.md` TC wording). | Low — process | planner / test-planner |
| **F-A7** | foundation findings still open (cross-reference) | F-2/F-3 (f-003 round-1 artifact reference; review-artifact retention for the six untracked foundation-era artifacts — the twelve later artifacts incl. all five accounts rounds are tracked), F-5 (lint/typecheck globs), F-7/F-9 (architect doc amendments). Unchanged by this phase; still awaiting their routed owners. | Info | user / planner / architect |

## 8. Checks performed (summary)

Environment (clean/synced/ancestry of all 5 merges; PR states + per-PR CI runs) · full local CI-equivalent sequence (11 checks, all green) · twice-consecutive test runs · DB-unset guard (incl. incidental `vitest list` proof) · fresh-DB migration · fresh-e2e-DB full `test:e2e` chain (system + Playwright) · web mechanism suite · build + bundle budget + CLI artifact emission · line-by-line verification of all 33 due TC specs against the plan · both-direction matrix reconciliation incl. parameterized-row counts · per-PR must-NOT-touch audits (file lists + the acc-003 `package.json` diff = exactly the 2 adjudicated script lines; lockfile/`ci.yml` byte-identical) · P-3 disjointness + combined-state verification · deferred-TC ownership check (integ-001/002 ticket files) · deviation ledger cross-check (ticket ↔ review artifact ↔ spec reality) · routings ledger existence-and-tracking audit · review-artifact git-tracking audit · open-findings carry-forward from all five round artifacts.

**Bottom line:** the Accounts & Access domain is done and verifiably so — every due TC is a faithful, passing translation of the approved plan; the five merged PRs compose correctly on `dev`; the harness, runner contract, and CI all held; and the phase's open items are recorded, routed, and none blocking. Accept the domain. Decide F-A1 (S3-1 hardening) as owner; F-A4 (ungated web specs) is the one structural gap worth fixing before the groups UI wave multiplies it.

## 9. Post-verdict record (2026-09-27)

- **User decision on F-A1 (S3-1 hardening):** "not important for MVP" — deferred, no hardening ticket. Rationale recorded in the F-A1 row: the race's precondition is full credential compromise (at which point the account is already lost), so persistence-through-reset is accepted for MVP; revisit only if the deployment/threat model changes.
- **F-A4 fixed (user-directed "dispatch the coder → review-lead" loop):** coder dispatch → **PR #15** (`fix/fa4-web-unit-gating`, worktree `/tmp/opencode/settleup/fix-fa4`) — third `web-unit` project in root `vitest.config.ts`; gap proof (pre-fix mutation left root `pnpm test` green) and gate proof (post-fix, exit 1) captured; full local sequence green, **48 files / 169 tests ×2**; DB-unset guard intact; e2e chain green; frozen `ci.yml`/lockfile byte-identical; spec contents untouched; addendum in TKT-foundation-006 (PR #9 precedent). Review-lead dispatch → **MERGEABLE, clean pass 1, all three lanes CLEAN, zero blocking findings** (artifact `reviews/PR-0015-fa4-web-unit-gating-round-1.md` committed to the PR branch at `784a8ce`; two info notes: R-1 uncommitted-report reference — self-resolved by this commit; R-2 dual-runner note). CI green on both PR heads (runs 36302837051, 36303707808 — the latter executes 48/169 on Node 24). **Merged at `8f8d6a0`** under the user's "ok merge it". Acceptance re-verification on merged dev: `pnpm test` **48/169 green, two consecutive runs**. F-A4 closed; the carried foundation F-4 line ends here (4 phases).
- **Still open after this record:** F-A2 (six cheap quality follow-ups — batch recommendation given to the user: items 2+5 first, item 4 rides the groups/expense timing TCs, 1/3/6 with the next auth touch), F-A3 (info only), F-A5 (with exp-005/006), F-A6 (planner pass), F-A7 (foundation-era owner items).

---

# II. Foundation Phase (TKT-foundation-001…007) — accepted 2026-09-27

**Verdict: ACCEPTED** for the foundation phase, with findings — two process-integrity items (**F-2/F-3**) need a user decision. No red tests, no missing foundation TCs, no scope creep, no unverified foundation acceptance criterion. **Post-verdict: F-1 fixed (PR #9) and F-6 resolved by design (USER-DECISION-3, PR #8) — see §8 below.**

- **Scope:** phase acceptance of the 7 foundation tickets only (all marked `done`). This is **not** project acceptance — 27 of 34 tickets are `todo`, 122 of 125 planned TCs are owned by domain tickets and not yet due. Project-level SC verification (§5) is pending by design.
- **Verified ref:** `dev` @ `35011da` (2026-09-27), clean worktree, synced with `origin/dev`. All seven PR merges (#1–#7) are ancestors of this ref. Post-verdict fixes merged at `5d7227c` (PR #8, docs-only) and `27fb714` (PR #9, F-1 harness fix) — §8.
- **Verifier:** acceptance agent (independent re-execution; no code or documents modified except this report).
- **Environment note:** local runs on Node 22.22.0 / pnpm 10.34.5 against PostgreSQL 17.11 (repo pins `engines >=24`; CI runs Node 24). Same recorded precedent as every foundation ticket's local verification (F-8, informational).

## 1. Environment & full-suite results (independent, on dev @ 35011da)

| Check | Command | Result |
|---|---|---|
| Frozen install | `pnpm install --frozen-lockfile` | ✅ exit 0 |
| Prisma client | `pnpm --filter api exec prisma generate` | ✅ exit 0 |
| Lint | `pnpm lint` | ✅ exit 0 (3 projects) |
| Typecheck | `pnpm typecheck` | ✅ exit 0 (3 projects) |
| Migrations (fresh DB `settleup_acceptance`) | `prisma migrate deploy` | ✅ applied cleanly; **re-run exit 0, "No pending migrations"** (idempotent) |
| Unit + integration | `DATABASE_URL=… pnpm test` — **run twice consecutively** | ✅ **15 files / 72 tests passed, both runs** (truncate-per-test isolation holds) |
| DB-unset guard | `pnpm test` with `DATABASE_URL` unset | ✅ unit 70/70 pass; integration fails with "The integration test project requires DATABASE_URL."; **exit 1** |
| Build | `pnpm build` | ✅ shared → api → web; SPA bundle **84.30 kB gzip** (≤ 300 KB budget) |
| Web mechanism suite | `pnpm --filter web test` | ✅ **47/47** (5 files) — note: outside root runner, see F-4 |
| E2E (full fresh path) | drop `settleup_e2e` → `E2E_DATABASE_URL=… pnpm test:e2e` | ✅ script re-creates + migrates DB, Playwright boots built `apps/api/dist/main.js` serving the built SPA, **1/1 passed** |
| CI (GitHub Actions, Node 24) | run `36285384382` (PR #7 head `ad7f77c` = merge ref of dev) | ✅ every step green: install, generate, lint, typecheck, migrate, 72-test run, build, E2E-db, Playwright |

The only commits after that CI run are `68ee322` (the merge itself — tree-identical to the validated merge ref) and `35011da` (ticket-status flip + `.gitignore` line; no code). Combined with the local re-execution above, the integrated dev state is fully verified.

Runner-gating proof (f-007 c3 / f-006 c3): directly observed — the `DATABASE_URL`-unset run fails the command with exit 1; recorded mutation proofs on file (f-006 round-1 artifact: broken canary → 2 failed/exit 1, neutered truncate → canary fails; f-004 round-2: five behavior-fix pins verified fail-pre-fix; f-005 round-1/2: route-break mutations fail exactly the right cases). I did not mutate code myself (acceptance rules).

## 2. Ticket acceptance verification (all 7 `done`)

**TKT-foundation-001 (monorepo scaffolding)** — criteria 1–5 ✅: frozen install, lint, typecheck, build (dist artifacts produced), real `pnpm test`/`test:e2e` runs (stubs since replaced by f-006/f-007 wiring, both exit 0), boot verified via the e2e webServer booting `dist/main.js` and the a1 boot specs. PR #1 → master, merged 2026-09-26.

**TKT-foundation-002 (Prisma model & migration)** — criteria 1–4 ✅: schema transcribed field-for-field from 02-data-model.md §4 (I compared all 8 models: fields, types, defaults, 3 enums with values/order, all `@unique`/`@@unique`, all 4 `@@index`es, `onDelete: Cascade` on ExpenseShare→Expense); FLAG-1 formatting normalization documented in-file with names/values/order unchanged. Fresh-DB `migrate deploy` ✅, idempotent re-run ✅ (both re-verified by me on a throwaway DB). `prisma generate` + typecheck ✅. PR #3 → master. (Merged without a formal review loop — user-directed, mitigations on record in the ticket; schema exercised green in CI runs 36221858640 / 36285384382.)

**TKT-foundation-003 (shared package)** — acceptance = TC-EXP-001/002/003 green ✅ (§3); criterion 1 (DTO exports for 03 §2/§3/§3b/§3c/§4) ✅ `dto-shapes.spec.ts` 5/5; criterion 2 (error-code union exactly 03 §4 + `LIST_TOO_LARGE`) ✅ `error-codes.spec.ts` 3/3; criterion 3 (no runtime deps) ✅ — `packages/shared/package.json` declares zero dependencies. PR #4 → dev.

**TKT-foundation-004 (API platform)** — criteria 1–5 ✅: a1 boot-env specs (13 tests) + missing-env non-zero exit; a2 CSRF/error-envelope specs (7); a3 validation-internal (3, hand-injected paramtypes — see F-1); a4 static-SPA (5); a5 request-logging (4); plus round-2 pins (csrf-method-set 7, unmapped-exception-status 3, payload-too-large 1, error-code-mirror 1). Real-dist serving verified by the Playwright boot of the built app. Review loop closed at pass 3; deviations/flags on record. PR #6 → dev.

**TKT-foundation-005 (SPA shell)** — criteria 1–4 ✅: routes/placeholders via App.spec + routes.spec (in the 47/47); wrapper mechanism via client.spec/errors.spec (CSRF header on mutations, envelope parsing, 401 redirect) + recorded dev-proxy round-trip (FLAG-1's live-envelope leg was permitted to be proven at unit level — f-004 has since landed the real envelope, and the e2e canary now exercises the real SPA/API pair); build 84.30 kB gzip ≤ 300 KB; no-email/no-input assertions in App.spec. Review loop closed clean at pass 2. PR #5 → dev.

**TKT-foundation-006 (integration & e2e harness)** — criteria 1–6 ✅: two consecutive 72-test runs; DB-unset guard (unit 70/70 + clear failure, exit 1 — independently reproduced); canary-break gating (recorded mutation proof + my direct exit-1 observation); fresh-DB e2e (independently reproduced end-to-end); CI green with **no workflow-file change** (verified via merge diff: 11 files, `ci.yml` untouched — must-NOT-touch held for `apps/api/src/**`, `packages/shared/src/**`, `apps/web/src/**` too); lint/typecheck exit 0. Review loop closed clean at pass 1. PR #7 → dev.

**TKT-foundation-007 (CI pipeline)** — criteria 1–5 ✅ with documented deviations: ci.yml implements 04 §4's four logical steps + service container + env + concurrency + artifact upload; DEVIATION-1..5 (pnpm `version:` input, `master` trunk per USER-DECISION-1, maintenance-DB CREATE fix, `permissions: contents: read`, explicit `--schema`) each justified in-file with architect amendments routed (F-7). Criterion 2: TC-EXP-001/002/003 execute in the unit project, passing with `DATABASE_URL` unset (70/70) — independently reproduced. Criterion 4 (local rehearsal of workflow steps in order) — I executed the exact sequence, all green. Criterion 5: CI green on the PR (runs 36250120873 / 36285384382); the "on main once merged" leg is pending trunk promotion (F-6). Review loop closed clean at pass 3. PR #2 → dev.

## 3. Coverage-matrix reconciliation (foundation scope)

- **Planned TCs due now:** TC-EXP-001, TC-EXP-002, TC-EXP-003 (placed on TKT-foundation-003 per the matrix/Gate-4 ledger). **All three exist, are exact translations of the plan's steps/expected values** (verified line-by-line: all 6 valid forms, all 7 rejected forms + the `21474836.47`/`.48` BVA pair, all 4 format cases + round-trip), **and pass** (18 tests: 6+8+4, green in the 72 and in CI). The plan's "throws / returns an error result" latitude is resolved as a non-throwing error result, documented in the spec.
- **Planned TCs not yet due:** 122/125 — owned by `todo` domain tickets (accounts/groups/exp/bal/integ). Placement was audited at Gate 4 (125/125 placed, zero orphans, zero duplicate owners); no done ticket claims any TC beyond EXP-001–003. Not a finding — this is the phase boundary.
- **Tests without planned TCs (extra-test direction):** 54 additional automated tests exist — 4 shared mechanism specs (8 tests), 34 api platform/pin specs, 2 integration-canary tests, 1 e2e canary, 47 web mechanism tests (some overlap in counts by file, 72 root + 47 web + 1 e2e total). All are **documented** in their tickets as criteria-level mechanism specs, consistent with the matrix's own note that foundation carries no TCs. None falsely claims a TC ID. The genuinely open item is that the 47 web mechanism tests are in **no CI-executed runner** (F-4).

## 4. Integration & e2e (cross-domain, my ownership)

The only system-level tests that exist at this phase are the harness canaries; both run green on dev — integration canary (unknown `/api` path → 404 in §4 envelope; truncate-per-test proven by the User-row self-test and two consecutive full runs) and the e2e SPA canary (fresh DB → built app → rendered SPA), verified locally and in CI run 36285384382. All other system/e2e TCs in the domain plans (23 e2e + 1 system) are owned by todo tickets.

## 5. Success criteria status (project level — pending, by design)

| SC | Verification path (matrix §2) | Status at foundation exit |
|---|---|---|
| SC-001 | real-world adoption (not automatable) + TC-BAL-025 path | pending (domain) |
| SC-002 | TC-EXP-004/005/008 · TC-BAL-001…004 | pending (exp-001 / bal-001, todo) |
| SC-003 | TC-EXP-028 | pending (exp-005, todo) |
| SC-004 | TC-ACC-027 · GRP-031 · EXP-032/033 · BAL-026 | pending (domain e2e) |
| SC-005 | TC-EXP-023 + TC-BAL-016 | pending (domain) |
| SC-006 | TC-ACC-015 + TC-GRP-021 | pending (integ-001, todo) |
| SC-007 | TC-BAL-025 | pending (bal-007, todo) |

No foundation artifact claims any SC as verified. Every SC has a defined, approved verification path — no unverifiable SCs. Foundation's contribution to the SC infrastructure is verified: ASM-002 money discipline (TC-EXP-001–003 green), the frozen DTO/error contracts, and the harness that will execute the remaining 122 TCs.

## 6. NFR verification status

None of the 20 NFRs' verification methods were due for execution in the foundation phase (all trace to domain TCs or the deployment ticket). The one foundation-translated NFR check — SPA initial bundle ≤ 300 KB gzip (NFR-ACC-003 translation, f-005 criterion 3) — **was executed and passes** (84.30 kB). NFR-ACC-002 (hosting review) is due at integ-003. No unexecuted-but-claimed NFRs.

## 7. Findings

| # | Type | Finding & evidence | Severity | Suggested routing |
|---|---|---|---|---|
| **F-1** | routed flag dropped (forward risk) | **f-004 FLAG-3 never reached f-006.** FLAG-3: "Vitest compiles with esbuild, which does not emit `design:paramtypes`… Unless TKT-foundation-006 enables decorator-metadata emission (e.g. an SWC-based transform), every domain DTO-validation integration test will silently skip validation" (TKT-foundation-004.md:33; also a code comment in `tc-foundation-004-a3-validation-internal.spec.ts:45-54`). Grep across `.pipeline/` finds FLAG-3 **only** in the f-004 ticket — absent from the f-006 ticket, its round-1 review artifact, and the board. The delivered harness (`vitest.config.ts`, integration support) has no decorator-metadata/SWC transform. All current tests are honest (a3 hand-injects metadata), but the first domain DTO-validation integration tests (accounts-001 onward — the plans are full of 400-VALIDATION_FAILED cases) risk **false greens** under the current harness. **→ RESOLVED (fixed):** user-directed fix via PR #9 — SWC decorator-metadata transform + permanent harness pin (§8), merged before any domain ticket started. | ~~High — resolve before TKT-accounts-001~~ → Resolved | planner/test-planner (harness contract) + coder (done) |
| **F-2** | missing review artifact (dangling reference) | TKT-foundation-003.md cites `.pipeline/plan/reviews/TKT-foundation-003-round-1.md` ("merged by owner after review round 1 and its fixes"); **no such file exists** on disk or in any branch (`git log --all` empty). The round-1 substance (DEVIATION-1/2) survives inside the ticket file (commit 46e7549), but the cited artifact is gone. | Medium | user / review-lead — reconstruct or correct the reference |
| **F-3** | review-artifact retention gap | `.gitignore:4` ignores `.pipeline/plan/reviews/`. Only 6 of 12 artifacts are tracked (f-004 ×3, f-005 ×2, f-006 ×1 — force-added); f-001 ×2, f-002 ×1, f-007 ×3 exist **only as untracked local files** (present on this machine, `git status --ignored` confirms). A fresh clone loses them — the exact failure mode f-006's provenance note describes ("uncommitted on disk — its commit never landed"). | Medium | user — decide: force-add the six local artifacts for record integrity, or accept ticket-file summaries as the record |
| **F-4** | ungated tests (open, 3rd consecutive ticket) | 47 web mechanism tests (`apps/web/src/**/*.spec.{ts,tsx}`) are outside root `pnpm test` (vitest.config includes shared+api unit, api integration only) and outside CI. They pass when run manually (47/47, verified) but nothing enforces them. Routed as C-1 in f-005 round 1 and f-006 round 1; still open. | Medium | test-planner |
| **F-5** | lint/typecheck coverage gaps (open, routed) | Test dirs, `playwright.config.ts`, and root `scripts/*.mjs` sit outside all lint/typecheck globs; known pre-existing type errors in `apps/api/test/unit` (f-006 FLAG-2/C-2; `scripts/e2e-db.mjs` has 14 `no-undef` under the root config). | Low | planner |
| **F-6** | trunk promotion pending (user action) | `dev` (35011da) is 73 commits ahead of `origin/master`, 0 behind — a clean fast-forward. CI's push trigger fires only on `master`, so f-007 criterion 5's "green on main once merged" leg and the board's "first trunk-push run" checklist item are still open. `master` branch protection is likewise pending. Local `master` is also stale (bd3e13d, behind origin/master). **→ RESOLVED (by design):** user decision 2026-09-27 — master intentionally lags dev until MVP release; recorded as USER-DECISION-3 in TKT-foundation-007.md via PR #8 (§8). Promotion, first trunk-push run, and master protection are MVP-release-time owner steps. Local-master staleness is cosmetic. | ~~Info (user-owned)~~ → Resolved | user (decided) |
| **F-7** | architecture-doc amendments pending (open, non-blocking) | 02-data-model §4/§7 (f-002 FLAG-1 normalization + naming), 04-ci-pipeline §4/§5 (f-007 DEVIATION-1..5, `main`→`master`), 03-api-design §3c (f-003 DEVIATION-2: `SettlementDto.status` field the doc's inline shape omits — the test plan and data model both pin it). All routed with recommended amendments; docs currently trail the shipped code. | Info | architect |
| **F-8** | environment observation | All local verification (coders' and mine) ran Node 22.22.0 vs pinned `engines >=24`; CI runs Node 24 and is green. Recorded precedent in f-002/f-004/f-005/f-006. | Info | none |
| **F-9** | open flags on f-004 (routed, in place) | FLAG-1 build-ordering workaround (error-code mirror in `apps/api/src/common/errors/error-contract.ts` + guard spec `error-code-mirror.spec.ts`; delete when the shared-dist build-ordering fix lands) and FLAG-2 (`VALIDATION_FAILED.details` shape `{ fields: string[] }` needs architect confirmation before domain tickets assert against it). | Info | architect / planner |

## 8. Post-verdict record (2026-09-27)

- **User decision on F-6:** "it is by design that master will be behind dev till MVP release." Recorded as **USER-DECISION-3** in `.pipeline/plan/tickets/TKT-foundation-007.md` — dev is the integration branch for the entire build; the dev→master promotion (clean fast-forward), the first trunk-push CI run, and `master` branch protection are owner steps at MVP-release time. f-007 criterion 5's "and on main once merged" leg is satisfied by design at promotion; until then PR merge-ref CI runs are the trunk evidence.
- **Fix routed and landed:** coder dispatched (user-directed), PR [#8](https://github.com/sarperim/settleup/pull/8) — docs-only, 1 file (+2/−1: USER-DECISION-3 bullet + rewritten user-side step, which also fixed the stale `main` word), CI green (run 36287477017), verified against the brief (no code/workflow/test changes; `ci.yml` byte-identical) and merged at `5d7227c`. The gitignored `board.md` owner-actions view was updated locally to match (nothing CI-related pending during the build; architect §5 amendment rider noted).
- **Fix routed and landed (F-1, user-directed "fix it"):** coder dispatched → PR [#9](https://github.com/sarperim/settleup/pull/9) — `unplugin-swc` + `@swc/core` root devDeps (lockfile waiver recorded, precedent f-007 USER-DECISION-2), `swc.vite()` on both Vitest projects, a3's hand-injected metadata removed, permanent harness-pin spec added (`apps/api/test/unit/harness.decorator-metadata.spec.ts`), full record in the TKT-foundation-006 addendum. **Red proof captured pre-fix** (invalid DTO → 201 instead of 400, verbatim assertion failure). **Review-lead pass 1 (user-directed):** all three lanes CLEAN (compliance / code / security — supply-chain verified: trusted-publisher releases, official NestJS recipe, dev-only), mutation proof run (plugin disabled → pin reds with exactly its documented signature; restored byte-identical), artifact `PR-0009-f1-harness-fix-round-1.md` committed to the PR branch. **Acceptance re-execution** (independent, on the PR head): install/generate/lint/typecheck exit 0, full suite **16 files / 74 tests × 2 consecutive runs** (72 baseline + 2 pin tests), DB-unset guard exit 1 with unit 72 passing, build exit 0, web 47/47, CI green on the final head (run 36289178494), frozen `ci.yml` untouched. Merged at `27fb714`. The domain waves (accounts-001 onward) now run DTO validation for real under Vitest.
- **Still open after these fixes:** F-2/F-3 (user decisions), F-4/F-5 (test-planner/planner), F-7 (architect), F-9 (architect/planner). F-1 and F-6 are closed.

## 9. Checks performed (summary)

Environment (clean/synced/ancestry of all 7 merges) · full local CI-equivalent sequence (11 checks, all green) · twice-consecutive test runs · DB-unset guard behavior · fresh-DB migration + idempotency · fresh-DB e2e · web mechanism suite · CI run inspection (step-level, Node 24) · must-NOT-touch scope audit of PR #7's merge diff · line-by-line verification of TC-EXP-001/002/003 against the plan · field-for-field schema comparison vs 02 §4 · shared-package dependency audit · review-artifact existence/tracking audit · routed-flags cross-check across tickets, board, and review artifacts · SC/NFR due-now reconciliation · coverage-matrix both-direction reconciliation for the foundation scope.

**Bottom line:** the foundation is solid — every ticket's acceptance criteria hold under independent re-execution, the runner contract is complete and CI-gated, and the merged dev state is green end-to-end. Accept the phase; F-1 (decorator metadata) and F-6 (trunk promotion) are resolved post-verdict (PRs #9 / #8); decide F-2/F-3 as owner. The domain waves are unblocked with the harness honest for DTO validation.
