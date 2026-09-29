# Review Round 1 — PR #30 (TKT-bal-003: Settle-up view — outstanding plan + settled facts)

PR: https://github.com/sarperim/settleup/pull/30
Branch: `tkt-bal-003` → `dev` · Head at review: `85e9704` · Base: `dev` tip `39eccf0`
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/review-TKT-bal-003` — branch `review/tkt-bal-003` at `85e9704` (= PR head; tree clean at review start).

> **Lane dispatch.** This environment exposes an `opencode run --agent` subagent mechanism; the three lanes were dispatched as concurrent subagents (`compliance-reviewer`, `code-reviewer`, `security-reviewer`) against the isolated checkout and returned findings + verdicts recorded below. Consolidation, blocking classification and mergeability rules are the review lead's.

Scope context: per `.pipeline/plan/tickets/TKT-bal-003.md` — **extend** `apps/api/src/settlement/**` with `GET /api/groups/:groupId/settlements` returning `{ outstanding, settled }`: `outstanding` computed **live** from the derived balances via TKT-bal-001's suggestion engine (D-ARCH-004 / strategy G-3 — derived, never stored), `settled` = the stored SETTLED/UNDONE `SettledPayment` facts distinguished by `undoneAt`; register the suggestion-engine provider wiring deferred from TKT-bal-002; prove TC-BAL-007 / TC-BAL-008 / TC-BAL-018. Must NOT touch `settlement/engine/**`, `ledger/**`, `groups/**`, `apps/web/**`, `packages/shared/src/**`, or root manifests.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three lanes run.** Reasoning recorded:

- The diff ships **executable API logic**: a new `SettlementsService` (Prisma reads + derived-plan computation), a new `SettlementsController` route, a new NestJS DI provider (`SUGGESTION_ENGINE`), and module wiring. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- **Test files are touched** (three new integration specs).
- The ticket **pins automated acceptance TCs** (TC-BAL-007, TC-BAL-008, TC-BAL-018) — the compliance lane must verify coverage.
- The endpoint exposes group-scoped financial data and membership display names — squarely in the security lane's remit.

## Scope fence — verified held (review lead, independently)

`git diff --name-status origin/dev...HEAD` — exactly 8 files, no renames, +603/−6:

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-bal-003.md` | status/PR/evidence lines only (sanctioned ticket-flip convention) |
| `apps/api/src/settlement/settlement.module.ts` | registers controller + service + `SUGGESTION_ENGINE` provider |
| `apps/api/src/settlement/settlements.controller.ts` | new — `GET …/settlements`, class-level `GroupMemberGuard` |
| `apps/api/src/settlement/settlements.service.ts` | new — live outstanding plan + settled facts |
| `apps/api/src/settlement/suggestion-engine.provider.ts` | new — DI-token wiring of the pure TKT-bal-001 engine |
| `apps/api/test/integration/tc-bal-007-settle-up-outstanding.spec.ts` | new |
| `apps/api/test/integration/tc-bal-008-all-zero-group.spec.ts` | new |
| `apps/api/test/integration/tc-bal-018-structural-suggestions.spec.ts` | new |

Declared fence re-checked by the review lead and the compliance lane:

- `git diff … -- apps/api/src/settlement/engine apps/api/src/ledger apps/api/src/groups apps/web packages/shared/src package.json pnpm-lock.yaml` → **empty**. The fence holds exactly.

## CI gate

`gh pr checks 30 --watch` reported no associated checks (the GitHub check-run rollup was empty), so the review lead gated directly on the Actions run for this PR's head: run [`36560257750`](https://github.com/sarperim/settleup/actions/runs/36560257750) — `pull_request`, `headSha=85e9704…` = current PR head — **success**, `Lint, test & build` green (unit & integration + E2E smoke pass). CI is the test authority; no local suite was run.

## Reviewer verdicts (pass 1)

### compliance-reviewer — verdict: **compliant**

All three acceptance TCs exist as integration specs and match the pinned plan entries:

| TC | Diff location | Fidelity |
|---|---|---|
| TC-BAL-007 | `tc-bal-007-settle-up-outstanding.spec.ts` | standing fixture (9000 EXACT 3000/3000/3000); read as carol; key set exactly `{outstanding, settled}`; plan `{bob→alice 3000, carol→alice 3000}`; `{id, displayName}` refs, no email; `settled: []` |
| TC-BAL-008 | `tc-bal-008-all-zero-group.spec.ts` | no-expense group + `{alice:5000}` single-participant net-zero group; both `outstanding: []`, all `balanceKurus 0`, `sumKurus 0` |
| TC-BAL-018 | `tc-bal-018-structural-suggestions.spec.ts` | random-remainder fixture (10000 EQUAL) + dave at 0; two identical reads, plan zeroes balances (test-side), zero-balance member excluded, `≤ members−1`, positive amounts; content not asserted (T5) |

Test integrity: no TC weakened/skipped/re-interpreted; extra assertions strengthen. Architecture: DI-token wiring (§3 rule 3); `outstanding` live and never stored (D-ARCH-004/G-3); zero balances filtered (BR-BAL-005); route group-scoped behind `GroupMemberGuard` (§8.1 / FR-BAL-010); `settled` distinguishes SETTLED/UNDONE via `undoneAt` (§5.2). No gold-plating. Noted (not violations): `ref()` `displayName: ''` fallback unreachable; populated `settled` path belongs to TKT-bal-004.

### code-reviewer — verdict: **approve** (0 blockers; 3 nits)

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| CODE-1 | nit | `settlements.service.ts:78-79` | `ref()` fallback renders an unknown party as `{ id, displayName: '' }` — dead defensive code that would mask a data-integrity violation; trust the permanent-membership invariant (BR-BAL-008) or throw. | open, non-blocking |
| CODE-2 | nit | `suggestion-engine.provider.ts:31-35` | `PureSuggestionEngine` delegates without the engine's `options.logger`, so the >12-nonzero greedy-fallback warning is swallowed; moot at the ≤8-member scale (threshold 12) but discards a designed observability hook. | open, non-blocking |
| CODE-3 | nit | `tc-bal-008-all-zero-group.spec.ts:103-104` | `expect(alice.id).toBeDefined(); expect(carol.id).toBeDefined();` are dead assertions existing only to consume the destructured `carol`; drop `carol` and the lines. | open, non-blocking |

Conventions note: no `AGENTS.md` in repo; conventions inferred from neighboring `balances.*`, `random-source.ts`, and existing `tc-bal-*` specs. Response shape matches `03-api-design.md` §3c; wiring sound (`PrismaModule` global, module registered, guard identical to `BalancesController`); reads read-only, no race.

### security-reviewer — verdict: **approve** (0 findings)

| Area | Result |
|---|---|
| Injection | Clean — `groupId` route param type-checked in guard, used only as parameterized Prisma `where`; no raw SQL/command/FS/HTML |
| AuthN/AuthZ | Correct — global `AuthGuard` then controller-level `GroupMemberGuard`; non-members get opaque 404 (FR-GRP-008, SC-006); identical to `BalancesController`; any member may read (FR-BAL-010) |
| Secrets / dependencies / config / crypto | None |
| Data exposure / PII | Clean — `SettlementPartyView` exposes only `{ id, displayName }`, never email (FR-ACC-008); specs assert no `@` |
| Resource exhaustion | Acceptable — group-scoped `findMany` per API §3c (unpaginated by design), NFR-BAL-005 retention at ≤8-member scale (NFR-BAL-003); no NFR demands a rate limit here |

Non-blocking observation: the `ref()` fallback would leak only an internal id (no PII) if it ever fired; recommend failing loudly.

## Consolidation

| ID | Severity | Source | Location | Status |
|---|---|---|---|---|
| CODE-1 | nit | code-reviewer | `settlements.service.ts:78-79` (`ref()` fallback) | open, non-blocking |
| CODE-2 | nit | code-reviewer | `suggestion-engine.provider.ts:31-35` (swallowed fallback warning) | open, non-blocking |
| CODE-3 | nit | code-reviewer | `tc-bal-008-…spec.ts:103-104` (dead assertions) | open, non-blocking |

Compliance: **zero violations.** Security: **zero findings.** No dispute, no escalation, no routing items.

## Mergeability check

- Open **blocking** findings: **none.** Blocking = compliance violation / code-review blocker / critical-or-high security finding. All findings above are nits.
- CI: **green** on the PR's latest commit `85e9704`.
- ⇒ **PR is MERGEABLE.**

## Verdict

Zero open blocking findings and green CI on `85e9704` — **MERGEABLE on pass 1** (clean pass; loop ends early; no fixer dispatch). Non-blocking nits CODE-1…CODE-3 are recorded for the user/backlog.

> This artifact commit itself is docs-only and advances the PR head past `85e9704`; CI will re-run on the new head. The review verdict above is for `85e9704`, the commit all three lanes reviewed.
