# Review Round 1 — PR #31 (TKT-bal-004: Settlement lifecycle — mark paid & undo, party-only)

PR: https://github.com/sarperim/settleup/pull/31
Branch: `tkt-bal-004` → `dev` · Head at review: `6ae1621` · Base: `dev` tip `e111cb1`
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/review-TKT-bal-004` — branch `review/tkt-bal-004` at `6ae1621` (= PR head; tree clean at review start).

> **Lane dispatch.** This environment exposes an `opencode run --agent` subagent mechanism; the three lanes were dispatched as concurrent subagents (`compliance-reviewer`, `code-reviewer`, `security-reviewer`) against the isolated checkout and returned the findings + verdicts recorded below. Consolidation, blocking classification and mergeability rules are the review lead's.

Scope context: per `.pipeline/plan/tickets/TKT-bal-004.md` — **extend** `apps/api/src/settlement/**` and add integration specs for the settlement lifecycle:
- `POST /api/groups/:groupId/settlements { payerId, recipientId, amountKurus }` — **party check first** (`403 NOT_PAYMENT_PARTY`, no plan work), then the §3.4 mark-paid consistency rule (recompute balances + plan inside the request transaction, exact-triple match, else `409 SUGGESTION_STALE`), insert `SETTLED` (FR-BAL-006/007).
- `POST /api/groups/:groupId/settlements/:settlementId/undo` — party check first (`403` before `409 ALREADY_UNDONE`), then `status → UNDONE`, `undoneAt` set, `paidAt` unchanged, row retained (FR-BAL-008/009).
- Prove TC-BAL-009 … TC-BAL-015. **Must NOT touch**: `settlement/engine/**`, `ledger/**`, `groups/**`, `apps/web/**`, `packages/shared/src/**`, `apps/api/prisma/**`, root `package.json` / `pnpm-lock.yaml`.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three lanes run.** Reasoning recorded:

- The diff ships **executable API logic**: two state-changing POST routes, a new `CreateSettlementDto`, in-transaction Prisma writes, an extended `BalancesService.forGroup(groupId, tx?)`, and precedence/error handling. Every LOW condition fails.
- **Test files are touched** (7 new integration specs + a new support helper).
- The ticket **pins automated acceptance TCs** (TC-BAL-009…015) — the compliance lane must verify coverage.
- The routes gate on membership **and** payment-party status — squarely the security lane's remit.

## Scope fence — verified held (review lead, independently)

`git diff --name-status origin/dev...HEAD` — exactly 13 files, no renames, +1213/−37:

- `.pipeline/plan/tickets/TKT-bal-004.md` — status/PR lines only (sanctioned ticket-flip convention)
- `apps/api/src/settlement/balances.service.ts` — optional `tx` client param
- `apps/api/src/settlement/dto/create-settlement.dto.ts` — new
- `apps/api/src/settlement/settlements.controller.ts` — two new POST routes
- `apps/api/src/settlement/settlements.service.ts` — `markPaid` / `undo` + shared plan/ref helpers
- `apps/api/test/integration/support/settlements.ts` — new helper
- `apps/api/test/integration/tc-bal-009…015-*.spec.ts` — 7 new specs

Fence re-checked: `git diff … -- apps/api/src/settlement/engine apps/api/src/ledger apps/api/src/groups apps/web packages/shared/src apps/api/prisma package.json pnpm-lock.yaml` → **empty**. The fence holds exactly.

## CI gate

`gh pr checks 31 --watch` reported no associated checks on the first read (rollup lag), so the review lead gated directly on the Actions run for this PR's head: run [`36567541148`](https://github.com/sarperim/settleup/actions/runs/36567541148) — `pull_request`, `headSha=6ae1621…` = current PR head — **success**, `Lint, test & build` green (lint, typecheck, unit & integration tests, build, E2E smoke). A re-check of `gh pr checks 31` then reported `Lint, test & build … pass`. CI is the test authority; no local suite was run.

## Reviewer verdicts (pass 1)

### compliance-reviewer — verdict: **violations listed** (1 minor weakened-test violation)

All seven acceptance TCs exist as integration specs; six are faithful; **TC-BAL-013 is weakened (minor)**:

- **CMP-1 — weakened test, minor — TC-BAL-013 expected `sumKurus = 0` never asserted.**
  - Plan entry: `.pipeline/testing/balances-settlement.md:153` — TC-BAL-013 expected result step 2: *"balances revert to alice +6000, bob −3000, carol −3000 …; **`sumKurus = 0`**; `outstanding` regenerates …"*.
  - Diff: `tc-bal-013-undo-either-party.spec.ts:61-65` comments "sum 0" but asserts only the three individual values via `readBalances`, whose helper (`support/settlements.ts:178-194`) discards `sumKurus`. The payer-case block (`:101-103`) asserts only alice/bob, not carol. No `sumKurus` assertion exists anywhere in TC-BAL-013. (TC-BAL-009/010 do assert it; the plan's explicit TC-013 zero-sum assertion is genuinely absent.)
- No test skipped/`.only`/deleted/re-interpreted (grep clean); precedence assertions match §4 amended (403 before 409) in TC-BAL-011 step 2 and TC-BAL-014 row b.
- Scope, architecture, gold-plating: **clean** (see fence above; routes/codes/shapes match 03 §3c/§4; DTO bounds `[1, 2^31−1]`; undo semantics per 02 §5.2).
- Observation (not counted): TC-BAL-013 step 3 "same outcomes when the payer undoes it" omits carol's reverted balance and the retained `settled` row; the recompute-in-`tx` deviation (only the `settled_payments` leg shares `tx`) is documented/rationalized — flagged to the code lane, not a violation.

### code-reviewer — verdict: **request changes** (0 blockers; 2 should-fix; 5 nits)

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| CODE-1 | should-fix | `settlements.service.ts:225-253` | `undo` is a non-atomic read-check-update (TOCTOU): `findFirst` → JS checks → bare `update({where:{id}})`. Two concurrent undos both pass; the second overwrites `undoneAt` with a fresh `new Date()`, violating the TC-BAL-015 contract ("exactly one `undoneAt`"). Fix: `updateMany({ where: { id, groupId, status: 'SETTLED' }, data: { status: 'UNDONE', undoneAt: new Date() } })`; `count===0` → re-read → `409 ALREADY_UNDONE`. | open, non-blocking (should-fix) |
| CODE-2 | should-fix | `settlements.service.ts:175-201` + `balances.service.ts:64-70` | Prisma interactive tx runs at Postgres READ COMMITTED; the plan read takes no lock and the insert re-validates nothing. Concurrent mark-paid of the same triple double-applies (§3.4/G-2 "never double-applied"); the new comment claiming otherwise overclaims. Fix: `{ isolationLevel: 'Serializable' }` + map P2034 → `409 SUGGESTION_STALE`, or a group-row `FOR UPDATE` lock; at minimum correct the comment. | open, non-blocking (should-fix) |
| CODE-3 | nit | `settlements.service.ts:112-124` | `forGroup` refactor dropped the original `Promise.all` for two sequential awaits on the GET path — restore parallelism (NFR-BAL-004). | open, non-blocking |
| CODE-4 | nit | `settlements.service.ts:203-204, 255-256` | Full 4-query balances recomputation just to resolve display names; the in-tx `balancesView` can be reused. Perf-only. | open, non-blocking |
| CODE-5 | nit | `settlements.service.ts:160` vs `:220` | `markPaid` is actor-first, `undo` actor-last; pick one order. | open, non-blocking |
| CODE-6 | nit | `settlements.controller.ts:37-48` | 4th copy of `requireUserId`; extract to `common/http`. | open, non-blocking |
| CODE-7 | nit | `support/settlements.ts:49`; `tc-bal-012…:46`; comments | `standingPlan` exported but unused outside file; `typeof ctx.server` type expression; duplicated step numbers in TC-009/013 comments. | open, non-blocking |

Test quality: good — TCs match the plan row-for-row (incl. both combined-precedence strengthenings), deterministic fixtures, writes driven through the real routes, observable assertions.

### security-reviewer — verdict: **request changes** (0 critical/high; 1 medium; 1 low)

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| SEC-1 | medium | `settlements.service.ts:175-197`, `balances.service.ts:68-81` | Concurrent mark-paid double-apply race: READ COMMITTED, no locks, no unique constraint → N parallel valid calls create N `SETTLED` rows for one payment, corrupting derived balances; the `409 SUGGESTION_STALE` guard works only sequentially. Fix: group-row `FOR UPDATE` lock or `Serializable` + retry. (Same root cause as CODE-2.) | open, non-blocking (medium) |
| SEC-2 | low | `settlements.service.ts:225-256` | Concurrent double-undo both return 200 and overwrite `undoneAt` (violates §3c/§4 + NFR-BAL-005 timestamp). Fix: status-guarded `updateMany` → count 0 → `409`. (Same root cause as CODE-1.) | open, non-blocking (low) |

Verified secure (no findings): full AuthN/AuthZ chain (global `AuthGuard` → `GroupMemberGuard` non-member 404 → party-first 403 → exact-triple match), no BOLA/IDOR (`undo` scopes `{id, groupId}`, indistinguishable 404), CSRF on both POSTs, DTO validation/injection, PII/data-exposure, secrets/dependencies/config. Pre-existing debt noted: `balances.service` reads members/expenses/shares on the non-tx client even in the mark-paid path (collapses into SEC-1).

## Consolidation

| ID | Severity | Source | Location | Status |
|---|---|---|---|---|
| CMP-1 | compliance violation (minor weakened test) | compliance-reviewer | `tc-bal-013-undo-either-party.spec.ts:61-65,101-103` | **open — BLOCKING** |
| CODE-1 / SEC-2 | should-fix / low | code + security | `settlements.service.ts:225-256` (non-atomic undo) | open, non-blocking |
| CODE-2 / SEC-1 | should-fix / medium | code + security | `settlements.service.ts:175-201` + `balances.service.ts:64-70` (mark-paid race) | open, non-blocking |
| CODE-3 | nit | code-reviewer | `settlements.service.ts:112-124` | open, non-blocking |
| CODE-4 | nit | code-reviewer | `settlements.service.ts:203-204,255-256` | open, non-blocking |
| CODE-5 | nit | code-reviewer | `settlements.service.ts:160,220` | open, non-blocking |
| CODE-6 | nit | code-reviewer | `settlements.controller.ts:37-48` | open, non-blocking |
| CODE-7 | nit | code-reviewer | `support/settlements.ts:49`; `tc-bal-012…:46`; comments | open, non-blocking |

No disputes, no escalation, no upstream-routing items.

## Mergeability check (pass 1)

- Open **blocking** findings: **CMP-1** (compliance violation — weakened TC-BAL-013). Blocking = any compliance violation / code-review blocker / critical-or-high security finding. CODE-1/CODE-2/SEC-1/SEC-2 are should-fix/medium/low and do **not** block by the severity taxonomy; the nits never block.
- CI: **green** on `6ae1621`.
- ⇒ **Not mergeable on pass 1.** Fixer dispatched for CMP-1 (with the non-blocking should-fixes available for triage).

## Fixer dispatch (pass 1 → pass 2)

Dispatched the fixer (`fixer` subagent) against the PR branch with this artifact, instructing:
- **CMP-1 (blocking)** — strengthen `tc-bal-013-undo-either-party.spec.ts` so the plan's expected result is asserted: `sumKurus = 0` on both cases (and, per the plan's step 3, carol's reverted balance + the retained `settled` row with `undoneAt` in the payer case). This adds assertions; no expected result is changed.
- **CODE-1/SEC-2** — cheap, local status-guarded `updateMany` transition; fix if minimal.
- **CODE-2/SEC-1** — assess: fix via `Serializable`/`FOR UPDATE` if minimal and in-scope, else dispute or escalate as a follow-up (MVP ≤ 8 members); at minimum correct the overclaiming comment.
- Nits — fix only if trivial; otherwise dispute as not-worth-churn.

## Verdict

Not clean on pass 1: one blocking compliance violation (CMP-1, weakened TC-BAL-013) with green CI. The loop continues — fixer dispatched; the next pass re-reviews the fix commits and re-checks CMP-1 plus all non-blocking findings for resolution, and hunts for new problems introduced by the fix.

> This artifact commit is docs-only and advances the PR head past `6ae1621`; CI will re-run on the new head. The pass-1 verdict above is for `6ae1621`, the commit all three lanes reviewed. CMP-1 closes only when a reviewer re-verifies it against the fixed test on the fixer's new head.
