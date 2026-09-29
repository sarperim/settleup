# Review Round 1 — PR #32 (TKT-bal-005: Settlement contract & invariants — TC-BAL-016/017/019/020)

PR: https://github.com/sarperim/settleup/pull/32
Branch: `tkt-bal-005` → `dev` · Head at review: `73225fa` · Base: `dev` tip `c2f99e9`
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/review-TKT-bal-005` — branch `review/tkt-bal-005` at `73225fa` (= remote `tkt-bal-005` head; tree clean at review start).

> **Lane dispatch.** Three concurrent subagents (`compliance-reviewer`, `code-reviewer`, `security-reviewer`) on the PR head. Consolidation, blocking classification and mergeability are the review lead's.

## Blast radius gate — decision: **FULL** (all three lanes)

Diff = 5 files: four new specs under `apps/api/test/integration/**` + the ticket doc (`Status`/`PR` lines). Reasoning:

- The gate's LOW class requires **no test files touched** and **no automated acceptance TCs pinned**. Both conditions fail: four `.spec.ts` files are added, and the ticket pins acceptance TCs TC-BAL-016/017/019/020. The compliance-reviewer must verify them.
- Test code is executable logic, not presentation-only/comment-only.

⇒ Full pipeline; pass 1 is not a fast pass.

## Scope fence — independently verified: **HELD**

`git diff dev...HEAD --name-only` → `.pipeline/plan/tickets/TKT-bal-005.md` + the four new specs under `apps/api/test/integration/`. Nothing under `apps/web/**`, `apps/api/src/**`, `packages/**`, or root `package.json`/`pnpm-lock.yaml`. `git status` clean (no untracked/omitted files). Declared fence (test-only, `apps/api/test/**`) is exactly what the diff contains.

**P-8 parallel disjointness (TKT-bal-005 vs TKT-bal-006, PR #33):** confirmed independently — this PR touches only `apps/api/test/**` + the ticket doc; TKT-bal-006's worktree is `apps/web/**` only. No overlap, no shared files, neither touches the lockfile.

## CI gate

Actions run [`36586987175`](https://github.com/sarperim/settleup/actions/runs/36586987175) — `Lint, test & build` = **pass** (`gh pr checks 32 --watch`), on PR head `73225fa`. CI is the test authority; no local suite was run.

## Reviewer verdicts (pass 1)

### compliance-reviewer — verdict: **compliant** (0 violations)

All four pinned TCs exist and are translated faithfully from `balances-settlement.md` §2 — no test weakened, skipped, or re-interpreted; no `.skip`/`.only`/`.todo`/conditional assertions.

| TC | Plan entry | Faithfulness |
|----|-----------|--------------|
| TC-BAL-016 | §2 L177–186 (settle #1 by payer, #2 by recipient, undo #1, undo #2; `sumKurus===0` after every step) | Faithful; exact per-member values additionally asserted (strengthening). |
| TC-BAL-017 | §2 L188–197 (A-only expense, B all-zero before/after A's settlement) | Faithful; group-scoping exercised via balances and settle-up views. |
| TC-BAL-019 | §2 L210–215 (settle two → undo one → re-settle → undo; direct `settled_payments` read; nothing deleted/rewritten) | Faithful; 3 retained rows, new id on re-settle, status/`undoneAt` correct. |
| TC-BAL-020 | §2 L217–222 (both write routes without `X-Requested-With` as a party → 403 `CSRF_HEADER_MISSING`, no side effect) | Faithful; no side-effect proven via view + direct table read. |

Architecture adherence: endpoints, `{outstanding[],settled[]}`/`{settlement}` shapes, `sumKurus`, `403 CSRF_HEADER_MISSING`, and `settled_payments` fields match 03-api-design §1/§3c/§4, 01 §8.2, 02-data-model §5.2/§7. No gold-plating.

### code-reviewer — verdict: **approve** (0 blockers, 0 should-fix, 2 nits)

Verified against the implementation: TC-BAL-016's per-member balances recomputed by hand at every step (all match `BalancesService`); TC-BAL-019's sequence valid against service precedence and the re-settle hits the regenerated plan (no `SUGGESTION_STALE`), `third.id !== first.id` genuine; TC-BAL-020 exercises the global CSRF middleware registered before Nest guards; TC-BAL-017 group-scoping via both views. Deterministic (fixed fixtures, timestamps self-compared, no randomness/timers; integration project pinned `fileParallelism:false`/`maxWorkers:1`), clean teardown, scope holds, no gold-plating.

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| CODE-1 | nit | `tc-bal-019-retention.spec.ts:104` | `expect(row.groupId).toBe(group.id)` is vacuous — the `findMany` at :96 already filters `where: { groupId: group.id }`, so it can never fail; retention coverage is carried by the id-set/status/timestamp checks. | open, non-blocking |
| CODE-2 | nit | `tc-bal-017-cross-group-isolation.spec.ts:78,107` | The all-zero `for (…values())` loops duplicate the `.get(alice.id)`/`.get(bob.id)` assertions on the preceding lines. Harmless redundancy. | open, non-blocking |

### security-reviewer — verdict: **approve** (0 findings, 0 critical/high/medium/low)

Test-only diff; no production code changed. No injection path, no AuthN/AuthZ weakening, no committed secrets (fixture `TEST_PASSWORD`/`*@test.local` are throwaway constants; cookies stay in-memory), no PII/log leakage, no new deps/config. TC-BAL-020 genuinely proves the CSRF guard rejects both settlement write routes pre-handler: `api()` injects no default headers, both routes hit as parties, and side-effect-freedom is checked via the API view **and** a direct `settled_payments` read.

- **SEC-OBS-1** (low, non-blocking, coverage nit): TC-BAL-020 tests only a *missing* header, not a *wrong* value (`X-Requested-With: evil`). The middleware does exact-value matching so it would also 403, but the wrong-value case is untested. Coverage gap, not a vulnerability — the documented contract is covered.
- Pre-existing debt (noted, not caused by this diff): `truncateAllTables` uses `$executeRawUnsafe` on table names sourced from `pg_tables` (not user input, not exploitable).

## Consolidation

| ID | Severity | Source | Status |
|---|---|---|---|
| CMP-1 | — (no violation) | compliance | n/a — compliant |
| CODE-1 | nit | code | open, non-blocking |
| CODE-2 | nit | code | open, non-blocking |
| SEC-OBS-1 | low (coverage nit) | security | open, non-blocking |
| SEC pre-existing `$executeRawUnsafe` | info | security | noted, not caused by diff |

No blocking findings. No disputes. No upstream-routing items.

## Mergeability check (pass 1)

- Open **blocking** findings: **none** (any compliance violation / code blocker / critical-high security finding). CODE-1/CODE-2 nits and SEC-OBS-1 low coverage nit never block.
- CI: **green** on `73225fa`.
- ⇒ **PR is MERGEABLE on pass 1** (clean first pass; loop ends early — no fixer dispatch, `cmp` cap untouched).

## Verdict

Zero open blocking findings and green CI on `73225fa` — **MERGEABLE on pass 1**. Non-blocking items recorded for the user/backlog: CODE-1, CODE-2 (cosmetic nits), SEC-OBS-1 (wrong-value CSRF coverage nit), and the pre-existing `$executeRawUnsafe` observation.

> This artifact commit is docs-only and advances the PR head past `73225fa`; CI will re-run on the new head. The pass-1 verdict above is for `73225fa`, the commit all three lanes reviewed. Dispatched by the user: **merge when ready** — after the user confirms the merge, the ticket file's Status becomes `done` and the board is regenerated.
