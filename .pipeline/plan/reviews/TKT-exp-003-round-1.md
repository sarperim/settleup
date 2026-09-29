# Review Round 1 — PR #24 (TKT-exp-003: Ledger reads — list, detail, defensive cap, LedgerReadService) — FINAL

PR: https://github.com/sarperim/settleup/pull/24
Branch: `tkt-exp-003` → `dev` · **Code head: `c04abfd`** · Base: `2216544` (= `origin/dev` tip; merge-base verified — the PR is a clean descendant of dev's tip)
Preceding: none (pass 1).
Review date: 2026-09-29 · Isolated checkout `/tmp/opencode/worktrees/rl-tkt-exp-003` (clean at every gate). Scratch namespace `/tmp/opencode/review-exp-003/`. Per-lane databases: lead `settleup_e3r_x`, compliance `settleup_e3r_c`, code `settleup_e3r_k`, security `settleup_e3r_s`, system/e2e `settleup_e2e_e3r` (all provisioned, migrations applied). Lane reports preserved at `/tmp/opencode/review-exp-003/{compliance,code,security}-report.md`.

Diff under review: `git diff origin/dev...HEAD` — 8 files, +616/−60: `apps/api/src/ledger/ledger-read.service.ts` (new, 103), `ledger.service.ts` (+144/−…), `ledger.controller.ts` (+17), `ledger.module.ts` (+6), three new integration specs `tc-exp-02{1,2,5}-*.spec.ts` (110/172/121), and the ticket file (status/evidence only).

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three review lanes run.** Reasoning recorded:

- The diff adds/re-layers **executable production logic** (`ledger-read.service.ts`, `ledger.service.ts`, `ledger.controller.ts`, `ledger.module.ts`) — not presentation-only, not non-executable.
- **Test files are touched** (3 new integration specs).
- The ticket **pins automated acceptance TCs** (TC-EXP-021, 022, 025 green) — the compliance lane verifies them.
- The diff adds a new authenticated HTTP read surface (the list route) over group-scoped financial data and exports a cross-module read service — security- and compliance-relevant.

## Scope fence (allowed set) — verified held (lead + compliance lane, independently)

Changed-file set: `.pipeline/plan/tickets/TKT-exp-003.md` (status `in-review` + evidence line) and files under `apps/api/src/ledger/**` + `apps/api/test/integration/tc-exp-02{1,2,5}-*.spec.ts` — exactly the ticket's declared **Extend `apps/api/src/ledger/**` and add integration specs** scope (ticket line 6).

**Zero lines** (independently re-verified by path-filtered diff) to the ticket's must-NOT-touch set: `apps/web/**`, `apps/api/src/groups/**`, `apps/api/src/auth/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`. No new dependencies. No schema/migration change. `error-contract.ts` untouched (`LIST_TOO_LARGE` pre-existed at `origin/dev`). exp-002 specs and shared test support untouched.

## Reviewer verdicts (pass 1, dispatched in parallel)

| Lane | Verdict | Blocking |
|------|---------|----------|
| compliance | **COMPLIANT** | no |
| code | **APPROVE** | no (7 nits) |
| security | **APPROVE** | no (2 low) |

## Consolidated findings

| ID | Lane | Severity | Status | Summary |
|----|------|----------|--------|---------|
| CMP-O1 / K-7 | compliance + code | non-blocking (obs/nit) | open | TC-EXP-022's Prisma-seeded `editedAt` fixture validity is asserted **transitively** via the read response, not by a standalone sum assert (see P1). |
| CMP-O2 | compliance | non-blocking (nit) | open | Plan BVA table (expense-tracking.md §3) lists `501 (cap+1)` but not `500`; the spec's additive 500→200 assertion is not enumerated there (see P2). |
| CMP-O3 | compliance | non-blocking (nit) | open | 01-system-architecture §9 flag 4 / NFR-EXP-004 phrase the cap as "cap at 500 rows → error", loose against the ticket's ">500"; API §3b + plan BVA + ticket agree, so no actual contradiction. Docs-wording routing only. |
| K-1 / F-S1 | code + security | non-blocking (nit/low) | open | Count→read TOCTOU in `list()`: `countGroupExpenses` and `listGroupExpenses` are separate queries, so a concurrent insert could overshoot the cap by the rows created in the window. Defensive-only guard; attacker is an authenticated member reading rows they may already read; one-line hardening (`take`). |
| K-2 | code | non-blocking (nit) | open | `toView`'s `view!` non-null assertion — safe by construction (`toViews([e])` → exactly one view); documented at the site. |
| K-3 | code | non-blocking (nit) | open | `EXPENSE_LIST_CAP` is exported but has no external consumer; specs hardcode 500/501. |
| K-4 | code | non-blocking (nit) | open | `LedgerReadService.listGroupShares` has no in-repo caller yet — **ticket-mandated** C5 surface, unconsumed/untested until C5 lands (see P3). |
| K-5 | code | non-blocking (nit) | open | TC-EXP-021's most-recent-first assertion rests on the `id desc` tiebreak, which the spec never tests directly (negligible risk; the plan prescribes exactly this assertion). |
| K-6 | code | non-blocking (nit) | open | TC-EXP-022's email-leak scan covers only the edited expense's response, not the unedited sibling (same projection path; TC-ACC-018 owns the cross-ref). |
| F-S2 | security | non-blocking (low) | open | No negative-case spec for the two GET routes yet — the planned SC-006 route-matrix **TC-GRP-021** does not exist as a file. Guard is class-level/unchanged; probe-verified correct today. Coverage debt, not a live vulnerability. |
| carried | security | pre-existing | open | `joinCode` redaction debt — untouched by this diff, carried only. |

**Open blocking findings: ZERO.**

## Flagged-point adjudication (the three points the user asked to be adjudicated)

### P1 — TC-EXP-022's `editedAt`-bearing EXACT expense seeded directly via Prisma → **PERMITTED read-path fixture (non-blocking)**

- **Within strategy §5?** §5 permits direct Prisma seeding "only for read-path fixtures (balances/suggestion views over pre-existing facts) and for scale fixtures". TC-EXP-022 is a read over a pre-existing fact (an already-edited expense row); the only alternative — the edit route — is TKT-exp-004's scope (ticket line 4/10). The parenthetical examples are ambiguous for an expense-detail read; both lanes read the intent as met and the seeding as the correct, disclosed call.
- **Fixture valid?** Yes: shares `0 + 2500 + 2500 = 5000 = amountKurus`; payer/logger/participants are group members; zero-kuruş EXACT participation is domain-legal (OQ-EXP-003).
- **Validity asserted?** Yes, transitively: the exact shares map and `amountKurus` are pinned from the API response, which re-reads the store (BR-EXP-005), so a mis-seeded fixture fails the test. No standalone sum assert (unlike TC-EXP-025's `assertFixtureValidity`) — diagnostic nicety only.
- **Plan test weakened?** No — the plan precondition only requires an edited expense to *exist*; the unedited expense is API-created as required.
- **Fence?** Yes — seeding lives in a test file; no production import, no route/guard bypass, no exported helper into `src/`.
- **Disposition:** not a compliance violation; not blocking. Documentation-nit routing: planner to confirm whether "read-path fixtures" covers expense-detail reads and whether transitive assertion satisfies §5's literal wording (CMP-O1 / K-7). TKT-exp-004 should switch this fixture to a realistic past-dated pair or the edit route once it lands.

### P2 — additive boundary assertion exactly 500 rows → 200 → **PERMITTED additive strengthening (non-blocking)**

- Ticket line 7 and API §3b pin `> 500 → 500 LIST_TOO_LARGE`; the plan BVA lists `501 (cap + 1)` as the first *failing* size, which implies 500 passes. The spec's `500 → 200` assertion is derived from the same contract, not invented.
- The strategy forbids **weakening** a test; it does not forbid an additional assertion. The pinned 501 case is asserted exactly as specified (including the exact error envelope and absence of a partial payload). This is strengthening, and the only thing that pins `>` vs `>=` against an off-by-one (mutating the check to `>= 500` fails the 500 case; the 501-only case cannot catch it).
- It is an extra assertion inside TC-EXP-025, not a distinct case → no new TC number required.
- **Disposition:** legitimate strengthening; not blocking. Planner doc nit: list `500 (cap)` alongside `501 (cap+1)` in the BVA table (CMP-O2).

### P3 — TKT-exp-002 minimal detail route rewrite (extend-not-duplicate) + exported `LedgerReadService` (C5 consumer) → **COMPLIANT, no regression (non-blocking)**

- **Detail route:** `getDetail` now calls `read.findGroupExpense(groupId, expenseId)` = `findFirst({ where: { id, groupId }, select: EXPENSE_ROW_SELECT })` — query-semantics-identical to exp-002's inline version (group scoping retained; cross-group reads impossible; `null` → `404 NOT_FOUND` unchanged). `EXPENSE_ROW_SELECT` moved verbatim (same 8 columns). `toView` = `toViews([expense])` — literally one projection path, so single vs batch cannot diverge; TC-EXP-022 now pins the full payload key set/order.
- **Service group-scoped:** all five methods filter by `groupId` (or by expense ids that already came from group-scoped reads); matches 02-data-model §6 ownership (C4 owns `expenses`/`expense_shares`; C5 reads via `LedgerReadService`). `LedgerModule` exports it — the sanctioned cross-module read path.
- **Unused surface:** `listGroupShares` has no in-repo caller but is mandated by ticket scope line 9 and the ownership matrix; four of five methods are consumed by this PR. Not gold-plating (carried as K-4 — untested until C5).
- **Disposition:** extend-not-duplicate satisfied; the local duplicate row type/select const were removed, not copied. Not blocking.

## Mergeability (pass 1) — MERGEABLE

- Open blocking findings (compliance violation / code-review blocker / critical-high security): **ZERO.**
- CI green on the code head (`c04abfd`): "Lint, test & build" SUCCESS (run 36536974280).
- Independent lead suite re-run green (below).
- Remaining items are non-blocking nits/observations and planner doc-wording routings — the user arbitrates (bundle, fold into a follow-up, or waive).

**RESULT: MERGEABLE on pass 1.** The loop ends early — no fixer dispatch, no escalation. The user (or the orchestrator under its merge grant) owns the merge and the ticket's `done` transition.

## Suite / CI evidence — lead independent re-run on `c04abfd`

| Gate | Command | Result |
|---|---|---|
| CI | `gh pr checks 24` | "Lint, test & build" **SUCCESS** on `c04abfd` (run 36536974280) |
| Lint | `pnpm lint` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit | `pnpm exec vitest run --project unit` | **21 files / 91 tests passed** |
| Full (unit+integration+web-unit, real PG17) | `DATABASE_URL=…/settleup_e3r_x pnpm test` | **88 files / 257 tests passed** (+3 files / +3 tests over the `2216544` baseline 85/254) |
| Build | `pnpm build` | exit 0 |
| System (built CLI) | `E2E_DATABASE_URL=…/settleup_e2e_e3r PSQL=… pnpm test:system` | **1 file / 1 test passed** |

PostgreSQL 17.11 at `127.0.0.1:5432` (lead DB `settleup_e3r_x`, migrations applied). Logs: `/tmp/opencode/review-exp-003/lead-{lint,typecheck,unit,test,build,system}.log`.
