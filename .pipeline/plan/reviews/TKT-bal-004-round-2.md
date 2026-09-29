# Review Round 2 — PR #31 (TKT-bal-004: Settlement lifecycle — mark paid & undo, party-only)

PR: https://github.com/sarperim/settleup/pull/31
Branch: `tkt-bal-004` → `dev` · Head at review: `aade78f` (fixer head) · Base: `dev` tip `e111cb1`
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/review-TKT-bal-004` — branch `review/tkt-bal-004` at `aade78f` (= PR head; tree clean at review start).

> **Lane dispatch.** Three concurrent subagents (`compliance-reviewer`, `code-reviewer`, `security-reviewer`) on the fixer's head, verifying the round-1 findings (never trusting the fixer's self-report) and hunting for new problems in the fix commits. Consolidation, blocking classification and mergeability are the review lead's.

Round-1 artifact: `.pipeline/plan/reviews/TKT-bal-004-round-1.md` (head `6ae1621`, verdict not clean — CMP-1 blocking). Fix commit reviewed this round: `aade78f` (`6ae1621...aade78f`, 4 files: `settlements.service.ts`, `balances.service.ts`, `support/settlements.ts`, `tc-bal-013-undo-either-party.spec.ts`).

## Blast radius gate

Unchanged from round 1: **FULL** (executable API logic, test files, pinned acceptance TCs, member/party authorization). All three lanes ran again.

## Scope fence — re-verified held (review lead, independently)

`git diff origin/dev...HEAD` = 14 files (the round-1 review artifact is the only addition since round 1). Fence check `-- apps/api/src/settlement/engine apps/api/src/ledger apps/api/src/groups apps/web packages/shared/src apps/api/prisma package.json pnpm-lock.yaml` → **empty**. Fix commits touch only settlement service/balances/test files + the docs artifact. No `dto`/`controller` change in the fix.

## CI gate

Actions run [`36579829970`](https://github.com/sarperim/settleup/actions/runs/36579829970) — `pull_request`, `headSha=aade78f…` = current PR head — **success**, `Lint, test & build` green (`gh pr checks 31` → `Lint, test & build … pass`). CI is the test authority; no local suite was run.

## Reviewer verdicts (pass 2)

### compliance-reviewer — verdict: **compliant** (0 violations)

- **CMP-1 (was blocking) — RESOLVED, no expected result changed.** `tc-bal-013-undo-either-party.spec.ts` now asserts the pinned plan result: recipient case `sumKurus === 0` + carol `−3000`; payer case `sumKurus === 0`, carol `−3000`, the regenerated `{bob→alice 3000, carol→alice 3000}` plan tuples, and the retained `settled` row with `undoneAt` (`balances-settlement.md:153-154`). The fix diff is **strictly additive** — only existing lines modified are the `readBalances` → `readBalancesView` swap, preserving every prior assertion.
- Full TC-BAL-009…015 re-checked faithful; no test skipped/`.only`/deleted; scope fence, architecture (§3c/§3.4/§4, §5.2), DTO bounds, undo semantics all pass; no gold-plating. New violations from the fix: **none**.

### code-reviewer — verdict: **approve** (0 blockers; 4 new non-blocking nits)

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| CODE-1 / SEC-2 (undo TOCTOU) | should-fix / low | `settlements.service.ts:277-287` | Status-guarded `updateMany({ id, groupId, status: 'SETTLED' })`; loser matches 0 rows → `409`; `undoneAt` written once. Precedence 404 → 403 → 409 preserved; correct row re-read. | **verified-fixed** |
| CODE-2 / SEC-1 (mark-paid race) | should-fix / medium | `settlements.service.ts:182-225`, `balances.service.ts:64-75` | Serializable isolation + narrow `P2034` → `409 SUGGESTION_STALE` catch (other errors rethrown); overclaiming comment corrected. | **verified-fixed** |
| CODE-3 (sequential GET awaits) | nit | `settlements.service.ts:113-127` | `Promise.all` restored. | **verified-fixed** |
| CODE-4…7 | nit | — | Disputed as not-worth-churn (perf/stylistic/shared-module scope). | **dispute upheld** (non-blocking) |

New nits (non-blocking, fix-commit surface): **P2-1** `P2034` also covers deadlocks (fail-closed, practically unreachable); **P2-2** Serializable-without-retry can spuriously `409` a *different*-triple concurrent mark-paid (accepted trade, fails closed); **P2-3** `readBalancesView` failure message still says `readBalances fixture failed`; **P2-4** payer case duplicates the recipient case's assertion block (plan-mirroring, defensible). None block.

### security-reviewer — verdict: **approve** (0 findings; 0 critical/high/medium/low)

- **SEC-1 (medium, double-apply) — VERIFIED CLOSED.** SSI on the `settled_payments` predicate read + insert forces one of two concurrent same-triple transactions to abort (40001 → `P2034` → 409); the catch is narrow (only P2034); Postgres honors Serializable (CI green executes the path).
- **SEC-2 (low, double-undo) — VERIFIED CLOSED.** `updateMany` under READ COMMITTED re-evaluates the `status: 'SETTLED'` predicate after the row lock → loser 0 rows → 409; group-scoped WHERE as defense in depth; new error paths leak nothing (`AllExceptionsFilter` folds unknown errors to generic 500).
- Full re-check for regressions: injection, AuthN/AuthZ chain, IDOR/BOLA, secrets/deps/config, PII/logging all clean. Residual notes (pre-existing non-tx reads, P2034 deadlock conflation, undo-during-markPaid interleaving) — none exploitable, no integrity loss.

## Consolidation

| ID | Severity | Source | Status |
|---|---|---|---|
| CMP-1 | compliance violation (minor weakened test) | compliance | **verified-fixed** (round-2: compliant) |
| CODE-1 / SEC-2 | should-fix / low | code + security | **verified-fixed** |
| CODE-2 / SEC-1 | should-fix / medium | code + security | **verified-fixed** |
| CODE-3 | nit | code | **verified-fixed** |
| CODE-4 | nit | code | disputed — upheld, non-blocking |
| CODE-5 | nit | code | disputed — upheld, non-blocking |
| CODE-6 | nit | code | disputed — upheld, non-blocking |
| CODE-7 | nit | code | disputed — upheld, non-blocking |
| P2-1…P2-4 | nit | code (new) | open, non-blocking |
| SEC residual observations | info | security | noted, non-blocking |

No open disputes on blocking findings; no escalation; no upstream-routing items.

## Mergeability check (pass 2)

- Open **blocking** findings: **none.** CMP-1 is verified-fixed; all remaining items are nits / non-blocking should-fixes / observations.
- CI: **green** on `aade78f`.
- ⇒ **PR is MERGEABLE on pass 2** (clean pass after one fixer round; loop ends early).

## Verdict

Zero open blocking findings and green CI on `aade78f` — **MERGEABLE on pass 2**. One fixer round ran (blocking CMP-1 plus the should-fix concurrency findings CODE-1/SEC-2 and CODE-2/SEC-1, and nit CODE-3); all verified fixed by the next pass, which found no new blocking problems. Non-blocking items recorded for the user/backlog: CODE-4…CODE-7 (disputed nits), P2-1…P2-4 (new fix-commit nits), and the security residual observations.

> This artifact commit is docs-only and advances the PR head past `aade78f`; CI will re-run on the new head. The pass-2 verdict above is for `aade78f`, the commit all three lanes reviewed. Per the review-lead contract the user is dispatched here: **merge when ready** — after the user confirms the merge, the ticket file's Status becomes `done` and the board is regenerated.
