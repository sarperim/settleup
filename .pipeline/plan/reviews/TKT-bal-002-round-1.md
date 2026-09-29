# Review Round 1 — PR #29 (TKT-bal-002: Balance engine & balances endpoint (derived, D-ARCH-004))

PR: https://github.com/sarperim/settleup/pull/29
Branch: `tkt-bal-002` → `dev` · Head at review: `b700e19` · Base: `dev` tip `0d6df72`
Review date: 2026-09-29
Isolated checkout: `/tmp/opencode/worktrees/review-TKT-bal-002` — branch `review/tkt-bal-002` at `b700e19` (= PR head; tree clean at review start).

> **Lane dispatch.** This environment exposes an `opencode run --agent` subagent mechanism; the three lanes were dispatched as concurrent subagents (`compliance-reviewer`, `code-reviewer`, `security-reviewer`) against the isolated checkout and returned findings + verdicts recorded verbatim below. Consolidation, blocking classification and mergeability rules are the review lead's.

Scope context: per `.pipeline/plan/tickets/TKT-bal-002.md` — create the C5 settlement module root files (`apps/api/src/settlement/{settlement.module,balances.controller,balances.service}.ts`), expose `GET /api/groups/:groupId/balances` behind `GroupMemberGuard`, derive per-`(group, member)` balances on demand (integer kuruş, zero-sum, always group-filtered, nothing materialized — D-ARCH-004), read expenses/shares via `LedgerReadService` only, and prove TC-BAL-006 / TC-EXP-023 / TC-EXP-024. Parallel group **P-7** with TKT-bal-001 (PR #28) and TKT-exp-006 — declared fence: `apps/api/src/settlement/engine/**` untouched.

## Blast radius gate (pass-1 dispatch decision)

**Classification: FULL — all three lanes run.** Reasoning recorded:

- The diff ships **executable API logic**: a new `BalancesService` (Prisma reads + balance folding), a new NestJS controller/route, and a new module registered in `app.module.ts`. Not presentation-only, not non-executable, not comment/formatting-only — every LOW condition fails.
- **Test files are touched** (three new integration specs).
- The ticket **pins automated acceptance TCs** (TC-BAL-006, TC-EXP-023, TC-EXP-024) — the compliance lane must verify them.
- The endpoint exposes group-scoped financial data and membership display names — squarely in the security lane's remit.

## Scope fence (P-7 constraint) — verified held (review lead, independently)

`git diff --name-status (merge-base dev HEAD)...HEAD` — exactly 8 files, no renames, +588/−5:

| File | Change |
|---|---|
| `.pipeline/plan/tickets/TKT-bal-002.md` | status/PR/evidence lines only (sanctioned ticket-flip convention) |
| `apps/api/src/app.module.ts` | registers `SettlementModule` (necessary wiring; not on the must-not-touch list) |
| `apps/api/src/settlement/balances.controller.ts` | new — `GET …/balances`, class-level `GroupMemberGuard` |
| `apps/api/src/settlement/balances.service.ts` | new — derived balance engine |
| `apps/api/src/settlement/settlement.module.ts` | new — balance components only |
| `apps/api/test/integration/tc-bal-006-balances-view.spec.ts` | new |
| `apps/api/test/integration/tc-exp-023-zero-sum-expense-ops.spec.ts` | new |
| `apps/api/test/integration/tc-exp-024-50-expense-ledger.spec.ts` | new |

Declared fence independently re-checked by the review lead and by the compliance lane:

- `git diff … -- apps/api/src/settlement/engine` → **empty** (the engine subdir does not exist on this branch; TKT-bal-001's territory untouched; no commits touch it).
- `git diff … -- apps/api/src/ledger apps/api/src/groups apps/web packages/shared/src apps/api/prisma package.json pnpm-lock.yaml` → **empty**.
- The fence holds exactly.

## CI gate

`gh pr checks 29 --watch` → `Lint, test & build  pass  2m37s` on run `36553956596`, `headSha=b700e19…` = current PR head. Green. (An earlier run `36553933697` was cancelled — superseded, not a failure.) CI is the test authority; no local suite was run.

## Reviewer verdicts (pass 1)

### compliance-reviewer — verdict: **compliant**

TC coverage, faithfully translated, all three present:

| TC | Diff location | Fidelity |
|---|---|---|
| TC-BAL-006 | `tc-bal-006-balances-view.spec.ts` | 200; key set exactly `['balances','sumKurus']`; 3 standing-fixture members alice +6000 / bob −3000 / carol −3000; `member` key set `['displayName','id']` with email-absence guard; `sumKurus===0` |
| TC-EXP-023 | `tc-exp-023-zero-sum-expense-ops.spec.ts` | all 5 create rows + all 5 edit rows + delete of edited & unedited; `sumKurus===0` after each parameter |
| TC-EXP-024 | `tc-exp-024-50-expense-ledger.spec.ts` | 50 expenses, rotating payer, EQUAL/EXACT alternating, `E01…E50`; per-expense shares sum, newest-first, `sumKurus===0`, single-list shape |

Test integrity: no skip/only/todo; no pre-existing test modified or deleted. Architecture: 01 §3 rule 1 (expenses/shares only via `LedgerReadService`; C5 reads its own `settled_payments`), 01 §5.2 / 02 §7 formula, group-scoped guard, module skeleton confined to balance components — all match. No gold-plating.

### code-reviewer — verdict: **approve**

- **should-fix — test quality** — `apps/api/test/integration/tc-exp-023-zero-sum-expense-ops.spec.ts:58`
  TC-EXP-023 is one monolithic `it` running ~12 sequential ops against shared accumulating state, not the parameterized matrix the plan describes. An early failure skips later parameters and the message does not identify which matrix row broke, under-reporting coverage on red runs. Suggested fix: `it.each` (or one `it` per parameter). Behavior otherwise correct.
- **nit — convention** — `apps/api/src/settlement/balances.service.ts:49`
  `const SETTLED = 'SETTLED'` re-declares the Prisma `PaymentStatus` enum; prefer the generated enum.
- **nit — structure** — `apps/api/src/settlement/balances.service.ts:64`
  Ticket says "one Prisma aggregation per group"; implementation issues four `Promise.all` reads. Correct, bounded, per-group — no change required for correctness (see routing item).
- **nit — robustness (latent only)** — `apps/api/src/settlement/balances.service.ts:88`
  `sumKurus` reduces over current members only; if a member could ever be removed while their facts remained, the always-zero guarantee could break. No member-removal route exists today.

### security-reviewer — verdict: **approve**

AuthN/AuthZ, group scoping/cross-group leakage, `groupId` injection, PII/data exposure, secrets/config: all **no finding** (global `AuthGuard` → 401; `GroupMemberGuard` fails closed 404; every read filtered by the same `groupId`; `groupId` only reaches Prisma `where`; response carries no email/PII).

- **low — unbounded in-memory ledger read per request** — `apps/api/src/settlement/balances.service.ts:64-82`
  Loads the group's entire expense + share + settled-payment sets and folds in JS rather than aggregating. A member can repeatedly call the route; cost grows with the group's ledger and there is no rate limit. Suggested fix: `prisma.expense.groupBy` / share & payment aggregates (constant memory) or an explicit cap. Not blocking under the ≤ 8-member small-group scale assumption.
- **low — no regression spec for the privacy boundary** — `tc-bal-006-balances-view.spec.ts` (absent case)
  No added test asserts the non-member `404` / cross-group isolation that SC-006 / FR-BAL-010 and the guard claim. Guard is present and correct today; the protection is untested. Suggested fix: add a `dave` (registered non-member) and a foreign-group member → `404` case.

Pre-existing/deferred (not blocking): `LedgerReadService` intentionally has no cap — a design choice shared with the ledger ticket.

## Consolidation

| ID | Severity | Source | Location | Status |
|---|---|---|---|---|
| C1 | should-fix | code-reviewer | `tc-exp-023-…spec.ts:58` (parameterization) | open, non-blocking |
| C2 | nit | code-reviewer | `balances.service.ts:49` (`SETTLED` literal) | open, non-blocking |
| C3 | nit | code-reviewer | `balances.service.ts:64` ("one aggregation" wording) | open, non-blocking |
| C4 | nit | code-reviewer | `balances.service.ts:88` (latent zero-sum on member removal) | open, non-blocking |
| S1 | low | security-reviewer | `balances.service.ts:64-82` (unbounded in-memory read) | open, non-blocking |
| S2 | low | security-reviewer | privacy-boundary regression spec missing | open, non-blocking |
| R1 | routing | compliance-reviewer | 02 §7 "one `queryRaw`" vs rule-1 `LedgerReadService` fold | routing item, not a PR defect |

Compliance: **zero violations.** No dispute, no escalation.

## Mergeability check

- Open **blocking** findings: **none.** Blocking = compliance violation / code-review blocker / critical-or-high security finding. All findings above are should-fix, nit, or low.
- CI: **green** on the PR's latest commit `b700e19`.
- ⇒ **PR is MERGEABLE.**

## Routing items (non-blocking, downstream)

- **R1 — doc consistency (architect / planner).** The ticket and 02 §7 use "one Prisma aggregation / `queryRaw` per group"; 01 §3 rule 1 (a superior permanent interaction rule, and the ticket's own mandate) forbids C5 from reading `expenses`/`expense_shares` directly. The implementation correctly resolves the tension by folding group-scoped `LedgerReadService` reads in one pass per group. Worth a one-line wording alignment in 02 §7 so the next reader does not re-litigate it. **Not a PR defect and not a fix-loop item.**

## Verdict

Zero open blocking findings and green CI on `b700e19` — **MERGEABLE on pass 1** (clean pass; loop ends early). Non-blocking items C1–C4/S1–S2 are recorded for the user/backlog; R1 routes to the architect/planner.

> This artifact commit itself is docs-only and pushes the PR head past `b700e19`; CI will re-run on the new head. The review verdict above is for `b700e19`, the commit all three lanes reviewed.
