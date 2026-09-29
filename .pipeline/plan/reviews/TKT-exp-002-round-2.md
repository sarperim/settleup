# Review Round 2 — PR #23 (TKT-exp-002: Log an expense — Ledger module create endpoint)

PR: https://github.com/sarperim/settleup/pull/23
Branch: `tkt-exp-002` → `dev` · Head at this pass: `e401b9e` (fixer round 1) · Base: `3e7d5c6` (= `origin/dev` tip)
Preceding: round-1 artifact `.pipeline/plan/reviews/TKT-exp-002-round-1.md` (head `2a8b510`, artifact commit `aca27f8`).
Review date: 2026-09-29 · Isolated checkout `/tmp/opencode/worktrees/rl-tkt-exp-002` (clean at every gate).
Fix commit under review: `code-review`/`security`/`compliance` verified `git diff aca27f8..e401b9e` — exactly `apps/api/src/ledger/dto/create-expense.dto.ts` (new `ExactAmountsRangeConstraint` `@Validate` on `exactAmounts`; `@ArrayUnique` on `participantIds`) and new `apps/api/test/integration/ledger-input-hardening.spec.ts` (6 tests).

Pass goal: verify the round-1 blocking/should-fix findings are resolved AND check the fix commit for new problems. All three lanes dispatched in parallel; lanes did not run the suite (CI is the authority).

## Reviewer verdicts (pass 2)

| Lane | Verdict | Blocking |
|------|---------|----------|
| compliance | **COMPLIANT** | no — all round-1 fixer findings resolved; NEW-1 (low), NEW-2 (observation) |
| code | **REQUEST CHANGES** | **yes — N-1 (blocker)**: new unhandled `500 INTERNAL` on non-iterable `participantIds` |
| security | **APPROVE** | no — S-1a/b/c/d genuinely closed; new S-2a (medium, non-blocking) |

## Round-1 findings — resolution

| ID | Round-1 severity | Pass-2 status |
|----|------------------|---------------|
| S-1a / K-1 | high (blocking) | **RESOLVED** — DTO fence rejects negative/oversized `exactAmounts`; probe: `{attacker:-N, victim:+N}` @ amount 0 → `400 VALIDATION_FAILED`, 0 persisted; §5.4 `shareKurus ≥ 0` restored. |
| S-1b | medium | **RESOLVED** — `Number.isInteger` rejects fractional values. |
| K-2 / S-1c | should-fix/low | **RESOLVED** — `@ArrayUnique` → 400; P2002→500 route removed. |
| K-3 / S-1d | nit/low | **RESOLVED for EXACT** — unknown keys rejected; residual NEW-1 (non-EXACT ignores the object; no persistence path). |
| K-4 | nit | **RESOLVED** — factory consumed by the control row. |
| K-5/CMP-N1, K-6 | nits | **DISPUTED** by the fixer as not-worth-churn — acceptable, non-blocking. |
| CMP-S1/D1/D2/C4, S-1e | upstream/obs | unchanged, routed upstream/non-blocking. |

## New findings (pass 2)

| ID | Severity | Source | Location | Status | Summary |
|----|----------|--------|----------|--------|---------|
| N-1 | **blocker (blocking)** | code | `create-expense.dto.ts:78` | open | `new Set(dto.participantIds ?? [])` throws `TypeError: … is not iterable` when `@Validate` runs after `@IsArray` already failed and `participantIds` is a JSON number/boolean/object (with `splitType: EXACT` + `exactAmounts`). class-validator does not catch custom-constraint exceptions → `500 INTERNAL` + stack log. A **new regression** introduced by the round-1 fix (pre-fix the same body was 400); contradicts the constraint's "never a 500" contract. Reachable by any authenticated group member; no corruption/data exposure. Fix: guard `Array.isArray`. |
| S-2a | medium (non-blocking) | security | same | open | Same defect, independently reproduced through the real HTTP path (`participantIds` = `12345`/`{}`/`true` → 500, generic envelope, 0 persisted). Rated medium (no corruption). |
| NEW-1 | low | compliance | `create-expense.dto.ts:68-70` | open | Under a non-EXACT split an `exactAmounts` object is ignored entirely (constraint returns true; engine never reads it) — deterministic-contract residual, no persistence path. |
| NEW-2 | observation | compliance | `create-expense.dto.ts` vs data-model §9 | open | §9 names `LedgerService` as enforcement point; the fence enforces at the DTO (upstream). Sanctioned by the round-1 routing; no non-HTTP caller exists. Note only. |

**Lane conflict recorded:** the code lane rates N-1 a **blocker**; the security lane rates the identical defect **medium/non-blocking**. Per the standing rule ("blocking = any code-review blocker, any critical/high security finding"), the code-review blocker governs → pass 2 is NOT clean. The disagreement is moot in practice: the fix is a one-line guard.

## Mergeability (pass 2)

Open blocking findings: **ONE — N-1 (code-review blocker).** Compliance compliant; security approves with a medium; code requests changes with a blocker.

**RESULT: NOT MERGEABLE on pass 2 — fixer round 2 dispatched** (the final allowed fix round). Routing: guard the `participantIds` coercion (`Array.isArray(...) ? … : []`) and add a regression row (non-array `participantIds` + EXACT + `exactAmounts` → 400, no write); NEW-1/N-2 optional/non-blocking.

## Suite / CI evidence (pass-2 head `e401b9e`)

- `DATABASE_URL=…/settleup_e2r_x pnpm test` — **85 files / 253 tests passed** (was 84/247; +1 file/+6 tests).
- CI run [36533018680](https://github.com/sarperim/settleup/actions/runs/36533018680) "Lint, test & build" **SUCCESS** on `e401b9e`.
- Security probes: real HTTP path against `settleup_e2r_s`; all S-1 vectors rejected, 0 persisted. Code probe: compiled DTO against class-validator 0.14.4.
